import {demandMatchesWeek} from '../lib/demand-week.mjs';
import {usableSku} from '../lib/sku-state.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {nextMonth,demandKey} from '../scripts/local/import-planning.mjs';

test('Site 162 Daily Demand uses rounded max of 30D and 60D; 90D only warns',()=>{
 const source=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
 const fn=source.slice(source.indexOf('const calculateForecastDemand ='),source.indexOf('const nextForecastMonth ='));
 const context=vm.createContext({});vm.runInContext(ts.transpileModule(fn+';globalThis.calculate=calculateForecastDemand;', {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
 assert.equal(context.calculate({f30:366,f60:670,f90:1062}).used,12);
 assert.equal(context.calculate({f30:30,f60:600,f90:90000}).used,10);
 assert.equal(context.calculate({f30:45,f60:0,f90:0}).used,2);
 assert.equal(context.calculate({f30:0,f60:0,f90:0}).used,0);
 assert.equal(context.calculate({f30:'',f60:null,f90:''}).used,0);
 assert.ok(Number.isNaN(context.calculate({f30:undefined,f60:0}).used));
});

test('report month rollover and Demand composite identity preserve blank weeks',()=>{
 assert.equal(nextMonth('12/2026'),'01/2027');assert.equal(nextMonth('07/2026'),'08/2026');assert.throws(()=>nextMonth('13/2026'));
 const row={requestDate:'14/09/2026',sku:'A',qty:40,delivery:'15/09/2026',type:'Bù tải',plannedWeek:''};
 assert.notEqual(demandKey(row),demandKey({...row,plannedWeek:'14/09/2026'}));
});

test('Engine excludes planned events including Bù tải; missing inputs default per SKU; MOQ rounds up',()=>{
 const source=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
 const fn=source.slice(source.indexOf('function buildProductionEngine('),source.indexOf('const proposalRows:',source.indexOf('function buildProductionEngine(')));
 const context=vm.createContext({usableSku,demandMatchesWeek,forecastData:{},leadtimeRows:[],skus:[{code:'A',confirmation_status:'Đã xác nhận',usage_status:'Đang sử dụng',leadTime:'2',moq:10,line:'A'}],leadtimeBySku:new Map(),
  mondayOf:d=>{const x=new Date(d);x.setDate(x.getDate()-(x.getDay()+6)%7);return x;},
  parseViDate:s=>{const [d,m,y]=s.split('/');return new Date(`${y}-${m}-${d}T00:00:00`);},
  formatViDate:d=>d.toISOString().slice(0,10),safetyBreakdown:()=>({total:1}),priorityRank:()=>1});
 vm.runInContext(ts.transpileModule(fn,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
 const forecast=[{sku:'A',month:'09/2026',applicationMonth:'09/2026',sourceReportMonth:'08/2026',used:10,f30:300,line:'A'}];
 const planned={sku:'A',status:'ĐÃ LẬP KẾ HOẠCH',type:'Bù tải',qty:999,delivery:'16/09/2026'};
 const run=(events,stock=new Map([['A',9]]),rule={leadTimeRules:[{from:0,to:null,days:1,status:"Đang áp dụng"}]},transit=new Map())=>context.buildProductionEngine(forecast,events,'2026-09-14',stock,rule,transit);
 assert.equal(run([planned]).rows[0].suggested,30);
 assert.equal(run([planned]).metrics.values().next().value.eventWeek,0);
 assert.equal(run([{...planned,status:'CHƯA LẬP KẾ HOẠCH',qty:11}]).rows[0].suggested,40);
 assert.equal(run([],new Map()).rows.length,1);
 assert.equal(run([],undefined,undefined,null).rows.length,1);
 const missing=context.buildProductionEngine(forecast,[{...planned,status:'CHƯA LẬP KẾ HOẠCH',qty:1275}],'2026-09-14',new Map(),undefined,null,[{code:'A',confirmation_status:'Đã xác nhận',usage_status:'Đang sử dụng',leadTime:'',moq:0,line:'',status:'Chờ xác nhận',confirmation_status:'Chờ xác nhận',usage_status:'Chưa sử dụng'}]);
 assert.equal(missing.rows.length,0);assert.equal(missing.metrics.size,0);assert.ok(missing.warnings.some(w=>w.includes('không tính Engine')));
 const zero=context.buildProductionEngine(forecast,[],'2026-09-14',new Map(),undefined,null,[{code:'A',confirmation_status:'Đã xác nhận',usage_status:'Đang sử dụng',leadTime:'0',moq:0,line:''}]);assert.equal(zero.metrics.values().next().value.defaults.includes('leadTime'),false);
 const partial=context.buildProductionEngine([...forecast,{...forecast[0],sku:'UNKNOWN'}],[],'2026-09-14',new Map(),undefined,null);assert.equal(partial.rows.length,1);assert.equal(partial.stats.unmatched,1);
 assert.equal(run([{...planned,status:'CHƯA LẬP KẾ HOẠCH',delivery:'01/09/2026'}]).metrics.values().next().value.eventWeek,0);
 assert.equal(context.buildProductionEngine(forecast,[],'2026-07-06',new Map(),{},new Map()).rows.length,0);
});
