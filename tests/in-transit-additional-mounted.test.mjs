import test,{after,beforeEach} from 'node:test';import assert from 'node:assert/strict';
import {createRequire} from 'node:module';import {createTestServer} from './helpers/vite-test-server.mjs';
import {normalizeTransit} from '../lib/in-transit.mjs';
const {JSDOM}=createRequire(import.meta.url)('jsdom'),dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://synthetic.test',pretendToBeVisual:true});
for(const name of ['window','document','HTMLElement','Element','HTMLInputElement','HTMLSelectElement','HTMLButtonElement','MutationObserver','CustomEvent','Event','Node','NodeFilter','DOMRect','getComputedStyle'])globalThis[name]=dom.window[name];
globalThis.requestAnimationFrame=dom.window.requestAnimationFrame.bind(dom.window);globalThis.cancelAnimationFrame=dom.window.cancelAnimationFrame.bind(dom.window);globalThis.IS_REACT_ACT_ENVIRONMENT=true;HTMLElement.prototype.scrollIntoView=()=>{};
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client'),el=React.createElement,vite=await createTestServer();
const {InTransit}=await vite.ssrLoadModule('/components/in-transit.tsx'),{ToolbarPermissions}=await vite.ssrLoadModule('/components/standard-toolbar/StandardToolbar.tsx'),sync=await vite.ssrLoadModule('/lib/data-sync.ts');
const originalFetch=globalThis.fetch,OriginalChannel=globalThis.BroadcastChannel,channels=new Set();if(OriginalChannel)globalThis.BroadcastChannel=class extends OriginalChannel{constructor(name){super(name);channels.add(this);}};
const source=normalizeTransit({id:'SYNTHETIC-SOURCE',planId:'SYNTHETIC-PLAN',week:'2026-11-02',sku:'SYNTHETIC-SKU',name:'Synthetic product',line:'A',plan:100,lsxCode:'SYNTHETIC-OLD',lsxQty:40,lsxOpenedAt:'2026-11-02',planStart:'2026-11-04',planEnd:'2026-11-06',sequence:1,status:'ĐÃ MỞ LSX',syncStatus:'ĐÃ ĐỒNG BỘ',pendingReportQty:20,revision:'SYNTHETIC-REV'});
let rows,writes,attempts,hold,release,lose,nonJson;
beforeEach(()=>{sync.clearClientReads('session');rows=[structuredClone(source)];writes=[];attempts=new Map();hold=false;lose=false;nonJson=false;release=null;globalThis.fetch=async(input,init={})=>{
 const path=new URL(String(input),'https://synthetic.test').pathname;
 if((init.method||'GET')==='GET'){if(path==='/api/records')return Response.json({records:[]});assert.equal(path,'/api/in-transit');return Response.json({rows,history:[]});}
 assert.equal(path,'/api/in-transit');const body=JSON.parse(init.body);writes.push(body);assert.equal(body.action,'add-lsx');
 let row=body.requestIdempotency&&attempts.get(body.requestIdempotency);const replayed=!!row;if(!row){row={...normalizeTransit({...source,id:'SYNTHETIC-NEW-'+rows.length,columns:[],isAdditionalLsx:true,lsxCode:'',lsxQty:null,lsxOpenedAt:'',status:'CHƯA MỞ LSX',syncStatus:'CHƯA ĐỒNG BỘ',pendingReportQty:0}),revision:'NEW'};rows.push(row);if(body.requestIdempotency)attempts.set(body.requestIdempotency,row);}
 if(hold){hold=false;await new Promise(resolve=>release=resolve);}if(lose){lose=false;throw new TypeError('Synthetic response lost after commit');}
 if(nonJson){nonJson=false;return new Response('<html>Synthetic overload after commit</html>',{status:502});}return Response.json({ok:true,row,replayed});
};});
after(async()=>{globalThis.fetch=originalFetch;for(const c of channels)c.close();globalThis.BroadcastChannel=OriginalChannel;await vite.close();dom.window.close();});
const button=(host,label)=>[...host.querySelectorAll('button')].find(b=>b.textContent.includes(label));
const click=async node=>{assert.ok(node);await act(async()=>node.click());};
async function mount(allowed=true){const host=document.createElement('div');document.body.append(host);const root=createRoot(host);await act(async()=>root.render(el(ToolbarPermissions.Provider,{value:(_name,label)=>!label.includes('Tạo thêm LSX')||allowed},el(InTransit,{}))));return{host,async close(){await act(async()=>root.unmount());host.remove();}};}
async function selectAndOpen(view){await click(view.host.querySelector('input[aria-label^="Select "]'));await click(button(view.host,'Tạo thêm LSX'));assert.ok(view.host.querySelector('form.it-modal'));}
const submit=async view=>{await act(async()=>view.host.querySelector('form.it-modal').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));};

for(const failure of ['network','non-json'])test(`mounted In Transit preserves an uncertain ${failure} additional-LSX attempt and retries the same key`,async()=>{
 const view=await mount();try{await selectAndOpen(view);if(failure==='network')lose=true;else nonJson=true;await submit(view);assert.equal(writes.length,1);assert.match(writes[0].requestIdempotency||'',/^[0-9a-f-]{36}$/);assert.ok(view.host.querySelector('form.it-modal'),'draft remains after lost response');assert.equal(rows.length,2);assert.equal(view.host.querySelector('form.it-modal fieldset').disabled,true);assert.match(view.host.textContent,/Chưa xác nhận kết quả/);const unload=new window.Event('beforeunload',{cancelable:true});window.dispatchEvent(unload);assert.equal(unload.defaultPrevented,true);
  await submit(view);assert.equal(writes.length,2);assert.equal(writes[1].requestIdempotency,writes[0].requestIdempotency);assert.equal(rows.length,2);assert.equal(view.host.querySelector('form.it-modal'),null);assert.match(view.host.textContent,/không tạo LSX mới/);const afterAck=new window.Event('beforeunload',{cancelable:true});window.dispatchEvent(afterAck);assert.equal(afterAck.defaultPrevented,false);
  const displayed=view.host.querySelectorAll('.it-table>table>tbody>tr:not(.it-week-divider)');assert.equal(displayed.length,2,[...displayed].map(r=>r.outerHTML.slice(0,220)).join('\n'));const blank=view.host.querySelector('input[aria-label^="Mã LSX "]');assert.ok(blank);assert.equal(blank.value,'');assert.equal(view.host.querySelector('input[aria-label^="Số lượng LSX "]').value,'');assert.equal(rows[0].pendingReportQty,20);assert.equal(rows[1].pendingReportQty,0);
 }finally{await view.close();}
});

test('mounted additional-LSX submission guards repeated form events while pending and UI permissions deny opening',async()=>{
 let view=await mount();try{await selectAndOpen(view);hold=true;await submit(view);await submit(view);assert.equal(writes.length,1);await act(async()=>release());assert.equal(rows.length,2);}finally{await view.close();}
 view=await mount(false);try{await click(view.host.querySelector('input[aria-label^="Select "]'));await click(button(view.host,'Tạo thêm LSX'));assert.equal(view.host.querySelector('form.it-modal'),null);assert.equal(writes.length,1);}finally{await view.close();}
});


test('unmounting an unresolved workspace preserves the same attempt until ACK',async()=>{
 let view=await mount();let token;try{await selectAndOpen(view);lose=true;await submit(view);token=writes[0].requestIdempotency;assert.equal(rows.length,2);await click(button(view.host.querySelector('form.it-modal'),'Đóng'));assert.equal(view.host.querySelector('form.it-modal'),null);}finally{await view.close();}
 view=await mount();try{await selectAndOpen(view);await submit(view);assert.equal(writes[1].requestIdempotency,token);assert.equal(rows.length,2);}finally{await view.close();}
});

test('a session change never restores the previous login pending draft in the next workspace',async()=>{
 let view=await mount();try{await selectAndOpen(view);lose=true;await submit(view);assert.equal(view.host.querySelector('form.it-modal fieldset').disabled,true);await act(async()=>sync.clearClientReads('session'));}finally{await view.close();}
 view=await mount();try{await selectAndOpen(view);assert.equal(view.host.querySelector('form.it-modal fieldset').disabled,false);assert.equal(writes.length,1);assert.ok(!view.host.textContent.includes('Chưa xác nhận kết quả'));}finally{await view.close();}
});
