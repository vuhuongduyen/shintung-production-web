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
let rows,writes,attempts,hold,release,lose,nonJson,serverScope,scopeCounter,ackWrites,loseBefore,denyRecovery,ackGenerations,recoveryFailure;
beforeEach(()=>{sync.clearClientReads('session');rows=[structuredClone(source)];writes=[];ackWrites=[];ackGenerations=[];serverScope={revision:null,pending:null};scopeCounter=0;loseBefore=false;denyRecovery=false;recoveryFailure='';attempts=new Map();hold=false;lose=false;nonJson=false;release=null;globalThis.fetch=async(input,init={})=>{
 const url=new URL(String(input),'https://synthetic.test'),path=url.pathname;
 if((init.method||'GET')==='GET'){if(url.searchParams.get('creationRecovery')==='1'){if(recoveryFailure==='network')throw new TypeError('SYNTHETIC_PRIVATE_TRANSPORT');if(recoveryFailure==='non-json')return new Response('<html>SYNTHETIC_PRIVATE_GATEWAY</html>',{status:503});return denyRecovery?Response.json({error:'Synthetic permission revoked'},{status:403}):Response.json(serverScope);}if(path==='/api/records')return Response.json({records:[]});assert.equal(path,'/api/in-transit');return Response.json({rows,history:[]});}
 assert.equal(path,'/api/in-transit');const body=JSON.parse(init.body);if(body.action==='ack-add-lsx'){ackGenerations.push(sync.clientReadGeneration());ackWrites.push(body);assert.equal(body.expectedCreationRevision,serverScope.revision);assert.equal(body.id,serverScope.pending.rowId);serverScope={revision:(++scopeCounter).toString(16).padStart(64,'0'),pending:null};return Response.json({ok:true});}writes.push(body);assert.equal(body.action,'add-lsx');if(loseBefore){loseBefore=false;throw new TypeError('Synthetic request never committed');}
 let saved=body.requestIdempotency&&attempts.get(body.requestIdempotency),row=saved?.row;const replayed=!!row;if(!row){if(body.expectedCreationRevision!==serverScope.revision||serverScope.pending)return Response.json({error:'Synthetic stale creation scope'},{status:409});row={...normalizeTransit({...source,id:'SYNTHETIC-NEW-'+rows.length,columns:[],isAdditionalLsx:true,planningNote:body.planningNote||'',lsxCode:'',lsxQty:null,lsxOpenedAt:'',status:'CHƯA MỞ LSX',syncStatus:'CHƯA ĐỒNG BỘ',pendingReportQty:0}),revision:'NEW'};rows.push(row);serverScope={revision:(++scopeCounter).toString(16).padStart(64,'0'),pending:{rowId:row.id,requestIdempotency:body.requestIdempotency}};saved={row,revision:serverScope.revision};if(body.requestIdempotency)attempts.set(body.requestIdempotency,saved);}
 if(hold){hold=false;await new Promise(resolve=>release=resolve);}if(lose){lose=false;throw new TypeError('Synthetic response lost after commit');}
 if(nonJson){nonJson=false;return new Response('<html>Synthetic overload after commit</html>',{status:502});}return Response.json({ok:true,row,replayed,creationScopeRevision:saved.revision});
};});
after(async()=>{globalThis.fetch=originalFetch;for(const c of channels)c.close();globalThis.BroadcastChannel=OriginalChannel;await vite.close();dom.window.close();});
const button=(host,label)=>[...host.querySelectorAll('button')].find(b=>b.textContent.includes(label));
const click=async node=>{assert.ok(node);await act(async()=>node.click());};
async function mount(allowed=true){const host=document.createElement('div');document.body.append(host);const root=createRoot(host);await act(async()=>root.render(el(ToolbarPermissions.Provider,{value:(_name,label)=>!label.includes('Tạo thêm LSX')||allowed},el(InTransit,{}))));return{host,async close(){await act(async()=>root.unmount());host.remove();}};}
async function selectAndOpen(view){await click(view.host.querySelector('input[aria-label^="Select "]'));await click(button(view.host,'Tạo thêm LSX'));assert.ok(view.host.querySelector('form.it-modal'));}
const submit=async view=>{await act(async()=>view.host.querySelector('form.it-modal').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));};

for(const failure of ['network','non-json'])test(`mounted In Transit preserves an uncertain ${failure} additional-LSX attempt and retries the same key`,async()=>{
 const view=await mount();try{await selectAndOpen(view);if(failure==='network')lose=true;else nonJson=true;await submit(view);assert.equal(writes.length,1);assert.match(writes[0].requestIdempotency||'',/^[0-9a-f-]{36}$/);assert.ok(view.host.querySelector('form.it-modal'),'draft remains after lost response');assert.equal(rows.length,2);assert.equal(view.host.querySelector('form.it-modal fieldset').disabled,true);assert.match(view.host.textContent,/Chưa xác nhận kết quả/);const unload=new window.Event('beforeunload',{cancelable:true});window.dispatchEvent(unload);assert.equal(unload.defaultPrevented,true);
  await submit(view);assert.equal(writes.length,2);assert.equal(writes[1].requestIdempotency,writes[0].requestIdempotency);assert.equal(rows.length,2);assert.equal(sync.clientReadGeneration(),ackGenerations.at(-1),'internal ACK must not invalidate workflow/transit data a second time');assert.equal(view.host.querySelector('form.it-modal'),null);assert.match(view.host.textContent,/không tạo LSX mới/);const afterAck=new window.Event('beforeunload',{cancelable:true});window.dispatchEvent(afterAck);assert.equal(afterAck.defaultPrevented,false);
  const displayed=view.host.querySelectorAll('.it-table>table>tbody>tr:not(.it-week-divider)');assert.equal(displayed.length,2,[...displayed].map(r=>r.outerHTML.slice(0,220)).join('\n'));const blank=view.host.querySelector('input[aria-label^="Mã LSX "]');assert.ok(blank);assert.equal(blank.value,'');assert.equal(view.host.querySelector('input[aria-label^="Số lượng LSX "]').value,'');assert.equal(rows[0].pendingReportQty,20);assert.equal(rows[1].pendingReportQty,0);
 }finally{await view.close();}
});

test('mounted additional-LSX submission guards repeated form events while pending and UI permissions deny opening',async()=>{
 let view=await mount();try{await selectAndOpen(view);hold=true;await submit(view);await submit(view);assert.equal(writes.length,1);await act(async()=>release());assert.equal(rows.length,2);}finally{await view.close();}
 view=await mount(false);try{await click(view.host.querySelector('input[aria-label^="Select "]'));await click(button(view.host,'Tạo thêm LSX'));assert.equal(view.host.querySelector('form.it-modal'),null);assert.equal(writes.length,1);}finally{await view.close();}
});


test('a full client reset recovers the server result without another create POST or browser draft storage',async()=>{
 const stored=[],originalSet=window.Storage.prototype.setItem;window.Storage.prototype.setItem=function(k,v){stored.push([k,v]);return originalSet.call(this,k,v);};
 let view=await mount();let token;try{await selectAndOpen(view);const note=view.host.querySelector('form.it-modal textarea');await act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set.call(note,'SYNTHETIC_PRIVATE_DRAFT_NOTE');note.dispatchEvent(new window.Event('input',{bubbles:true}));});lose=true;await submit(view);assert.equal(writes[0].planningNote,'SYNTHETIC_PRIVATE_DRAFT_NOTE');token=writes[0].requestIdempotency;assert.equal(rows.length,2);}finally{await view.close();}
 try{await act(async()=>sync.clearClientReads('session'));view=await mount();await click(button(view.host,'Tạo thêm LSX'));assert.equal(view.host.querySelector('form.it-modal'),null);assert.equal(writes.length,1);assert.equal(rows.length,2);assert.equal(ackWrites.length,1);assert.equal(serverScope.pending,null);assert.match(view.host.textContent,/Đã tìm thấy LSX/);assert.ok(!JSON.stringify(stored).includes(token));assert.ok(!JSON.stringify(stored).includes('SYNTHETIC_PRIVATE_DRAFT_NOTE'));assert.equal(view.host.querySelector('input[aria-label="Select SYNTHETIC-PLAN SYNTHETIC-NEW-1"]').checked,true);}finally{await view.close();window.Storage.prototype.setItem=originalSet;}
});

test('a session change never restores the previous login pending draft in the next workspace',async()=>{
 let view=await mount();try{await selectAndOpen(view);lose=true;await submit(view);assert.equal(view.host.querySelector('form.it-modal fieldset').disabled,true);await act(async()=>sync.clearClientReads('session'));serverScope={revision:null,pending:null};}finally{await view.close();}
 view=await mount();try{await selectAndOpen(view);assert.equal(view.host.querySelector('form.it-modal fieldset').disabled,false);assert.equal(writes.length,1);assert.ok(!view.host.textContent.includes('Chưa xác nhận kết quả'));}finally{await view.close();}
});


test('reload after a request that never committed does not invent a saved result or auto-submit; late old packet is rejected',async()=>{
 let view=await mount();let old;try{await selectAndOpen(view);loseBefore=true;await submit(view);old=writes[0];assert.equal(rows.length,1);assert.equal(serverScope.pending,null);}finally{await view.close();}
 await act(async()=>sync.clearClientReads('session'));view=await mount();try{await selectAndOpen(view);assert.equal(writes.length,1,'opening a fresh form is not a write');await submit(view);assert.equal(rows.length,2);assert.notEqual(writes[1].requestIdempotency,old.requestIdempotency);const late=await globalThis.fetch('/api/in-transit',{method:'POST',body:JSON.stringify(old)});assert.equal(late.status,409);assert.equal(rows.length,2);}finally{await view.close();}
});

test('an old page receiving its response after unmount cannot ACK or duplicate the result recovered by the new page',async()=>{
 let view=await mount();let finish;try{await selectAndOpen(view);hold=true;await submit(view);finish=release;assert.equal(rows.length,2);}finally{await view.close();}
 await act(async()=>sync.clearClientReads('session'));view=await mount();try{await click(button(view.host,'Tạo thêm LSX'));assert.equal(ackWrites.length,1);assert.equal(writes.length,1);await act(async()=>finish());assert.equal(ackWrites.length,1);assert.equal(rows.length,2);}finally{await view.close();}
});

test('recovery forbidden by a changed permission never creates or discards the owned server result',async()=>{
 let view=await mount();try{await selectAndOpen(view);lose=true;await submit(view);}finally{await view.close();}
 await act(async()=>sync.clearClientReads('session'));denyRecovery=true;view=await mount();try{await click(button(view.host,'Tạo thêm LSX'));assert.equal(view.host.querySelector('form.it-modal'),null);assert.equal(writes.length,1);assert.ok(serverScope.pending);assert.match(view.host.textContent,/permission revoked/);}finally{await view.close();}
 denyRecovery=false;view=await mount();try{await click(button(view.host,'Tạo thêm LSX'));assert.equal(writes.length,1);assert.equal(rows.length,2);assert.equal(ackWrites.length,1);}finally{await view.close();}
});


for(const failure of ['network','non-json'])test(`unavailable ${failure} recovery keeps the result pending and never silently opens a new creation`,async()=>{
 let view=await mount();try{await selectAndOpen(view);lose=true;await submit(view);}finally{await view.close();}
 await act(async()=>sync.clearClientReads('session'));recoveryFailure=failure;view=await mount();try{await click(button(view.host,'Tạo thêm LSX'));assert.equal(view.host.querySelector('form.it-modal'),null);assert.equal(writes.length,1);assert.ok(serverScope.pending);assert.match(view.host.textContent,/Chưa kiểm tra được lượt tạo LSX/);assert.ok(!view.host.textContent.includes('SYNTHETIC_PRIVATE'));recoveryFailure='';await click(button(view.host,'Tạo thêm LSX'));assert.equal(writes.length,1);assert.equal(ackWrites.length,1);}finally{await view.close();}
});
