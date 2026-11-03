import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {JSDOM} from 'jsdom';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
import {resolve as resolvePath} from 'node:path';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {root,openDatabase,migrate} from '../scripts/local/database.mjs';
import {createProductionExamples} from '../scripts/local/production-examples.mjs';
import {mutateProductionWorkflow,readProductionWorkflow} from '../scripts/local/production-workflow.mjs';
import {productionEntryActorId} from '../lib/production-actor.mjs';
import {productionDisplayTime} from '../lib/production-display-time.mjs';
import {productionDetailContext,scheduleChanges} from '../lib/production-detail.mjs';
const vite=await createServer({appType:'custom',configFile:false,resolve:{alias:{'@':resolvePath(fileURLToPath(new URL('..',import.meta.url)))}},root:process.cwd(),server:{middlewareMode:true}});
after(()=>vite.close());
const {default:Details}=await vite.ssrLoadModule('/components/production-detail-fields.tsx');
const orders=[{id:'o',planId:'PLAN-40',lsxCode:'LSX-01',sku:'TEST-SKU-001',name:'Sản phẩm giả kiểm thử',spec:'80cm',line:'A',planStart:'2026-10-01',planEnd:'2026-10-06',lsxQty:1000,completedQty:200,inTransitQty:800,productionState:'Đang làm',actualStartedAt:'2026-10-05T01:00:00Z'},{id:'dest',lsxCode:'LSX-02',line:'B'}];
const employees=[{id:'NV1',name:'Nhân viên Giả Một'}];
const report={id:'r',kind:'completion',transitId:'o',lsxCode:'LSX-01',sku:'TEST-SKU-001',name:'Sản phẩm giả kiểm thử',line:'A',lsxQty:1000,reportedQuantity:200,startedAt:'2026-10-05T01:00:00Z',completedAt:'2026-10-05T03:00:00Z',productionDate:'2026-10-05',hours:{hc:2,ot:0,total:2,perEmployee:[{id:'NV1',hc:2,ot:0,total:2}]},reviewStatus:'Đã xác nhận',approvedQuantity:200,reviewedBy:'qlsx',reviewedAt:'2026-10-05T03:10:00Z',warehouseStatus:'Chờ xác nhận',reportedBy:'line-a',reportedAt:'2026-10-05T03:01:00Z'};
const event={id:'e',kind:'complete',sourceId:'o',reportId:'r',count:1,employees:['NV1'],effectiveAt:report.completedAt,actor:'line-a',recordedAt:report.reportedAt};
const render=(detail,events=[event])=>renderToStaticMarkup(React.createElement(Details,{detail,orders,reports:[report],events,employees}));
test('SX completed quantity includes approved and pending, excludes cancelled, on table and mobile',async()=>{
 const {ProductionWorkBoardView:Board}=await vite.ssrLoadModule('/components/production-work-board.tsx');
 const reports=[report,{...report,id:'pending',reviewStatus:'Chờ kiểm tra',reportedQuantity:50},{...report,id:'cancelled',cancelled:true,reportedQuantity:900}];
 const html=renderToStaticMarkup(React.createElement(Board,{rows:[orders[0]],reports,events:[],active:()=>({known:true,running:true,count:1}),openAction:()=>{},showDetail:()=>{},chosen:null,action:'',effectiveLocal:'',setEffectiveLocal:()=>{},submit:()=>{},cancel:()=>{},busy:false,schedules:[],line:'A',employees,page:1,onPageChange:()=>{}}));
 assert.ok(html.includes('<th>SL hoàn thành</th>'));assert.ok(!html.includes('SL chờ xác nhận'));
 assert.match(html,/>250<\/td>/);assert.match(html,/SL hoàn thành: 250/);
});
function field(html,label,value){assert.ok(html.includes(`<dt>${label}</dt><dd>${value}</dd>`),`${label}: ${value}`);}
test('legacy report and journal event share plan, quantity, workforce, hours and reviewer details without rewriting records',()=>{
 const before=JSON.stringify({orders,report,event});
 for(const entry of [report,event,{...event,name:'wrong joined label'}]) {
  const html=render(entry);field(html,'Ngày bắt đầu kế hoạch','01/10/2026');field(html,'Ngày hoàn thành kế hoạch','06/10/2026');field(html,'Số lượng còn lại chưa xác nhận','800');field(html,'Quy cách','80cm');field(html,'Nhân viên','Nhân viên Giả Một (NV1)');field(html,'Giờ HC','2');field(html,'Người xác nhận','qlsx');field(html,'Sản lượng lần này','200');
 }
 assert.equal(JSON.stringify({orders,report,event}),before);
});
test('all order detail entry points and transfers resolve source and destination; stored history and zero values survive fallback',()=>{
 const html=render(orders[0]);field(html,'Ngày bắt đầu kế hoạch','01/10/2026');field(html,'Trạng thái LSX','Đang làm');
 const transfer={id:'t',kind:'transfer',sourceId:'o',destinationId:'dest',count:1,employees:['NV1'],effectiveAt:report.completedAt,actor:'line-a'};
 field(render(transfer,[transfer]),'Chuyển đến lệnh','LSX-02');field(render(transfer,[transfer]),'Line chuyển đến','B');
 const context=productionDetailContext({...report,planStart:'2026-09-30',completedQty:0},orders);
 assert.equal(context.detail.planStart,'2026-09-30');assert.equal(context.detail.completedQty,0);
 const missing=productionDetailContext({id:'old',kind:'completion',transitId:'deleted',reportedQuantity:0});assert.equal(missing.detail.planStart,undefined);
});
test('Line hour adjustments show linked LSX and actual before/after hours; capacity zero is displayed',()=>{
 const adjustment={id:'hours',kind:'hours-adjustment',line:'A',changes:[{reportId:'r',before:{hc:3,ot:1,total:4},after:{hc:2,ot:0,total:2}}],actor:'qlsx'};
 const html=render(adjustment,[adjustment]);assert.match(html,/LSX-01/);field(html,'Giờ HC','3 → 2');field(html,'Giờ TC','1 → 0');assert.doesNotMatch(html,/Thay đổi trước → sau<\/h3><\/section>/);
 const capacity={id:'cap',kind:'capacity',line:'A',week:'2026-10-05',capacityAction:'review',capacityDecision:'approve',before:0,after:95};
 field(render(capacity,[capacity]),'Giờ khả dụng trước','0');field(render(capacity,[capacity]),'Quyết định','Đồng ý');
});
test('schedule and workforce audit details render business fields instead of empty generic headings',()=>{
 const days=[{date:'2026-10-05',working:true,hcStart:'08:00',hcEnd:'17:00',lunchStart:'12:00',lunchEnd:'13:00',ot:false,breaks:[{start:'10:00',end:'10:10'}],cleaning:[]}];
 const schedule={id:'sched',kind:'schedule',line:'A',before:days,after:[{...days[0],hcStart:'09:00',note:'Đổi giờ'}]};
 const html=render(schedule,[schedule]);assert.match(html,/08:00–17:00 → 09:00–17:00/);assert.match(html,/12:00–13:00/);assert.match(html,/Đổi giờ/);assert.doesNotMatch(html,/Thông tin lệnh sản xuất/);assert.equal(scheduleChanges(null,days)[0].before.working,'Chưa ghi nhận');
 const audit={id:'audit',kind:'report-cancel',sourceId:'o',before:{kind:'add',count:1,employees:['NV1']},after:{kind:'add',count:1,employees:['NV1'],voided:true}};
 const auditHtml=render(audit,[audit]);assert.match(auditHtml,/Đã hủy: — → Có/);assert.match(auditHtml,/Số người: 1 → 1/);assert.match(auditHtml,/Nhân viên Giả Một/);
});

test('actual workflow: station start at 09:00, pending output 100 at 11:00 and another 50 retain original start and all quantity states',async()=>{
 mkdirSync(resolve(root,'.local-data/tests'),{recursive:true});
 const c=await openDatabase(mkdtempSync(resolve(root,'.local-data/tests/detail-workflow-'))),actor={login:'manager@test',userId:'QLSX-001',isAdmin:true,line:null};
 try {
  await migrate(c.db);const set=await createProductionExamples(c.db,actor),day=set.examples.date,at=t=>new Date(`${day}T${t}:00+07:00`).toISOString();
  await mutateProductionWorkflow(c.db,{action:'start',orderId:'TEST-LSX-A02',employees:['TEST-NV-A07','TEST-NV-A08','TEST-NV-A09','TEST-NV-A10'],count:4,effectiveAt:at('09:00')},actor);
  const saved=await mutateProductionWorkflow(c.db,{action:'complete',orderId:'TEST-LSX-A02',quantity:100,effectiveAt:at('11:00'),actorId:'FAKE-ID'},actor);
  let data=await readProductionWorkflow(c.db,actor);
  assert.equal(data.events.find(e=>e.id===saved.event.id).cumulativeLaborHours,7.3333);assert.equal(data.events.find(e=>e.id===saved.event.id).actorId,'QLSX-001');assert.equal(data.reports.find(r=>r.id===saved.report.id).actorId,'QLSX-001');
  const context=productionDetailContext(saved.event,data.orders,data.reports,data.events);
  assert.equal(context.detail.reportedCompletedQty,100);assert.equal(context.detail.approvedCompletedQty,0);assert.equal(context.detail.pendingCompletedQty,100);assert.equal(context.detail.unreportedQty,900);assert.equal(context.detail.actualStartedAt,at('09:00'));
  // Reproduce the screenshot even if the order projection has no actual start, as in the sample database.
  data.orders=data.orders.map(o=>o.id==='TEST-LSX-A02'?{...o,actualStartedAt:''}:o);
  for(const detail of [saved.event,saved.report,data.orders.find(o=>o.id==='TEST-LSX-A02')]) {
   const html=renderToStaticMarkup(React.createElement(Details,{detail,...data}));
   field(html,'Sản lượng đã hoàn thành','100');field(html,'Sản lượng đã xác nhận','0');field(html,'Sản lượng chờ xác nhận','100');field(html,'Số lượng chưa báo công','900');
   const start=html.match(/<dt>Bắt đầu thực tế<\/dt><dd>(.*?)<\/dd>/)?.[1];assert.match(start,/09:00:00/);assert.doesNotMatch(start,/Chưa ghi nhận/);
   if(detail.kind==='complete')assert.doesNotMatch(html,/<dt>Đến thời điểm<\/dt><dd>Chưa ghi nhận/);
  }
  const next=await mutateProductionWorkflow(c.db,{action:'complete',orderId:'TEST-LSX-A02',quantity:50,effectiveAt:at('11:30')},actor);
  data=await readProductionWorkflow(c.db,actor);
  const after=productionDetailContext(next.event,data.orders.map(o=>({...o,actualStartedAt:''})),data.reports,data.events);
  assert.equal(after.detail.actualStartedAt,at('09:00'));assert.equal(after.detail.reportedCompletedQty,150);assert.equal(after.detail.unreportedQty,850);
  const rejected={...data.reports.find(r=>r.id===saved.report.id),reviewStatus:'Cần điều chỉnh'};
  const valid=productionDetailContext(next.event,data.orders,data.reports.map(r=>r.id===rejected.id?rejected:r),data.events);
  assert.equal(valid.detail.reportedCompletedQty,50);
 } finally {await c.close();}
});

test('timestamps are date first in Vietnam and employee count keeps names inside a closed disclosure',async()=>{
 assert.equal(productionEntryActorId({reportedBy:'test@example.invalid'},[{id:'NV-LOGIN-01',email:'test@example.invalid'}]),'NV-LOGIN-01');
 assert.equal(productionEntryActorId({reportedBy:'NV-OLD',updatedBy:'reviewer'}),'NV-OLD');assert.equal(productionEntryActorId({}), '');
 assert.equal(productionDisplayTime('2026-10-03T02:00:00Z'),'03/10/2026 09:00:00');
 assert.equal(productionDisplayTime('2026-10-03T18:00:00Z'),'04/10/2026 01:00:00');
 assert.equal(productionDisplayTime('2026-10-03'),'03/10/2026');
 const {default:Count}=await vite.ssrLoadModule('/components/production-employee-count.tsx');
 const html=renderToStaticMarkup(React.createElement(Count,{row:{count:4,employees:['NV1'],hours:{perEmployee:[{id:'NV1',hc:1.5,ot:0.5,total:2}]}},employees}));
 const disclosure=JSDOM.fragment(html).querySelector('details.production-employee-count');assert.ok(disclosure);assert.equal(disclosure.getAttribute('name'),'onspa-employee-lists');assert.equal(disclosure.open,false);assert.equal(disclosure.querySelector('summary').textContent,'4');assert.equal(disclosure.querySelector('summary').getAttribute('aria-label'),'Nhân viên · 4');
 assert.match(html,/Nhân viên Giả Một/);assert.match(html,/<th scope="col">Giờ HC<\/th><th scope="col">Giờ TC<\/th><th scope="col">Tổng giờ công<\/th>/);assert.match(html,/<td class="number">1,5<\/td><td class="number">0,5<\/td><td class="number">2<\/td>/);assert.doesNotMatch(html,/<details[^>]* open/);
 const {default:Journal}=await vite.ssrLoadModule('/components/production-journal.tsx');
 const journal=renderToStaticMarkup(React.createElement(Journal,{orders,reports:[report],events:[event],employees,open:()=>{},refresh:()=>{},busy:false}));
 assert.match(journal,/<thead><tr><th>Thời gian ghi nhận<\/th><th>Plan ID<\/th><th>LSX<\/th>/);
 assert.match(journal,/<th>Số người<\/th>/);assert.match(journal,/name="onspa-employee-lists"/);
 const journalTable=JSDOM.fragment(journal).querySelector('.production-report-journal'),headers=[...journalTable.tHead.rows[0].cells].map(c=>c.textContent),cells=journalTable.tBodies[0].rows[0].cells;assert.equal(cells[headers.indexOf('Ngày bắt đầu')].textContent,'05/10/2026 08:00:00');assert.equal(cells[headers.indexOf('Ngày hoàn thành')].textContent,'05/10/2026 10:00:00');
 assert.match(journal,/<th>Quy cách<\/th>/);assert.match(journal,/<td>80cm<\/td>/);assert.match(journal,/<td>PLAN-40<\/td>/);
 for(const label of ['Ngày bắt đầu','Ngày hoàn thành','Số lượng hoàn thành','Người ghi nhận (ID)','Số người','Giờ HC / TC','Trạng thái','Chi tiết'])assert.ok(journal.includes(`<th>${label}</th>`),label);
});


test('time journal renders the reference layout with product name, operating hours, source and adjustment reason',async()=>{
 const {default:Journal}=await vite.ssrLoadModule('/components/production-journal.tsx');
 const html=renderToStaticMarkup(React.createElement(Journal,{initialCategory:'time',orders,reports:[report],events:[{...event,cumulativeLaborHours:1.5,reason:'Nhập sai thời gian',supersedes:'old'}],employees,open:()=>{},refresh:()=>{},busy:false}));
 for(const heading of ['Thời gian hệ thống ghi nhận','Plan ID','Tên sản phẩm','Sự kiện','Tổng giờ công lũy kế','Lý do điều chỉnh thời gian'])assert.match(html,new RegExp(`<th(?:\\s+[^>]*)?>\\s*${heading}\\s*</th>`),heading);
 assert.match(html,/Sản phẩm giả kiểm thử/);assert.match(html,/PLAN-40/);assert.match(html,/>1,50<\/td>/);assert.match(html,/Nhập sai thời gian/);assert.match(html,/time-event-complete/);assert.doesNotMatch(html,/<th>Đến thời điểm<\/th>/);
});

test('correction screen uses square selectors and offers adjustments without cancellation controls',async()=>{
 const {default:Correction}=await vite.ssrLoadModule('/components/production-corrections.tsx');
 const html=renderToStaticMarkup(React.createElement(Correction,{orders,reports:[report],events:[event],employees,allowed:true,refresh:async()=>{},showDetail:()=>{}}));
 assert.match(html,/Điều chỉnh báo công/);assert.match(html,/type="checkbox"/);
 assert.doesNotMatch(html,/type="radio"/);assert.doesNotMatch(html,/>Hủy báo công<\/button>/);
 assert.match(html,/production-corrections-screen/);
});

test('progress review separates pending quantities from approved planning output and uses Vietnam completion dates',async()=>{
 const {progressReviewSummary,reportReviewBlocker,reportRequiresDelayReason}=await import('../lib/production-progress-review.mjs');
 const pending={...report,id:'pending',reportedQuantity:800,reviewStatus:'Chờ kiểm tra',completedAt:'2026-10-06T16:00:00Z'};
 const summary=progressReviewSummary(orders[0],[report,pending,{...pending,id:'cancelled',cancelled:true}],[], '2026-10-06T12:00:00Z');
 assert.equal(summary.qty,200);assert.equal(summary.pendingQty,800);assert.equal(summary.completedAt,pending.completedAt);assert.equal(summary.awaitingCompletion,true);assert.equal(summary.startedAt,orders[0].actualStartedAt);assert.equal(summary.timing,'Hoàn thành đúng hạn');
 assert.equal(summary.approved.length,1);assert.equal(summary.pending.length,1);
 assert.equal(summary.approved[0].id,report.id);assert.equal(summary.pending[0].id,pending.id);
 const {progressOrderStatus}=await import('../lib/production-progress-review.mjs');
 assert.deepEqual(progressOrderStatus(summary,{known:true,running:false}),{label:'Chờ xác nhận HT',tone:'review'});
 assert.equal(reportRequiresDelayReason(orders[0],pending,[report,pending]),false);
 assert.equal(reportRequiresDelayReason(orders[0],{...pending,completedAt:'2026-10-06T18:00:00Z'},[report]),true);
 assert.equal(reportReviewBlocker(pending),'');assert.equal(reportReviewBlocker({...pending,hours:null}),'Chưa đủ dữ liệu giờ công');
 assert.equal(reportReviewBlocker({...pending,hours:{hc:null,ot:0,total:0}}),'Chưa đủ dữ liệu giờ công');
 assert.equal(reportReviewBlocker({...pending,pendingAttendance:[{}]}),'Có điều chỉnh giờ chờ duyệt');
});
test('QLSX progress workspace presents review quantities, separate sync destinations and compact square selectors',async()=>{
 const {default:Progress}=await vite.ssrLoadModule('/components/production-progress-review.tsx');
 const html=renderToStaticMarkup(React.createElement(Progress,{orders,reports:[{...report,reviewStatus:'Chờ kiểm tra'}],events:[event],employees,manager:true,busy:false,refresh:()=>{},open:()=>{},active:()=>({count:1,employees:['NV1'],running:true}),onReview:async()=>true,late:[],onApproveHours:()=>{}}));
 for(const label of ['SL đã xác nhận','SL chờ xác nhận','Báo công chờ kiểm tra','LSX-01','Sản phẩm giả kiểm thử','80cm'])assert.ok(html.includes(label),label);
 assert.ok(html.includes('type="checkbox"'));assert.ok(!html.includes('type="radio"'));assert.ok(html.includes('data-no-pagination="true"'));
});

test('progress opens with every planning-synced order, including orders without any production reports or events',async()=>{
 const {default:Progress}=await vite.ssrLoadModule('/components/production-progress-review.tsx');
 const waiting={...orders[0],id:'waiting-order',syncStatus:'ĐÃ ĐỒNG BỘ',planId:'PLAN-41',lsxCode:'LSX-CHUA-SX',name:'Dây cấp nước',spec:'120cm',planStart:'2026-10-08',planEnd:'2026-10-09',actualStartedAt:undefined,actualCompletedAt:undefined,completedQty:0,inTransitQty:1000};
 const html=renderToStaticMarkup(React.createElement(Progress,{orders:[orders[0],waiting],reports:[{...report,reviewStatus:'Chờ kiểm tra'}],events:[event],employees,manager:true,busy:false,refresh:()=>{},open:()=>{},active:o=>o.id===waiting.id?{count:0,employees:[],running:false,known:false}:{count:1,employees:['NV1'],running:true,known:true},onReview:async()=>true,late:[],onApproveHours:()=>{}}));
 for(const label of ['LSX-01','LSX-CHUA-SX','PLAN-41','Dây cấp nước','120cm','08/10/2026','09/10/2026','Chưa SX'])assert.ok(html.includes(label),label);
 const waitingRow=[...JSDOM.fragment(html).querySelectorAll('tbody tr')].find(row=>[...row.cells].some(cell=>cell.textContent.includes('LSX-CHUA-SX')));assert.ok(waitingRow);const quantities=[...waitingRow.querySelectorAll('td.number')].map(cell=>cell.textContent);assert.ok(quantities.includes('1.000'));assert.ok(quantities.includes('0'));
 const noReports=renderToStaticMarkup(React.createElement(Progress,{orders:[waiting],reports:[],events:[],employees,manager:true,busy:false,refresh:()=>{},open:()=>{},active:()=>({count:0,known:false,running:false}),onReview:async()=>true,late:[],onApproveHours:()=>{}}));
 assert.ok(noReports.includes('LSX-CHUA-SX'));assert.ok(!noReports.includes('Không có dữ liệu phù hợp'));
});

test('progress states distinguish running, finished, paused, pending, not started and incident; resuming clears the stopped incident',async()=>{
 const {progressOrderStatus}=await import('../lib/production-progress-review.mjs');
 const summary={completedAt:'',pending:[{id:'r'}]},paused={known:true,running:false};
 assert.equal(progressOrderStatus(summary,{known:false,running:false}).tone,'waiting');
 assert.equal(progressOrderStatus(summary,{known:true,running:true}).tone,'running');
 assert.equal(progressOrderStatus(summary,paused).tone,'paused');
 assert.equal(progressOrderStatus({...summary,completedAt:report.completedAt},paused).tone,'completed');
 assert.equal(progressOrderStatus(summary,paused,[{reportId:'r',finalCompletion:true}]).tone,'review');
 const incident={kind:'incident',stopWork:true,effectiveAt:'2026-10-05T01:00:00Z'};
 assert.equal(progressOrderStatus(summary,paused,[incident]).tone,'incident');
 assert.equal(progressOrderStatus(summary,{known:true,running:true},[incident,{kind:'resume',effectiveAt:'2026-10-05T02:00:00Z'}]).tone,'running');
 assert.equal(progressOrderStatus(summary,paused,[{...incident,voided:true}]).tone,'paused');
});

test('progress labels distinguish six current workers from nine historical report workers without changing the saved report',async()=>{
 const {default:Progress}=await vite.ssrLoadModule('/components/production-progress-review.tsx');
 const ids=Array.from({length:9},(_,i)=>`NV${i+1}`),history={...report,reviewStatus:'Chờ kiểm tra',hours:{...report.hours,perEmployee:ids.map(id=>({id,hc:2,ot:0,total:2}))}};
 const before=JSON.stringify(history);
 const html=renderToStaticMarkup(React.createElement(Progress,{orders:[orders[0]],reports:[history],events:[event],employees,manager:true,busy:false,refresh:()=>{},open:()=>{},active:()=>({count:6,employees:ids.slice(0,6),running:true,known:true}),onReview:async()=>true,late:[],onApproveHours:()=>{}}));
 assert.ok(html.includes('Số người hiện tại'));assert.ok(!html.includes('progress-workforce-note'));assert.ok(!html.includes('progress-status-legend'));assert.ok(!html.includes('progress-review-intro'));assert.ok(html.includes('aria-label="Nhân viên · 6"'));assert.equal(JSON.stringify(history),before);
 const {default:EmployeeCount}=await vite.ssrLoadModule('/components/production-employee-count.tsx');
 assert.ok(renderToStaticMarkup(React.createElement(EmployeeCount,{row:history,employees})).includes('aria-label="Nhân viên · 9"'));
});

test('progress groups planning weeks from KHSX, leaves actual dates blank before production and separates completion outcomes',async()=>{
 const {default:Progress}=await vite.ssrLoadModule('/components/production-progress-review.tsx');
 const {progressOrderStatus}=await import('../lib/production-progress-review.mjs');
 const a={...orders[0],id:'week40',lsxCode:'LSX-W40',week:'2026-09-28',actualStartedAt:undefined,actualCompletedAt:undefined},b={...a,id:'week41',lsxCode:'LSX-W41',week:'2026-10-05'};
 const html=renderToStaticMarkup(React.createElement(Progress,{orders:[b,a],reports:[],events:[],employees,manager:true,busy:false,refresh:()=>{},open:()=>{},active:()=>({count:0,known:false,running:false}),onReview:async()=>true}));
 for(const label of ['Tuần kế hoạch 40: 28/09/2026 – 04/10/2026','Tuần kế hoạch 41: 05/10/2026 – 11/10/2026'])assert.ok(html.includes(label),label);
 assert.ok(html.indexOf('LSX-W40')<html.indexOf('LSX-W41'));assert.ok(!html.includes('Chưa bắt đầu'));assert.ok(!html.includes('Chưa hoàn thành'));
 assert.ok(!html.includes('Trả điều chỉnh'));assert.ok(!html.includes('Duyệt giờ'));assert.ok(!html.includes('Điều chỉnh giờ chờ duyệt'));
 for(const [timing,label,tone] of [['Hoàn thành sớm','HT sớm','early'],['Hoàn thành trễ','HT trễ','late'],['Hoàn thành đúng hạn','Hoàn thành','completed']])assert.deepEqual(progressOrderStatus({completedAt:report.completedAt,timing,pending:[]},{known:true,running:false}),{label,tone});
});

test('daily output follows productionDate and groups exits per LSX/day; unit labor waits for the whole order across months',async()=>{
 const {dailyProductionOutput,orderLaborOutput}=await import('../lib/production-output-summary.mjs');
 const o={...orders[0],lsxQty:300,actualCompletedAt:'2026-10-02T03:00:00Z'};
 const first={...report,id:'first',reportedQuantity:100,approvedQuantity:100,productionDate:'2026-09-30',completedAt:'2026-10-01T03:00:00Z',hours:{hc:18,ot:0,total:18}},second={...first,id:'second',reportedQuantity:200,approvedQuantity:200,productionDate:'2026-10-02',completedAt:o.actualCompletedAt,hours:{hc:36,ot:0,total:36}};
 const daily=dailyProductionOutput([o],[first,second,{...second,id:'cancelled',cancelled:true}]);
 // User requirement 19/10: newest month first; this fixture has one day per month.
 assert.deepEqual(daily.map(r=>[r.date,r.approved]),[['2026-10-02',200],['2026-09-30',100]]);
 assert.equal(orderLaborOutput({...o,actualCompletedAt:undefined},[first]).unit,null);
 const closed=orderLaborOutput(o,[first,second]);assert.equal(closed.total,54);assert.equal(closed.qty,300);assert.equal(closed.unit,0.18);
 assert.equal(orderLaborOutput(o,[first,{...second,reviewStatus:'Chờ kiểm tra'}]).unit,null);
 assert.equal(orderLaborOutput(o,[first,{...second,hours:null}]).unit,null);
 const grouped=dailyProductionOutput([o],[first,{...first,id:'extra',reportedQuantity:50,approvedQuantity:50}]);assert.equal(grouped.length,1);assert.equal(grouped[0].approved,150);
 const {default:Output}=await vite.ssrLoadModule('/components/production-output.tsx');
 const html=renderToStaticMarkup(React.createElement(Output,{orders:[o],reports:[first,second],open:()=>{}}));
 for(const label of ['Tháng 09/2026','Tháng 10/2026','Ngày sản lượng','SL theo ngày','Giờ công theo LSX'])assert.ok(html.includes(label),label);
 assert.ok(!html.includes('GIỜ CÔNG/SP'));assert.ok(html.includes('30/09/2026'));assert.ok(html.includes('02/10/2026'));
 assert.ok(html.indexOf('Tháng 10/2026')<html.indexOf('Tháng 09/2026'),'newest month appears first');
});

test('SX work board groups plan weeks like In Transit, preserving within-week sort and unknown weeks',async()=>{
 const {ProductionWorkBoardView:Board}=await vite.ssrLoadModule('/components/production-work-board.tsx'),{JSDOM}=await import('jsdom');
 const row=(id,week)=>({...orders[0],id,lsxCode:id,week,actualStartedAt:''});
 const rows=[row('next','2026-10-26'),row('first-b','2026-10-19'),row('unknown',undefined),row('first-a','2026-10-21')],before=JSON.stringify(rows);
 const html=renderToStaticMarkup(React.createElement(Board,{rows,reports:[],events:[],active:()=>({known:false,running:false,count:0}),openAction:()=>{},showDetail:()=>{},chosen:null,action:'',effectiveLocal:'',setEffectiveLocal:()=>{},submit:()=>{},cancel:()=>{},busy:false,schedules:[],line:'all',employees:[],page:1,onPageChange:()=>{}}));
 const dom=new JSDOM(html),doc=dom.window.document;
 assert.equal(doc.querySelector('.work-table thead th:last-child').textContent,'Plan ID');
 assert.equal(doc.querySelector('.work-table thead .work-order-code').textContent,'Lệnh sản xuất');
 assert.equal(doc.querySelector('.work-table tbody tr:not(.work-week-divider) td:last-child').textContent,orders[0].planId);
 assert.deepEqual([...doc.querySelectorAll('.work-week-divider')].map(r=>r.textContent),['TUẦN KẾ HOẠCH 43: 19/10/2026 – 25/10/2026','TUẦN KẾ HOẠCH 44: 26/10/2026 – 01/11/2026','Tuần kế hoạch chưa xác định']);
 assert.deepEqual([...doc.querySelectorAll('.work-table tbody>tr:not(.work-week-divider)')].map(r=>r.querySelector('.work-order-code button').textContent),['first-b','first-a','next','unknown']);assert.equal(doc.querySelectorAll('.work-mobile-week').length,3);assert.equal(JSON.stringify(rows),before);dom.window.close();
});
test('SX week divider repeats on page two without counting it as a production order',async()=>{
 const {ProductionWorkBoardView:Board}=await vite.ssrLoadModule('/components/production-work-board.tsx'),{JSDOM}=await import('jsdom');
 const rows=Array.from({length:12},(_,i)=>({...orders[0],id:`page-${i}`,lsxCode:`LSX-${i}`,week:'2026-12-28'}));
 for(const page of [1,2]){
  const html=renderToStaticMarkup(React.createElement(Board,{rows,reports:[],events:[],active:()=>({known:false,running:false,count:0}),openAction:()=>{},showDetail:()=>{},chosen:null,action:'',effectiveLocal:'',setEffectiveLocal:()=>{},submit:()=>{},cancel:()=>{},busy:false,schedules:[],line:'A',employees:[],page,onPageChange:()=>{}}));
  const dom=new JSDOM(html),doc=dom.window.document;
  assert.equal(doc.querySelectorAll('.work-table tbody>tr:not([hidden]):not(.work-week-divider)').length,page===1?10:2);assert.equal(doc.querySelectorAll('.work-week-divider:not([hidden])').length,1);assert.match(doc.querySelector('.work-week-divider:not([hidden])').textContent,/53: 28\/12\/2026 – 03\/01\/2027/);assert.equal(doc.querySelectorAll('.work-mobile-card').length,page===1?10:2);assert.equal(doc.querySelectorAll('.work-table tbody>tr:not(.work-week-divider)').length,12);dom.window.close();
 }
});

test('output groups months newest first and preserves per-production-date quantities without imposing day order',async()=>{
 const {dailyProductionOutput}=await import('../lib/production-output-summary.mjs');
 const order={...orders[0],lsxQty:51};
 const entries=[['2026-10-03',21],['2026-08-31',8],['2026-10-01',13],['2026-09-30',9]].map(([date,qty],i)=>({...report,id:`MONTH-${i}`,transitId:order.id,productionDate:date,completedAt:'2026-11-03T01:00:00Z',reportedQuantity:qty,approvedQuantity:qty}));
 const before=JSON.stringify(entries),expected=new Map([['2026-10-03',21],['2026-08-31',8],['2026-10-01',13],['2026-09-30',9]]);
 for(const input of [entries,[...entries].reverse()]){
  const rows=dailyProductionOutput([order],input);
  const months=rows.filter((r,i)=>i===0||r.month!==rows[i-1].month).map(r=>r.month);
  assert.deepEqual(months,['2026-10','2026-09','2026-08']);
  assert.deepEqual(new Map(rows.map(r=>[r.date,r.approved])),expected);
  assert.equal(rows.reduce((n,r)=>n+r.approved,0),51);
 }
 assert.equal(JSON.stringify(entries),before);
});
