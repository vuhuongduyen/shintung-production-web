import test,{after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://synthetic.test',pretendToBeVisual:true});
for(const name of ['window','document','HTMLElement','HTMLInputElement','HTMLSelectElement','HTMLButtonElement','MutationObserver','CustomEvent','Event','Element','Node','NodeFilter','getComputedStyle','requestAnimationFrame','cancelAnimationFrame','localStorage'])globalThis[name]=dom.window[name];
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
const originalBroadcastChannel=globalThis.BroadcastChannel;globalThis.BroadcastChannel=class{postMessage(){}close(){}};
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client'),el=React.createElement;
const rootPath=fileURLToPath(new URL('..',import.meta.url)).replace(/\/$/,'');
const vite=await createServer({appType:'custom',configFile:false,resolve:{alias:{'@':rootPath}},plugins:[{name:'expose-real-workspace-for-notice-tests',enforce:'pre',transform(source,id){if(id===`${rootPath}/app/page.tsx`)return `${source}\nexport {WorkspaceSession};`;}}],server:{middlewareMode:true,hmr:false}});
const {WorkspaceSession}=await vite.ssrLoadModule('/app/page.tsx');
const {ActionFeedbackHost}=await vite.ssrLoadModule('/components/action-feedback.tsx');
const feedback=await vite.ssrLoadModule('/lib/action-feedback.ts');
const {clearClientReads}=await vite.ssrLoadModule('/lib/data-sync.ts');
const originalFetch=globalThis.fetch;let forbidden=[],routes=[];
globalThis.fetch=async(input,init={})=>{const url=new URL(String(input),'https://synthetic.test'),method=init.method||'GET';if(method!=='GET'||url.origin!=='https://synthetic.test'){forbidden.push(`${method} ${url}`);throw Error('Only synthetic GET fixtures are permitted');}if(url.pathname==='/api/sku-capabilities')return Response.json({canConfirm:false});return Response.json({records:[],rows:[],files:[],groups:[],total:0,authenticated:false});};
const identity={language:'vi',authenticated:true,session:{kind:'account',login:'test.admin',name:'Synthetic Admin',detail:'Test',role:'ADMIN',isAdmin:true,grants:[]}};
const defaults={initialRoute:{view:'sku',child:null,planTab:'base'},identity,onIdentity:()=>{},onNavigate:route=>routes.push({...route,scope:feedback.actionFeedbackScope()}),active:true,scopeId:'test-navigation',workspaceTabs:null};
beforeEach(()=>{routes=[];forbidden=[];clearClientReads();feedback.clearActionFeedback();});
after(async()=>{globalThis.fetch=originalFetch;globalThis.BroadcastChannel=originalBroadcastChannel;await vite.close();dom.window.close();});
async function mount(overrides={}){const host=document.createElement('div');host.id='test-navigation';host.className='workspace-session';document.body.append(host);const root=createRoot(host);let props={...defaults,...overrides};const render=()=>root.render(el(React.Fragment,null,el(WorkspaceSession,props),el(ActionFeedbackHost)));await act(async()=>{render();await new Promise(r=>setTimeout(r,10));});return{host,async update(patch){props={...props,...patch};await act(async()=>render());},async close(){await act(async()=>root.unmount());host.remove();assert.deepEqual(forbidden,[]);}};}
const notice=()=>document.querySelector('[data-action-feedback]')||[...document.querySelectorAll('[role=alert]')].find(n=>n.textContent.includes('TEST NOTICE')||n.textContent.includes('Bạn không có quyền'));
async function show(text='TEST NOTICE'){await act(async()=>feedback.notifyActionFailure(text));assert.ok(notice(),'Mounted feedback host must display warning');}
async function click(node){assert.ok(node,'Expected real navigation button');await act(async()=>node.click());}
test('real WorkspaceSession parent navigation clears notice and preserves queued route merging',async()=>{const v=await mount();try{await show();const scope=feedback.actionFeedbackScope();await click([...v.host.querySelectorAll('.top-modules button')].find(b=>b.textContent.includes('Kế hoạch sản xuất')));assert.equal(notice(),undefined);assert.equal(routes.length,1);assert.equal(routes[0].view,'planning');assert.equal(routes[0].child,null);assert.equal(routes[0].planTab,'base');assert.ok(routes[0].scope>scope,'Scope changes before navigation callback');}finally{await v.close();}});
test('real WorkspaceSession child navigation clears notice and keeps child/planTab in one queued route',async()=>{const v=await mount({initialRoute:{view:'planning',child:null,planTab:'base'}});try{await show();await click([...v.host.querySelectorAll('.process-stage-main')].find(b=>b.textContent.includes('Demand Event')));assert.equal(notice(),undefined);assert.equal(routes.length,1);assert.equal(routes[0].view,'planning');assert.ok(routes[0].child);assert.equal(routes[0].planTab,'demand');}finally{await v.close();}});
test('active route/plan-tab and identity boundaries clear notices without navigation side effects',async()=>{const v=await mount();try{await show();await v.update({initialRoute:{view:'planning',child:null,planTab:'base'}});assert.equal(notice(),undefined);await show();await v.update({initialRoute:{view:'planning',child:null,planTab:'demand'}});assert.equal(notice(),undefined);await show();await v.update({identity:{...identity,session:{...identity.session,login:'test.other'}}});assert.equal(notice(),undefined);assert.deepEqual(routes,[]);}finally{await v.close();}});
test('retained inactive workspace does not dismiss current notice; activating a tab clears it',async()=>{const v=await mount({active:false});try{await show();await v.update({initialRoute:{view:'planning',child:null,planTab:'base'}});assert.ok(notice(),'Inactive tab changes must not clear active screen feedback');await v.update({active:true});assert.equal(notice(),undefined);}finally{await v.close();}});
test('same-route rerenders preserve a denied-navigation warning; accepted navigation clears it',async()=>{const v=await mount();try{await show('Bạn không có quyền mở chức năng này.');const scope=feedback.actionFeedbackScope();await v.update({identity:{...identity}});assert.ok(notice());assert.equal(feedback.actionFeedbackScope(),scope);await click([...v.host.querySelectorAll('.top-modules button')].find(b=>b.textContent.includes('Dữ liệu cơ bản')));assert.equal(notice(),undefined);}finally{await v.close();}});
