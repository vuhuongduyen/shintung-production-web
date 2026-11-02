import test,{after,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://synthetic.test',pretendToBeVisual:true});
for(const key of ['window','document','HTMLElement','HTMLInputElement','HTMLSelectElement','Event','CustomEvent','Node','MutationObserver','Element','HTMLButtonElement','HTMLTextAreaElement','NodeFilter'])globalThis[key]=dom.window[key];
globalThis.getComputedStyle=dom.window.getComputedStyle;
globalThis.requestAnimationFrame=dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame=dom.window.cancelAnimationFrame.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
const vite=await createServer({appType:'custom',configFile:false,resolve:{alias:{'@':fileURLToPath(new URL('..',import.meta.url))}},server:{middlewareMode:true,hmr:false}});
const {default:Schedule}=await vite.ssrLoadModule('/components/actual-work-schedule.tsx');
const {default:Month}=await vite.ssrLoadModule('/components/actual-labor-month.tsx');
const originalFetch=globalThis.fetch;let writes=0;
globalThis.fetch=()=>{throw Error('Lookup must use loaded data, never request or mutate data');};
after(async()=>{globalThis.fetch=originalFetch;await vite.close();dom.window.close();});
afterEach(()=>{assert.equal(writes,0);});
const people=[{id:'TEST_A',name:'Nhân viên thử A',line:'A'},{id:'TEST_B',name:'Nhân viên thử B',line:'B'}];
const event=(id,line,absenceType='Nghỉ',month='2026-11')=>({id,kind:'line-absence',line,absenceType,employees:[line==='A'?'TEST_A':'TEST_B'],effectiveAt:`${month}-02T01:00:00Z`,endsAt:`${month}-02T03:00:00Z`,count:1,reason:`TEST ${id}`});
const events=[event('A_NGHI','A'),event('B_NGHI','B'),event('B_TRE','B','Đi trễ'),event('OCT','A','Nghỉ','2026-10')];
const day={date:'2026-11-02',working:true,hcStart:'08:00',hcEnd:'17:00',lunchStart:'12:00',lunchEnd:'13:00',ot:false,note:'TEST note'};
const props={week:'2026-11-02',line:'A',locked:false,days:[day],setWeek:()=>{},setLine:()=>{},setDays:()=>{},version:1,approved:{version:1},approvedSchedules:[],history:[],events,orders:[],employees:people,manager:true,hr:true,busy:false,save:async()=>{writes++;return true;},openAction:()=>{throw Error('Unrelated order action');},refresh:async()=>{throw Error('No lookup refresh');}};
const button=(host,label)=>[...host.querySelectorAll('button')].find(n=>n.textContent.trim()===label);
const click=async n=>{assert.ok(n);await act(async()=>n.click());};
const change=async(n,value)=>{assert.ok(n);await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(n,value);n.dispatchEvent(new Event('input',{bubbles:true}));});};
const choose=async(n,value)=>{assert.ok(n);await act(async()=>{n.value=value;n.dispatchEvent(new Event('change',{bubbles:true}));});};
const enter=async n=>{assert.ok(n);await act(async()=>n.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true})));};
async function mount(Component=Schedule,initial=props){const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const render=next=>act(async()=>root.render(React.createElement(Component,next)));await render(initial);return{host,render,close:async()=>{await act(async()=>root.unmount());host.remove();}};}
async function lookup(host){await click(button(host,'Tổng hợp tháng'));const toolbar=host.querySelector('[data-standard-toolbar=ActualWorkSchedule]');assert.equal(toolbar.querySelector('select').value,'Tổng hợp tháng');assert.ok(toolbar.querySelector('input[type=month]'),'monthly fields open immediately');return toolbar;}
const results=host=>host.querySelector('.actual-month-results tbody').textContent;

test('one toolbar combines month/Line/type/name lookup in one search; changing criteria alone preserves calendar/results',async()=>{
 let lineChanges=0,weekChanges=0;const m=await mount(Schedule,{...props,setLine:()=>lineChanges++,setWeek:()=>weekChanges++});
 try{
  const calendar=m.host.querySelector('[data-actual-calendar]');const t=await lookup(m.host);
  assert.equal(calendar.hidden,true);assert.match(results(m.host),/A_NGHI|B_NGHI/);
  await choose(t.querySelector('[aria-label="Line tra cứu"]'),'B');await click(t.querySelector('[aria-label="Loại biến động tra cứu"]'));await click([...document.querySelectorAll('[role=group] label')].find(n=>n.textContent==='Đi trễ').querySelector('input'));await click(t.querySelector('[aria-label="Loại biến động tra cứu"]')); await change(t.querySelector('[aria-label="Nhân viên tra cứu"]'),'thử B');
  assert.equal(calendar.hidden,true);await enter(t.querySelector('[aria-label="Nhân viên tra cứu"]'));
  assert.equal(calendar.hidden,true);assert.equal(m.host.querySelectorAll('[data-standard-toolbar]').length,1);assert.equal([...m.host.querySelectorAll('button')].filter(n=>n.textContent==='Quay lại').length,1);
  assert.match(results(m.host),/B_TRE/);assert.doesNotMatch(results(m.host),/A_NGHI|B_NGHI|OCT/);assert.equal(lineChanges,0);assert.equal(weekChanges,0);
  await choose(t.querySelector('[aria-label="Line tra cứu"]'),'A');assert.match(results(m.host),/B_TRE/,'draft select alone does not apply');
  await click(button(t,'Tìm kiếm'));assert.doesNotMatch(results(m.host),/B_TRE/);assert.ok(m.host.querySelector('.actual-month-results [data-no-data]'));
 }finally{await m.close();}
});

test('one Back restores exact calendar draft and scroll; lookup criteria, result instance and edit close stay in place',async()=>{
 function StatefulSchedule(input){const [days,setDays]=React.useState(input.days);return React.createElement(Schedule,{...input,days,setDays});}
 const m=await mount(StatefulSchedule);
 try{
  const calendar=m.host.querySelector('[data-actual-calendar]'),scroll=calendar.querySelector('.actual-scroll');scroll.scrollTop=64;scroll.scrollLeft=120;
  const hrDate=calendar.querySelector('.actual-day-note');await change(hrDate,'Ghi chú lịch đang nhập');
  const t=await lookup(m.host);await choose(t.querySelector('[aria-label="Line tra cứu"]'),'B');await click(button(t,'Tìm kiếm'));
  const table=m.host.querySelector('.actual-month-results table'),monthScroll=table.parentElement;monthScroll.scrollTop=48;monthScroll.scrollLeft=180;const row=[...table.querySelectorAll('tbody tr')].find(n=>n.textContent.includes('B_NGHI'));
  await click(button(row,'Sửa'));assert.ok(m.host.querySelector('[role=dialog]'));await click(button(m.host.querySelector('[role=dialog]'),'Đóng'));assert.equal(m.host.querySelector('[role=dialog]'),null);assert.equal(m.host.querySelector('.actual-month-results table')===table,true);assert.equal(t.querySelector('[aria-label="Line tra cứu"]').value,'B');
  await click(button(t,'Quay lại'));assert.equal(calendar.hidden,false);assert.equal(m.host.querySelector('[data-actual-calendar]')===calendar,true);assert.equal(calendar.querySelector('.actual-day-note')===hrDate,true);assert.equal(hrDate.value,'Ghi chú lịch đang nhập');assert.equal(scroll.scrollTop,64);assert.equal(scroll.scrollLeft,120);
  const reopened=await lookup(m.host);assert.equal(reopened.querySelector('[aria-label="Line tra cứu"]').value,'B');await click(button(reopened,'Tìm kiếm'));assert.equal(m.host.querySelector('.actual-month-results table')===table,true);assert.equal(monthScroll.scrollTop,48);assert.equal(monthScroll.scrollLeft,180);assert.match(results(m.host),/B_NGHI/);assert.doesNotMatch(results(m.host),/A_NGHI/);
 }finally{await m.close();}
});

test('Clear filters keeps chosen month/results view and busy search cannot execute; locked A/B cannot widen lookup',async()=>{
 for(const line of ['A','B']){
  const m=await mount(Schedule,{...props,line,locked:true});
  try{
   const t=await lookup(m.host),select=t.querySelector('[aria-label="Line tra cứu"]');assert.equal(select.disabled,true);assert.deepEqual([...select.options].map(n=>n.value),['',line]);
   await change(t.querySelector('[aria-label="Nhân viên tra cứu"]'),'nobody');await click(button(t,'Tìm kiếm'));assert.ok(m.host.querySelector('.actual-month-results [data-no-data]'));
   await click(button(t,'Xóa lọc'));assert.equal(t.querySelector('input[type=month]').value,'2026-11');assert.equal(m.host.querySelector('[data-actual-calendar]').hidden,true);assert.match(results(m.host),new RegExp(`${line}_NGHI`));assert.doesNotMatch(results(m.host),new RegExp(line==='A'?'B_NGHI|B_TRE':'A_NGHI'));
  }finally{await m.close();}
 }
 const m=await mount(Schedule,{...props,busy:true});try{const t=await lookup(m.host);await enter(t.querySelector('input[type=month]'));assert.match(results(m.host),/A_NGHI/);}finally{await m.close();}
});

test('controlled monthly table clamps forged Line and retains HR viewing without warehouse/transfer edit actions',async()=>{
 const warehouse={...event('PRIVATE_ACTION','A','Phụ kho')};
 const m=await mount(Month,{events:[...events,warehouse],employees:people,line:'A',locked:true,manager:false,hr:true,busy:false,save:props.save,lookupFilters:{month:'2026-11',line:'B',kind:'',query:'',showCancelled:false}});
 try{assert.equal(m.host.querySelectorAll('[data-standard-toolbar]').length,0);assert.match(results(m.host),/A_NGHI|PRIVATE_ACTION/);assert.doesNotMatch(results(m.host),/B_NGHI|B_TRE/);const row=[...m.host.querySelectorAll('tbody tr')].find(n=>n.textContent.includes('PRIVATE_ACTION'));assert.equal(button(row,'Sửa'),undefined);assert.equal(button(row,'Hủy bản ghi'),undefined);}finally{await m.close();}
});

test('employee suggestions accept code, alias and accentless name; click/keyboard selection waits for Search',async()=>{
 const staff=[{id:'TEST_A',sourceEmployeeId:'NV001',name:'Nguyễn Ánh',line:'A'},{id:'TEST_B',sourceEmployeeId:'NV010',name:'Nguyễn Ánh',line:'B'}];
 const m=await mount(Schedule,{...props,employees:staff});
 try{
  const t=await lookup(m.host),input=t.querySelector('[aria-label="Nhân viên tra cứu"]');
  await change(input,'nguyen anh');let options=[...document.querySelectorAll('[role=option]')];assert.equal(options.length,2);assert.match(options[0].textContent,/NV001.*Nguyễn Ánh/);assert.match(options[1].textContent,/NV010/);
  await act(async()=>input.dispatchEvent(new window.KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true,cancelable:true})));assert.equal(document.querySelectorAll('[role=option]')[1].getAttribute('aria-selected'),'true');
  await click(options[0]);assert.equal(input.value,'NV001');assert.equal(m.host.querySelector('[data-actual-calendar]').hidden,true,'choosing keeps the result view');
  await click(button(t,'Tìm kiếm'));assert.match(results(m.host),/A_NGHI/);assert.doesNotMatch(results(m.host),/B_NGHI/);
  await change(input,'NV01');assert.equal(document.querySelectorAll('[role=option]').length,1);
  await act(async()=>input.dispatchEvent(new window.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true})));
  await enter(input);assert.equal(input.value,'NV010');assert.match(results(m.host),/A_NGHI/,'Enter selection does not search or save');
  await enter(input);assert.match(results(m.host),/B_NGHI/);assert.doesNotMatch(results(m.host),/A_NGHI/);
  await change(input,'TEST_A');assert.equal(document.querySelectorAll('[role=option]').length,1);await click(document.querySelector('[role=option]'));assert.equal(input.value,'NV001');
 }finally{await m.close();}
});

test('weekly and month employee suggestions retain locked Line scope; Escape/blur/IME/no-match never save',async()=>{
 for(const line of ['A','B']){
  const m=await mount(Schedule,{...props,line,locked:true});
  try{
   await click(button(m.host,'Tổng hợp tháng'));const t=m.host.querySelector('[data-standard-toolbar=ActualWorkSchedule]');await choose(t.querySelector('select'),'Nhân viên');const input=t.querySelector('input');
   await change(input,'nhan vien');assert.equal(document.querySelectorAll('[role=option]').length,1);assert.match(document.querySelector('[role=option]').textContent,new RegExp(`TEST_${line}`));
   await act(async()=>input.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));assert.equal(document.querySelector('[role=listbox]'),null);assert.equal(input.value,'nhan vien');
   await change(input,'missing');assert.match(document.querySelector('[role=status]').textContent,/Không tìm thấy/);
   const before=m.host.querySelector('[data-actual-calendar]');await act(async()=>input.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Enter',isComposing:true,keyCode:229,bubbles:true,cancelable:true})));assert.equal(before.hidden,true);
   await click(button(t,'Quay lại'));assert.equal(document.querySelector('[role=listbox]'),null);
  }finally{await m.close();}
 }
});

test('monthly summary opens all criteria in one click; Save stays beside reason and returns with its draft',async()=>{
 const m=await mount();
 try{
  const reason=m.host.querySelector('#actual-reason'),save=button(m.host,'Lưu thay đổi');assert.ok(reason.closest('label').contains(save));assert.equal(reason.closest('label').querySelector('input+span button')===save,true);
  await change(reason,'Lý do đang nhập');const calendar=m.host.querySelector('[data-actual-calendar]');
  assert.equal(button(m.host,'Tra cứu'),undefined);await click(button(m.host,'Tổng hợp tháng'));
  const t=m.host.querySelector('[data-standard-toolbar=ActualWorkSchedule]');for(const label of ['Nội dung tra theo tháng','Line tra cứu','Loại biến động tra cứu','Nhân viên tra cứu','Trạng thái tra cứu'])assert.ok(t.querySelector(`[aria-label="${label}"]`));
  assert.equal(calendar.hidden,true,'one click opens the result table');assert.match(results(m.host),/A_NGHI/);assert.equal(button(t,'Lưu thay đổi'),undefined,'no orphan Save without reason during lookup');assert.equal(m.host.querySelectorAll('[data-standard-toolbar]').length,1);
  await click(button(t,'Quay lại'));assert.equal(m.host.querySelector('#actual-reason').value,'Lý do đang nhập');assert.ok(m.host.querySelector('#actual-reason').closest('label').contains(button(m.host,'Lưu thay đổi')));assert.equal(calendar.hidden,false);
 }finally{await m.close();}
});

test('recall button opens shared 24h form, multi-select submits bounded window without changing planning',async()=>{
 const staff=[{id:'C01',name:'Nhân viên C Một',line:'C',active:true},{id:'C02',name:'Nhân viên C Hai',line:'C',active:true}];
 const schedule={line:'B',key:'2026-11-02:B',days:[day],roster:[{date:day.date,hc:['C01','C02'],ot:[]}],input:{dailySchedule:[day]}};
 const saved=[];const m=await mount(Schedule,{...props,hr:false,employees:staff,approvedSchedules:[schedule],save:async body=>{saved.push(body);return true;}});
 try{
 await click(button(m.host,'Thu hồi nhân sự'));
 const form=m.host.querySelector('form.actual-line-leave');assert.ok(form);
 assert.equal(form.querySelectorAll('input[type=date]').length,2);
 assert.ok(form.querySelector('[aria-label="Từ giờ 24h"]'));assert.ok(form.querySelector('[aria-label="Đến giờ 24h"]'));
 assert.match(form.textContent,/Line B → C/);
 for(const box of form.querySelectorAll('.cap-employee-picker-options input'))await click(box);
 await act(async()=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 assert.equal(saved.length,1);assert.equal(saved[0].action,'staff-recall');assert.deepEqual(saved[0].employees,['C01','C02']);
 assert.equal(saved[0].effectiveAt,'2026-11-02T01:00:00.000Z');assert.equal(saved[0].endsAt,'2026-11-02T10:00:00.000Z');
 assert.deepEqual(schedule.roster[0].hc,['C01','C02']);
 }finally{await m.close();}
 const read=await mount(Schedule,{...props,hr:false,manager:false,attendanceManager:false});try{assert.equal(button(read.host,'Thu hồi nhân sự'),undefined);}finally{await read.close();}
});

 test('multiple checked kinds remain drafts until Search and employee is the first column',async()=>{
 const m=await mount(Schedule,{...props,events:[...events,event('B_SOM','B','Về sớm'),event('B_KHO','B','Phụ kho')]});try{
 const t=await lookup(m.host);await click(button(t,'Tìm kiếm'));assert.match(results(m.host),/B_KHO/);
 const trigger=t.querySelector('[aria-label="Loại biến động tra cứu"]');await click(trigger);
 for(const kind of ['Nghỉ','Đi trễ','Về sớm'])await click([...document.querySelectorAll('[role=group] label')].find(n=>n.textContent===kind).querySelector('input'));
 assert.match(results(m.host),/B_KHO/);await click(trigger);await click(button(t,'Tìm kiếm'));
 assert.match(results(m.host),/A_NGHI/);assert.match(results(m.host),/B_TRE/);assert.match(results(m.host),/B_SOM/);assert.doesNotMatch(results(m.host),/B_KHO/);
 assert.equal(m.host.querySelector('.actual-month-results th').textContent,'Nhân viên');assert.match(m.host.querySelector('.actual-month-results tbody td').textContent,/Nhân viên thử/);
 await click(button(t,'Xóa lọc'));assert.match(results(m.host),/B_KHO/);
 }finally{await m.close();}
});
