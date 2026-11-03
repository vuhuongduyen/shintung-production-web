import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {JSDOM} from 'jsdom';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const dom=new JSDOM('<div id="root"></div>',{url:'https://synthetic.test',pretendToBeVisual:true});
const domKeys=['window','document','HTMLElement','Element','Node','Event','CustomEvent','MutationObserver','DocumentFragment','HTMLInputElement','HTMLButtonElement','HTMLTextAreaElement','NodeFilter','getComputedStyle'],domGlobals=new Map(domKeys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
for(const k of domKeys)globalThis[k]=dom.window[k];
const root=fileURLToPath(new URL('..',import.meta.url));
const vite=await createServer({appType:'custom',configFile:false,root,resolve:{alias:{'@':resolve(root)}},server:{middlewareMode:true}});
after(async()=>{await vite.close();for(const k of domKeys){const descriptor=domGlobals.get(k);if(descriptor)Object.defineProperty(globalThis,k,descriptor);else delete globalThis[k];}dom.window.close();});
const {WorkCalendarBanner,ProductionWorkBoardView}=await vite.ssrLoadModule('/components/production-work-board.tsx');
const date='2026-10-19',ids=Array.from({length:10},(_,i)=>`TEST-B${i}`);
const day={date,working:true,hcStart:'09:00',hcEnd:'17:00',ot:false};
const employees=[...ids.map((id,i)=>({id,name:`Nhân viên giả B${i}`,sourceEmployeeId:`TEST-${i}`,line:'B'})),...['TEST-C1','TEST-C2'].map(id=>({id,name:id,line:'C'}))];
const reference={key:'2026-10-19:B',workers:10,days:[day],roster:[{date,hc:ids,ot:[]}],input:{dailySchedule:[day],dailyHcLeave:[{date,mode:'full',employees:['TEST-B0']}],dailyOtLeave:[]}};
const move={id:'TEST-MOVE',kind:'line-movement',line:'C',destinationLine:'B',employees:['TEST-C1','TEST-C2'],count:2,effectiveAt:`${date}T08:00:00+07:00`,endsAt:'2026-10-23T17:00:00+07:00'};
const hr=(extra={})=>({id:'TEST-HR',kind:'line-absence',line:'B',absenceType:'Nghỉ',employees:['TEST-B0'],approved:true,effectiveAt:`${date}T09:00:00+07:00`,endsAt:`${date}T17:00:00+07:00`,...extra});
function banner(extra={},now='2026-10-20T00:00:00Z'){
 const original=Date.now;
 try {Date.now=()=>Date.parse(now);return renderToStaticMarkup(React.createElement(WorkCalendarBanner,{schedules:[reference],line:'B',referenceDate:date,employees,events:[move],orders:[],...extra}));}
 finally {Date.now=original;}
}
const bannerText=html=>html.split('<details')[0];
const countText=html=>bannerText(html).match(/<strong>(.*?)<\/strong>/)?.[1];

test('SX reporting shows 10 - 1 forecast + 2 incoming as 11 with named provisional evidence',()=>{
 const before=JSON.stringify({reference,move,employees}),html=banner();
 assert.equal(countText(html),'11 người');
 assert.match(bannerText(html),/Line B · HC 09:00 – 17:00 · <strong>11 người<\/strong> · Tạm tính/);
 assert.match(html,/<summary>Nhân lực<\/summary>/);
 assert.match(html,/<p>Capacity · nghỉ HC: Nhân viên giả B0<\/p>/);
 assert.match(html,/<p>C → B: TEST-C1, TEST-C2<\/p>/);
 assert.equal((html.match(/<summary>Danh sách nhân viên \(11\)<\/summary>/g)||[]).length,1);
 assert.equal((html.match(/<p>Capacity · nghỉ HC:/g)||[]).length,1,'absence names are not repeated for every work interval');
 assert.match(html,/Nhân viên giả B0/);
 assert.doesNotMatch(html,/Nhân lực theo lịch|tạm tính Capacity, chờ HR|Số người theo từng khoảng đã gồm điều chuyển Line/);
 assert.doesNotMatch(bannerText(html),/Capacity|chờ HR|ghi nhận nghỉ|Nhân viên giả/);
 assert.doesNotMatch(html,/<details[^>]* open/);
 assert.equal(JSON.stringify({reference,move,employees}),before);
});

test('HR recording for the same employee replaces forecast without double subtraction',()=>{
 const html=banner({events:[move,hr()]});
 assert.equal(countText(html),'11 người');
 assert.doesNotMatch(bannerText(html),/Tạm tính/);
 assert.match(html,/<p>Thực tế · Nghỉ: Nhân viên giả B0 · 09:00–17:00<\/p>/);
 assert.doesNotMatch(html,/aria-label="Ghi nhận nghỉ Line B"/,'shared details replaces duplicate raw absence list');
});

test('HR partial-day replacement shows a count range and actual time boundaries',()=>{
 const html=banner({events:[move,hr({effectiveAt:`${date}T13:00:00+07:00`})]});
 assert.equal(countText(html),'11–12 người');
 assert.doesNotMatch(bannerText(html),/Tạm tính/);
 assert.match(html,/13:00/);
 assert.match(html,/Nhân viên giả B0/);
});

test('forecast remains through the 10th ICT and disappears at midnight on the 11th',()=>{
 const before=banner({},'2026-11-10T16:59:59.999Z'),after=banner({},'2026-11-10T17:00:00Z');
 assert.equal(countText(before),'11 người');assert.equal(countText(after),'12 người');
 assert.match(bannerText(before),/Tạm tính/);
 assert.doesNotMatch(bannerText(after),/Tạm tính/);
 assert.equal(countText(banner({events:[move,hr()]},'2026-11-10T17:00:00Z')),'11 người');
});

test('pending HR data preserves provisional evidence and its approval warning',()=>{
 const html=banner({events:[move,hr({approved:false})]});
 assert.equal(countText(html),'11 người');
 assert.match(bannerText(html),/Tạm tính/);
 assert.match(html,/chờ duyệt/i);
 assert.match(html,/Nhân viên giả B0/);
});

test('Line scope, empty schedules and unavailable named headcount remain explicit',()=>{
 const other={...reference,key:'2026-10-19:A',roster:[{date,hc:[],ot:[]}],input:{...reference.input,dailyHcLeave:[]}};
 const scoped=banner({schedules:[reference,other]});assert.doesNotMatch(scoped,/Line A/);
 const empty=banner({schedules:[],events:[]});assert.match(empty,/Chưa có lịch thực tế được duyệt/);assert.equal(countText(empty),undefined);
 const unnamed=banner({schedules:[{...reference,roster:[],workers:50,input:{...reference.input,dailyHcLeave:[{date,mode:'full',people:1}]}}],employees:[],events:[]});
 assert.equal(countText(unnamed),'Chưa đủ dữ liệu');assert.doesNotMatch(bannerText(unnamed),/Chưa đủ dữ liệu người/);
 assert.match(unnamed,/Có nghỉ Capacity chưa xác định được nhân viên/);
 assert.doesNotMatch(unnamed,/HC: 0 người/);
});

test('provisional banner leaves LSX staffing, action callbacks and saved report hours unchanged',async()=>{
 const order={id:'TEST-ORDER',line:'B',lsxCode:'TEST-LSX',sku:'TEST-SKU',name:'Sản phẩm giả',lsxQty:100,inTransitQty:50,actualStartedAt:`${date}T09:00:00+07:00`};
 const report={id:'TEST-REPORT',transitId:order.id,reportedQuantity:50,reviewStatus:'Đã xác nhận',hours:{hc:24,ot:0}};
 const events=[move],reports=[report],before=JSON.stringify({order,events,reports,reference});
 let calls=0;
 const element=React.createElement(ProductionWorkBoardView,{rows:[order],events,reports,active:()=>({known:true,running:true,count:12,assigned:12}),openAction:()=>{calls++;},showDetail:()=>{calls++;},chosen:order,action:'complete',effectiveLocal:`${date}T11:00`,setEffectiveLocal:()=>{calls++;},submit:()=>{calls++;},cancel:()=>{calls++;},busy:false,schedules:[reference],line:'B',employees,page:1,onPageChange:()=>{calls++;}});
 const fetch=globalThis.fetch,previousAct=globalThis.IS_REACT_ACT_ENVIRONMENT,requests=[];globalThis.IS_REACT_ACT_ENVIRONMENT=true;globalThis.fetch=async(_url,init)=>{const body=JSON.parse(init.body);requests.push(body);assert.equal(body.action,'preview-report');return Response.json({hours:null});};
 const {createRoot}=await import('react-dom/client'),root=createRoot(document.getElementById('root'));
 try{await React.act(async()=>root.render(element));const html=document.body.innerHTML;
 assert.ok(document.querySelector('[role=dialog]'),'assert the real portal rather than SSR output');
 assert.match(html,/Có mặt tại giờ xuất \/ Phân công/);assert.match(html,/value="12 \/ 12"/);
 assert.match(html,/<dd>24 giờ<\/dd>/);assert.match(html,/Xác nhận xuất trạm/);
 assert.equal(calls,0);assert.equal(JSON.stringify({order,events,reports,reference}),before);assert.ok(requests.every(body=>body.action==='preview-report'));
 }finally{await React.act(async()=>root.unmount());globalThis.fetch=fetch;globalThis.IS_REACT_ACT_ENVIRONMENT=previousAct;}
});

test('display-only employee directory resolves historical transfers without changing action candidates',()=>{
 const currentEmployees=employees.filter(employee=>employee.line==='B');
 const before=JSON.stringify(currentEmployees);
 assert.equal(countText(banner({employees:currentEmployees,displayEmployees:employees})),'11 người');
 assert.equal(JSON.stringify(currentEmployees),before);
 const restricted=banner({employees:currentEmployees,displayEmployees:employees,restrictedLine:true});
 assert.equal(countText(restricted),'Chưa đủ dữ liệu');
 assert.doesNotMatch(bannerText(restricted),/Chưa đủ dữ liệu người/);
 assert.match(restricted,/Chưa đủ dữ liệu HR được phép xem để xác định đầy đủ nhân lực điều chuyển/);
 assert.doesNotMatch(restricted,/HC: 11 người/);
});


test('no-calendar days retain concise actual records including pending and open arrival',()=>{
 const html=banner({schedules:[],events:[hr({absenceType:'Đi trễ',approved:false,openArrival:true})]});
 assert.equal(countText(html),undefined);
 assert.match(html,/<summary>Nhân lực<\/summary>/);
 assert.match(html,/Đi trễ: Nhân viên giả B0 \(TEST-0\) · 09:00–17:00 · Chưa đến · Chờ duyệt/);
 assert.doesNotMatch(html,/Thực tế ·|giờ kết thúc dự kiến|Chờ duyệt điều chỉnh giờ/);
 assert.doesNotMatch(html,/<details[^>]* open/);
 const unnamed=banner({schedules:[],events:[hr({employees:[],count:2})]});
 assert.match(unnamed,/Nghỉ: 2 người · chưa có tên · 09:00–17:00/);
});

test('banner preserves shift times and non-working days without extra explanatory copy',()=>{
 const overtime={...day,ot:true,otStart:'17:30',otEnd:'21:00'};
 const html=banner({schedules:[{...reference,days:[overtime],roster:[{date,hc:ids,ot:ids}],input:{...reference.input,dailySchedule:[overtime]}}]});
 assert.match(bannerText(html),/Line B · HC 09:00 – 17:00 · TC 17:30 – 21:00/);
 const closedDay={...day,working:false};
 const stopped=banner({schedules:[{...reference,days:[closedDay],input:{...reference.input,dailySchedule:[closedDay]}}],events:[]});
 assert.match(bannerText(stopped),/Line B · Không làm việc/);
 assert.equal(countText(stopped),undefined);
 assert.doesNotMatch(bannerText(stopped),/Tạm tính/);
});


test('source-only LSX absences retain their Line-resolved record in collapsed fallback',()=>{
 const event=hr({line:undefined,sourceId:'TEST-LSX-SOURCE',absenceType:'Về sớm',effectiveAt:`${date}T16:00:00+07:00`});
 const html=banner({events:[event],orders:[{id:'TEST-LSX-SOURCE',line:'B'}]});
 assert.match(html,/<summary>Ghi nhận khác<\/summary><ul aria-label="Ghi nhận nghỉ Line B">/);
 assert.match(html,/Về sớm: Nhân viên giả B0 \(TEST-0\) · 16:00–17:00/);
 assert.doesNotMatch(html,/<details[^>]* open/);
 assert.doesNotMatch(banner({line:'C',events:[event],orders:[{id:'TEST-LSX-SOURCE',line:'B'}]}),/Về sớm: Nhân viên giả B0/);
});
