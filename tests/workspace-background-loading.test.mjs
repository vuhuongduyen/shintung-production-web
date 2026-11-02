import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {createBackgroundRefresh} from '../lib/client-background-refresh.mjs';

const source=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function effects(name){const result=[];function visit(node){if(ts.isFunctionDeclaration(node)&&node.name?.text===name){function scan(item){if(ts.isCallExpression(item)&&item.expression.getText(ast)==='useEffect')result.push(item.arguments[0].getText(ast));ts.forEachChild(item,scan);}scan(node);}else ts.forEachChild(node,visit);}visit(ast);return result;}
const endpoints=['/api/site-session','/api/pending-approvals','/api/active-viewers'];
const rootEffects=effects('Home').filter(code=>endpoints.some(path=>code.includes(path)));
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function harness(session={kind:'account',login:'alice'}){
 const window=new EventTarget(),document=new EventTarget();document.hidden=false;const timers=new Map();let sequence=0;window.setInterval=fn=>{timers.set(++sequence,fn);return sequence;};window.clearInterval=id=>timers.delete(id);
 const requests=[],updates={viewers:[],groups:[],count:[],identity:[]};const identityRef={current:{authenticated:true,session}};
 const context={module:{exports:{}},window,document,LOCAL_TEST:false,AbortController,accountKey:session.kind+':'+session.login,identityRef,createBackgroundRefresh,workspaceIdentityKey:id=>id.authenticated?`${id.session?.kind}:${id.session?.login}`:'',restoredLoginSession:user=>({kind:'account',...user}),receiveIdentity:value=>{identityRef.current=value;updates.identity.push(value);},bomChangeHistory:[],setNotificationGroups:value=>updates.groups.push(value),setNotificationCount:value=>updates.count.push(value),setActiveViewers:value=>updates.viewers.push(value),viewersRefresh:{current:async()=>{}},fetch:(path,init)=>new Promise(resolve=>requests.push({path,init,resolve:data=>resolve({ok:true,json:async()=>data})}))};
 const cleanups=rootEffects.map(code=>{vm.runInNewContext(ts.transpileModule('module.exports='+code,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);return context.module.exports();});
 return {window,document,timers,requests,updates,identityRef,context,dispose:()=>cleanups.forEach(cleanup=>cleanup?.())};
}

test('session, approval and viewer effects have one root owner, with no per-menu polling',()=>{
 assert.equal(rootEffects.length,3);
 const workspaceEffects=effects('WorkspaceSession');
 for(const path of endpoints.slice(1))assert.equal(workspaceEffects.filter(code=>code.includes(path)).length,0,path);
 const sessionEffects=workspaceEffects.filter(code=>code.includes('/api/site-session'));
 assert.equal(sessionEffects.length,1);assert.ok(sessionEffects[0].includes('identity.authenticated'));
 assert.equal(sessionEffects[0].includes('setInterval'),false,'only initial login restoration remains in the workspace');
});

test('actual root effects coalesce wake/timer overlap and do no background requests while hidden',async()=>{
 const h=harness();assert.equal(h.timers.size,3);assert.deepEqual(h.requests.map(r=>r.path),endpoints.slice(1));
 h.window.dispatchEvent(new Event('focus'));h.document.dispatchEvent(new Event('visibilitychange'));
 for(const tick of h.timers.values())tick();
 assert.equal(h.requests.length,3);assert.equal(h.requests.filter(r=>r.path==='/api/site-session').length,1);
 h.document.hidden=true;for(const tick of h.timers.values())tick();assert.equal(h.requests.length,3);
 for(const request of h.requests)request.resolve(request.path==='/api/site-session'?{authenticated:true,user:{login:'alice',grants:['new permission']}}:request.path==='/api/active-viewers'?{viewers:[{login:'alice'}]}:{groups:[]});
 await flush();assert.equal(h.updates.identity.at(-1).session.grants[0],'new permission');h.dispose();assert.equal(h.timers.size,0);
});

test('actual root effect callbacks reject old account responses even before effect cleanup',async()=>{
 const h=harness();h.window.dispatchEvent(new Event('focus'));
 h.identityRef.current={authenticated:true,session:{kind:'account',login:'bob'}};
 for(const request of h.requests)request.resolve(request.path==='/api/site-session'?{authenticated:true,user:{login:'alice'}}:request.path==='/api/active-viewers'?{viewers:[{login:'alice'}]}:{groups:[{entity:'sku',label:'Old account data',count:9}]});
 await flush();assert.deepEqual(h.updates,{viewers:[],groups:[],count:[],identity:[]});h.dispose();
});


test('Line A/B login and reload never start presence or approval polling; >45s wakes remain safe',async()=>{
 for(const line of ['A','B'])for(const phase of ['login','reload']){
  const h=harness({kind:'line',line,login:'LINE_'+line});
  assert.equal(h.requests.length,0,line+' '+phase);
  assert.equal(h.timers.size,1,'identity verification remains active');
  // Fire the 45s/60s clock callbacks and a hidden -> visible wake.
  h.document.hidden=true;for(const tick of h.timers.values())tick();
  assert.equal(h.requests.length,0);h.document.dispatchEvent(new Event('visibilitychange'));
  h.document.hidden=false;h.document.dispatchEvent(new Event('visibilitychange'));h.window.dispatchEvent(new Event('focus'));
  for(const tick of h.timers.values())tick();
  assert.deepEqual(h.requests.map(r=>r.path),['/api/site-session']);
  for(const r of h.requests)r.resolve({authenticated:false});
  await flush();h.dispose();assert.equal(h.timers.size,0);
 }
});

test('account -> Line transition stops stale wakes, aborts pending presence and removes all timers/listeners',async()=>{
 const h=harness();const presence=h.requests.find(r=>r.path==='/api/active-viewers');
 assert.ok(presence);assert.equal(presence.init.signal.aborted,false);
 h.identityRef.current={authenticated:true,session:{kind:'line',line:'B',login:'LINE_B'}};
 const count=h.requests.filter(r=>r.path==='/api/active-viewers').length;
 h.document.dispatchEvent(new Event('visibilitychange'));for(const tick of h.timers.values())tick();
 assert.equal(h.requests.filter(r=>r.path==='/api/active-viewers').length,count);
 h.dispose();assert.equal(presence.init.signal.aborted,true);assert.equal(h.timers.size,0);
 const stopped=h.requests.length;h.window.dispatchEvent(new Event('focus'));h.document.dispatchEvent(new Event('visibilitychange'));
 await h.context.viewersRefresh.current();assert.equal(h.requests.length,stopped);
 for(const r of h.requests)r.resolve(r.path==='/api/site-session'?{authenticated:false}:{viewers:[{login:'old-account'}],groups:[]});
 await flush();assert.equal(h.updates.viewers.length,0,'old response never restores stale viewer list');
});
