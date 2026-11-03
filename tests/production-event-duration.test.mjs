import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {productionEventDuration as duration,formatProductionEventDuration as format} from '../lib/production-event-duration.mjs';
const date='2026-10-12',day={date,working:true,ot:true,hcStart:'08:00',hcEnd:'17:00',lunchStart:'12:00',lunchEnd:'13:00',breaks:[{start:'10:00',end:'10:10'},{start:'15:00',end:'15:10'}],otStart:'17:30',otEnd:'21:00'},schedules=[{key:date+':A',days:[day]}];
const event=(start,end,extra={})=>({kind:'line-absence',line:'A',effectiveAt:`${date}T${start}:00+07:00`,endsAt:`${date}T${end}:00+07:00`,...extra});
test('record hours intersect actual calendar, excluding short breaks; administrative reference includes them',()=>{
 for(const [start,end,minutes,productionMinutes,text] of [['08:00','10:30',150,140,'2 giờ 20 phút'],['14:30','17:00',150,140,'2 giờ 20 phút'],['09:30','10:30',60,50,'50 phút'],['08:00','17:00',480,460,'7 giờ 40 phút'],['11:30','13:30',60,60,'1 giờ'],['10:00','10:10',10,0,'0 phút'],['17:00','18:00',30,30,'30 phút'],['06:00','22:00',690,670,'11 giờ 10 phút']]){
  const result=duration(event(start,end),schedules);assert.equal(result.administrativeMinutes,minutes);assert.equal(result.minutes,productionMinutes);assert.equal(format(result),text);
 }
});
test('row duration is per person and descriptive for cancelled/pending/overlapping records',()=>{
 const e=event('08:00','10:30',{count:2,employees:['N1','N2'],cancelled:true,approved:false}),before=JSON.stringify(e);assert.equal(duration(e,schedules).minutes,140);assert.equal(JSON.stringify(e),before);
 assert.equal(duration({...e,id:'duplicate'},schedules).minutes,140);
});
test('resolved custom calendar and multi-day spans are used without guessing missing schedules',()=>{
 const custom=[{line:'A',days:[{...day,breaks:[{start:'09:00',end:'09:20'},{start:'14:00',end:'14:10'}]}, {...day,date:'2026-10-13',working:false,ot:false}]}];
 assert.equal(duration(event('08:00','10:30'),custom).minutes,130);
 assert.equal(duration({...event('08:00','17:00'),endsAt:'2026-10-13T17:00:00+07:00'},custom).minutes,660);
 assert.equal(duration(event('08:00','10:30'),[]).reason,'Thiếu lịch làm việc');
 assert.equal(duration(event('08:00','10:30',{openArrival:true}),schedules).minutes,null);
 assert.equal(duration(event('08:00','10:30',{endsAt:null}),schedules).minutes,null);
});
test('cleaning is not an absence or helper break; transfer duration uses receiving Line calendar',()=>{
 const s=[{line:'B',days:[{...day,cleaning:[{start:'09:30',end:'10:30',people:1,employees:['N']}]}]}];
 assert.equal(duration(event('09:30','10:30',{kind:'line-movement',destinationLine:'B'}),s).minutes,50);
});
test('monthly history places Số giờ immediately after end time and passes resolved calendar',()=>{
 const source=readFileSync(new URL('../components/actual-labor-month.tsx',import.meta.url),'utf8');assert.match(source,/<th>Đến thời điểm<\/th><th[^>]*>Số giờ theo lịch \(mỗi người\)<\/th><th>Loại/);assert.match(source,/productionEventDuration\(e,schedules,durationContext\)/);assert.match(source,/Giờ theo ca gồm giải lao:/);assert.match(source,/Số giờ tính cho mỗi người/);assert.match(source,/colSpan=\{12\}/);
 const parent=readFileSync(new URL('../components/actual-work-schedule.tsx',import.meta.url),'utf8');assert.match(parent,/<ActualLaborMonth[^>]*schedules=\{approvedSchedules\}/);
});

test('payroll clarifies productive attendance basis without changing fields or calculation',()=>{
 const source=readFileSync(new URL('../components/production-payroll.tsx',import.meta.url),'utf8');assert.match(source,/role="note">\{attendanceBasisNote\}/);assert.match(source,/Giờ lịch, giờ vắng và giờ hiện diện trong bảng này đã loại nghỉ trưa và giải lao/);assert.match(source,/\['calendarHc','calendarOt','absentHc','absentOt'\]/);
});

test('Phat home C follows receiving B and subsequent A windows without altering HR fact',()=>{
 const id='S2017002',employees=[{id,name:'Trầm Thuận Phát',line:'C'}],e=event('08:00','17:00',{line:'C',employees:[id]}),before=JSON.stringify(e);
 const b={line:'B',days:[day],roster:[{date,hc:[id],ot:[]}]};
 assert.equal(duration(e,[b],{events:[],employees}).minutes,460);
 const movements=[{id:'move',kind:'line-movement',line:'C',destinationLine:'B',employees:[id],effectiveAt:e.effectiveAt,endsAt:e.endsAt}];
 assert.equal(duration(e,[{line:'B',days:[day]}],{events:movements,employees}).minutes,460);
 const split=[{...b,roster:[{date,hc:[id],hcWindows:{[id]:[[480,720]]},ot:[]}]},{line:'A',days:[{...day,breaks:[{start:'14:00',end:'14:30'},{start:'16:00',end:'16:10'}]}],roster:[{date,hc:[id],hcWindows:{[id]:[[720,1020]]},ot:[]}]}];
 const r=duration(e,split,{events:[],employees});assert.equal(r.minutes,430);assert.deepEqual(r.lines,['B','A']);assert.equal(JSON.stringify(e),before);
 const missing=duration(e,[],{events:movements,employees});assert.equal(missing.minutes,null);
 const cancelled=[...movements,{id:'cancel',kind:'attendance-cancel',supersedes:'move'}];
 assert.equal(duration(e,[{line:'B',days:[day]}],{events:cancelled,employees}).reason,'Thiếu lịch làm việc');
 assert.equal(duration({...e,employees:[id,'OTHER']},[b],{events:[],employees}).minutes,null);
});

test('reusing resolved attendance preserves cancelled and pending movement semantics',async()=>{
 const {effectiveAttendance}=await import('../lib/production-attendance.mjs');
 const id='TEST',employees=[{id,line:'C'}],e=event('08:00','17:00',{line:'C',employees:[id]});
 const move={id:'m',kind:'line-movement',line:'C',destinationLine:'B',employees:[id],effectiveAt:e.effectiveAt,endsAt:e.endsAt};
 for(const events of [[move],[{...move,approved:false}],[move,{id:'cancel',kind:'attendance-cancel',supersedes:'m'}]]){
  assert.deepEqual(duration(e,[{line:'B',days:[day]}],{events,employees,activeEvents:effectiveAttendance(events)}),duration(e,[{line:'B',days:[day]}],{events,employees}));
 }
});
