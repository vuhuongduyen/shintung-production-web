import test from 'node:test';
import assert from 'node:assert/strict';
import {payrollFundHistory} from '../lib/production-fund-history.mjs';
import {payrollFundHistoryReport,payrollXlsx} from '../lib/production-payroll-export.mjs';
const calculate=month=>['A','B'].map(line=>({line,share:{allocated:3000000},result:{issues:[],paid:line==='A'?2000000:2500000,unallocated:line==='A'?700000:500000,returned:line==='A'?300000:0}}));
test('each line has its own running retained balance without reallocating next month',()=>{
 const h=payrollFundHistory({from:'2026-10',to:'2026-12',calculate});
 assert.deepEqual(h.companyRows.map(r=>r.cumulative),[300000,600000,900000]);assert.equal(h.completeMonths,3);assert.equal(h.rows.length,6);
 assert.deepEqual(h.rows.map(r=>r.cumulative),[700000,500000,1400000,1000000,2100000,1500000]);
 assert.equal(h.totals.allocated,18000000);assert.equal(h.totals.paid+h.totals.retained+h.totals.returned,h.totals.allocated);
 assert.ok(h.rows.every(r=>r.allocated===3000000));
});
test('unknown month is not zero; gaps block running totals and fully reconcile only known inputs',()=>{
 const h=payrollFundHistory({from:'2026-10',to:'2026-12',calculate:month=>month==='2026-11'?calculate(month).map(r=>({...r,result:{...r.result,issues:['Thiếu ngày bắt đầu']}})):calculate(month)});
 assert.equal(h.completeMonths,2);assert.equal(h.totals.paid,null);assert.equal(h.totals.retained,null);
 assert.equal(h.rows[2].paid,null);assert.equal(h.rows[4].retained,700000);assert.equal(h.rows[4].cumulative,null);
 const report=payrollFundHistoryReport(h);assert.equal(report.sheets[0].rows.find(r=>r.values[0]?.v==='2026-11').values[3].v,null);assert.ok(payrollXlsx(report).length>1000);
});
test('validates range and supports crossing year boundaries, restricted line cannot infer shared fund',()=>{
 for(const [from,to] of [['','2026-01'],['2026-13','2027-01'],['2026-02','2026-01'],['2024-01','2026-01']])assert.ok(payrollFundHistory({from,to,calculate}).error);
 const h=payrollFundHistory({from:'2026-12',to:'2027-01',calculate});assert.deepEqual(h.rows.map(r=>r.month),['2026-12','2026-12','2027-01','2027-01']);
 const restricted=payrollFundHistory({from:'2026-10',to:'2026-10',calculate:month=>calculate(month).slice(0,1)});assert.equal(restricted.completeMonths,0);assert.equal(restricted.rows[0].paid,null);assert.match(restricted.rows[0].issues.join(),/quyền xem cả Line/);
});
test('fund history PDF renders known and missing months with a legible header',async()=>{
 const {createCanvas,GlobalFonts}=await import('@napi-rs/canvas');GlobalFonts.registerFromPath('public/fonts/OnspaReport.ttf','OnspaReport');
 const {payrollPdf}=await import('../lib/production-payroll-export.mjs');
 const saved=globalThis.document;
 globalThis.document={createElement:()=>createCanvas(1,1)};
 try{const report=payrollFundHistoryReport(payrollFundHistory({from:'2026-01',to:'2026-12',calculate:m=>m==='2026-05'?calculate(m).map(r=>({...r,result:{...r.result,issues:['Thiếu lịch làm việc','Thiếu ngày bắt đầu']}})):calculate(m)}));const bytes=await payrollPdf(report);assert.match(new TextDecoder().decode(bytes.slice(0,8)),/%PDF-1/);assert.ok(bytes.length>10000);}finally{globalThis.document=saved;}
});

test('Line C contribution at B returns to company only, and missing months block company balance',()=>{
 const calculateB=month=>calculate(month).map(r=>r.line==='B'?{...r,result:{...r.result,paid:2000000,returned:500000}}:r);
 const h=payrollFundHistory({from:'2026-10',to:'2026-11',calculate:calculateB});
 assert.equal(h.rows[3].cumulative,1000000);assert.equal(h.companyRows[1].sourceB,500000);assert.equal(h.companyRows[1].cumulative,1600000);
 const report=payrollFundHistoryReport(h);assert.equal(report.sheets.length,1);assert.equal(h.totals.remaining,4000000);assert.equal(h.totals.paid+h.totals.remaining,h.totals.allocated);
 const gap=payrollFundHistory({from:'2026-10',to:'2026-11',calculate:m=>m==='2026-10'?calculateB(m).map(r=>({...r,result:{...r.result,issues:['Thiếu lịch']}})):calculateB(m)});
 assert.equal(gap.companyRows[0].returned,null);assert.equal(gap.companyRows[1].returned,800000);assert.equal(gap.companyRows[1].cumulative,null);
});

test("hide January through September 2026 before calculation and totals",()=>{const seen=[];const h=payrollFundHistory({from:"2026-01",to:"2026-10",calculate:m=>{seen.push(m);return calculate(m);}});assert.deepEqual(seen,["2026-10"]);assert.equal(h.from,"2026-10");assert.equal(h.monthCount,1);assert.equal(h.totals.remaining,1500000);assert.equal(h.totals.unallocated,1200000);assert.equal(h.totals.returned,300000);assert.equal(h.rows[0].cumulative,700000);});

test('return details retain employee identity, work line and exact returned amounts',()=>{
 const calculateDetails=()=>['A','B'].map(line=>({line,share:{allocated:100},people:[{id:'S2017002',name:'Trầm Thuận Phát',line:'C',hc:7,ot:1}],result:{issues:[],paid:80,unallocated:0,returned:20,details:new Map([['S2017002',{returned:20,reason:'Line C'}],['OTHER',{returned:0}]])}}));
 const h=payrollFundHistory({from:'2026-10',to:'2026-10',calculate:calculateDetails});
 assert.deepEqual(h.rows.map(r=>r.returnDetails[0].workLine),['A','B']);
 for(const r of h.rows){assert.equal(r.returnDetails.length,1);assert.equal(r.returnDetails[0].name,'Trầm Thuận Phát');assert.equal(r.returnDetails[0].homeLine,'C');assert.equal(r.returnDetails[0].hours,8);assert.equal(r.returnDetails.reduce((n,d)=>n+d.amount,0),r.returned);}
 const missing=payrollFundHistory({from:'2026-10',to:'2026-10',calculate:()=>calculateDetails().map(r=>({...r,result:{...r.result,issues:['Thiếu lịch']}}))});assert.ok(missing.rows.every(r=>r.returnDetails.length===0));
});
