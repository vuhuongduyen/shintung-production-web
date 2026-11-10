import test,{after} from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';import {createServer} from 'vite';import {fileURLToPath} from 'node:url';
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://synthetic.test',pretendToBeVisual:true});
for(const name of ['window','document','HTMLElement','HTMLInputElement','HTMLSelectElement','HTMLButtonElement','MutationObserver','CustomEvent','Event','Element','Node','NodeFilter','getComputedStyle','requestAnimationFrame','cancelAnimationFrame','localStorage'])globalThis[name]=dom.window[name];
globalThis.IS_REACT_ACT_ENVIRONMENT=true;globalThis.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};const oldChannel=globalThis.BroadcastChannel;globalThis.BroadcastChannel=class{postMessage(){}close(){}};
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client'),rootPath=fileURLToPath(new URL('..',import.meta.url)).replace(/\/$/,'');
const vite=await createServer({appType:'custom',configFile:false,resolve:{alias:{'@':rootPath}},plugins:[{name:'expose-existing-component-only',enforce:'pre',transform(source,id){if(id===`${rootPath}/app/page.tsx`)return `${source}\nexport {PlanningView};`;}}],server:{middlewareMode:true,hmr:false}});
const app=await vite.ssrLoadModule('/app/page.tsx'),sync=await vite.ssrLoadModule('/lib/data-sync.ts');
const sku='SYNTHETIC-PR16',week='2026-10-19',month='10/2026';
const masterRows=[{code:sku,name:'Synthetic engine',specification:'Test',group:'Test',line:'A',unit:'PCS',mode:'Sản xuất',confirmation_status:'Đã xác nhận',usage_status:'Đang sử dụng',status:'Đã xác nhận',standardHours:'0.999'}];
const row={id:'SYNTHETIC-ROW',sku,name:'Synthetic engine',spec:'Test',group:'Test',line:'A',priority:'CAO - ROP',suggested:1000,qty:1000,status:'Chưa đưa vào kế hoạch',moq:1};
const metric={...(process.env.SYNTHETIC_ENGINE_RATE?{standardHours:Number(process.env.SYNTHETIC_ENGINE_RATE)}:{}),weekLabel:'19–25/10/2026',month,dailyDemand:1,eventWeek:0,stock:10,inTransit:0,replenish:1000,moq:1,transit:0,leadTime:7,safetyDays:7,rop:14,needed:1000,afterMoq:1000,reason:'Synthetic saved result'};
const saved={key:'SYNTHETIC-RUN',payload:{week,generatedAt:'2026-10-19T00:00:00Z',rows:[row],metrics:[[row.id,metric]]}};
let rate={sku,laborHour:.016,updatedAt:'2026-11-01T00:00:00Z',effectiveFrom:'2026-11-01'},fail=false,requests=[];const originalFetch=globalThis.fetch;
globalThis.fetch=async(input,init={})=>{const url=new URL(String(input),'https://synthetic.test'),method=init.method||'GET';assert.equal(method,'GET');assert.equal(url.origin,'https://synthetic.test');requests.push(url.pathname+url.search);if(url.pathname==='/api/records'){
 const entity=url.searchParams.get('entity');if(entity==='labor_hours'){if(fail)return Response.json({error:'synthetic denied'},{status:503});return Response.json({records:[{key:sku,payload:rate}]});}
 const records=entity==='production_engine'?[saved]:entity==='forecast'?[{key:month,payload:[{month,applicationMonth:month,sourceReportMonth:'09/2026',sku,name:'Synthetic engine',spec:'Test',line:'A',group:'Test',f30:30,f60:60,f90:90,d30:1,d60:1,used:1,d90:1}]}]:[];return Response.json({records});}
 return Response.json({rows:[],records:[],files:[],groups:[],total:0,authenticated:false});};
after(async()=>{globalThis.fetch=originalFetch;globalThis.BroadcastChannel=oldChannel;await vite.close();dom.window.close();});
async function settle(){await act(async()=>{await new Promise(r=>setTimeout(r,30));});}
const labelValue=host=>[...host.querySelectorAll('.calc-result div')].find(e=>e.textContent.includes('Tổng giờ công dự kiến'))?.querySelector('b')?.textContent;
const opener=host=>[...host.querySelectorAll('button')].find(e=>e.textContent===sku);
async function open(host){await act(async()=>opener(host).click());await settle();assert.ok(host.querySelector('.calc-panel'));}
async function close(host){await act(async()=>host.querySelector('[aria-label="Đóng cách tính"]').click());await settle();}
const expected=process.env.SYNTHETIC_ENGINE_RATE?`${(1000*Number(process.env.SYNTHETIC_ENGINE_RATE)).toLocaleString('vi-VN',{maximumFractionDigits:10})} giờ (${Number(process.env.SYNTHETIC_ENGINE_RATE).toLocaleString('vi-VN',{maximumFractionDigits:10})} giờ/SP · căn cứ đã lưu)`:'Thiếu căn cứ Giờ công/SP đã lưu';
test('persisted Engine without labor basis never borrows current master in actual PlanningView',async()=>{
 sync.clearClientReads();const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const before=JSON.stringify(saved);
 try{await act(async()=>root.render(React.createElement(app.PlanningView,{tab:'proposal',operator:'Synthetic reader',masterRows})));await settle();assert.ok(opener(host));
 for(const value of [.016,.025,0,null,'0.016',-1]){
 rate={...rate,laborHour:value};sync.clearClientReads('mutation');await act(async()=>sync.announceDataChange('labor_hours'));await settle();await open(host);
 assert.equal(labelValue(host),expected);assert.equal(JSON.stringify(saved),before);await close(host);
 }
 fail=true;sync.clearClientReads('mutation');await open(host);assert.equal(labelValue(host),expected);
 assert.equal(JSON.stringify(saved),before);assert.equal(requests.filter(p=>p.includes('entity=labor_hours')).length,0);
 }finally{await act(async()=>root.unmount());host.remove();}
});

if(process.env.SYNTHETIC_ENGINE_RATE===undefined)for(const rate of ['0.0006','0'])test(`persisted Engine saved rate ${rate} remains unchanged after current master updates`,async()=>{
 const {spawnSync}=await import('node:child_process');const childEnv={...process.env,SYNTHETIC_ENGINE_RATE:rate};delete childEnv.NODE_TEST_CONTEXT;const result=spawnSync(process.execPath,['--test',fileURLToPath(import.meta.url)],{env:childEnv,encoding:'utf8',timeout:60000});assert.equal(result.status,0,result.stdout+result.stderr);assert.match(result.stdout,/persisted Engine without labor basis/);
});
