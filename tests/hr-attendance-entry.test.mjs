import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
const dom=new JSDOM('<html><body></body></html>',{url:'https://synthetic.test',pretendToBeVisual:true});
for(const key of ['window','document','HTMLElement','HTMLInputElement','HTMLSelectElement','Event','CustomEvent','Node','MutationObserver'])globalThis[key]=dom.window[key];
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
const vite=await createServer({appType:'custom',configFile:false,resolve:{alias:{'@':fileURLToPath(new URL('..',import.meta.url))}},server:{middlewareMode:true,hmr:false}});
const {default:Entry}=await vite.ssrLoadModule('/components/hr-attendance-entry.tsx');
const {default:Schedule}=await vite.ssrLoadModule('/components/actual-work-schedule.tsx');
const originalFetch=globalThis.fetch;globalThis.fetch=()=>{throw Error('Synthetic component tests cannot access production');};
after(async()=>{globalThis.fetch=originalFetch;await vite.close();dom.window.close();});
const people=[{id:'TEST-A',sourceEmployeeId:'NV001',name:'Nhân viên thử A',line:'A',active:true},{id:'TEST-A2',sourceEmployeeId:'NV002',name:'Nhân viên thử A2',line:'A',active:true},{id:'TEST-B',sourceEmployeeId:'NV003',name:'Nhân viên thử B',line:'B',active:true}];
const days=Array.from({length:7},(_,i)=>({date:`2026-10-${12+i}`,working:i<6,hcStart:'08:00',hcEnd:'17:00',lunchStart:'12:00',lunchEnd:'13:00',ot:false}));
const props={week:'2026-10-12',line:'A',days,approved:{version:1,days},employees:people,events:[],active:true,allowed:true,busy:false,back:()=>{},save:async()=>true};
const button=(host,label)=>[...host.querySelectorAll('button')].find(node=>node.textContent.trim()===label);
const click=async node=>{assert.ok(node);await act(async()=>node.click());};
const change=async(node,value)=>{assert.ok(node);await act(async()=>{if(node.tagName==='SELECT'){node.value=value;node.dispatchEvent(new Event('change',{bubbles:true}));}else{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}));}});};
const row=(host,index)=>host.querySelector(`[data-hr-row="${index}"]`);
const field=(host,index,label)=>row(host,index).querySelector(`[aria-label="${label} ${index}"]`);
const save=host=>host.querySelector('[data-hr-save-footer] .primary-button');
async function mount(Component=Entry,initial=props){const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const render=next=>act(async()=>root.render(React.createElement(Component,next)));await render(initial);return{host,render,close:async()=>{await act(async()=>root.unmount());host.remove();}};}
test('monthly entry saves several kinds in one explicit action, correct dates/Line/employee and no schedule overwrite',async()=>{
 const calls=[],m=await mount(Entry,{...props,save:async body=>{calls.push(body);return true;}});try{
  await change(field(m.host,1,'Nhân viên'),'NV001');await change(field(m.host,1,'Đến ngày'),'2026-10-13');await click(button(m.host,'Thêm dòng'));
  await change(field(m.host,2,'Nhân viên'),'NV002');await change(field(m.host,2,'Loại ghi nhận'),'Đi trễ');await change(field(m.host,2,'Từ ngày'),'2026-10-14');await change(field(m.host,2,'Đến giờ'),'09:00');
  assert.equal(calls.length,0);await click(save(m.host));assert.equal(calls.length,2);assert.ok(calls.every(body=>body.action==='line-absence'&&body.line==='A'));assert.deepEqual(calls[0].employees,['TEST-A']);assert.equal(calls[0].dateTo,'2026-10-13');assert.equal(calls[0].effectiveAt,'2026-10-12T01:00:00.000Z');assert.equal(calls[1].absenceType,'Đi trễ');assert.equal(calls[1].endsAt,'2026-10-14T02:00:00.000Z');assert.match(m.host.textContent,/Đã lưu 2 dòng/);assert.equal(save(m.host).disabled,true);
 }finally{await m.close();}
});
test('invalid employee scope, overlap, dates and no working day block before any request',async()=>{
 for(const scenario of ['scope','overlap','date','nonworking']){const calls=[],m=await mount(Entry,{...props,save:async body=>{calls.push(body);return true;}});try{
  await change(field(m.host,1,'Nhân viên'),scenario==='scope'?'NV003':'NV001');
  if(scenario==='date')await change(field(m.host,1,'Từ ngày'),'2026-11-01');
  if(scenario==='nonworking')await change(field(m.host,1,'Từ ngày'),'2026-10-18');
  if(scenario==='overlap'){await click(button(m.host,'Sao chép'));}
  await click(save(m.host));assert.equal(calls.length,0,scenario);assert.ok(m.host.querySelector('[role=alert]'),scenario);
 }finally{await m.close();}}
});
test('partial failure retains drafts and retry token, never resends confirmed rows',async()=>{const calls=[];let fail=true;const m=await mount(Entry,{...props,save:async body=>{calls.push(body);return !(body.employees[0]==='TEST-A2'&&fail);}});try{
 await change(field(m.host,1,'Nhân viên'),'NV001');await click(button(m.host,'Thêm dòng'));await change(field(m.host,2,'Nhân viên'),'NV002');await click(save(m.host));assert.equal(calls.length,2);assert.match(row(m.host,1).textContent,/Đã lưu/);assert.match(row(m.host,2).textContent,/Chưa xác nhận/);const token=calls[1].requestIdempotency;
 fail=false;await click(save(m.host));assert.equal(calls.length,3);assert.equal(calls[2].requestIdempotency,token);assert.equal(calls.filter(body=>body.employees[0]==='TEST-A').length,1);
 }finally{await m.close();}});
test('permission/context change during in-flight save stops remaining rows and busy blocks repeat submit',async()=>{let finish;const calls=[];let current={...props,save:body=>{calls.push(body);return new Promise(resolve=>finish=resolve);}};const m=await mount(Entry,current);try{
 await change(field(m.host,1,'Nhân viên'),'NV001');await click(button(m.host,'Thêm dòng'));await change(field(m.host,2,'Nhân viên'),'NV002');await act(async()=>save(m.host).click());assert.equal(calls.length,1);assert.equal(save(m.host).disabled,true);
 current={...current,allowed:false};await m.render(current);await act(async()=>finish(true));assert.equal(calls.length,1);assert.equal(save(m.host).getAttribute('aria-disabled'),'true');
 }finally{await m.close();}});
test('HR button replaces three tabs, opens separate retained workspace; warehouse/transfer and calendar drafts remain',async()=>{
 const m=await mount(Schedule,{...props,setWeek:()=>{},setLine:()=>{},setDays:()=>{},version:1,approvedSchedules:[],history:[],orders:[],manager:true,hr:true,locked:false,save:async()=>{throw Error('No write on navigation');},openAction:()=>{},refresh:async()=>true});try{
  assert.deepEqual([...m.host.querySelectorAll('[role=tab]')].map(node=>node.textContent),['Phụ kho','CV khác','Chuyển Line','Thu hồi nhân sự']);const reason=m.host.querySelector('#actual-reason');await change(reason,'Giữ lý do lịch');
  await click(button(m.host,'Ghi nhận chấm công'));const entry=m.host.querySelector('[data-hr-attendance-entry]');assert.doesNotMatch(entry.querySelector('h2').textContent,/Line/);assert.equal(entry.parentElement.hidden,false);assert.equal(m.host.querySelector('[data-standard-toolbar=ActualWorkSchedule]').parentElement.hidden,true);await change(field(entry,1,'Nhân viên'),'NV001');await click(button(entry,'Quay lại'));
  assert.equal(reason.value,'Giữ lý do lịch');await click(button(m.host,'Ghi nhận chấm công'));assert.match(field(m.host.querySelector('[data-hr-attendance-entry]'),1,'Nhân viên').value,/NV001.*Nhân viên thử A/);
 }finally{await m.close();}
});
test('month and Line drafts remain separate; all three locales show one entry and the same three HR types',async()=>{
 const m=await mount();try{await change(field(m.host,1,'Nhân viên'),'NV001');await m.render({...props,line:'B'});assert.equal(field(m.host,1,'Nhân viên').value,'');await change(field(m.host,1,'Nhân viên'),'NV003');await m.render(props);assert.match(field(m.host,1,'Nhân viên').value,/NV001.*Nhân viên thử A/);}finally{await m.close();}
 for(const [locale,title] of [['vi','Ghi nhận chấm công'],['en','Attendance entry'],['zh','出勤登錄']]){document.documentElement.lang=locale;const m=await mount();try{assert.match(m.host.querySelector('h2').textContent,new RegExp(title));assert.deepEqual([...m.host.querySelector('tbody select').options].map(option=>option.value),['Nghỉ','Đi trễ','Về sớm']);assert.equal(m.host.querySelectorAll('[data-standard-toolbar]').length,2);}finally{await m.close();}}document.documentElement.lang='vi';
});
test('monthly entry accepts day 5 outside visible week, combines employee name/code, removes full-day column and spaces actions',async()=>{
 const previous=days.map((day,index)=>({...day,date:`2026-10-${String(5+index).padStart(2,'0')}`}));const calls=[];
 const m=await mount(Entry,{...props,schedules:[{key:'2026-10-05:A',version:1,days:previous}],save:async body=>{calls.push(body);return true;}});try{
  assert.equal(m.host.querySelector('[aria-label="Tháng ghi nhận"]').value,'2026-10');assert.equal(field(m.host,1,'Từ ngày').min,'2026-10-01');assert.equal(field(m.host,1,'Từ ngày').max,'2026-10-31');assert.equal(m.host.querySelector('input[type=checkbox]'),null);assert.doesNotMatch(m.host.querySelector('thead').textContent,/Cả ngày/);
  await change(field(m.host,1,'Nhân viên'),'NV001');assert.match(field(m.host,1,'Nhân viên').value,/NV001.*Nhân viên thử A/);assert.equal(row(m.host,1).querySelector('small'),null);
  await change(field(m.host,1,'Từ ngày'),'2026-10-05');await change(field(m.host,1,'Đến ngày'),'2026-10-05');await click(save(m.host));assert.equal(calls.length,1);assert.equal(calls[0].effectiveAt,'2026-10-05T01:00:00.000Z');assert.equal(calls[0].endsAt,'2026-10-05T10:00:00.000Z');
 }finally{await m.close();}
});
test('drafts can be corrected or deleted and existing month records expose scoped edit/cancel dialogs',async()=>{
 const recorded={id:'SYNTHETIC-ENTRY',kind:'line-absence',absenceType:'Nghỉ',line:'A',employees:['TEST-A'],effectiveAt:'2026-10-05T01:00:00Z',endsAt:'2026-10-05T10:00:00Z',approved:true};const m=await mount(Entry,{...props,events:[recorded,{...recorded,id:'OTHER-LINE',line:'B'}]});try{
  await change(field(m.host,1,'Nhân viên'),'bad code');await change(field(m.host,1,'Nhân viên'),'NV001');await click(button(m.host,'Xóa dòng'));assert.equal(m.host.querySelectorAll('[data-hr-row]').length,1);assert.equal(field(m.host,1,'Nhân viên').value,'');await click(button(m.host,'Thêm dòng'));assert.equal(m.host.querySelectorAll('[data-hr-row]').length,2);
  assert.equal([...m.host.querySelectorAll('button')].filter(node=>node.textContent==='Sửa').length,1);await click(button(m.host,'Sửa'));const dialog=m.host.querySelector('[role=dialog]');assert.ok(dialog);assert.equal(dialog.querySelector('select').disabled,true);assert.deepEqual([...dialog.querySelector('select').options].map(option=>option.value),['A']);await click(button(dialog,'Đóng'));await click(button(m.host,'Hủy bản ghi'));assert.match(m.host.querySelector('[role=dialog]').textContent,/Lý do/);
 }finally{await m.close();}
});
test('month deadline is inclusive through day 10 GMT+7 and handles year rollover',async()=>{
 const {hrAttendancePeriodOpen,hrAttendanceDeadline}=await import('../lib/hr-attendance-period.mjs');
 assert.equal(hrAttendanceDeadline('2026-12'),'2027-01-10');assert.equal(hrAttendancePeriodOpen('2026-10',Date.parse('2026-11-10T16:59:59.999Z')),true);assert.equal(hrAttendancePeriodOpen('2026-10',Date.parse('2026-11-10T17:00:00.000Z')),false);
 const m=await mount();try{await change(m.host.querySelector('[aria-label="Tháng ghi nhận"]'),'2026-09');assert.equal(save(m.host).disabled,true);assert.match(save(m.host).closest('[role=button]').textContent,/Lưu ghi nhận/);}finally{await m.close();}
});

test('unrestricted HR enters C without approved schedule, preserves draft across Line changes and sends employee scope',async()=>{
 const calls=[],all=[...people,{id:'TEST-C',sourceEmployeeId:'NV004',name:'Nhân viên thử C',line:'C',active:true}];
 const initial={...props,globalHr:true,approved:undefined,days:[],employees:all,save:async body=>{calls.push(body);return true;}};
 const m=await mount(Entry,initial);try{
  assert.doesNotMatch(m.host.querySelector('h2').textContent,/Line/);await change(field(m.host,1,'Nhân viên'),'NV004');
  await change(field(m.host,1,'Từ ngày'),'2026-10-05');await change(field(m.host,1,'Đến ngày'),'2026-10-05');
  await m.render({...initial,line:'B'});assert.match(field(m.host,1,'Nhân viên').value,/NV004/);
  await click(save(m.host));assert.equal(calls.length,1);assert.equal(calls[0].attendanceScope,'employee');assert.equal(calls[0].line,undefined);assert.deepEqual(calls[0].employees,['TEST-C']);
  await click(button(m.host,'Thêm dòng'));await change(field(m.host,2,'Nhân viên'),'NV003');await change(field(m.host,2,'Từ ngày'),'2026-10-18');await click(save(m.host));assert.equal(calls.length,2,'raw Sunday facts do not depend on SX calendar');
 }finally{await m.close();}
});
test('global HR history includes C and personal edit has one employee without a Line selector; scoped projection is read-only',async()=>{
 const person={id:'TEST-C',sourceEmployeeId:'NV004',name:'Nhân viên thử C',line:'C',active:true};
 const record={id:'PERSONAL-C',kind:'line-absence',attendanceScope:'employee',absenceType:'Nghỉ',line:'C',employees:['TEST-C'],effectiveAt:'2026-10-05T01:00:00Z',endsAt:'2026-10-05T10:00:00Z',approved:true};
 const m=await mount(Entry,{...props,globalHr:true,employees:[...people,person],events:[record,{...record,id:'projection',hrScopeProjection:true,line:'A'}]});try{
  assert.equal([...m.host.querySelectorAll('button')].filter(node=>node.textContent==='Sửa').length,1);await click(button(m.host,'Sửa'));const dialog=m.host.querySelector('[role=dialog]');assert.ok(dialog);assert.equal(dialog.querySelectorAll('select').length,1);assert.equal(dialog.querySelector('select').value,'Nghỉ');assert.equal(dialog.querySelector('.cap-picker-select-all'),null);
 }finally{await m.close();}
});

const key=async(node,key,extra={})=>{assert.ok(node);let event;await act(async()=>{event=new window.KeyboardEvent('keydown',{key,bubbles:true,cancelable:true,...extra});node.dispatchEvent(event);});return event;};
test('ArrowDown from every editable column appends and focuses same column; ArrowUp and existing-row navigation never duplicate',async()=>{
 for(const label of ['Nhân viên','Loại ghi nhận','Từ ngày','Đến ngày','Từ giờ','Đến giờ','Ghi chú']){const m=await mount(Entry,{...props,globalHr:true});try{
  await change(field(m.host,1,'Nhân viên'),'NV001');const input=field(m.host,1,label);await act(async()=>input.focus());const event=await key(input,'ArrowDown');assert.equal(event.defaultPrevented,true,label);assert.equal(m.host.querySelectorAll('[data-hr-row]').length,2,label);assert.equal(document.activeElement,field(m.host,2,label),label);
  await key(field(m.host,2,label),'ArrowUp');assert.equal(document.activeElement,field(m.host,1,label),label);await key(field(m.host,1,label),'ArrowDown');assert.equal(m.host.querySelectorAll('[data-hr-row]').length,2,label);assert.equal(document.activeElement,field(m.host,2,label),label);assert.match(field(m.host,1,'Nhân viên').value,/NV001/);
 }finally{await m.close();}}
});
test('suggestion navigation retains arrows until selected; clock popover, IME, repeats and busy do not append accidentally',async()=>{
 const m=await mount(Entry,{...props,globalHr:true});try{
  const employee=field(m.host,1,'Nhân viên');await change(employee,'NV00');await act(async()=>employee.focus());await key(employee,'ArrowDown');assert.equal(m.host.querySelectorAll('[data-hr-row]').length,1);assert.ok(employee.getAttribute('aria-activedescendant'));await key(employee,'Enter');assert.match(employee.value,/NV001/);await key(employee,'ArrowDown');assert.equal(m.host.querySelectorAll('[data-hr-row]').length,2);
  const time=field(m.host,2,'Từ giờ');for(const extra of [{isComposing:true},{repeat:true},{ctrlKey:true}])await key(time,'ArrowDown',extra);assert.equal(m.host.querySelectorAll('[data-hr-row]').length,2);
  await click(row(m.host,2).querySelector('[aria-label="Từ giờ 2 · chọn giờ 24h"]'));await key(time,'ArrowDown');assert.equal(m.host.querySelectorAll('[data-hr-row]').length,2);await click(button(document.body.querySelector('.cap-clock-picker'),'Xong'));await key(time,'ArrowDown');assert.equal(m.host.querySelectorAll('[data-hr-row]').length,3);assert.equal(document.activeElement,field(m.host,3,'Từ giờ'));
  await m.render({...props,globalHr:true,busy:true});await key(field(m.host,3,'Ghi chú'),'ArrowDown');assert.equal(m.host.querySelectorAll('[data-hr-row]').length,3);
 }finally{await m.close();}
});
test('one Save is below draft table and above complete monthly history; type filters retain input and never write',async()=>{
 let calls=0;const events=['Nghỉ','Đi trễ','Về sớm'].map((absenceType,i)=>({id:`HISTORY-${i}`,kind:'line-absence',attendanceScope:'employee',absenceType,line:['A','B','C'][i],employees:['TEST-A'],effectiveAt:`2026-10-0${i+1}T01:00:00Z`,endsAt:`2026-10-0${i+1}T02:00:00Z`,recordedAt:'2026-10-17T01:00:00Z',approved:true,actor:'Synthetic HR',reason:`Complete note ${i}`}));
 const m=await mount(Entry,{...props,globalHr:true,events,save:async()=>{calls++;return true;}});try{
  await change(field(m.host,1,'Ghi chú'),'Keep draft');assert.equal(m.host.querySelectorAll('[data-hr-save-footer] .primary-button').length,1);assert.equal(m.host.querySelector('[data-standard-toolbar=HrAttendanceEntry]').textContent.includes('Lưu ghi nhận'),false);const footer=m.host.querySelector('[data-hr-save-footer]');assert.ok(footer.previousElementSibling.querySelector('[data-hr-row]'));assert.equal(footer.nextElementSibling.textContent,'Đã ghi nhận trong tháng');assert.equal(m.host.querySelectorAll('[data-hr-history-row]').length,3);
  const filters=m.host.querySelector('[data-standard-toolbar=HrAttendanceHistory]');for(const kind of ['Nghỉ','Đi trễ','Về sớm']){await click([...filters.querySelectorAll('button')].find(node=>node.textContent===`${kind} · 1`));assert.equal(m.host.querySelectorAll('[data-hr-history-row]').length,1);const record=m.host.querySelector('[data-hr-history-row]');assert.match(record.textContent,new RegExp(kind));assert.match(record.textContent,/Complete note|Synthetic HR/);assert.equal(field(m.host,1,'Ghi chú').value,'Keep draft');}
  await click([...filters.querySelectorAll('button')].find(node=>node.textContent==='Tất cả · 3'));assert.equal(m.host.querySelectorAll('[data-hr-history-row]').length,3);assert.equal(calls,0);
 }finally{await m.close();}
});
test('haquyen retains calendar and orange HR launch; hides schedule writes and retains attendance drafts',async()=>{
 const initial={...props,attendanceOnly:true,setWeek:()=>{},setLine:()=>{},setDays:()=>{},version:1,approvedSchedules:[],history:[],orders:[],manager:true,hr:true,locked:false,save:async()=>{throw Error('No writes on navigation');},openAction:()=>{},refresh:async()=>true};
 const m=await mount(Schedule,initial);try{
  assert.equal(m.host.querySelector('[data-hr-only-workspace]'),null);const launch=m.host.querySelector('#hr-attendance-launch');assert.equal(launch.textContent,'Ghi nhận chấm công');assert.equal(m.host.querySelector('#actual-reason'),null);assert.ok(m.host.querySelector('[data-actual-calendar]'));assert.equal(m.host.querySelector('[data-actual-calendar]').hidden,false);assert.equal(m.host.querySelector('[role=tab]'),null);assert.equal(m.host.querySelector('.actual-day-note').disabled,true);assert.equal(m.host.querySelector('[aria-label="Làm HC 12/10/2026"]').disabled,true);
  await click(launch);await change(field(m.host,1,'Ghi chú'),'Retain HR draft');await click(button(m.host,'Quay lại'));await click(launch);assert.equal(field(m.host,1,'Ghi chú').value,'Retain HR draft');
  await m.render({...initial,attendanceOnly:false,hr:false});assert.equal(m.host.querySelector('[data-hr-attendance-entry]'),null);assert.ok(m.host.querySelector('#actual-reason'),'other manager presentation is preserved');assert.equal(m.host.querySelector('.actual-day-note').disabled,false);
 }finally{await m.close();}
});

test('deleting the last draft keeps one fresh input row; Back/reopen, month switch and permission refresh retain it without requests',async()=>{
 let calls=0;const initial={...props,globalHr:true,save:async()=>{calls++;return true;}};const m=await mount(Entry,initial);try{
  const oldId=row(m.host,1).dataset.hrDraftId;await change(field(m.host,1,'Nhân viên'),'NV001');await click(button(m.host,'Xóa dòng'));assert.equal(m.host.querySelectorAll('[data-hr-row]').length,1);assert.notEqual(row(m.host,1).dataset.hrDraftId,oldId);assert.equal(field(m.host,1,'Nhân viên').value,'');
  await m.render({...initial,active:false});await m.render(initial);assert.equal(m.host.querySelectorAll('[data-hr-row]').length,1);await change(field(m.host,1,'Ghi chú'),'Retain my row');await m.render({...initial,busy:true});await m.render(initial);assert.equal(field(m.host,1,'Ghi chú').value,'Retain my row');
  await change(m.host.querySelector('[aria-label="Tháng ghi nhận"]'),'2026-11');assert.equal(m.host.querySelectorAll('[data-hr-row]').length,1);await change(m.host.querySelector('[aria-label="Tháng ghi nhận"]'),'2026-10');assert.equal(field(m.host,1,'Ghi chú').value,'Retain my row');assert.equal(calls,0);
 }finally{await m.close();}
});
test('reopening a fully saved batch adds one empty input without resending or deleting confirmed rows',async()=>{
 const calls=[],initial={...props,globalHr:true,save:async body=>{calls.push(body);return true;}};const m=await mount(Entry,initial);try{
  await change(field(m.host,1,'Nhân viên'),'NV001');await click(save(m.host));assert.equal(calls.length,1);assert.match(row(m.host,1).textContent,/Đã lưu/);
  await m.render({...initial,active:false});await m.render(initial);assert.equal(m.host.querySelectorAll('[data-hr-row]').length,2);assert.match(row(m.host,1).textContent,/Đã lưu/);assert.equal(field(m.host,2,'Nhân viên').value,'');await click(button(row(m.host,2),'Xóa dòng'));assert.equal(m.host.querySelectorAll('[data-hr-row]').length,2);assert.equal(field(m.host,2,'Nhân viên').value,'');assert.equal(calls.length,1);
 }finally{await m.close();}
});
