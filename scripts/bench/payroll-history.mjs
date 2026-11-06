// Pure synthetic fixtures; no DB, browser, network or production bindings.
import assert from 'node:assert/strict';import {performance} from 'node:perf_hooks';import {pathToFileURL} from 'node:url';import {monthlyEarnedOrders} from '../../lib/production-payroll.mjs';
const previous=process.argv[2]?(await import(pathToFileURL(process.argv[2]).href)).monthlyEarnedOrders:null,results=[];
for(const count of [50,500]){
 const orders=Array.from({length:count},(_,i)=>({id:`SYNTHETIC-LSX-${i}`,lsxCode:`SYNTHETIC-LSX-${i}`,sku:'SYNTHETIC-SKU',name:'Synthetic product',planId:`SYNTHETIC-PLAN-${i}`,line:i%2?'B':'A',lsxQty:1000})),reports=orders.flatMap(o=>Array.from({length:20},(_,i)=>({id:`${o.id}-${i}`,kind:'completion',transitId:o.id,reportingModel:'daily-finished-v1',quantityOnly:true,line:o.line,sku:o.sku,lsxCode:o.lsxCode,name:o.name,planId:o.planId,productionDate:'2026-11-02',reportedQuantity:1,approvedQuantity:1,reviewStatus:'Đã xác nhận',rateBasis:{value:.1,productionDate:'2026-11-02',versionId:'SYNTHETIC-RATE'}}))),input=structuredClone({orders,reports}),args=[orders,reports,'2026-11','A',new Map(),true];
 if(previous)assert.deepEqual(monthlyEarnedOrders(...args),previous(...args));
 for(const f of [previous,monthlyEarnedOrders].filter(Boolean))f(...args);
 for(let sample=0;sample<5;sample++)for(const [label,fn] of [...(previous?[['before',previous]]:[]),['after',monthlyEarnedOrders]]){const start=performance.now(),rows=fn(...args);results.push({orders:count,reports:reports.length,sample,label,ms:Number((performance.now()-start).toFixed(3)),rows:rows.length,earned:rows.reduce((n,r)=>n+r.earned,0)});}
 assert.deepEqual({orders,reports},input);
}
console.log(JSON.stringify({node:process.version,results,limits:'Pure local JS only, one warm-up and five samples; equal full results verified. Not Worker CPU/memory, DB, network or browser timing.'}));
