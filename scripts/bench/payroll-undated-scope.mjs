// Before/after pure-helper benchmark against the documented previous PR head.
// No DB, HTTP, credentials or production data. Run from a Git checkout.
import test from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
import {payrollMonth as after} from '../../lib/production-payroll-month.mjs';
const baseline='9cc828e55dbe3aa18465c48e7cb7128b8ed881d0',root=new URL('../../',import.meta.url);
const source=execFileSync('git',['show',baseline+':lib/production-payroll-month.mjs'],{cwd:root,encoding:'utf8'}).replace(/from '(\.\/[^']+)'/g,(_m,p)=>`from '${new URL('lib/'+p.slice(2),root).href}'`);
const {payrollMonth:before}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
test('linear undated scope check preserves exact dated-report calculations at representative scales',t=>{
 for(const [orderCount,reportCount] of [[50,1000],[500,10000]]){
  const orders=Array.from({length:orderCount},(_,i)=>({id:'SYNTHETIC-LSX-'+i,sku:'SYNTHETIC-SKU',line:i%2?'B':'A',lsxQty:100000})),reports=Array.from({length:reportCount},(_,i)=>({id:'SYNTHETIC-REPORT-'+i,kind:'completion',transitId:orders[i%orderCount].id,productionDate:'2026-10-01',reviewStatus:'Đã xác nhận',approvedQuantity:1,reportedQuantity:1,hours:{hc:1,ot:0,total:1}})),input={orders,reports,employees:[],events:[],schedules:[],month:'2026-10',standards:new Map([['SYNTHETIC-SKU',.1]])},original=structuredClone(input),expected=before(input),samples=[];
  assert.deepEqual(after(input),expected);
  for(let round=0;round<3;round++)for(const [phase,calculate] of round%2?[['after',after],['before',before]]:[['before',before],['after',after]]){const cpu=process.cpuUsage(),start=performance.now(),value=calculate(input),wallMs=performance.now()-start,used=process.cpuUsage(cpu);assert.deepEqual(value,expected);samples.push({round,phase,wallMs:Number(wallMs.toFixed(2)),nodeCpuMs:Number(((used.user+used.system)/1000).toFixed(2))});}
  assert.deepEqual(input,original);t.diagnostic(JSON.stringify({baseline,node:process.version,orders:orderCount,reports:reportCount,samples,limits:'Synthetic pure payrollMonth calls. Empty workforce/calendar intentionally preserve identical missing-attendance blocks. No API/network/browser/Worker CPU/p95/peak-memory or production capacity claim.'}));
 }
});
