import {trackBrowserChannels} from './helpers/browser-channels.mjs';
const closeBrowserChannels=trackBrowserChannels();
import {readFileSync} from 'node:fs';
import test,{after} from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';import {createTestServer as createServer} from './helpers/vite-test-server.mjs';import {fileURLToPath} from 'node:url';
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://synthetic.test'});
for(const name of ['window','document','HTMLElement','HTMLInputElement','HTMLButtonElement','MutationObserver','CustomEvent','Event','Node','NodeFilter','HTMLFormElement','HTMLDialogElement','getComputedStyle'])globalThis[name]=dom.window[name];
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
const vite=await createServer({appType:'custom',configFile:false,resolve:{alias:{'@':fileURLToPath(new URL('..',import.meta.url))}},server:{middlewareMode:true,hmr:false}});
const {default:Board}=await vite.ssrLoadModule('/components/production-daily-board.tsx');
const {ProductionWorkBoardView:OriginalBoard}=await vite.ssrLoadModule('/components/production-work-board.tsx');
const {default:TableReports}=await vite.ssrLoadModule('/components/table-reports.tsx');
const {ExportPermissionContext}=await vite.ssrLoadModule('/components/standard-toolbar/StandardToolbar.tsx');
const {renderToStaticMarkup}=await import('react-dom/server');
const {tableExportReport}=await import('../lib/table-report.mjs');
const {payrollXlsx}=await import('../lib/production-payroll-export.mjs');
const {unzipSync,strFromU8}=await import('fflate');
const fetchOriginal=globalThis.fetch;
after(async()=>{globalThis.fetch=fetchOriginal;await vite.close();closeBrowserChannels();dom.window.close();});
const order={id:'SYNTHETIC-ORDER',lsxCode:'SYNTHETIC-LSX',sku:'SYNTHETIC-SKU',name:'Sản phẩm giả',line:'A',lsxQty:1000,inTransitQty:800,revision:'r1',planningNote:'Giữ tem riêng – dữ liệu giả',week:'2026-11-02'};
const daily={id:'SYNTHETIC-REPORT',transitId:order.id,kind:'completion',reportingModel:'daily-finished-v1',quantityOnly:true,reportedQuantity:200,approvedQuantity:0,productionDate:'2026-11-02',productionAt:'2026-11-02T02:00:00Z',reviewStatus:'Chờ kiểm tra'};
const base={orders:[order],reports:[],policy:{active:true,effectiveFrom:'2026-11-01'},allowed:true,active:true,owner:{},onSaved:()=>{},openDetail:()=>{},onEditingChange:()=>{}};
const today=new Date(Date.now()+25200000).toISOString().slice(0,10),yesterday=new Date(Date.now()+25200000-86400000).toISOString().slice(0,10);
const cases=[
 ['running overdue',{...order,planEnd:yesterday},[daily],[],{known:true,running:true}],
 ['due today',{...order,planEnd:today},[],[],{known:false,running:false}],
 ['pending completion',{...order,planEnd:'2026-11-01'},[{...daily,reportedQuantity:1000}],[],{known:true,running:true}],
 ['completed early',{...order,planEnd:'2026-11-03',actualCompletedAt:'2026-11-02'},[{...daily,reportedQuantity:1000,approvedQuantity:1000,reviewStatus:'Đã xác nhận'}],[],{known:true,running:false}],
 ['completed late',{...order,planEnd:'2026-11-01',actualCompletedAt:'2026-11-02'},[{...daily,reportedQuantity:1000,approvedQuantity:1000,reviewStatus:'Đã xác nhận'}],[],{known:true,running:false}],
 ['paused',{...order,planEnd:'2099-01-01'},[],[],{known:true,running:false}],
 ['incident',{...order,planEnd:'2099-01-01'},[],[{id:'I',kind:'incident',stopWork:true,sourceId:order.id,effectiveAt:'2026-11-01T02:00:00Z'}],{known:true,running:false}],
 ['cancelled',{...order,status:'HỦY',planEnd:yesterday},[],[],{known:true,running:true}],
];
for(const [name,row,reports,events,runtime]of cases)test('same original desktop/mobile badge and due styling: '+name,()=>{
 const active=()=>runtime,html=renderToStaticMarkup(React.createElement(Board,{...base,orders:[row],reports,events,runtimeFor:active})),old=renderToStaticMarkup(React.createElement(OriginalBoard,{rows:[row],reports,events,active,openAction:()=>{},showDetail:()=>{},chosen:null,action:'',effectiveLocal:'',setEffectiveLocal:()=>{},submit:()=>{},cancel:()=>{},busy:false,schedules:[],line:'A',employees:[],page:1,onPageChange:()=>{}}));
 const parse=s=>new JSDOM(s).window.document,actual=parse(html),expected=parse(old);
 for(const selector of ['.work-status .onspa-progress','.work-mobile-card .onspa-progress']){const a=actual.querySelector(selector),b=expected.querySelector(selector);assert.ok(a,selector);assert.equal(a.className,b.className);assert.equal(a.textContent,b.textContent);assert.equal(a.title,b.title);}
 assert.equal(actual.querySelectorAll('.work-due-today').length,expected.querySelectorAll('.work-due-today').length);assert.equal(actual.querySelector('.work-table .work-overdue')!==null,expected.querySelector('.work-table .work-overdue')!==null);
 assert.equal(actual.querySelector('.order-planning-note .khsx-planning-note').textContent,row.planningNote);assert.equal(actual.querySelector('.work-mobile-card .khsx-planning-note').textContent,'Ghi chú KHSX: '+row.planningNote);
});
async function mount(props=base,allowed=true){const host=document.createElement('main');host.className='workspace';host.id='synthetic-report-scope';document.body.append(host);const root=createRoot(host),trigger=document.createElement('button');host.append(trigger);let current=props,canExport=allowed;
 const render=async patch=>{current={...current,...patch};await act(async()=>root.render(React.createElement(ExportPermissionContext.Provider,{value:canExport},React.createElement(React.Fragment,null,React.createElement('button',{id:'synthetic-export-trigger'},'Xuất'),React.createElement(Board,current),React.createElement(TableReports,{scopeId:host.id,resetKey:'daily',enabled:true})))));};await render({});return{host,render,setAllowed:async v=>{canExport=v;await render({});},async close(){await act(async()=>root.unmount());host.remove();}};}
const click=async n=>{assert.ok(n);await act(async()=>n.click());};
const readSource=v=>JSON.parse(v.host.querySelector('.daily-output-table').dataset.reportSource);
test('all47 filtered results export independently of the mounted page; filtering to Line A exports only those24 rows',async()=>{
 const all=Array.from({length:47},(_,i)=>({...order,id:'SYNTHETIC-'+i,lsxCode:'TEST-LSX-'+String(i).padStart(2,'0'),line:i%2?'B':'A',sequence:i+1,week:i<20?'2026-11-02':'2026-11-09',planStart:'2026-11-01',planEnd:'2099-01-01'}));const view=await mount({...base,orders:all});try{assert.equal(view.host.querySelectorAll('.daily-output-table tbody tr:not(.work-week-divider)').length,10);const before=readSource(view);assert.equal(before.rows.length,47);assert.equal(before.headers.length,13);assert.ok(before.rows.every(r=>r.length===13));assert.equal(before.rows.at(-1)[0],'TEST-LSX-46');await click(view.host.querySelector('.onspa-pagination-pages [aria-label="Trang 2"]'));assert.deepEqual(readSource(view),before);assert.equal(view.host.querySelector('.daily-output-table tbody tr:not(.work-week-divider)').textContent.includes('TEST-LSX-10'),true);
 const zip=unzipSync(payrollXlsx(tableExportReport(before))),xml=strFromU8(zip['xl/worksheets/sheet1.xml']);assert.match(xml,/TEST-LSX-46/);assert.doesNotMatch(xml,/Báo côngBáo công/);
 await view.render({orders:all.filter(o=>o.line==='A')});const filtered=readSource(view);assert.equal(filtered.rows.length,24);assert.ok(filtered.rows.every(r=>r[4]==='A'));const filteredXml=strFromU8(unzipSync(payrollXlsx(tableExportReport(filtered)))['xl/worksheets/sheet1.xml']);assert.match(filteredXml,/TEST-LSX-46/);assert.doesNotMatch(filteredXml,/TEST-LSX-45/);await view.render({orders:[]});assert.equal(readSource(view).rows.length,0,'empty filtered results do not reuse the preceding export snapshot');
 }finally{await view.close();}
});
test('common exporter can preview the active mobile card source, while inactive and unauthorized sources remain excluded',async()=>{const all=Array.from({length:23},(_,i)=>({...order,id:'MOBILE-'+i,lsxCode:'MOBILE-LSX-'+i}));const view=await mount({...base,orders:all});const dispatch=async()=>{let event;await act(async()=>{event=new window.CustomEvent('onspa-table-export',{cancelable:true,detail:{button:view.host.querySelector('#synthetic-export-trigger')}});window.dispatchEvent(event);});return event;};try{assert.equal(view.host.querySelector('table').getClientRects().length,0,'simulate mobile table hidden while card representation is used');let event=await dispatch();assert.equal(event.defaultPrevented,true);const preview=document.querySelector('.onspa-report-dialog');assert.ok(preview);assert.match(preview.textContent,/MOBILE-LSX-22/);await click(preview.querySelector('button[aria-label="Đóng xem trước"]'));await view.render({active:false});event=await dispatch();assert.equal(event.defaultPrevented,false);assert.equal(document.querySelector('.onspa-report-dialog'),null);await view.render({active:true});await view.setAllowed(false);event=await dispatch();assert.equal(event.defaultPrevented,true);assert.equal(document.querySelector('.onspa-report-dialog'),null);assert.match(view.host.querySelector('[role=alert]').textContent,/quyền/i);}finally{await view.close();}});
for(const locale of ['vi','en','zh'])test('shared export source eligibility and permission remain intact in '+locale,async()=>{
 document.documentElement.lang=locale;const view=await mount();try{let event;await act(async()=>{event=new window.CustomEvent('onspa-table-export',{cancelable:true,detail:{button:view.host.querySelector('#synthetic-export-trigger')}});window.dispatchEvent(event);});assert.equal(event.defaultPrevented,true);assert.ok(document.querySelector('.onspa-report-dialog'));await view.setAllowed(false);assert.equal(document.querySelector('.onspa-report-dialog'),null);await act(async()=>{event=new window.CustomEvent('onspa-table-export',{cancelable:true,detail:{button:view.host.querySelector('#synthetic-export-trigger')}});window.dispatchEvent(event);});assert.equal(event.defaultPrevented,true);assert.ok(view.host.querySelector('[role=alert]'));}finally{await view.close();document.documentElement.lang='vi';}
});
