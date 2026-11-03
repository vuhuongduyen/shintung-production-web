import test from 'node:test';
import assert from 'node:assert/strict';
import {reportTypes,reportRows,unpackPlans,filterReport,weekLabel,xmlWorkbook,columnsFor} from '../lib/planning-reports.mjs';
import {normalizeTransit,transitReportRows} from '../lib/in-transit.mjs';
const week='2026-09-21';
const plans=unpackPlans([{key:week,payload:{week,rows:[{id:'p1',sku:'S1',plan:100,line:'A',status:'ĐÃ CHUYỂN',sourceIds:['new'],suggested:90},{id:'p2',sku:'S2',plan:50,status:'HỦY'}]}}]);
test('eleven reports retain the seven existing transit filter semantics',()=>{
 assert.equal(reportTypes.length,11);
 const transit=[normalizeTransit({id:'a',week,lsxCode:'LSX',lsxQty:100,completedQty:20,planEnd:'2026-09-22'}),normalizeTransit({id:'b',week}),normalizeTransit({id:'c',week,cancelReason:'Stop'})];
 for(const [type] of reportTypes.slice(0,7))assert.deepEqual(reportRows(type,{transit},'2026-09-24').map(r=>r.id),transitReportRows(transit,type,'','2026-09-24').map(r=>r.id));
});
test('plan actual counts one plan, sums eligible linked LSX and excludes cancelled/unrelated rows',()=>{
 const transit=[{id:'t1',planRowId:'p1',week,lsxQty:60,completedQty:40},{id:'t2',planRowId:'p1',week,lsxQty:40,completedQty:30,isAdditionalLsx:true},{id:'t3',planRowId:'p1',week,lsxQty:100,completedQty:100,status:'HỦY'},{id:'t4',planRowId:'p1',week:'2026-09-14',completedQty:200},{id:'t5',planRowId:'another',week,completedQty:900}];
 const [row]=reportRows('plan-actual',{plans,transit});assert.equal(reportRows('plan-actual',{plans,transit}).length,1);assert.equal(row.planQty,100);assert.equal(row.lsxQty,100);assert.equal(row.completedQty,70);assert.equal(row.remaining,30);assert.equal(row.progress,70);
});
test('engine comparison takes only latest weekly snapshot and requires explicit source link',()=>{
 const engines=[{key:'old',payload:{week,generatedAt:'2026-09-20',rows:[{sku:'S1',suggested:999}]}},{key:'new',payload:{week,generatedAt:'2026-09-21',rows:[{sku:'S1',suggested:90},{sku:'S2',suggested:20},{sku:'S3',suggested:10},{sku:'S4',suggested:0},{sku:'S5',suggested:4,priority:'KHÔNG BỔ SUNG'}]}}];
 const rows=reportRows('engine-plan',{plans,engines});assert.equal(rows.length,3);assert.equal(rows[0].processing,'received');assert.equal(rows[0].received,90);assert.equal(rows[0].difference,10);assert.equal(rows[1].processing,'plan-cancelled');assert.equal(rows[2].processing,'not-received');assert.equal(rows[2].received,null);
 const other=reportRows('engine-plan',{plans:plans.map(p=>({...p,sourceIds:['old']})),engines});assert.equal(other[0].processing,'other-source');assert.equal(other[0].received,null);
});
test('unplanned demand uses delivery date and accurate overdue days and master groups',()=>{
 const rows=reportRows('unprocessed-demand',{demand:[{sku:'S',status:'Chưa lập kế hoạch',delivery:'20/09/2026',requestDate:'18/09/2026'},{sku:'T',status:'Đã lập kế hoạch'},{sku:'X',status:'Chưa lập kế hoạch',_deleted:true}],catalog:[{code:'S',group:'G'}]},'2026-09-21');assert.equal(rows.length,1);assert.equal(rows[0].overdueDays,1);assert.equal(rows[0].group,'G');assert.equal(rows[0].week,'2026-09-14');assert.equal(filterReport(rows,{week,from:'2026-09-21'}).length,0);
});
test('weekly plan preserves dates and statuses, detects duplicates and excludes deleted data',()=>{
 assert.equal(reportRows('weekly-plan',{plans}).length,2);assert.equal(reportRows('weekly-plan',{plans})[0].planQty,100);
 assert.throws(()=>unpackPlans([{key:week,payload:{rows:[{sku:'S'},{sku:'S'}]}}]),/PLAN_DUPLICATE/);
 assert.equal(unpackPlans([{payload:{_deleted:true,rows:[{sku:'S'}]}}]).length,0);
 assert.equal(weekLabel('2026-09-30'),'28/09/2026 - 04/10/2026');
});
test('filters combine and XML preserves numbers and untrusted text without formulas',()=>{
 const rows=[{sku:'SKU1',name:'Vòi',week,group:'G',line:'A',status:'DỰ KIẾN',reportDate:week}];
 assert.equal(filterReport(rows,{query:'voi',group:'G',line:'A',week,from:week,to:week}).length,1);assert.equal(filterReport(rows,{status:'HỦY'}).length,0);
 const xml=xmlWorkbook('Report & test',['Qty','Name'],[[10,'=HYPERLINK("bad")<script>']]);assert.match(xml,/ss:Type="Number">10/);assert.match(xml,/ss:Type="String">=HYPERLINK/);assert.ok(!xml.includes('<script>'));assert.ok(columnsFor('sync-issues').includes('syncError'));
});
