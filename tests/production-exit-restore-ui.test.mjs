import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';
// Own native browser-channel resources created by data-sync during mutation previews.
const NativeBroadcastChannel=globalThis.BroadcastChannel,channels=[];
if(NativeBroadcastChannel)globalThis.BroadcastChannel=class extends NativeBroadcastChannel{constructor(name){super(name);channels.push(this);}};
const dom=new JSDOM('<html><body></body></html>',{url:'https://synthetic.test'});
for(const k of ['window','document','HTMLElement','Event','CustomEvent','Node','localStorage'])globalThis[k]=dom.window[k];
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
const vite=await createServer({appType:'custom',configFile:false,resolve:{alias:{'@':new URL('..',import.meta.url).pathname}},optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,watch:null}});
const {default:Picker}=await vite.ssrLoadModule('/components/production-exit-restore.tsx');
const {translateToolbar}=await vite.ssrLoadModule('/components/standard-toolbar/translations.ts');
after(async()=>{await vite.close();for(const channel of channels)channel.close();globalThis.BroadcastChannel=NativeBroadcastChannel;dom.window.close();});
const date='2026-10-28',at=t=>`${date}T${t}:00+07:00`;
const props={event:{effectiveAt:at('09:00')},line:'B',employees:[{id:'N',name:'Loaned TEST',line:'C',active:true},{id:'M',name:'Other TEST',line:'B',active:true}],orders:[{id:'Y',lsxCode:'TEST PACK',processes:['PACKING']}],reports:[],events:[{id:'E',kind:'stage-work',stageReporting:true,stageAction:'start',sourceId:'Y',stageName:'PACKING',effectiveAt:at('09:00'),stageAfter:{people:['N','M'],status:'running'}}],schedules:[{line:'B',days:[{date,working:true,hcStart:'08:00',hcEnd:'17:00'}],roster:[{date,hc:['N','M'],hcWindows:{N:[[480,1020]]}}]}]};
test('borrowed worker assigned to PACKING remains selectable; selection and return-time controls update without network writes',async()=>{
 let value={mode:'continuous',employees:['N'],at:at('11:00')},calls=0;const fetch=globalThis.fetch;globalThis.fetch=async()=>{calls++;throw Error('No network expected');};
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const render=()=>act(async()=>root.render(React.createElement(Picker,{...props,value,onChange:v=>value=v,t:s=>s})));
 try{await render();const checkbox=host.querySelector('[aria-label="Khôi phục Loaned TEST"]');assert.ok(checkbox);assert.equal(checkbox.disabled,false);assert.equal(checkbox.checked,true);assert.match(host.textContent,/TEST PACK · PACKING/);
 await act(async()=>checkbox.click());assert.deepEqual(value.employees,[]);await render();await act(async()=>host.querySelector('[aria-label="Khôi phục Loaned TEST"]').click());assert.deepEqual(value.employees,['N']);
 await render();const mode=host.querySelector('select');await act(async()=>{mode.value='return';mode.dispatchEvent(new Event('change',{bubbles:true}));});await render();assert.equal(value.mode,'return');assert.ok(host.querySelector('[aria-label="Thời điểm quay lại · ngày"]'));assert.equal(calls,0);
 for(const lang of ['en','zh']){await act(async()=>root.render(React.createElement(Picker,{...props,value,onChange:v=>value=v,t:s=>translateToolbar(s,lang)})));assert.doesNotMatch(host.querySelector('strong').textContent,/Nhân viên thực tế/);}
 }finally{await act(async()=>root.unmount());host.remove();globalThis.fetch=fetch;}
});
test('actual correction dialog: cancel exit reveals staff restoration, preview then changed selection requires new preview',async()=>{
 for(const k of ['HTMLInputElement','MutationObserver','HTMLSelectElement','HTMLTextAreaElement','DocumentFragment','NodeFilter'])globalThis[k]=dom.window[k];
 globalThis.getComputedStyle=dom.window.getComputedStyle;globalThis.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
 const {default:Correction}=await vite.ssrLoadModule('/components/production-correction-orders.tsx');
 const orders=[...props.orders,{id:'X',line:'B',lsxCode:'TEST ASSY',processes:['ASSY','FINAL']}];
 const before={orderId:'X',stage:'ASSY',status:'running',people:['N'],startedAt:at('08:00'),at:at('08:00'),completed:0};
 const events=[...props.events,{id:'START',sourceId:'X',kind:'stage-work',stageReporting:true,stageAction:'start',stageName:'ASSY',effectiveAt:at('08:00'),stageAfter:before},{id:'EXIT',sourceId:'X',kind:'stage-work',stageReporting:true,stageAction:'complete',stageName:'ASSY',effectiveAt:at('09:00'),stageBefore:before,stageAfter:{...before,people:[],status:'done'}}];
 const requests=[],original=globalThis.fetch;globalThis.fetch=async(path,init)=>{requests.push(JSON.parse(init.body));return Response.json({expectedRevision:'fixture',eventChanges:[{operation:'cancel'}],reportImpacts:[{}],allocationImpacts:[{action:'Thu hồi phân công ghi nhầm',employees:['N'],label:'TEST PACK · PACKING',from:at('09:00')}]});};
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{await act(async()=>root.render(React.createElement(Correction,{orders,events,reports:[],employees:props.employees,schedules:props.schedules,allowed:true,refresh:async()=>{},showDetail:()=>{}})));
 const row=[...host.querySelectorAll('tr')].find(r=>r.textContent.includes('TEST ASSY'));await act(async()=>[...row.querySelectorAll('button')].find(b=>b.textContent==='Sửa').click());
 const dialog=document.querySelector('[role="dialog"]'),select=dialog.querySelector('select');await act(async()=>{select.value='ASSY';select.dispatchEvent(new Event('change',{bubbles:true}));});
 const exit=[...dialog.querySelectorAll('section')].find(s=>s.querySelector('h3')?.textContent.includes('Xuất trạm'));await act(async()=>[...exit.querySelectorAll('button')].find(b=>b.textContent==='Hủy thao tác').click());const optIn=dialog.querySelector('[aria-label="Phân bổ lại NV"]');assert.ok(optIn);assert.equal(optIn.checked,false);assert.equal(requests.length,0);assert.equal(dialog.querySelector('[aria-label="Cách khôi phục nhân viên"]'),null);await act(async()=>optIn.click());assert.ok(dialog.querySelector('[aria-label="Cách khôi phục nhân viên"]'));assert.ok(dialog.querySelector('[aria-label="Khôi phục Loaned TEST"]'));assert.equal(dialog.querySelectorAll('textarea').length,0);
 assert.equal(dialog.querySelector('[aria-label="Khôi phục Loaned TEST"]').checked,false);assert.equal(dialog.querySelector('[aria-label="Khôi phục Other TEST"]').checked,false);await act(async()=>dialog.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));assert.equal(requests.length,0,'empty opt-in must not request or write');await act(async()=>dialog.querySelector('[aria-label="Khôi phục Loaned TEST"]').click());
 await act(async()=>dialog.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));assert.equal(requests.at(-1)?.action,'preview');assert.equal(requests.at(-1).restore.mode,'continuous');assert.deepEqual(requests.at(-1).restore.employees,['N']);assert.match(dialog.textContent,/Thu hồi phân công ghi nhầm/);
 await act(async()=>dialog.querySelector('[aria-label="Khôi phục Other TEST"]').click());assert.ok([...dialog.querySelectorAll('button')].some(b=>b.textContent==='Xem ảnh hưởng hủy'));assert.equal(requests.filter(r=>r.action==='apply').length,0);await act(async()=>dialog.querySelector('[aria-label="Phân bổ lại NV"]').click());assert.equal(dialog.querySelector('[aria-label="Cách khôi phục nhân viên"]'),null);assert.ok([...dialog.querySelectorAll('button')].some(b=>b.textContent==='Xem ảnh hưởng hủy'));assert.equal(requests.filter(r=>r.action==='apply').length,0);
 // Returning to the same selection must still require a fresh preview.
 await act(async()=>dialog.querySelector('[aria-label="Phân bổ lại NV"]').click());await act(async()=>dialog.querySelector('[aria-label="Khôi phục Loaned TEST"]').click());assert.ok([...dialog.querySelectorAll('button')].some(b=>b.textContent==='Xem ảnh hưởng hủy'));
 await act(async()=>dialog.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));assert.equal(requests.length,2);assert.equal(requests.at(-1).action,'preview');assert.deepEqual(requests.at(-1).restore.employees,['N']);
 // Declining restoration sends no restore payload and never applies automatically.
 await act(async()=>dialog.querySelector('[aria-label="Phân bổ lại NV"]').click());await act(async()=>dialog.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));assert.equal(requests.length,3);assert.equal(requests.at(-1).action,'preview');assert.equal(requests.at(-1).restore,undefined);assert.equal(requests.filter(r=>r.action==='apply').length,0);
 assert.equal(translateToolbar('Phân bổ lại NV?','en'),'Reassign employees?');assert.equal(translateToolbar('Phân bổ lại NV?','zh'),'重新分配員工？');
 }finally{await act(async()=>root.unmount());host.remove();globalThis.fetch=original;}
});
