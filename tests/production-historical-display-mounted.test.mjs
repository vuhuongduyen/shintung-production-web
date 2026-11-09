import {trackBrowserChannels} from './helpers/browser-channels.mjs';
const closeBrowserChannels=trackBrowserChannels();
import test,{after} from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';import {createTestServer} from './helpers/vite-test-server.mjs';
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://synthetic.test'});
for(const name of ['window','document','HTMLElement','HTMLInputElement','HTMLButtonElement','MutationObserver','CustomEvent','Event','Node','NodeFilter','HTMLFormElement','getComputedStyle'])globalThis[name]=dom.window[name];
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client'),vite=await createTestServer();
const {default:Journal}=await vite.ssrLoadModule('/components/production-journal.tsx'),{default:Output}=await vite.ssrLoadModule('/components/production-output.tsx'),originalFetch=globalThis.fetch;
after(async()=>{globalThis.fetch=originalFetch;await vite.close();closeBrowserChannels();dom.window.close();});
const order={id:'SYNTHETIC-OLD-ORDER',sku:'SYNTHETIC-SKU',planId:'SYNTHETIC-PLAN',lsxCode:'SYNTHETIC-LSX',line:'A',lsxQty:100,actualCompletedAt:'2026-10-30T02:00:00Z',processes:['FINAL']};
const report={id:'SYNTHETIC-OLD-REPORT',kind:'completion',transitId:order.id,sku:order.sku,line:'A',stageName:'FINAL',productionDate:'2026-10-30',completedAt:order.actualCompletedAt,reportedAt:'2026-10-30T02:01:00Z',reportedQuantity:100,approvedQuantity:100,reviewStatus:'Đã xác nhận',hours:{hc:1,ot:0,total:1},standardUnit:.01};
for(const screen of ['journal','output'])for(const mode of ['stored','missing','conflict'])test(`${screen} historical visible cells, detail and export retain stored evidence after later master changes: ${mode}`,async()=>{
 const value={...report,...(mode==='missing'?{standardUnit:undefined}:mode==='conflict'?{rateBasis:{kind:'effective-version',versionId:'SYNTHETIC-CONFLICT',value:.02,productionDate:report.productionDate,validFrom:'2026-10-01'}}:{})},before=JSON.stringify({order,value}),requests=[];
 for(const current of [.01,.016]){
  globalThis.fetch=async url=>{requests.push(String(url));return Response.json({records:[{key:order.sku,payload:{sku:order.sku,laborHour:current}}]});};
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host),opened=[];
  try{
   await act(async()=>root.render(React.createElement(screen==='journal'?Journal:Output,{orders:[order],reports:[value],events:[],employees:[],open:r=>opened.push(r),refresh:()=>{},busy:false})));
   if(screen==='output')await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Giờ công theo LSX').click());
   const table=host.querySelector('table[data-report-source]'),data=JSON.parse(table.dataset.reportSource),unit=data.headers.indexOf('Giờ công chuẩn/SP'),cells=[...table.querySelector('tbody tr:not(.production-output-month)').children];assert.ok(unit>=0);
   if(mode==='stored'){
    assert.equal(data.rows[0][unit],.01);assert.match(cells[unit].textContent,/0,0100/);
    if(screen==='journal'){assert.equal(data.rows[0][data.headers.indexOf('Lệch giờ chuẩn')],'0%');await act(async()=>[...table.querySelectorAll('button')].find(b=>b.textContent==='Chi tiết').click());assert.equal(opened[0].standardLaborHours,1);assert.equal(opened[0].laborDeviation,0);}
    else assert.equal(data.rows[0][data.headers.indexOf('Giờ công chuẩn HT')],1);
   }else{
    assert.equal(data.rows[0][unit],'Thiếu căn cứ định mức');assert.equal(cells[unit].textContent,'—');assert.ok(cells[unit].querySelector('[aria-label="Thiếu căn cứ định mức"]'));
    if(screen==='journal'){await act(async()=>[...table.querySelectorAll('button')].find(b=>b.textContent==='Chi tiết').click());assert.equal(opened[0].standardLaborHours,null);assert.equal(opened[0].laborDeviation,null);}
    else assert.equal(data.rows[0][data.headers.indexOf('Giờ công chuẩn HT')],null);
   }
   assert.equal(JSON.stringify({order,value}),before);
  }finally{await act(async()=>root.unmount());host.remove();}
 }
 assert.deepEqual(requests,[],'historical displays do not fetch a mutable master or write data');
});

for(const locale of ['en','zh'])for(const screen of ['journal','output'])test(`${screen} missing evidence label remains accessible and exported in ${locale}`,async()=>{
 document.documentElement.lang=locale;const {translateToolbar}=await vite.ssrLoadModule('/components/standard-toolbar/translations.ts'),t=s=>translateToolbar(s,locale),host=document.createElement('div');document.body.append(host);const root=createRoot(host),before=JSON.stringify(report);
 try{
  await act(async()=>root.render(React.createElement(screen==='journal'?Journal:Output,{orders:[order],reports:[{...report,standardUnit:undefined}],events:[],employees:[],open:()=>{},refresh:()=>{},busy:false})));
  if(screen==='output')await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent===t('Giờ công theo LSX')).click());
  const table=host.querySelector('table[data-report-source]'),data=JSON.parse(table.dataset.reportSource),label=t('Thiếu căn cứ định mức');assert.notEqual(label,'Thiếu căn cứ định mức');assert.equal(data.rows[0][data.headers.indexOf(t('Giờ công chuẩn/SP'))],label);assert.ok([...table.querySelectorAll('[aria-label]')].some(n=>n.getAttribute('aria-label')===label));assert.equal(JSON.stringify(report),before);
 }finally{await act(async()=>root.unmount());host.remove();document.documentElement.lang='vi';}
});

for(const screen of ['journal','output'])test(`${screen} displays and exports dated reference explicitly without changing stored evidence`,async()=>{
 const {attachLaborReferences}=await import('../lib/production-labor-reference.mjs'),{siteLaborHours}=await import('../lib/site-labor-hours.mjs');
 const value={...report,standardUnit:undefined,legacyEarnedBasis:{kind:'observed-legacy-earned-v1',status:'missing',sku:order.sku,line:'A',journalPresentation:{standardUnitHours:null,standardLaborHours:null,laborDeviation:null}}};
 const menu=siteLaborHours([{key:order.sku,payload:{sku:order.sku,version:1,laborHour:.016,updatedAt:'2026-10-16T03:00:00Z'}}]),projected=attachLaborReferences([value],[order],menu),before=JSON.stringify(projected);
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try {
  await act(async()=>root.render(React.createElement(screen==='journal'?Journal:Output,{orders:[order],reports:projected,events:[],employees:[],open:()=>{},refresh:()=>{},busy:false})));
  if(screen==='output')await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Giờ công theo LSX').click());
  const table=host.querySelector('table[data-report-source]'),data=JSON.parse(table.dataset.reportSource),unit=data.headers.indexOf('Giờ công chuẩn/SP');
  assert.match(table.querySelector('tbody').textContent,/0,0160/);assert.match(table.querySelector('tbody').textContent,/Đối chiếu, chưa chốt/);assert.match(JSON.stringify(data.rows),/Đối chiếu lịch sử, chưa chốt/);
  if(screen==='output'){assert.equal(data.rows[0][unit],.016);assert.equal(data.rows[0][data.headers.indexOf('Giờ công chuẩn HT')],1.6);assert.equal(data.rows[0][data.headers.indexOf('Tổng giờ LSX')],1);}
  assert.equal(JSON.stringify(projected),before);
 }finally{await act(async()=>root.unmount());host.remove();}
});

test('report detail shows historical reference date/version and leaves actual hours intact',async()=>{
 const {default:Detail}=await vite.ssrLoadModule('/components/production-detail-fields.tsx');
 const value={...report,standardUnit:undefined,laborReference:{kind:'historical-labor-reference-v1',status:'resolved',sku:order.sku,productionDate:'2026-10-30',frozen:false,basis:{value:.016,validFrom:'2026-10-16',productionDate:'2026-10-30',versionId:'SYNTHETIC-H2',recordedAt:'2026-10-16T03:00:00Z'}}},before=JSON.stringify(value),host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  await act(async()=>root.render(React.createElement(Detail,{detail:value,reports:[value],orders:[order],employees:[],events:[]})));
  assert.match(host.textContent,/0,016/);assert.match(host.textContent,/SYNTHETIC-H2/);assert.match(host.textContent,/16\/10\/2026/);assert.match(host.textContent,/Đối chiếu lịch sử, chưa chốt/);assert.equal(JSON.stringify(value),before);
 }finally{await act(async()=>root.unmount());host.remove();}
});
