import test,{after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://synthetic.test',pretendToBeVisual:true});
for(const name of ['window','document','HTMLElement','Element','HTMLInputElement','HTMLSelectElement','HTMLButtonElement','MutationObserver','CustomEvent','Event','Node','NodeFilter','DOMRect','getComputedStyle'])globalThis[name]=dom.window[name];
globalThis.requestAnimationFrame=dom.window.requestAnimationFrame.bind(dom.window);globalThis.cancelAnimationFrame=dom.window.cancelAnimationFrame.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client'),el=React.createElement;
const vite=await createServer({appType:'custom',configFile:false,resolve:{alias:{'@':fileURLToPath(new URL('..',import.meta.url))}},server:{middlewareMode:true,hmr:false}});
const {ProductionPlan}=await vite.ssrLoadModule('/components/production-plan.tsx');
const {ToolbarPermissions}=await vite.ssrLoadModule('/components/standard-toolbar/StandardToolbar.tsx');
const sync=await vite.ssrLoadModule('/lib/data-sync.ts');
const originalFetch=globalThis.fetch,OriginalChannel=globalThis.BroadcastChannel,channels=new Set();
if(OriginalChannel)globalThis.BroadcastChannel=class extends OriginalChannel{constructor(name){super(name);channels.add(this);}};
const week='2026-11-02';let rows,writes,release,planReads,holdNextRead,releaseRead,capacityRows,effectivePlanning,laborRows;
const original={id:'ROOT-SYNTHETIC',week,sku:'SYNTHETIC-SKU',name:'Synthetic product',line:'A',start:week,end:week,plan:100,suggested:100,laborHour:0.1,status:'DỰ KIẾN',type:'TUẦN CHÍNH',priority:'THƯỜNG',planId:'SHARED-PLAN',sourceIds:[]};
beforeEach(()=>{sync.clearClientReads('session');rows=[{...original}];writes=[];release=null;planReads=0;holdNextRead=false;releaseRead=null;capacityRows=[];effectivePlanning=false;laborRows=[];globalThis.fetch=async(input,init={})=>{
 const url=new URL(String(input),'https://synthetic.test');
 if((init.method||'GET')==='GET'){
  if(url.pathname==='/api/capacity')return Response.json({requests:[]});
  assert.equal(url.pathname,'/api/production-plan');if(url.searchParams.has('capacityOnly'))return Response.json({capacity:capacityRows});planReads++;const snapshot=structuredClone({revision:rows.length,rows,sources:[],capacity:capacityRows,transit:[],audit:[],warnings:[],canReopen:false,effectivePlanning,labor:laborRows});if(holdNextRead){holdNextRead=false;return await new Promise(resolve=>releaseRead=()=>resolve(Response.json(snapshot)));}return Response.json(snapshot);
 }
 assert.equal(url.pathname,'/api/production-plan');const body=JSON.parse(init.body);writes.push(body);assert.equal(body.action,'split');assert.deepEqual(body.ids,[original.id]);
 rows=[{...original,planGroupId:original.id,groupPlanId:original.planId},{...original,id:'CHILD-SYNTHETIC',planGroupId:original.id,groupPlanId:original.planId,splitFromId:original.id,suggested:null,plan:null}];
 const committedRows=structuredClone(rows);
 await new Promise(resolve=>release=resolve);
 return Response.json({revision:2,added:1,existing:0,updated:0,rows:committedRows});
};});
after(async()=>{globalThis.fetch=originalFetch;for(const c of channels)c.close();globalThis.BroadcastChannel=OriginalChannel;await vite.close();dom.window.close();});
async function mount(allowed=true){const host=document.createElement('div');document.body.append(host);const root=createRoot(host);await act(async()=>root.render(el(ToolbarPermissions.Provider,{value:(_name,label)=>label!=='Tách đơn'||allowed},el(ProductionPlan,{initialWeek:week}))));return{host,async close(){await act(async()=>root.unmount());host.remove();}};}
const button=(host,text)=>[...host.querySelectorAll('button')].find(b=>b.textContent.trim()===text);
async function click(node){assert.ok(node);await act(async()=>node.click());}
test('single selected editable row splits once under repeated clicks; blank child/suggestion/details stay distinct',async()=>{
 const view=await mount();try{
  const split=button(view.host,'Tách đơn');assert.ok(split);assert.equal(split.disabled,true);assert.equal(writes.length,0);
  await click(view.host.querySelector('[aria-label="Select SYNTHETIC-SKU"]'));assert.equal(button(view.host,'Tách đơn').disabled,false);
  await act(async()=>{split.click();split.click();await Promise.resolve();});assert.equal(writes.length,1);assert.equal(button(view.host,'Tách đơn').disabled,true);
  await act(async()=>release());
  const bodyRows=[...view.host.querySelectorAll('.pp-plan-grid tbody>tr')];assert.equal(bodyRows.length,2);assert.equal(planReads,1,'split response updates the current week without an extra full GET');
  const quantities=[...view.host.querySelectorAll('input[aria-label^="Quantity "]')];assert.deepEqual(quantities.map(n=>n.value),['100','']);assert.equal(new Set(quantities.map(n=>n.getAttribute('aria-label'))).size,2);
  assert.deepEqual(bodyRows.map(r=>r.cells[5].textContent),['100','']);
  assert.doesNotMatch(view.host.querySelector('.pp-plan-grid').textContent,/ROOT-SYNTHETIC|CHILD-SYNTHETIC/);
  await click([...bodyRows[1].querySelectorAll('button')].find(b=>b.textContent==='Chi tiết'));const detail=view.host.querySelector('[role=dialog]');assert.ok(detail);assert.match(detail.textContent,/CHILD-SYNTHETIC/);assert.match(detail.textContent,/SHARED-PLAN/);
  await click(button(view.host,'Đóng'));assert.equal(button(view.host,'Tách đơn').disabled,true,'selection clears after success');
  rows=rows.map(row=>row.id==='CHILD-SYNTHETIC'?{...row,plan:75}:row);await act(async()=>sync.announceDataChange('production_plan'));assert.equal(planReads,2,'a foreign write still refreshes the full current plan');assert.deepEqual([...view.host.querySelectorAll('input[aria-label^="Quantity "]')].map(n=>n.value),['100','75']);
 }finally{await view.close();}
});
test('denied Sửa or a locked confirmed row never calls split endpoint',async()=>{
 for(const mode of ['denied','confirmed']){sync.clearClientReads('session');if(mode==='confirmed')rows=[{...original,status:'ĐÃ CHỐT'}];const view=await mount(mode!=='denied');try{
  await click(view.host.querySelector('[aria-label="Select SYNTHETIC-SKU"]'));const split=button(view.host,'Tách đơn');assert.ok(split);if(mode==='denied')assert.equal(split.getAttribute('aria-disabled'),'true');else assert.equal(split.disabled,true);await click(split);assert.equal(writes.length,0);
 }finally{await view.close();}}
});


test('two selected rows cannot split and no row code appears as a main-table column',async()=>{
 rows=[{...original},{...original,id:'OTHER',sku:'OTHER-SKU'}];const view=await mount();try{
  await click(view.host.querySelector('[aria-label="Select SYNTHETIC-SKU"]'));await click(view.host.querySelector('[aria-label="Select OTHER-SKU"]'));
  const split=button(view.host,'Tách đơn');assert.equal(split.disabled,true);await click(split);assert.equal(writes.length,0);
  assert.doesNotMatch(view.host.querySelector('.pp-plan-grid thead').textContent,/Mã dòng/);
 }finally{await view.close();}
});


test('an older full read finishing after split must not remove the newly created row or regress cache',async()=>{
 const view=await mount();try{
  holdNextRead=true;await act(async()=>sync.announceDataChange('production_plan'));assert.equal(typeof releaseRead,'function');
  await click(view.host.querySelector('[aria-label="Select SYNTHETIC-SKU"]'));await click(button(view.host,'Tách đơn'));await act(async()=>release());
  assert.equal(view.host.querySelectorAll('.pp-plan-grid tbody>tr').length,2);
  await act(async()=>releaseRead());assert.equal(view.host.querySelectorAll('.pp-plan-grid tbody>tr').length,2,'older revision cannot replace the split result');
  holdNextRead=true;const second=await mount();try{assert.equal(second.host.querySelectorAll('.pp-plan-grid tbody>tr').length,2,'older read cannot regress the reusable week cache');await act(async()=>releaseRead());}finally{await second.close();}
 }finally{await view.close();}
});


test('a delayed split response cannot overwrite a newer foreign snapshot already on screen',async()=>{
 const view=await mount();try{
  await click(view.host.querySelector('[aria-label="Select SYNTHETIC-SKU"]'));await click(button(view.host,'Tách đơn'));
  rows=rows.map(row=>row.id===original.id?{...row,plan:80}:row);rows.push({...original,id:'EXTERNAL',sku:'EXTERNAL-SKU',plan:50});
  await act(async()=>sync.announceDataChange('production_plan'));assert.equal(view.host.querySelectorAll('.pp-plan-grid tbody>tr').length,3);
  await act(async()=>release());assert.equal(view.host.querySelectorAll('.pp-plan-grid tbody>tr').length,3);
  assert.deepEqual([...view.host.querySelectorAll('input[aria-label^="Quantity "]')].map(n=>n.value).sort(),['','50','80']);
 }finally{await view.close();}
});


test('Capacity notice is compact for actionable drafts and disappears without adding/removing banner siblings',async()=>{
 const view=await mount();try{
  const slot=view.host.querySelector('[data-plan-notices]'),table=view.host.querySelector('.pp-plan-grid');assert.equal(slot.querySelector('button').style.visibility,'visible');
  assert.equal(view.host.querySelectorAll('.pp-alert').length,0,'capacity warning is no longer an inline banner');
  capacityRows=[{week,line:'A',status:'Đã xác nhận',version:1,availableHours:1000}];await act(async()=>sync.announceDataChange('capacity'));
  assert.equal(view.host.querySelector('[data-plan-notices]'),slot);assert.equal(view.host.querySelector('.pp-plan-grid'),table);assert.equal(slot.querySelector('button').style.visibility,'hidden');assert.equal(view.host.querySelectorAll('.pp-alert').length,0);
  capacityRows=[];rows=[{...original,status:'HỦY'}];await act(async()=>sync.announceDataChange('production_plan'));assert.equal(slot.querySelector('button').style.visibility,'hidden','a cancelled-only list does not warn about closing new plans');assert.equal(writes.length,0);
 }finally{await view.close();}
});

test('planned hours are plain text and a collapsed header arrow explains the close-day rule without writes',async()=>{
 effectivePlanning=true;laborRows=[{sku:original.sku,effectiveVersions:[{id:'SYNTHETIC-RATE-1',status:'published',value:.1,validFrom:'2026-11-01'}]}];
 rows=[{...original,plan:200,laborHour:.1,planLaborBasis:{status:'resolved',value:.1,businessDate:'2026-11-03'}}];
 const view=await mount();try{
  const table=view.host.querySelector('.pp-plan-grid'),cell=table.querySelector('tbody>tr').cells[7];assert.match(cell.textContent,/20/);assert.equal(cell.querySelector('button'),null);assert.equal(view.host.querySelector('[aria-label="Xem công thức SYNTHETIC-SKU"]'),null);
  const note=table.querySelector('thead details.pp-labor-note'),summary=note.querySelector('summary');assert.ok(note);assert.equal(note.open,false);assert.equal(summary.textContent,'Giờ công');summary.focus();await click(summary);assert.equal(note.open,true);assert.match(note.textContent,/ngày chốt/);assert.match(note.textContent,/Không bắt tách/);assert.match(note.textContent,/ngày hoàn thành/);await click(summary);assert.equal(note.open,false);assert.equal(document.activeElement,summary);assert.equal(view.host.querySelector('[role=dialog]'),null);assert.equal(writes.length,0);
  await click(button(view.host,'Chi tiết'));const detail=view.host.querySelector('[role=dialog]');assert.ok(detail);assert.doesNotMatch(detail.textContent,/Tách đơn và nhập lượng/);await click(button(detail,'Đóng'));assert.equal(writes.length,0);
 }finally{await view.close();}
});
