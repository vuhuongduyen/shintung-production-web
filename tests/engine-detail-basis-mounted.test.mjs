import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'vite';
import {engineDetailBasis} from '../lib/engine-detail-basis.mjs';
const {JSDOM}=createRequire(import.meta.url)('jsdom');const dom=new JSDOM('<!doctype html><body></body>',{url:'https://test.invalid'});
for(const name of ['window','document','HTMLElement','Event','Node'])globalThis[name]=dom.window[name];globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
const vite=await createServer({appType:'custom',configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false}});
const {EngineCalculationDetails}=await vite.ssrLoadModule('/components/engine-calculation-details.tsx');after(async()=>{await vite.close();dom.window.close();});
const week='2026-11-09',sku='SYNTHETIC-DETAIL',row={id:'row',sku,suggested:70};
const metric={dailyDemand:10,leadTime:5,safetyDays:2,rop:70,eventWeek:4,stock:3,inTransit:1,moq:5,replenish:70,standardHours:0.2,reason:'Saved reason',forecastBasis:{f30:300,f60:600,f90:900,d30:10,d60:10}};
async function renderCase(callback){const host=document.createElement('div');document.body.append(host);const root=createRoot(host);try{await callback(host,async detail=>{await act(async()=>root.render(React.createElement(EngineCalculationDetails,{metric:detail.metric,suggested:detail.row.suggested})));});}finally{await act(async()=>root.unmount());host.remove();}}
test('saved Engine detail stays 10 × 7 = 70 after Forecast/Demand Event/master changes and reload',async()=>{
 const saved={payload:{week,rows:[row],metrics:[[row.id,structuredClone(metric)]]}},before=JSON.stringify(saved);
 await renderCase(async(host,render)=>{
  await render(engineDetailBasis(saved,week,sku,{rows:[row],metrics:new Map([[row.id,metric]])}));const original=host.textContent;
  const changed={rows:[{...row,suggested:999}],metrics:new Map([[row.id,{...metric,dailyDemand:99,eventWeek:999,leadTime:90,safetyDays:9,rop:9801,standardHours:9,forecastBasis:{f30:2970}}]])};
  await render(engineDetailBasis(JSON.parse(JSON.stringify(saved)),week,sku,changed));
  assert.equal(host.textContent,original);assert.match(host.textContent,/10 × 7 = 70/);assert.doesNotMatch(host.textContent,/99 ×|2970|9801/);assert.equal(JSON.stringify(saved),before);
 });
});
test('legacy metric keeps stored results without inventing Forecast or hours; absent basis never uses live inputs',async()=>{
 await renderCase(async(host,render)=>{
  const old={...metric};delete old.forecastBasis;delete old.standardHours;
  const saved={payload:{week,rows:[row],metrics:[[row.id,old]]}};
  await render(engineDetailBasis(saved,week,sku,{rows:[row],metrics:new Map([[row.id,metric]])}));assert.match(host.textContent,/10 × 7 = 70/);assert.match(host.textContent,/Thiếu căn cứ đã lưu/);
  delete old.dailyDemand;await render(engineDetailBasis(saved,week,sku,{rows:[row],metrics:new Map([[row.id,metric]])}));assert.match(host.textContent,/ROP đã lưu: 70/);assert.doesNotMatch(host.textContent,/× 7 =/);
  delete saved.payload.metrics;await render(engineDetailBasis(saved,week,sku,{rows:[row],metrics:new Map([[row.id,metric]])}));assert.match(host.textContent,/ROP đã lưu: Thiếu căn cứ đã lưu/);
  saved.payload.rows[0]={...row,engineCalculationBasis:{metric}};await render(engineDetailBasis(saved,week,sku,null));assert.match(host.textContent,/10 × 7 = 70/);
 });
});
test('zero captured demand is valid and inconsistent historical operands never rewrite the saved ROP',async()=>{
 await renderCase(async(host,render)=>{
  await render({row,metric:{...metric,dailyDemand:0,rop:0}});assert.match(host.textContent,/0 × 7 = 0/);
  await render({row,metric:{...metric,rop:71}});assert.match(host.textContent,/ROP đã lưu: 71/);assert.doesNotMatch(host.textContent,/10 × 7 = 71/);
 });
});
