import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'vite';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
const dom=new JSDOM('<html><body></body></html>',{url:'https://synthetic.test'});
for(const key of ['window','document','HTMLElement','CustomEvent'])globalThis[key]=dom.window[key];
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
const vite=await createServer({appType:'custom',configFile:false,server:{middlewareMode:true,hmr:false}});
const {default:RecordFiles}=await vite.ssrLoadModule('/components/record-files.tsx');
const {ActionFeedbackHost}=await vite.ssrLoadModule('/components/action-feedback.tsx');
const sync=await vite.ssrLoadModule('/lib/data-sync.ts');
const originalFetch=globalThis.fetch,el=React.createElement;
after(async()=>{globalThis.fetch=originalFetch;await vite.close();dom.window.close();});
async function mount(){sync.clearClientReads('session');const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const component=id=>el(React.Fragment,null,el(ActionFeedbackHost),el(RecordFiles,{module:'synthetic',recordId:id}));await act(async()=>{root.render(component('first'));await new Promise(r=>setTimeout(r,0));});return{host,async render(id){await act(async()=>{root.render(component(id));await new Promise(r=>setTimeout(r,0));});},async close(){await act(async()=>root.unmount());host.remove();}};}
test('storage network rejection is caught and safely explained without exposing files or payload',async()=>{
 globalThis.fetch=async()=>{throw Error('SQL secret stack token');};const view=await mount();try{assert.match(view.host.querySelector('[role=alert]').textContent,/Không tải được danh sách tệp/);assert.doesNotMatch(view.host.textContent,/SQL|secret|stack|token/);assert.equal(view.host.querySelector('.record-files'),null);}finally{await view.close();}
});
test('initial forbidden storage resource remains hidden without disclosing metadata',async()=>{
 globalThis.fetch=async()=>Response.json({files:[{original_name:'private.pdf'}],error:'secret'},{status:403});const view=await mount();try{assert.equal(view.host.textContent,'');assert.equal(view.host.querySelector('input'),null);}finally{await view.close();}
});
test('server and malformed list failures show safe red feedback, not raw response errors',async()=>{
 for(const response of [()=>Response.json({error:'SQL private'},{status:500}),()=>Response.json({files:null})]){globalThis.fetch=async()=>response();const view=await mount();try{assert.ok(view.host.querySelector('[role=alert]'));assert.doesNotMatch(view.host.textContent,/SQL|private|Invalid file list/);}finally{await view.close();}}
});
test('unmounted and cancelled file reads cannot leave a late warning',async()=>{
 let finish;globalThis.fetch=()=>new Promise((resolve,reject)=>{finish=reject;});const view=await mount();await view.close();await act(async()=>finish(Error('late private error')));assert.equal(document.querySelector('[role=alert]'),null);
 globalThis.fetch=async()=>{const error=Error('cancel');error.name='AbortError';throw error;};const cancelled=await mount();try{assert.equal(cancelled.host.textContent,'');}finally{await cancelled.close();}
});
test('successful authorized storage read preserves scoped attachment rendering',async()=>{
 globalThis.fetch=async()=>Response.json({files:[{file_id:'one',original_name:'visible.pdf',module:'synthetic',record_id:'first',checksum:'x'},{file_id:'two',original_name:'other.pdf',module:'other',record_id:'first',checksum:'x'}]});const view=await mount();try{assert.match(view.host.textContent,/visible.pdf/);assert.doesNotMatch(view.host.textContent,/other.pdf/);assert.equal(view.host.querySelector('[role=alert]'),null);}finally{await view.close();}
});
