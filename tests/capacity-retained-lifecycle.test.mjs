import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {reconcileCapacityRefresh,isCapacityReadCancelled} from '../lib/capacity-snapshot-cache.mjs';
const source=fs.readFileSync(new URL('../components/weekly-capacity.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('weekly-capacity.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function effectContaining(marker){let found;function visit(node){if(ts.isCallExpression(node)&&node.expression.getText(ast)==='useEffect'&&node.arguments[0]?.getText(ast).includes(marker))found=node.arguments[0].getText(ast);ts.forEachChild(node,visit);}visit(ast);assert.ok(found);return ts.transpileModule('module.exports='+found,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;}
const readEffect=effectContaining('const refresh=async()=>'),latestEffect=effectContaining('const lookup=()=>');
const week='2026-10-12',nextWeek='2026-10-19';
const data=(revision=1)=>({week,revision,rows:[{week,line:'A',input:{value:`SYNTHETIC ${revision}`}}],permissions:{view:true,edit:true},employees:[]});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function harness({active=true,hidden=false,dirty=false,fetcher=async()=>({data:data(),updatedAt:100}),latestFetcher=async()=>({data:{week}}),source=readEffect}={}){
 const saved=data(),state={value:saved,rows:saved.rows,updatedAt:50,loading:false,error:'',permissions:false,selected:['A'],weekReady:true,lookupError:''};let calls=0,version=0;const events=new Map();
 const window={setInterval:fn=>{events.set('interval',fn);return 1;},addEventListener:(key,fn)=>events.set(key,fn),removeEventListener:key=>events.delete(key)};
 const document={hidden,addEventListener:(key,fn)=>events.set(key,fn),removeEventListener:key=>events.delete(key)};
 const ctx={module:{exports:{}},workspaceActive:active,scopeValid:true,weekReady:true,week,resetVersion:0,retryRevision:0,view:'calendar',calendarLine:'A',window,document,BroadcastChannel:undefined,clearInterval:()=>{},
  live:{current:{week,busy:false,dirty,calendarLine:'A'}},latestAttempt:{current:''},manualWeek:{current:false},capacityRestrictedError:()=>null,capacityResetVersion:()=>version,
  sessionLine:'A',retainedCapacity:()=>null,readAllocationWorkspace:async()=>null,readCapacityWeek:async()=>{calls++;return fetcher();},readCapacityLatest:async()=>{calls++;return latestFetcher();},isCapacityReadCancelled,isClientSessionReadCancelled:()=>false,reconcileCapacityRefresh,
  subscribeClientReadInvalidation:fn=>{events.set('mutation',()=>fn('mutation'));return ()=>events.delete('mutation');},
  setState:fn=>state.value=fn(state.value),setRows:value=>state.rows=typeof value==='function'?value(state.rows):value,setUpdatedAt:value=>state.updatedAt=value,setReadLoading:value=>state.loading=value,setReadError:value=>state.error=value,setPermissionsReady:value=>state.permissions=value,setComparison:()=>{},setSelected:fn=>state.selected=fn(state.selected),
  setWeekLookupError:value=>state.lookupError=value,setWeekReady:value=>state.weekReady=value,selectWeek:value=>state.selectedWeek=value,monday:value=>value,today:()=>week,
 };
 vm.runInNewContext(source,ctx);const cleanup=ctx.module.exports();return {state,ctx,events,cleanup,calls:()=>calls,changeScope:()=>version++};
}

test('actual Capacity effects defer hidden-workspace initial reads',async()=>{
 for(const source of [readEffect,latestEffect]){const h=harness({active:false,source});await tick();assert.equal(h.calls(),0);assert.equal(h.cleanup,undefined);}
});

test('browser-hidden initial latest/week reads wait for visibility before starting',async()=>{
 for(const source of [readEffect,latestEffect]){const h=harness({hidden:true,source});await tick();assert.equal(h.calls(),0);h.ctx.document.hidden=false;await h.events.get('visibilitychange')();await tick();assert.equal(h.calls(),1);h.cleanup();}
});

test('actual read effect retains data through slow refresh and transient error, clears after verified empty',async()=>{
 const delayed=deferred();let result=delayed.promise;const h=harness({fetcher:()=>result});const original=h.state.rows;
 await tick();assert.equal(h.state.loading,true);assert.equal(h.state.rows,original);delayed.reject(new Error('SYNTHETIC 503'));await tick();
 assert.equal(h.state.rows,original);assert.equal(h.state.updatedAt,50);assert.equal(h.state.error,'SYNTHETIC 503');assert.equal(h.state.permissions,false);
 result=Promise.resolve({data:{...data(2),rows:[]},updatedAt:200});await h.events.get('interval')();await tick();assert.equal(h.state.rows.length,0);assert.equal(h.state.updatedAt,200);assert.equal(h.state.error,'');h.cleanup();
});

test('dirty form keeps displayed edits, timestamp and original revision while current permissions revalidate',async()=>{
 const incoming={...data(9),permissions:{view:true,edit:false}},h=harness({dirty:true,fetcher:async()=>({data:incoming,updatedAt:200})});const original=h.state.rows;
 await tick();assert.equal(h.state.rows,original);assert.equal(h.state.value.revision,1);assert.equal(h.state.value.permissions.edit,false);assert.equal(h.state.updatedAt,50);assert.equal(h.state.permissions,true);h.cleanup();
});

test('late read completion cannot relabel an old week, overwrite a new scope, or affect unmounted view',async()=>{
 for(const mode of ['week','scope','unmount']){const delayed=deferred(),h=harness({fetcher:()=>delayed.promise});const original=h.state.rows;await tick();
  if(mode==='week')h.ctx.live.current.week=nextWeek;else if(mode==='scope')h.changeScope();else h.cleanup();
  delayed.resolve({data:data(20),updatedAt:200});await tick();assert.equal(h.state.rows,original);assert.equal(h.state.value.revision,1);if(mode!=='unmount')h.cleanup();
 }
});

test('slow latest metadata never overrides an explicitly chosen week or an unsaved form',async()=>{
 for(const mode of ['selected','dirty']){const delayed=deferred(),h=harness({source:latestEffect,latestFetcher:()=>delayed.promise});await tick();if(mode==='selected')h.ctx.manualWeek.current=true;else h.ctx.live.current.dirty=true;
  delayed.resolve({data:{week:nextWeek}});await tick();assert.equal(h.state.selectedWeek,undefined);assert.equal(h.state.weekReady,true);h.cleanup();
 }
});

test('calendar refresh keeps selection on the latest chosen line instead of captured old line',async()=>{
 const delayed=deferred(),h=harness({fetcher:()=>delayed.promise});await tick();h.ctx.live.current.calendarLine='B';delayed.resolve({data:data(3),updatedAt:200});await tick();assert.deepEqual(Array.from(h.state.selected),['B']);h.cleanup();
});
