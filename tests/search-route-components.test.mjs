import test, {after, beforeEach, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';
import {newDailyCapacity} from '../lib/capacity.mjs';

// Mount the production route components, with synthetic GET responses only.
// Reachability: app/page -> EmployeeDirectory / WeeklyCapacity / WebsiteTestLog /
// ProductionPlan / InTransit; ProductionManagement -> Payroll / Output / Journal /
// Corrections / Progress; ProductionJournal(labor) -> ProductionLaborJournal;
// ActualWorkSchedule -> ActualLaborMonth. This is component integration coverage,
// not a claim that the complete authenticated app shell or native OS picker ran.
const {JSDOM} = createRequire(import.meta.url)('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'https://synthetic.test', pretendToBeVisual: true,
});
for (const name of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'HTMLButtonElement', 'MutationObserver', 'CustomEvent']) globalThis[name] = dom.window[name];
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = await import('react');
const {act} = React;
const {createRoot} = await import('react-dom/client');
const vite = await createServer({appType:'custom', configFile:false,
  resolve:{alias:{'@':fileURLToPath(new URL('..',import.meta.url))}},
  server:{middlewareMode:true,hmr:false}});
const modules = await Promise.all([
  'employee-directory', 'actual-labor-month', 'production-payroll', 'production-output',
  'production-journal', 'production-corrections', 'production-progress-review', 'weekly-capacity',
].map(name => vite.ssrLoadModule(`/components/${name}.tsx`)));
const [EmployeeDirectory, ActualLaborMonth, ProductionPayroll, ProductionOutput,
  ProductionJournal, ProductionCorrections, ProductionProgressReview, WeeklyCapacity] = modules.map(m => m.default);
const {WebsiteTestLog} = await vite.ssrLoadModule('/components/website-test-log.tsx');
const {ProductionPlan} = await vite.ssrLoadModule('/components/production-plan.tsx');
const {InTransit} = await vite.ssrLoadModule('/components/in-transit.tsx');
const sync = await vite.ssrLoadModule('/lib/data-sync.ts');
const capacityCache = await vite.ssrLoadModule('/lib/capacity-workspace-cache.ts');
const originalFetch = globalThis.fetch;
const OriginalBroadcastChannel = globalThis.BroadcastChannel;
const channels = new Set();
if (OriginalBroadcastChannel) globalThis.BroadcastChannel = class extends OriginalBroadcastChannel {
  constructor(name) {super(name);channels.add(this);}
};
const el = React.createElement;
let requests = [], mutationAttempts = [], unexpectedReads = [];
const employees = [
  {id:'EMP-ALPHA', name:'Alpha Employee', line:'A', active:true, version:1},
  {id:'EMP-BETA', name:'Beta Employee', line:'B', active:true, version:1},
];
const orders = ['ALPHA','BETA'].map((name, i) => ({id:`order-${name}`, planId:`PLAN-${name}`,
  lsxCode:`LSX-${name}`, sku:`SKU-${name}`, name:`Product ${name}`, spec:'Synthetic', line:i?'B':'A',
  week:'2026-10-12', planStart:'2026-10-12T01:00:00Z', planEnd:'2026-10-31T10:00:00Z', lsxQty:100, laborHour:0.1}));
const reports = orders.map((order,i) => ({id:`report-${i}`, kind:'completion', transitId:order.id,
  line:order.line, reportedQuantity:10, approvedQuantity:10, reviewStatus:'Đã xác nhận',
  productionDate:i?'2026-11-16':'2026-10-15', reportedAt:i?'2026-11-16T08:00:00Z':'2026-10-15T08:00:00Z',
  startedAt:i?'2026-11-16T01:00:00Z':'2026-10-15T01:00:00Z', completedAt:i?'2026-11-16T08:00:00Z':'2026-10-15T08:00:00Z',
  actorId:'synthetic-user', employees:[employees[i].id], count:1, hours:{hc:1,ot:0,total:1}}));
const events = orders.map((order,i) => ({id:`event-${i}`, kind:'start', sourceId:order.id, line:order.line,
  effectiveAt:i?'2026-10-16T01:00:00Z':'2026-10-15T01:00:00Z', recordedAt:i?'2026-10-16T01:00:00Z':'2026-10-15T01:00:00Z',
  actorId:'synthetic-user', employees:[employees[i].id], count:1}));
const attendance = employees.map((employee,i) => ({id:`leave-${i}`, kind:'absence', absenceType:'Nghỉ',
  line:employee.line, effectiveAt:i?'2026-11-16T01:00:00Z':'2026-10-15T01:00:00Z',
  endsAt:i?'2026-11-16T05:00:00Z':'2026-10-15T05:00:00Z', employees:[employee.id], count:1,
  actorId:'synthetic-user', reason:i?'BETA-LEAVE':'ALPHA-LEAVE'}));
const planRows=orders.map((order,i)=>({...order,plan:100,suggested:100,start:'2026-10-12',end:'2026-10-16',status:'DỰ KIẾN',type:'TUẦN CHÍNH',priority:'THƯỜNG',sequence:i+1,sourceIds:[]}));
const transitRows=orders.map((order,i)=>({...order,planStart:'2026-10-12',planEnd:i?'2026-10-16':'2026-10-15',planQty:100,lsxOpenedAt:'2026-10-12',completedQty:0,inTransitQty:100,progress:0,status:'ĐÃ MỞ LSX',progressStatus:'CHƯA SẢN XUẤT',syncStatus:'ĐÃ ĐỒNG BỘ'}));
const logEntries=Array.from({length:52},(_,i)=>({id:`log-${i}`,actor:i%2?'Beta Actor':'Alpha Actor',actorId:i%2?'actor-beta':'actor-alpha',at:'2026-10-17T01:00:00Z',menu:'Synthetic menu',entity:'synthetic',record:`RECORD-${i%2?'BETA':'ALPHA'}-${i}`,action:i%2?'add':'update',operation:'synthetic',reason:'',source:'synthetic',before:null,after:null,hasBefore:false,hasAfter:false,summary:null}));
function logResponse(url) {
  const q=url.searchParams.get('q')||'',actor=url.searchParams.get('actor')||'',action=url.searchParams.get('action')||'';
  const rows=logEntries.filter(e=>(!q||e.record.includes(q))&&(!actor||e.actorId===actor)&&(!action||e.action===action));
  const offset=Number(url.searchParams.get('offset')||0);
  return {entries:rows.slice(offset,offset+50),actors:[{id:'actor-alpha',label:'Alpha Actor'},{id:'actor-beta',label:'Beta Actor'}],menus:[{id:'synthetic',label:'Synthetic menu'}],total:rows.length,truncated:false,coverage:'Synthetic only'};
}
function capacityResponse(week) {
  return {week, revision:3, rows:['A','B'].map(line=>newDailyCapacity(week,line)), employees:[], legacy:[], permissions:{view:true,edit:false,confirm:false}};
}
beforeEach(() => {
  requests = [];mutationAttempts = [];unexpectedReads = [];
  window.sessionStorage.clear();document.documentElement.lang='vi';
  sync.clearClientReads('session');
  globalThis.fetch = async (input, init={}) => {
    const method=(init.method||'GET').toUpperCase();
    if(method!=='GET')mutationAttempts.push(`${method} ${input}`);
    assert.equal(method,'GET',`No mutations are allowed in lookup tests: ${method} ${input}`);
    const url=new URL(String(input),'https://synthetic.test');
    requests.push(url.pathname+url.search);
    if(url.pathname==='/api/employees') return Response.json({employees,permissions:{edit:false,cancel:false}});
    if(url.pathname==='/api/production-standards') return Response.json({records:orders.map(o=>({key:o.sku,payload:{sku:o.sku,laborHour:0.1}}))});
    if(url.pathname==='/api/capacity') return Response.json(url.searchParams.has('requests')?{requests:[]}:url.searchParams.has('latest')?{week:'2026-10-12'}:capacityResponse(url.searchParams.get('week')));
    if(url.pathname==='/api/website-test-log') return Response.json(logResponse(url));
    if(url.pathname==='/api/in-transit') return Response.json({rows:transitRows,history:[]});
    if(url.pathname==='/api/records'&&url.searchParams.get('entity')==='sku') return Response.json({records:[]});
    if(url.pathname==='/api/production-plan') return Response.json({revision:1,rows:planRows,sources:[],capacity:[],transit:[],audit:[],warnings:[],canReopen:false});
    unexpectedReads.push(url.pathname+url.search);
    throw new Error(`Unexpected synthetic read: ${url.pathname+url.search}`);
  };
});
afterEach(()=>{assert.deepEqual(mutationAttempts,[],'Lookup must never attempt a write');assert.deepEqual(unexpectedReads,[],'Every read must have an explicit synthetic fixture');});
after(async () => {
  globalThis.fetch=originalFetch;
  for(const channel of channels) channel.close();
  globalThis.BroadcastChannel=OriginalBroadcastChannel;
  await vite.close();dom.window.close();
});
async function mount(component) {
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  await act(async()=>root.render(component));
  return {host, async close(){await act(async()=>root.unmount());host.remove();}};
}
async function key(control, options={}) {
  assert.ok(control,'Expected mounted keyboard control');
  const event=new window.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true,...options});
  await act(async()=>control.dispatchEvent(event));return event;
}
async function change(input,value) {
  assert.ok(input,'Expected mounted input');
  await act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new window.Event('input',{bubbles:true}));});
}
async function choose(select,value) {
  assert.ok(select,'Expected mounted select');
  await act(async()=>{select.value=value;select.dispatchEvent(new window.Event('change',{bubbles:true}));});
}
async function click(button) {assert.ok(button,'Expected mounted button');await act(async()=>button.click());}
const button=(host,label)=>[...host.querySelectorAll('button')].find(b=>b.textContent===label);
const toolbar=host=>host.querySelector('[data-standard-toolbar]');
const body=host=>[...host.querySelectorAll('tbody')].filter(t=>!t.closest('[hidden]')).map(t=>t.textContent).join('\n');
const never=()=>{throw new Error('Lookup must not invoke unrelated business actions');};
async function search(host,control,method) {if(method==='click')await click(button(toolbar(host),'Tìm kiếm'));else await key(control);}
async function openPickerEnter(control) {
  control.matches=selector=>selector===':open';
  const event=await key(control);
  assert.equal(event.defaultPrevented,false,'An open picker must retain native option acceptance');
  control.matches=()=>false;
}

for (const method of ['enter','click']) {
  test(`EmployeeDirectory real text and closed Line lookup apply by ${method}`,async()=>{
    const view=await mount(el(EmployeeDirectory));
    try {
      assert.match(body(view.host),/EMP-ALPHA/);assert.match(body(view.host),/EMP-BETA/);
      await click(button(view.host,'Tra cứu'));
      const input=toolbar(view.host).querySelector('input');await change(input,'Alpha');
      assert.match(body(view.host),/EMP-BETA/,'Typing remains a draft');
      await search(view.host,input,method);assert.match(body(view.host),/EMP-ALPHA/);assert.doesNotMatch(body(view.host),/EMP-BETA/);
      await click(button(view.host,'Xóa lọc'));
      const line=toolbar(view.host).querySelectorAll('select')[1];await choose(line,'B');
      await openPickerEnter(line);assert.match(body(view.host),/EMP-ALPHA/);
      await search(view.host,line,method);assert.doesNotMatch(body(view.host),/EMP-ALPHA/);assert.match(body(view.host),/EMP-BETA/);
      assert.equal(requests.filter(url=>url==='/api/employees').length,1,'Client lookup must not reload or save employees');
    } finally {await view.close();}
  });
  test(`ActualLaborMonth real month and employee lookup apply by generated Search/${method}`,async()=>{
    const view=await mount(el(ActualLaborMonth,{events:attendance,employees,manager:false,hr:false,busy:false,save:never,line:'A',locked:false,initialMonth:'2026-10'}));
    try {
      assert.match(body(view.host),/ALPHA-LEAVE/);assert.doesNotMatch(body(view.host),/BETA-LEAVE/);
      const month=toolbar(view.host).querySelector('input[type=month]');await change(month,'2026-11');
      assert.match(body(view.host),/ALPHA-LEAVE/);
      await search(view.host,month,method);assert.doesNotMatch(body(view.host),/ALPHA-LEAVE/);assert.match(body(view.host),/BETA-LEAVE/);
      await choose(toolbar(view.host).querySelector('select'),'Nhân viên');
      const input=toolbar(view.host).querySelector('input');await change(input,'nobody');
      assert.match(body(view.host),/BETA-LEAVE/);await search(view.host,input,method);
      assert.doesNotMatch(body(view.host),/BETA-LEAVE/);assert.ok(view.host.querySelector('[data-no-data]'));
      assert.deepEqual(requests,[]);
    } finally {await view.close();}
  });
  test(`ProductionPayroll real month and closed Line lookup apply by generated Search/${method}`,async()=>{
    window.sessionStorage.setItem('onspa-payroll-month','2026-10');
    const view=await mount(el(ProductionPayroll,{orders,reports,events:[],schedules:[],employees:[],open:never,refresh:never}));
    try {
      assert.match(view.host.querySelector('.payroll-section-title').textContent,/10\/2026/);
      await click(button(view.host,'Tra cứu'));
      const month=toolbar(view.host).querySelector('input[type=month]');await change(month,'2026-11');
      assert.match(view.host.querySelector('.payroll-section-title').textContent,/10\/2026/);
      await search(view.host,month,method);assert.match(view.host.querySelector('.payroll-section-title').textContent,/11\/2026/);
      await click(button(view.host,'Giờ công theo LSX'));assert.doesNotMatch(body(view.host),/LSX-BETA/);
      await choose(toolbar(view.host).querySelector('select'),'line');
      const line=toolbar(view.host).querySelectorAll('select')[1];await choose(line,'B');
      await openPickerEnter(line);assert.doesNotMatch(body(view.host),/LSX-BETA/);
      await search(view.host,line,method);assert.match(body(view.host),/LSX-BETA/);assert.doesNotMatch(body(view.host),/LSX-ALPHA/);
      assert.equal(window.sessionStorage.getItem('onspa-payroll-month'),'2026-11');
    } finally {await view.close();}
  });
  test(`ProductionOutput real date, text and closed Line lookup apply by ${method}`,async()=>{
    const view=await mount(el(ProductionOutput,{orders,reports,open:never}));
    try {
      await click(button(view.host,'Tra cứu'));
      const dates=toolbar(view.host).querySelectorAll('input[type=date]');await change(dates[0],'2026-11-01');await change(dates[1],'2026-11-30');
      assert.match(body(view.host),/LSX-ALPHA/);assert.match(body(view.host),/LSX-BETA/);
      await search(view.host,dates[1],method);assert.doesNotMatch(body(view.host),/LSX-ALPHA/);assert.match(body(view.host),/LSX-BETA/);
      await click(button(view.host,'Xóa lọc'));await choose(toolbar(view.host).querySelector('select'),'sku');
      const input=toolbar(view.host).querySelector('input');await change(input,'SKU-ALPHA');await search(view.host,input,method);
      assert.match(body(view.host),/LSX-ALPHA/);assert.doesNotMatch(body(view.host),/LSX-BETA/);
      await click(button(view.host,'Xóa lọc'));await choose(toolbar(view.host).querySelector('select'),'line');
      const line=toolbar(view.host).querySelectorAll('select')[1];await choose(line,'B');await openPickerEnter(line);
      assert.match(body(view.host),/LSX-ALPHA/);await search(view.host,line,method);
      assert.doesNotMatch(body(view.host),/LSX-ALPHA/);assert.match(body(view.host),/LSX-BETA/);
    } finally {await view.close();}
  });
  test(`ProductionJournal real date, text and closed Line lookup apply by ${method}`,async()=>{
    const view=await mount(el(ProductionJournal,{reports,events,orders,employees,open:never,refresh:never,busy:false}));
    try {
      await click(button(view.host,'Tra cứu'));
      const dates=toolbar(view.host).querySelectorAll('input[type=date]');await change(dates[0],'2026-11-01');await change(dates[1],'2026-11-30');
      assert.match(body(view.host),/LSX-ALPHA/);await search(view.host,dates[1],method);
      assert.doesNotMatch(body(view.host),/LSX-ALPHA/);assert.match(body(view.host),/LSX-BETA/);
      await click(button(view.host,'Xóa lọc'));
      const input=toolbar(view.host).querySelector('input:not([type])');await change(input,'ALPHA');await search(view.host,input,method);
      assert.match(body(view.host),/LSX-ALPHA/);assert.doesNotMatch(body(view.host),/LSX-BETA/);
      await click(button(view.host,'Xóa lọc'));
      const line=[...toolbar(view.host).querySelectorAll('select')].find(s=>s.querySelector('option[value=all]')&&s.querySelector('option[value=A]'));
      await choose(line,'B');await openPickerEnter(line);assert.match(body(view.host),/LSX-ALPHA/);
      await search(view.host,line,method);assert.doesNotMatch(body(view.host),/LSX-ALPHA/);assert.match(body(view.host),/LSX-BETA/);
      assert.deepEqual(requests,['/api/production-standards'],'loaded standards only; lookup must not refetch or write');
    } finally {await view.close();}
  });
  test(`ProductionCorrections real text and closed Line lookup apply by ${method} without editing`,async()=>{
    const view=await mount(el(ProductionCorrections,{events,reports,orders,employees,allowed:false,refresh:never,showDetail:never}));
    try {
      const input=toolbar(view.host).querySelector('input');await change(input,'ALPHA');
      assert.match(body(view.host),/LSX-BETA/);await search(view.host,input,method);
      assert.match(body(view.host),/LSX-ALPHA/);assert.doesNotMatch(body(view.host),/LSX-BETA/);
      await click(button(view.host,'Xóa lọc'));
      const line=toolbar(view.host).querySelectorAll('select')[1];await choose(line,'B');await openPickerEnter(line);
      assert.match(body(view.host),/LSX-ALPHA/);await search(view.host,line,method);
      assert.doesNotMatch(body(view.host),/LSX-ALPHA/);assert.match(body(view.host),/LSX-BETA/);
      assert.equal(view.host.querySelector('.production-correction-panel'),null);assert.deepEqual(requests,[]);
    } finally {await view.close();}
  });
  test(`ProductionProgressReview real SKU and closed Line lookup apply by ${method}`,async()=>{
    const view=await mount(el(ProductionProgressReview,{orders,reports:[],events:[],employees,manager:false,busy:false,refresh:never,open:never,active:()=>({known:false,running:false,count:0}),onReview:never}));
    try {
      await click(button(view.host,'Tra cứu'));await choose([...toolbar(view.host).querySelectorAll('select')].find(s=>s.querySelector('option[value=sku]')),'sku');
      const input=toolbar(view.host).querySelector('input');await change(input,'SKU-ALPHA');
      assert.match(body(view.host),/LSX-BETA/);await search(view.host,input,method);
      assert.match(body(view.host),/LSX-ALPHA/);assert.doesNotMatch(body(view.host),/LSX-BETA/);
      await change(input,'');await search(view.host,input,method);
      assert.doesNotMatch(body(view.host),/LSX-BETA/,'Existing filter survives an invalid empty SKU search');
      await click(button(view.host,'Xóa lọc'));
      const line=[...toolbar(view.host).querySelectorAll('select')].find(s=>s.querySelector('option[value=all]')&&s.querySelector('option[value=A]'));await choose(line,'B');await openPickerEnter(line);
      assert.match(body(view.host),/LSX-ALPHA/);await search(view.host,line,method);
      assert.doesNotMatch(body(view.host),/LSX-ALPHA/);assert.match(body(view.host),/LSX-BETA/);assert.deepEqual(requests,[]);
    } finally {await view.close();}
  });
  test(`WeeklyCapacity real calendar week lookup applies by generated Search/${method} as a read`,async()=>{
    await capacityCache.readCapacityLatest();await capacityCache.readCapacityWeek('2026-10-12');
    const view=await mount(el(WeeklyCapacity,{view:'calendar',sessionLine:'A'}));
    try {
      await click(button(view.host,'Tra cứu'));
      const date=toolbar(view.host).querySelector('input[type=date]');await change(date,'2026-11-04');
      assert.match(view.host.querySelector('.cap-week-heading').textContent,/12\/10\/2026/);
      const category=toolbar(view.host).querySelector('select');await openPickerEnter(category);
      assert.ok(!requests.some(url=>url.includes('week=2026-11-02')));
      await search(view.host,date,method);
      assert.equal(toolbar(view.host).querySelector('input[type=date]').value,'2026-11-02');
      assert.match(view.host.querySelector('.cap-week-heading').textContent,/02\/11\/2026/);
      assert.equal(requests.filter(url=>url.includes('week=2026-11-02')).length,1);
    } finally {await view.close();}
  });
}

test('ActualLaborMonth closed Line picker applies generated Search and open picker only accepts the option',async()=>{
  const monthEvents=attendance.map(event=>({...event,effectiveAt:'2026-10-15T01:00:00Z',endsAt:'2026-10-15T05:00:00Z'}));
  const view=await mount(el(ActualLaborMonth,{events:monthEvents,employees,manager:false,hr:false,busy:false,save:never,line:'A',locked:false,initialMonth:'2026-10'}));
  try {
    await choose(toolbar(view.host).querySelector('select'),'Line');
    const line=toolbar(view.host).querySelectorAll('select')[1];await choose(line,'B');
    await openPickerEnter(line);assert.match(body(view.host),/ALPHA-LEAVE/);assert.match(body(view.host),/BETA-LEAVE/);
    await key(line);assert.doesNotMatch(body(view.host),/ALPHA-LEAVE/);assert.match(body(view.host),/BETA-LEAVE/);
    await choose(line,'A');await click(button(view.host,'Tìm kiếm'));
    assert.match(body(view.host),/ALPHA-LEAVE/);assert.doesNotMatch(body(view.host),/BETA-LEAVE/);assert.deepEqual(requests,[]);
  } finally {await view.close();}
});

test('WeeklyCapacity closed category select Enter applies the deferred week once',async()=>{
  await capacityCache.readCapacityLatest();await capacityCache.readCapacityWeek('2026-10-12');
  const view=await mount(el(WeeklyCapacity,{view:'calendar',sessionLine:'A'}));
  try {
    await click(button(view.host,'Tra cứu'));
    await change(toolbar(view.host).querySelector('input[type=date]'),'2026-11-04');
    const category=toolbar(view.host).querySelector('select');await openPickerEnter(category);
    assert.ok(!requests.some(url=>url.includes('week=2026-11-02')));
    await key(category);assert.equal(toolbar(view.host).querySelector('input[type=date]').value,'2026-11-02');
    assert.equal(requests.filter(url=>url.includes('week=2026-11-02')).length,1);
  } finally {await view.close();}
});

for(const method of ['enter','click']) {
  for(const journalView of ['current','history']) {
    test(`ProductionLaborJournal ${journalView} real text, Line${journalView==='history'?' and date':''} lookup applies by ${method}`,async()=>{
      // Enter through the actual ProductionJournal category branch, not a copied toolbar.
      const view=await mount(el(ProductionJournal,{initialCategory:'labor',reports,events,orders,employees,open:never,refresh:never,busy:false}));
      try {
        const mode=[...toolbar(view.host).querySelectorAll('select')].find(s=>s.querySelector('option[value=current]'));
        if(journalView==='history')await choose(mode,'history');
        assert.equal(toolbar(view.host).dataset.standardToolbar,`ProductionLaborJournal-${journalView}`);
        await click(button(view.host,'Tra cứu'));
        await choose(toolbar(view.host).querySelector('select'),'sku');
        const input=toolbar(view.host).querySelector('input');await change(input,'SKU-ALPHA');
        assert.match(body(view.host),/LSX-BETA/);await search(view.host,input,method);
        assert.match(body(view.host),/LSX-ALPHA/);assert.doesNotMatch(body(view.host),/LSX-BETA/);
        await click(button(view.host,'Xóa lọc'));
        const line=[...toolbar(view.host).querySelectorAll('select')].find(s=>s.querySelector('option[value=all]')&&s.querySelector('option[value=A]'));
        await choose(line,'B');await openPickerEnter(line);assert.match(body(view.host),/LSX-ALPHA/);
        await search(view.host,line,method);assert.doesNotMatch(body(view.host),/LSX-ALPHA/);assert.match(body(view.host),/LSX-BETA/);
        if(journalView==='history') {
          await click(button(view.host,'Xóa lọc'));
          const dates=toolbar(view.host).querySelectorAll('input[type=date]');await change(dates[0],'2026-10-16');await change(dates[1],'2026-10-16');
          assert.match(body(view.host),/LSX-ALPHA/);await search(view.host,dates[1],method);
          assert.doesNotMatch(body(view.host),/LSX-ALPHA/);assert.match(body(view.host),/LSX-BETA/);
        }
        // Labor history derives from events/roster; it does not use product labor rates.
        assert.deepEqual(requests,[],'labor lookup must neither fetch unused standards nor refetch or write');
      } finally {await view.close();}
    });
  }
  test(`ProductionPlan real deferred text and closed Line lookup apply by generated Search/${method} without autosave`,async()=>{
    const view=await mount(el(ProductionPlan,{initialWeek:'2026-10-12'}));
    try {
      assert.match(body(view.host),/SKU-ALPHA/);assert.match(body(view.host),/SKU-BETA/);
      await click(button(view.host,'Tra cứu'));
      const input=toolbar(view.host).querySelector('[aria-label="Search plan"]');await change(input,'SKU-ALPHA');
      assert.match(body(view.host),/SKU-BETA/);await search(view.host,input,method);
      assert.match(body(view.host),/SKU-ALPHA/);assert.doesNotMatch(body(view.host),/SKU-BETA/);
      await click(button(view.host,'Xóa lọc'));
      await choose(toolbar(view.host).querySelector('select'),'line');
      const line=toolbar(view.host).querySelector('[aria-label="Filter line"]');await choose(line,'B');await openPickerEnter(line);
      assert.match(body(view.host),/SKU-ALPHA/);await search(view.host,line,method);
      assert.doesNotMatch(body(view.host),/SKU-ALPHA/);assert.match(body(view.host),/SKU-BETA/);
      assert.equal(view.host.querySelector('[role=dialog]'),null);
    } finally {await view.close();}
  });
  test(`InTransit real deferred text, closed Line and date lookup apply by ${method} without editor actions`,async()=>{
    const view=await mount(el(InTransit));
    try {
      assert.match(body(view.host),/LSX-ALPHA/);assert.match(body(view.host),/LSX-BETA/);
      await click([...toolbar(view.host).querySelectorAll('button')].find(b=>b.textContent.includes('Tra cứu')));
      const input=toolbar(view.host).querySelector('input');await change(input,'SKU-ALPHA');
      assert.match(body(view.host),/LSX-BETA/);await search(view.host,input,method);
      assert.match(body(view.host),/LSX-ALPHA/);assert.doesNotMatch(body(view.host),/LSX-BETA/);
      await choose(toolbar(view.host).querySelector('select'),'line');
      const line=toolbar(view.host).querySelectorAll('select')[1];await choose(line,'B');await openPickerEnter(line);
      assert.match(body(view.host),/LSX-ALPHA/);await search(view.host,line,method);
      assert.doesNotMatch(body(view.host),/LSX-ALPHA/);assert.match(body(view.host),/LSX-BETA/);
      await choose(toolbar(view.host).querySelector('select'),'from');
      const date=toolbar(view.host).querySelector('input[type=date]');await change(date,'2026-10-16');
      assert.match(body(view.host),/LSX-ALPHA/);await search(view.host,date,method);
      assert.doesNotMatch(body(view.host),/LSX-ALPHA/);assert.match(body(view.host),/LSX-BETA/);
      assert.equal(view.host.querySelector('[role=dialog]'),null);
      assert.equal(requests.filter(url=>url==='/api/in-transit').length,1);
    } finally {await view.close();}
  });
  for(const language of ['vi','en','zh']) {
    test(`WebsiteTestLog ${language} real text, actor, action and date search by ${method} requests correct criteria and resets page`,async()=>{
      const labels=language==='vi'?{lookup:'Tra cứu',search:'Tìm kiếm',clear:'Xóa lọc'}:language==='en'?{lookup:'Lookup',search:'Search',clear:'Clear filters'}:{lookup:'查詢',search:'搜尋',clear:'清除篩選'};
      document.documentElement.lang=language;
      const view=await mount(el(WebsiteTestLog,{language}));
      const apply=async control=>method==='click'?click(button(view.host,labels.search)):key(control);
      const last=()=>new URL(requests.filter(url=>url.startsWith('/api/website-test-log?')).at(-1),'https://synthetic.test').searchParams;
      try {
        assert.match(body(view.host),/RECORD-ALPHA/);assert.match(body(view.host),/RECORD-BETA/);
        await click(button(view.host,'›'));assert.equal(last().get('offset'),'50');
        await click(button(view.host,labels.lookup));await choose([...toolbar(view.host).querySelectorAll('select')].find(s=>s.querySelector('option[value=q]')),'q');
        const input=toolbar(view.host).querySelector('input:not([type])');await change(input,'ALPHA');
        const before=requests.length;await apply(input);assert.equal(requests.length,before+1);
        assert.equal(last().get('q'),'ALPHA');assert.equal(last().get('offset'),'0');
        assert.match(body(view.host),/RECORD-ALPHA/);assert.doesNotMatch(body(view.host),/RECORD-BETA/);
        await click(button(view.host,labels.clear));await choose([...toolbar(view.host).querySelectorAll('select')].find(s=>s.querySelector('option[value=q]')),'actor');
        let select=[...toolbar(view.host).querySelectorAll('select')].find(s=>s.querySelector('option[value=actor-beta]'));await choose(select,'actor-beta');
        const beforeOpen=requests.length;await openPickerEnter(select);assert.equal(requests.length,beforeOpen);
        await apply(select);assert.equal(last().get('actor'),'actor-beta');assert.doesNotMatch(body(view.host),/RECORD-ALPHA/);assert.match(body(view.host),/RECORD-BETA/);
        await click(button(view.host,labels.clear));await choose([...toolbar(view.host).querySelectorAll('select')].find(s=>s.querySelector('option[value=q]')),'action');
        select=[...toolbar(view.host).querySelectorAll('select')].find(s=>s.querySelector('option[value=update]'));await choose(select,'update');await apply(select);
        assert.equal(last().get('action'),'update');assert.match(body(view.host),/RECORD-ALPHA/);assert.doesNotMatch(body(view.host),/RECORD-BETA/);
        const date=toolbar(view.host).querySelectorAll('input[type=date]')[1];await change(date,'2026-10-18');await apply(date);
        assert.equal(last().get('from'),'2026-10-16');assert.equal(last().get('to'),'2026-10-18');assert.equal(last().get('action'),'update');
      } finally {await view.close();}
    });
  }
}

test('WeeklyCapacity summary exposes instant Line filtering and no reachable lookup/search button',async()=>{
  const source=await readFile(new URL('../components/weekly-capacity.tsx',import.meta.url),'utf8');
  const summaryToolbar=source.split(':<StandardToolbar permissionFeedback={permissionsReady} name="WeeklyCapacity"')[1]?.split(']}/>')[0];
  assert.ok(summaryToolbar,'Expected the actual summary toolbar branch');
  assert.doesNotMatch(summaryToolbar,/onClick:\(\)=>setSearch\(true\)/);
  assert.match(summaryToolbar,/!search&&toolbar\.field\('Line'/);
  await capacityCache.readCapacityLatest();await capacityCache.readCapacityWeek('2026-10-12');
  const view=await mount(el(WeeklyCapacity,{view:'summary'}));
  try {
    assert.equal(button(view.host,'Tra cứu'),undefined);assert.equal(button(view.host,'Tìm kiếm'),undefined);
    const rowLines=()=>[...view.host.querySelectorAll('.cap-summary-row')].map(row=>row.querySelectorAll('td')[2].textContent);
    assert.deepEqual(rowLines(),['A','B']);
    const line=toolbar(view.host).querySelector('select');const before=requests.length;
    await choose(line,'B');assert.deepEqual(rowLines(),['B'],'Summary line filtering is immediate');
    const event=await key(line);assert.equal(event.defaultPrevented,false);assert.deepEqual(rowLines(),['B']);assert.equal(requests.length,before);
    assert.equal(button(view.host,'Tra cứu'),undefined);assert.equal(button(view.host,'Tìm kiếm'),undefined);
  } finally {await view.close();}
});
