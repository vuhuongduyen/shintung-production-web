import test,{after,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';

// Actual components and shared toolbar/notification host, synthetic reads only.
const {JSDOM}=createRequire(import.meta.url)('jsdom');
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://synthetic.test',pretendToBeVisual:true});
for(const name of ['window','document','HTMLElement','Element','HTMLInputElement','HTMLSelectElement','HTMLButtonElement','MutationObserver','CustomEvent','Event'])globalThis[name]=dom.window[name];
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
const vite=await createServer({appType:'custom',configFile:false,resolve:{alias:{'@':fileURLToPath(new URL('..',import.meta.url))}},server:{middlewareMode:true,hmr:false}});
const {default:ProductionManagement}=await vite.ssrLoadModule('/components/production-management.tsx');
const {default:ActualWorkSchedule}=await vite.ssrLoadModule('/components/actual-work-schedule.tsx');
const {default:ProductionProgressReview}=await vite.ssrLoadModule('/components/production-progress-review.tsx');
const {ActionFeedbackHost}=await vite.ssrLoadModule('/components/action-feedback.tsx');
const sync=await vite.ssrLoadModule('/lib/data-sync.ts');
const originalFetch=globalThis.fetch,OriginalBroadcastChannel=globalThis.BroadcastChannel,channels=new Set();
if(OriginalBroadcastChannel)globalThis.BroadcastChannel=class extends OriginalBroadcastChannel{constructor(name){super(name);channels.add(this);}};
const el=React.createElement;
const week='2026-10-12';
const employees=[{id:'EMP-ALPHA',name:'Alpha Employee',line:'A',active:true},{id:'EMP-BETA',name:'Beta Employee',line:'A',active:true}];
const orders=['ALPHA','BETA'].map(name=>({id:`order-${name}`,planId:`PLAN-${name}`,lsxCode:`LSX-${name}`,sku:`SKU-${name}`,name:`Product ${name}`,line:'A',week,planStart:week,planEnd:'2026-10-18',lsxQty:100,inTransitQty:100,progressStatus:'CHƯA SẢN XUẤT'}));
const days=Array.from({length:7},(_,i)=>({date:`2026-10-${12+i}`,working:true,hcStart:'08:00',hcEnd:'17:00',lunchStart:'12:00',lunchEnd:'13:00',ot:false,breaks:[],cleaning:[]}));
const events=employees.map((p,i)=>({id:`absence-${i}`,kind:'line-absence',absenceType:'Nghỉ',line:'A',effectiveAt:'2026-10-15T01:00:00Z',endsAt:'2026-10-15T10:00:00Z',employees:[p.id],count:1,reason:`NOTE-${i?'BETA':'ALPHA'}`}));
let requests=[],mutations=[],unexpected=[];
beforeEach(()=>{
 requests=[];mutations=[];unexpected=[];document.documentElement.lang='vi';window.sessionStorage.clear();sync.clearClientReads('session');
 globalThis.fetch=async(input,init={})=>{const method=(init.method||'GET').toUpperCase();if(method!=='GET')mutations.push(`${method} ${input}`);assert.equal(method,'GET');const path=new URL(String(input),'https://synthetic.test').pathname;requests.push(path+new URL(String(input),'https://synthetic.test').search);
 if(path==='/api/production-workflow')return Response.json({orders,reports:[],events:[],employees,actualSchedules:[],approvedSchedules:[],rights:{manager:true,line:null}});
 unexpected.push(path);throw new Error(`Unexpected synthetic read ${path}`);};
});
afterEach(()=>{assert.deepEqual(mutations,[]);assert.deepEqual(unexpected,[]);});
after(async()=>{globalThis.fetch=originalFetch;for(const c of channels)c.close();globalThis.BroadcastChannel=OriginalBroadcastChannel;await vite.close();dom.window.close();});
async function mount(component){const host=document.createElement('div');document.body.append(host);const root=createRoot(host);await act(async()=>root.render(el(React.Fragment,null,component,el(ActionFeedbackHost))));return{host,async close(){await act(async()=>root.unmount());host.remove();}};}
const toolbar=host=>host.querySelector('[data-standard-toolbar]');
const button=(host,label)=>[...host.querySelectorAll('button')].find(b=>b.textContent.trim()===label);
const body=host=>[...host.querySelectorAll('tbody')].filter(b=>!b.closest('[hidden]')).map(b=>b.textContent).join('\n');
const alert=host=>host.querySelector('[role=alert]')?.textContent||'';
async function click(b){assert.ok(b);await act(async()=>b.click());}
async function choose(s,value){assert.ok(s);await act(async()=>{s.value=value;s.dispatchEvent(new window.Event('change',{bubbles:true}));});}
async function change(input,value){assert.ok(input);await act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new window.Event('input',{bubbles:true}));});}
async function search(host,method,control){if(method==='click')await click(button(toolbar(host),'Tìm kiếm'));else{assert.ok(control);await act(async()=>control.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true})));}}
function scheduleProps(extra={}){return{week,setWeek:()=>{},line:'A',setLine:()=>{},locked:false,days,setDays:()=>{},version:2,approved:{key:`${week}:A`,version:3,days},approvedSchedules:[],history:[],events,orders:[],employees,manager:true,hr:true,busy:false,save:async()=>{throw Error('Unexpected save');},openAction:()=>{throw Error('Unexpected action');},refresh:async()=>true,...extra};}
for(const method of ['click','enter']){
 test(`ProductionManagement ${method}: missing category/text explains and preserves previously applied results`,async()=>{
  const view=await mount(el(ProductionManagement,{mode:'work',operator:'SYNTHETIC'}));try{
   assert.match(body(view.host),/LSX-ALPHA/);assert.match(body(view.host),/LSX-BETA/);
   await click(button(view.host,'Tra cứu'));let category=toolbar(view.host).querySelector('select');
   await search(view.host,method,category);assert.match(alert(view.host),/Chọn hạng mục/);
   await choose(category,'SKU');let input=toolbar(view.host).querySelector('input');await change(input,'ALPHA');await search(view.host,method,input);
   assert.match(body(view.host),/LSX-ALPHA/);assert.doesNotMatch(body(view.host),/LSX-BETA/);
   await change(input,'   ');await search(view.host,method,input);assert.match(alert(view.host),/Nhập nội dung/);assert.doesNotMatch(body(view.host),/LSX-BETA/);
   await choose(category,'');await search(view.host,method,category);assert.match(alert(view.host),/Chọn hạng mục/);assert.doesNotMatch(body(view.host),/LSX-BETA/);
   await choose(category,'SKU');input=toolbar(view.host).querySelector('input');await change(input,'BETA');await search(view.host,method,input);assert.match(body(view.host),/LSX-BETA/);assert.doesNotMatch(body(view.host),/LSX-ALPHA/);
   assert.deepEqual(requests,['/api/production-workflow?view=work','/api/production-workflow'],'initial light/full enrichment only; searching must not fetch again');
  }finally{await view.close();}
 });
 test(`ActualWorkSchedule ${method}: blank employee/week/month criteria explain without changing applied results`,async()=>{
  const weeks=[],view=await mount(el(ActualWorkSchedule,scheduleProps({setWeek:v=>weeks.push(v)})));try{
   await click(button(view.host,'Tổng hợp tháng'));const category=toolbar(view.host).querySelector('select');await choose(category,'');await search(view.host,method,category);assert.match(alert(view.host),/Chọn hạng mục/);
   await choose(category,'Nhân viên');let input=toolbar(view.host).querySelector('input');await change(input,'ALPHA');await search(view.host,method,input);assert.match(body(view.host),/NOTE-ALPHA/);assert.doesNotMatch(body(view.host),/NOTE-BETA/);
   await change(input,'   ');await search(view.host,method,input);assert.match(alert(view.host),/Nhập nội dung/);assert.doesNotMatch(body(view.host),/NOTE-BETA/);
   for(const kind of ['Tuần','Tổng hợp tháng']){await choose(category,kind);input=toolbar(view.host).querySelector('input');await change(input,'');await search(view.host,method,input);assert.match(alert(view.host),/Nhập nội dung/);assert.doesNotMatch(body(view.host),/NOTE-BETA/);}
   assert.deepEqual(weeks,[]);await choose(category,'Tuần');input=toolbar(view.host).querySelector('input');await change(input,'2026-10-22');await search(view.host,method,input);assert.deepEqual(weeks,['2026-10-19']);
   await click(button(view.host,'Xóa lọc'));assert.match(body(view.host),/NOTE-BETA/);assert.deepEqual(requests,[]);
  }finally{await view.close();}
 });
 test(`ActualWorkSchedule ${method}: locked Line explains and unlocked Line applies only on search`,async()=>{
  for(const locked of [true,false]){const lines=[],view=await mount(el(ActualWorkSchedule,scheduleProps({locked,setLine:v=>lines.push(v)})));try{
   await click(button(view.host,'Tổng hợp tháng'));const category=toolbar(view.host).querySelector('select');await choose(category,'Line');const line=toolbar(view.host).querySelectorAll('select')[1];assert.equal(line.disabled,locked);
   if(!locked){await choose(line,'B');assert.deepEqual(lines,[]);}
   await search(view.host,method,category);if(locked){assert.match(alert(view.host),/Line đã được phân quyền/);assert.deepEqual(lines,[]);}else {assert.deepEqual(lines,[],'monthly lookup must preserve the editor Line');assert.ok(view.host.querySelector('.actual-month-results [data-no-data]'));assert.doesNotMatch(body(view.host),/NOTE-ALPHA|NOTE-BETA/);}
  }finally{await view.close();}}
 });
}
test('ActualWorkSchedule missing reason preserves focus and sends no save; valid trimmed reason saves once',async()=>{
 const saves=[],view=await mount(el(ActualWorkSchedule,scheduleProps({save:async v=>{saves.push(v);return true;}})));try{
  const input=view.host.querySelector('#actual-reason');await change(input,'   ');await click(button(view.host,'Lưu thay đổi'));assert.match(alert(view.host),/Nhập lý do cập nhật lịch/);assert.equal(document.activeElement,input);assert.deepEqual(saves,[]);
  await change(input,' Điều chỉnh ca ');await click(button(view.host,'Lưu thay đổi'));assert.equal(saves.length,1);assert.equal(saves[0].reason,'Điều chỉnh ca');assert.equal(saves[0].approvedVersion,3);assert.equal(input.value,'');
 }finally{await view.close();}
});
test('ActualWorkSchedule busy/unapproved/nonmanager guards still block saves',async()=>{
 for(const extra of [{busy:true},{approved:undefined},{manager:false}]){const saves=[],view=await mount(el(ActualWorkSchedule,scheduleProps({...extra,save:async v=>{saves.push(v);return true;}})));try{
  const save=button(view.host,'Lưu thay đổi');if(extra.manager===false){assert.equal(save.getAttribute('aria-disabled'),'true');await click(save);}else{assert.equal(save.disabled,true);await click(save.closest('[role=button]'));}assert.match(alert(view.host),extra.manager===false?/không có quyền/:extra.busy?/Đang xử lý/:/chưa được duyệt/);assert.deepEqual(saves,[]);
 }finally{await view.close();}}
});

for(const method of ['click','enter'])test(`ProductionProgressReview ${method}: blank SKU/LSX/name/Plan ID explains and retains applied rows`,async()=>{
 const view=await mount(el(ProductionProgressReview,{orders,reports:[],events:[],employees,manager:true,busy:false,refresh:()=>{},open:()=>{},active:()=>({count:0,employees:[],known:false,running:false}),onConfirm:async()=>{throw Error('Unexpected review');}}));try{
  await click(button(view.host,'Tra cứu'));const category=[...toolbar(view.host).querySelectorAll('select')].find(s=>s.querySelector('option[value=sku]'));
  await choose(category,'sku');let input=toolbar(view.host).querySelector('input');await change(input,'ALPHA');await search(view.host,method,input);assert.match(body(view.host),/LSX-ALPHA/);assert.doesNotMatch(body(view.host),/LSX-BETA/);
  for(const field of ['sku','lsxCode','name']){await choose(category,field);input=toolbar(view.host).querySelector('input');await change(input,'   ');await search(view.host,method,input);assert.match(alert(view.host),/Nhập nội dung/);assert.doesNotMatch(body(view.host),/LSX-BETA/);}
  await change(input,'BETA');await search(view.host,method,input);assert.match(body(view.host),/LSX-BETA/);assert.doesNotMatch(body(view.host),/LSX-ALPHA/);
  await choose(category,'planId');input=toolbar(view.host).querySelector('input');
  for(const value of ['', '   ']){await change(input,value);await search(view.host,method,input);assert.equal(view.host.querySelector('[role=alert] p')?.textContent,'Vui lòng nhập Plan ID');assert.match(body(view.host),/LSX-BETA/);assert.doesNotMatch(body(view.host),/LSX-ALPHA/);}
  await change(input,'PLAN-ALPHA');await search(view.host,method,input);assert.match(body(view.host),/LSX-ALPHA/);assert.doesNotMatch(body(view.host),/LSX-BETA/);
  await click(button(view.host,'Xóa lọc'));assert.match(body(view.host),/LSX-ALPHA/);assert.match(body(view.host),/LSX-BETA/);assert.deepEqual(requests,[]);
 }finally{await view.close();}
});
test('ActualWorkSchedule busy search explains processing without changing week or Line',async()=>{
 const changes=[],view=await mount(el(ActualWorkSchedule,scheduleProps({busy:true,setWeek:v=>changes.push(v),setLine:v=>changes.push(v)})));try{
  await click(button(view.host,'Tổng hợp tháng'));const searchButton=button(view.host,'Tìm kiếm');assert.equal(searchButton.disabled,true);await click(searchButton.closest('[role=button]'));assert.match(alert(view.host),/Đang xử lý/);assert.deepEqual(changes,[]);assert.deepEqual(requests,[]);
 }finally{await view.close();}
});

test('ActualWorkSchedule cleaning cap follows initial actual day/Line; invalid draft remains visible and never saves',async()=>{
 const saves=[],cleanDay={...days[0],cleaning:[{people:1,start:'16:00',end:'17:00'}]};
 function Harness(){const [draft,setDraft]=React.useState([cleanDay]);return el(ActualWorkSchedule,scheduleProps({days:draft,setDays:setDraft,approved:{key:`${week}:A`,workers:99,version:3,days:[cleanDay],roster:[{date:week,hc:employees.map(p=>p.id),ot:[]}],input:{dailySchedule:[cleanDay]}},events:[],save:async body=>{saves.push(body);return true;}}));}
 const view=await mount(el(Harness));try{
  const people=view.host.querySelector('[aria-label="Số người vệ sinh 12/10/2026 nhóm 1"]');assert.ok(people);assert.equal(people.max,'2');
  await change(people,'3');await change(view.host.querySelector('#actual-reason'),'Synthetic edit');await click(button(view.host,'Lưu thay đổi'));
  assert.match(alert(view.host),/vượt số người thực tế đầu ca \(2\)/);assert.equal(people.value,'3');assert.deepEqual(saves,[]);
  await change(people,'2');await click(button(view.host,'Lưu thay đổi'));assert.equal(saves.length,1);assert.equal(saves[0].days[0].cleaning[0].people,2);assert.equal(saves[0].reason,'Synthetic edit');assert.deepEqual(requests,[]);
 }finally{await view.close();}
});
