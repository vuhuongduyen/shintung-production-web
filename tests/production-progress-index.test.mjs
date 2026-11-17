import test from 'node:test';import assert from 'node:assert/strict';
import {activeProgressOrders} from '../scripts/local/production-progress-read.mjs';
import {pendingReportReview} from '../lib/production-progress-review.mjs';
import {normalized} from '../lib/production-plan.mjs';
const reference=(state,actor)=>{const pending=state.summaryReports.filter(pendingReportReview),matches=(r,o)=>r.transitId?r.transitId===o.id:(r.lsxCode||r.orderCode||r.mo)?normalized(r.lsxCode||r.orderCode||r.mo)===normalized(o.lsxCode):!o.planGroupId&&Boolean(o.planId&&normalized(r.planId)===normalized(o.planId));const orders=state.rows.filter(o=>(!actor.line||o.line===actor.line)&&o.status!=='HỦY'&&!(Number(o.lsxQty)>0&&Number(o.completedQty)>=Number(o.lsxQty)&&!pending.some(r=>matches(r,o))));const known=new Set(state.rows.map(o=>o.id));for(const r of pending)if(r.transitId&&!known.has(r.transitId)&&(!actor.line||r.line===actor.line))orders.push({id:r.transitId,lsxCode:r.lsxCode||'',planId:r.planId||''});return orders;};
test('indexed active membership matches prior identity precedence, zero pending, cancelled, orphan, Unicode and split Plan behavior',()=>{
 const rows=Array.from({length:1200},(_,i)=>({id:'ORDER-'+i,lsxCode:i%11?'LSX '+i:' ĐƠN  '+i,planId:i%17?'PLAN-'+i:'',planGroupId:i%4?'':'SPLIT',lsxQty:100,completedQty:i%7?100:0,status:i%13?'MỞ':'HỦY',line:i%2?'A':'B'}));
 const summaryReports=Array.from({length:900},(_,i)=>({id:'REPORT-'+i,...(i%5===0?{transitId:'ORDER-'+i,lsxCode:'LSX '+(i+1)}:i%5===1?{lsxCode:rows[i].lsxCode}:i%5===2?{orderCode:rows[i].lsxCode}:i%5===3?{mo:rows[i].lsxCode}:{planId:'PLAN-'+i}),reportedQuantity:0,reviewStatus:i%7?'Chờ kiểm tra':'Lịch sử chờ đối chiếu',line:i%2?'A':'B',cancelled:i%29===0,voided:i%31===0}));
 summaryReports.push({transitId:'ORPHAN',line:'A',reviewStatus:'Chờ kiểm tra'},{transitId:'ORPHAN-B',line:'B',reviewStatus:'Chờ kiểm tra'});
 const state={rows,summaryReports},before=JSON.stringify(state);
 for(const actor of [{},{line:'A'},{line:'B'}])assert.deepEqual(activeProgressOrders(state,actor),reference(state,actor));
 assert.equal(JSON.stringify(state),before);
});
