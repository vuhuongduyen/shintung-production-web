import test from 'node:test';import assert from 'node:assert/strict';
import {dailyFixture} from './helpers/daily-output-fixture.mjs';
import {records} from '../scripts/local/database.mjs';
import {readProductionWorkflow} from '../scripts/local/production-workflow.mjs';
import {observeReadDatabase} from '../worker/read-performance.mjs';
import {progressReviewSummary} from '../lib/production-progress-review.mjs';
import {reviewSnapshot} from '../lib/production-review-selection.mjs';
test('all progress reads report/event/history pages once and preserves review evidence and saved records',()=>dailyFixture(async c=>{
 for(let i=0;i<25;i++)await c.put('production_report','R'+i,{id:'R'+i,kind:'completion',transitId:c.order.id,line:'A',reportedQuantity:10,approvedQuantity:i%2?10:0,reviewStatus:i%2?'Đã xác nhận':'Chờ kiểm tra',completedAt:'2026-11-02T09:00:00+07:00',hours:{hc:1,ot:0,total:1},laborNotes:[{text:'Keep original note'}],sourceSnapshot:{audit:'x'.repeat(1000)}});
 await c.put('production_event','START',{kind:'start',sourceId:c.order.id,line:'A',effectiveAt:'2026-11-02T08:00:00+07:00',employees:[],count:0});
 await c.put('production_history_import','H',{reports:[{id:'H-R',transitId:c.order.id,line:'A',kind:'completion',reportedQuantity:5,approvedQuantity:5,reviewStatus:'Đã xác nhận',hours:{hc:1,ot:0,total:1},completedAt:'2026-11-01'}]});
 const before=await records(c.db),actor={login:'TEST',isAdmin:true};
 const full=await readProductionWorkflow(c.db,actor,[],{includeDerivedHours:false,includeJournalHours:false});
 const measured=observeReadDatabase(c.db),progress=await readProductionWorkflow(measured.database,actor,[],{progressRead:true,includeDerivedHours:false,includeJournalHours:false});
 const stats=measured.summary();console.log('All-progress payload read calls:',JSON.stringify(Object.fromEntries(['production_reportCalls','production_eventCalls','production_history_importCalls','calls'].map(k=>[k,stats[k]]))));
 for(const entity of ['production_report','production_event','production_history_import'])assert.equal(stats[entity+'Calls'],2,entity+' reads metadata + payload once');
 for(const order of progress.orders){const a=progressReviewSummary(order,full.reports,full.events),b=progressReviewSummary(order,progress.reports,progress.events);for(const key of ['qty','pendingQty','startedAt','completedAt','hc','ot'])assert.deepEqual(b[key],a[key]);}
 for(const r of progress.reports){const o=progress.orders.find(o=>o.id===r.transitId);assert.equal(reviewSnapshot(o,r),reviewSnapshot(o,full.reports.find(old=>old.id===r.id)));}
 assert.deepEqual(await records(c.db),before);
}));
