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
    assert.equal(data.rows[0][unit],'Thiếu căn cứ định mức');assert.equal(cells[unit].textContent,'—');assert.match(host.textContent,/Mở Chi tiết phiếu/);assert.match(host.textContent,/menu Giờ công/);assert.match(host.textContent,/Lịch sử/);assert.ok(cells[unit].querySelector('[aria-label="Thiếu căn cứ định mức"]'));
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

for(const rate of [.016,.0006,0])for(const screen of ['journal','output'])test(`${screen} displays and exports dated reference ${rate} explicitly without changing stored evidence`,async()=>{
 const {attachLaborReferences}=await import('../lib/production-labor-reference.mjs'),{siteLaborHours}=await import('../lib/site-labor-hours.mjs');
 const value={...report,standardUnit:undefined,legacyEarnedBasis:{kind:'observed-legacy-earned-v1',status:'missing',sku:order.sku,line:'A',journalPresentation:{standardUnitHours:null,standardLaborHours:null,laborDeviation:null}}};
 const menu=siteLaborHours([{key:order.sku,payload:{sku:order.sku,version:1,laborHour:rate,updatedAt:'2026-10-16T03:00:00Z'}}]),projected=attachLaborReferences([value],[order],menu),before=JSON.stringify(projected);
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try {
  await act(async()=>root.render(React.createElement(screen==='journal'?Journal:Output,{orders:[order],reports:projected,events:[],employees:[],open:()=>{},refresh:()=>{},busy:false})));
  if(screen==='output')await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Giờ công theo LSX').click());
  const table=host.querySelector('table[data-report-source]'),data=JSON.parse(table.dataset.reportSource),unit=data.headers.indexOf('Giờ công chuẩn/SP');
  assert.ok(table.querySelector('tbody').textContent.includes(rate.toLocaleString('vi-VN',{minimumFractionDigits:4})));assert.match(table.querySelector('tbody').textContent,/Đối chiếu, chưa chốt/);assert.match(JSON.stringify(data.rows),/Đối chiếu lịch sử, chưa chốt/);
  assert.equal(data.rows[0][unit],rate);
  const {tableExportReport}=await import('../lib/table-report.mjs'),{payrollXlsx}=await import('../lib/production-payroll-export.mjs'),{unzipSync,strFromU8}=await import('fflate');
  const exportReport=tableExportReport({...data,compactHeader:true}),{displayPayrollCell}=await import('../lib/production-payroll-export.mjs');
  assert.equal(displayPayrollCell(exportReport.sheets[0].rows.at(-1).values[unit]),rate.toLocaleString('vi-VN',{maximumFractionDigits:10}));
  const {default:Preview}=await vite.ssrLoadModule('/components/report-preview.tsx');const previewHost=document.createElement('div');document.body.append(previewHost);const previewRoot=createRoot(previewHost);
  try{await act(async()=>previewRoot.render(React.createElement(Preview,{report:exportReport,close:()=>{}})));const cells=document.querySelector('.onspa-report-overlay tbody').lastElementChild.children;assert.equal(cells[unit].textContent,rate.toLocaleString('vi-VN',{maximumFractionDigits:10}));}finally{await act(async()=>previewRoot.unmount());previewHost.remove();}
  const xml=strFromU8(unzipSync(payrollXlsx(tableExportReport({...data,compactHeader:true})))['xl/worksheets/sheet1.xml']);
  const parsed=new dom.window.DOMParser().parseFromString(xml,'application/xml');assert.equal(parsed.querySelectorAll('parsererror').length,0);assert.ok([...parsed.querySelectorAll('c')].some(c=>c.querySelector('v')?.textContent===String(rate)&&c.getAttribute('t')!=='inlineStr'));
  if(screen==='output'){assert.equal(data.rows[0][unit],rate);assert.equal(data.rows[0][data.headers.indexOf('Giờ công chuẩn HT')],rate*100);assert.equal(data.rows[0][data.headers.indexOf('Tổng giờ LSX')],1);}
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

for(const value of [.0006,.016,0,null])test(`daily detail retains rate precision and distinguishes missing: ${value}`,async()=>{
 const {default:Detail}=await vite.ssrLoadModule('/components/production-detail-fields.tsx');
 const daily={...report,reportingModel:'daily-finished-v1',quantityOnly:true,rateStatus:'resolved',rateBasis:{value}},before=JSON.stringify(daily),host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{await act(async()=>root.render(React.createElement(Detail,{detail:daily,reports:[daily],orders:[order],employees:[],events:[]})));
 const label=[...host.querySelectorAll('dt')].find(n=>n.textContent==='Định mức hiệu lực');assert.ok(label);assert.equal(label.nextElementSibling.textContent,value===null?'Thiếu căn cứ định mức':value.toLocaleString('vi-VN',{maximumFractionDigits:10}));assert.equal(JSON.stringify(daily),before);
 }finally{await act(async()=>root.unmount());host.remove();}
});

for(const screen of ['journal','output'])test(`${screen} November legacy missing basis guides user through details even for unfinished LSX`,async()=>{
 const pendingOrder={...order,actualCompletedAt:undefined,lsxQty:200},value={...report,id:'SYNTHETIC-NOV-MISSING',standardUnit:undefined,productionDate:'2026-11-02',completedAt:'2026-11-02T03:00:00Z'},before=JSON.stringify({pendingOrder,value});
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host),opened=[];
 try{await act(async()=>root.render(React.createElement(screen==='journal'?Journal:Output,{orders:[pendingOrder],reports:[value],events:[],employees:[],open:r=>opened.push(r),refresh:()=>{},busy:false})));
 if(screen==='output')await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Giờ công theo LSX').click());
 assert.match(host.textContent,/SYNTHETIC-NOV-MISSING/);assert.match(host.textContent,/2026-11-02/);assert.match(host.textContent,/menu Giờ công/);
 if(screen==='journal'){
 await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Chi tiết').click());assert.equal(opened.length,1);
 const {default:Detail}=await vite.ssrLoadModule('/components/production-detail-fields.tsx');await act(async()=>root.render(React.createElement(Detail,{detail:opened[0],reports:[value],orders:[pendingOrder],employees:[],events:[]})));
 assert.match(host.textContent,/Chưa xác định được căn cứ Giờ công\/SP/);assert.match(host.textContent,/SYNTHETIC-NOV-MISSING/);assert.match(host.textContent,/2026-11-02/);assert.match(host.textContent,/menu Giờ công/);
 }
 assert.equal(JSON.stringify({pendingOrder,value}),before);
 }finally{await act(async()=>root.unmount());host.remove();}
});

test('unfinished order without final does not warn about final labor rate or alter actual hours',async()=>{
 const pendingOrder={...order,actualCompletedAt:undefined,processes:['CUT','FINAL']},value={...report,id:'SYNTHETIC-CUT',stageName:'CUT',standardUnit:undefined,productionDate:'2026-11-02'},before=JSON.stringify(value),host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{for(const screen of ['journal','output','detail']){
 const {default:Detail}=await vite.ssrLoadModule('/components/production-detail-fields.tsx');
 await act(async()=>root.render(React.createElement(screen==='journal'?Journal:screen==='output'?Output:Detail,{detail:value,orders:[pendingOrder],reports:[value],events:[],employees:[],open:()=>{},refresh:()=>{},busy:false})));
 if(screen==='output')await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Giờ công theo LSX').click());
 assert.doesNotMatch(host.textContent,/Chưa xác định được Giờ công\/SP cho|Chưa xác định được căn cứ Giờ công\/SP/);assert.equal(JSON.stringify(value),before);assert.deepEqual(value.hours,{hc:1,ot:0,total:1});
 }}finally{await act(async()=>root.unmount());host.remove();}
});

for(const mode of ['no-final','resolved-final','missing-final'])test(`LSX warning excludes zero-output CUT: ${mode}`,async()=>{
 const o={...order,processes:['CUT','FINAL'],actualCompletedAt:mode==='no-final'?undefined:'2026-11-02T04:00:00Z'};
 const cut={...report,id:'SYNTHETIC-CUT-ZERO',stageName:'CUT',productionDate:'2026-11-02',completedAt:'2026-11-02T03:00:00Z',reportedQuantity:0,approvedQuantity:0,standardUnit:undefined,hours:{hc:2,ot:0,total:2}},final={...report,id:'SYNTHETIC-FINAL',stageName:'FINAL',productionDate:'2026-11-02',completedAt:'2026-11-02T04:00:00Z',standardUnit:mode==='resolved-final'?.016:undefined,hours:{hc:.5,ot:0,total:.5}};
 const values=mode==='no-final'?[cut]:[cut,final],before=JSON.stringify({o,values}),host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{await act(async()=>root.render(React.createElement(Output,{orders:[o],reports:values,events:[],employees:[],open:()=>{},refresh:()=>{},busy:false})));await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Giờ công theo LSX').click());
 const warning=host.querySelector('details.production-inline-message');if(mode==='missing-final'){assert.ok(warning);assert.match(warning.textContent,/SYNTHETIC-FINAL/);assert.doesNotMatch(warning.textContent,/SYNTHETIC-CUT-ZERO/);}else assert.equal(warning,null);
 if(mode!=='no-final'){const data=JSON.parse(host.querySelector('table[data-report-source]').dataset.reportSource),row=data.rows[0];assert.equal(row[data.headers.indexOf('Tổng giờ LSX')],2.5);assert.equal(row[data.headers.indexOf('Giờ công chuẩn HT')],mode==='resolved-final'?1.6:null);assert.equal(row[data.headers.indexOf('Giờ công chuẩn/SP')],mode==='resolved-final'?.016:'Thiếu căn cứ định mức');}
 assert.equal(JSON.stringify({o,values}),before);
 }finally{await act(async()=>root.unmount());host.remove();}
});

test('each final contribution with missing basis is identified, not just the last final',async()=>{
 const o={...order,processes:['CUT','FINAL']},first={...report,id:'SYNTHETIC-FIRST-FINAL',stageName:'FINAL',productionDate:'2026-11-02',completedAt:'2026-11-02T03:00:00Z',reportedQuantity:50,approvedQuantity:50,standardUnit:undefined},last={...first,id:'SYNTHETIC-LAST-FINAL',completedAt:'2026-11-02T04:00:00Z',standardUnit:.016};
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{await act(async()=>root.render(React.createElement(Output,{orders:[o],reports:[first,last],events:[],employees:[],open:()=>{},refresh:()=>{},busy:false})));await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Giờ công theo LSX').click());const warning=host.querySelector('details.production-inline-message');assert.match(warning.textContent,/SYNTHETIC-FIRST-FINAL/);assert.doesNotMatch(warning.textContent,/SYNTHETIC-LAST-FINAL/);}finally{await act(async()=>root.unmount());host.remove();}
});

for(const liveRoute of [['CUT','FINAL'],['CUT','PACKING'],['FINAL','CUT']])test(`preserved final identity survives current route ${liveRoute.join(' → ')}`,async()=>{
 const {captureLegacyPreservation}=await import('../lib/production-legacy-preservation.mjs'),{attachLegacyEarnedBasis}=await import('../lib/production-legacy-earned-basis.mjs');
 const o={...order,processes:['CUT','FINAL'],actualCompletedAt:'2026-11-02T04:00:00Z'};
 const cut={...report,id:'SYNTHETIC-PRESERVED-CUT',stageName:'CUT',productionDate:'2026-11-02',completedAt:'2026-11-02T02:00:00Z',reportedQuantity:0,approvedQuantity:0,standardUnit:undefined,hours:{hc:2,ot:0,total:2}};
 const first={...report,id:'SYNTHETIC-PRESERVED-FIRST',stageName:'FINAL',productionDate:'2026-11-02',completedAt:'2026-11-02T03:00:00Z',reportedQuantity:50,approvedQuantity:50,standardUnit:undefined,hours:{hc:.25,ot:0,total:.25}},last={...first,id:'SYNTHETIC-PRESERVED-LAST',completedAt:'2026-11-02T04:00:00Z',standardUnit:.016};
 const raw=[cut,first,last],before=JSON.stringify(raw),workflow={orders:[o],reports:raw,events:[],employees:[],payrollEmployees:[],approvedSchedules:[]};
 const captured=await captureLegacyPreservation({workflow,standards:new Map(),snapshotId:'SYNTHETIC-PRESERVATION',observedAt:'2026-11-03T00:00:00Z',cutoverDate:'2026-11-03'}),attached=await attachLegacyEarnedBasis(raw,captured.basis,{required:true});
 assert.equal(attached[1].legacyEarnedBasis.journalPresentation.legacyJournalFinal,false);assert.equal(attached[2].legacyEarnedBasis.journalPresentation.legacyJournalFinal,true);const attachedBefore=JSON.stringify(attached),capturedBefore=JSON.stringify(captured),liveOrder={...o,processes:liveRoute};
 const {isLaborFinalReport}=await import('../lib/production-labor-reference.mjs');assert.deepEqual(attached.map(r=>isLaborFinalReport(r,[liveOrder])),[false,true,true]);
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{await act(async()=>root.render(React.createElement(Output,{orders:[liveOrder],reports:attached,events:[],employees:[],open:()=>{},refresh:()=>{},busy:false})));await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Giờ công theo LSX').click());
 const warning=host.querySelector('details.production-inline-message');assert.ok(warning);assert.match(warning.textContent,/SYNTHETIC-PRESERVED-FIRST/);assert.doesNotMatch(warning.textContent,/SYNTHETIC-PRESERVED-CUT|SYNTHETIC-PRESERVED-LAST/);
 const data=JSON.parse(host.querySelector('table[data-report-source]').dataset.reportSource);assert.equal(data.rows[0][data.headers.indexOf('Tổng giờ LSX')],2.5);assert.equal(data.rows[0][data.headers.indexOf('Giờ công chuẩn HT')],null);
 const {default:Detail}=await vite.ssrLoadModule('/components/production-detail-fields.tsx');await act(async()=>root.render(React.createElement(Detail,{detail:attached[1],orders:[liveOrder],reports:attached,events:[],employees:[]})));assert.match(host.textContent,/Chưa xác định được căn cứ Giờ công\/SP/);assert.match(host.textContent,/SYNTHETIC-PRESERVED-FIRST/);
 assert.equal(JSON.stringify(raw),before);assert.equal(JSON.stringify(attached),attachedBefore);assert.equal(JSON.stringify(captured),capturedBefore);
 }finally{await act(async()=>root.unmount());host.remove();}
});
