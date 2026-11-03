import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduleHeadcount} from '../lib/production-schedule-headcount.mjs';
import {monthlyAttendance} from '../lib/production-monthly-attendance.mjs';
const date='2026-10-19',ids=Array.from({length:10},(_,i)=>'B'+i);
const day={date,working:true,hcStart:'09:00',hcEnd:'17:00',ot:false};
const employees=[...ids.map(id=>({id,line:'B'})),...['C1','C2'].map(id=>({id,line:'C'}))];
const reference={key:'2026-10-19:B',workers:10,days:[day],roster:[{date,hc:ids,ot:[]}],input:{dailySchedule:[day],dailyHcLeave:[{date,mode:'full',employees:['B0']}],dailyOtLeave:[]}};
const move={id:'M',kind:'line-movement',line:'C',destinationLine:'B',employees:['C1','C2'],count:2,effectiveAt:'2026-10-19T08:00:00+07:00',endsAt:'2026-10-23T17:00:00+07:00'};
const hr=(extra={})=>({id:'H',kind:'line-absence',line:'B',absenceType:'Nghỉ',employees:['B0'],approved:true,effectiveAt:date+'T09:00:00+07:00',endsAt:date+'T17:00:00+07:00',...extra});
const calc=(extra={})=>scheduleHeadcount({reference,employees,line:'B',day,events:[move],now:Date.parse('2026-10-20T00:00:00Z'),...extra});
test('10 - Capacity 1 + transferred 2 = 11, explicit named evidence, actual shift start',()=>{const r=calc();assert.equal(r.label,'11');assert.equal(r.windows[0].start,540);assert.deepEqual(r.windows[0].provisional,['B0']);assert.equal(r.windows[0].people.length,11);});
test('same HR person is deducted once and HR different interval replaces whole day forecast',()=>{
 const same=calc({events:[move,hr()]});assert.equal(same.label,'11');assert.deepEqual(same.windows[0].provisional,[]);assert.deepEqual(same.windows[0].actualAbsent,['B0']);
 const changed=calc({events:[move,hr({effectiveAt:date+'T13:00:00+07:00'})]});assert.equal(changed.label,'11–12');assert.equal(changed.windows[0].count,12);assert.equal(changed.windows.find(w=>w.start===780).count,11);
});
test('partial Capacity leave and transfer end boundaries split windows',()=>{
 const r=calc({reference:{...reference,input:{...reference.input,dailyHcLeave:[{date,mode:'hours',start:'09:00',end:'10:00',employees:['B0']}] }},events:[{...move,endsAt:date+'T13:00:00+07:00'}]});
 assert.equal(r.windows[0].count,11);assert.equal(r.windows.find(w=>w.start===610).count,12);assert.equal(r.windows.find(w=>w.start===780).count,10);
});
test('incoming already in roster is never doubled',()=>{assert.equal(calc({reference:{...reference,roster:[{date,hc:[...ids,'C1','C2'],ot:[]}]}}).label,'11');});
test('helpers, pending, cancelled records do not replace provisional leave; present override covers only interval',()=>{
 for(const event of [hr({absenceType:'Phụ kho'}),hr({approved:false}),hr({voided:true})])assert.deepEqual(calc({events:[move,event]}).windows[0].provisional,['B0']);
 const r=calc({events:[move,hr({kind:'attendance-override',endsAt:date+'T10:00:00+07:00'})]});assert.equal(r.windows[0].count,12);assert.equal(r.windows.find(w=>w.start===610).count,11);
});
test('deadline inclusive 10th next month ICT; HR records remain effective after deadline',()=>{
 const deadline=Date.parse('2026-11-10T17:00:00Z');assert.equal(calc({now:deadline-1}).label,'11');assert.equal(calc({now:deadline}).label,'12');assert.equal(calc({now:deadline,events:[move,hr()]}).label,'11');
 const december='2026-12-19',ref=JSON.parse(JSON.stringify(reference).replaceAll(date,december));const options={reference:ref,day:{...day,date:december},events:[]};
 assert.equal(calc({...options,now:Date.parse('2027-01-10T16:59:59Z')}).label,'9');assert.equal(calc({...options,now:Date.parse('2027-01-10T17:00:00Z')}).label,'10');
});
test('Capacity-only never deducts monthly actual hours even before deadline',()=>{
 const result=monthlyAttendance({events:[],schedules:[reference],employees,month:'2026-10',line:'B'});
 const p=result.people.find(p=>p.id==='B0'),other=result.people.find(p=>p.id==='B1');assert.equal(p.absentHc,0);assert.equal(p.hc,other.hc);assert.ok(p.hc>0);
});
test('unknown or unnamed leave is flagged, no guessed deduction',()=>{
 for(const leave of [{date,mode:'full',people:1},{date,mode:'full',employees:['UNKNOWN']}]){const r=calc({reference:{...reference,input:{...reference.input,dailyHcLeave:[leave]}}});assert.equal(r.label,'12');assert.ok(r.warnings.length);}
});
test('unnamed legacy roster does not invent exact counts or employee identities',()=>{
 const r=calc({reference:{workers:5,input:{dailySchedule:[day]}},events:[]});assert.equal(r.label,'Chưa đủ dữ liệu');assert.equal(r.windows[0].count,null);assert.deepEqual(r.windows[0].people,[]);assert.equal(r.actualMax,5);
});
test('partial OT attended-hours without interval is explicitly unresolved',()=>{
 const otday={...day,ot:true,otStart:'17:30',otEnd:'21:00'};
 const r=calc({day:otday,reference:{...reference,roster:[{date,hc:ids,ot:ids}],input:{...reference.input,dailyOtLeave:[{date,mode:'attended',hours:1,employees:['B0']}]}}});assert.equal(r.windows.find(w=>w.part==='ot').count,null);assert.ok(r.warnings.some(w=>w.includes('TC')));
});
test('restricted Line borrowing keeps visible evidence but never certifies hidden HR completeness',()=>{
 const limited=calc({restrictedLine:true});assert.equal(limited.label,'Chưa đủ dữ liệu');assert.equal(limited.windows[0].count,null);assert.ok(limited.windows[0].people.includes('C1'));assert.ok(limited.warnings.some(w=>w.includes('được phép xem')));assert.equal(JSON.stringify(limited).includes('hidden-person'),false);
 assert.equal(calc({restrictedLine:false}).label,'11');
 const returned=calc({restrictedLine:true,events:[{...move,endsAt:date+'T09:00:00+07:00'}]});assert.equal(returned.label,'9');
});
test('HR replacement and deadline resolve old ambiguous OT forecast',()=>{
 const otday={...day,ot:true,otStart:'17:30',otEnd:'21:00'},ref={...reference,roster:[{date,hc:ids,ot:ids}],input:{...reference.input,dailyOtLeave:[{date,mode:'attended',hours:1,employees:['B0']}]}};
 for(const extra of [{events:[move,hr()]},{now:Date.parse('2026-11-10T17:00:00Z')}]){const r=calc({day:otday,reference:ref,...extra});assert.notEqual(r.windows.find(w=>w.part==='ot').count,null);assert.equal(r.warnings.some(w=>w.includes('Nghỉ TC')),false);}
});
test('unresolved roster identity and foreign Capacity assignment do not claim complete totals',()=>{
 const ref={...reference,roster:[{date,hc:['B0','C1'],ot:[]}]};
 const missing=calc({reference:ref,employees:employees.filter(p=>p.id!=='C1'),events:[]});assert.equal(missing.label,'Chưa đủ dữ liệu');assert.ok(missing.warnings.some(w=>w.includes('mã nhân viên')));
 const foreign=calc({reference:ref,restrictedLine:true,events:[]});assert.equal(foreign.label,'Chưa đủ dữ liệu');
});
