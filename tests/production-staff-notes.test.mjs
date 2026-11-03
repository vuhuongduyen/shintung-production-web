import test from 'node:test';
import assert from 'node:assert/strict';
import {productionStaffNotes} from '../lib/production-staff-notes.mjs';
const date='2026-10-03',at=time=>new Date(`${date}T${time}:00+07:00`).toISOString();
test('station picker shows same-day attendance, latest corrections and pending changes in Vietnam 24h',()=>{
 const events=[
  {id:'late',kind:'line-absence',employees:['NV01'],absenceType:'Đi trễ',effectiveAt:at('08:00'),endsAt:at('17:00'),openArrival:true,approved:true},
  {id:'arrival',supersedes:'late',kind:'line-absence',employees:['NV01'],absenceType:'Đi trễ',effectiveAt:at('08:00'),endsAt:at('09:30'),approved:true},
  {id:'warehouse',kind:'line-absence',employees:['NV01'],absenceType:'Phụ kho',effectiveAt:at('13:00'),endsAt:at('14:00'),approved:false},
  {id:'other',kind:'line-absence',employees:['NV02'],absenceType:'Nghỉ',effectiveAt:at('08:00'),endsAt:at('17:00')},
  {id:'tomorrow',kind:'line-absence',employees:['NV01'],absenceType:'Nghỉ',effectiveAt:'2026-10-04T01:00:00Z',endsAt:'2026-10-04T10:00:00Z'},
 ];
 assert.deepEqual(productionStaffNotes({employeeId:'nv01',date,events}),['Đi trễ 08:00–09:30','Phụ kho 13:00–14:00 · Chờ duyệt điều chỉnh giờ']);
 assert.deepEqual(productionStaffNotes({employeeId:'NV01',date,events:[events[0]]}),['Đi trễ 08:00 · Chưa đến']);
 assert.deepEqual(productionStaffNotes({employeeId:'NV03',date,events}),[]);
});
test('planned leave and actual presence are both visible, including multi-day leave and overtime',()=>{
 const reference={days:[{date,hcStart:'08:00',hcEnd:'17:00',otStart:'17:30',otEnd:'21:00'}],input:{dailyHcLeave:[{date:'2026-10-02',to:'2026-10-04',mode:'full',employees:['NV01'],includeOt:true}],dailyOtLeave:[]}};
 const events=[{id:'present',kind:'attendance-override',employees:['NV01'],effectiveAt:at('08:00'),endsAt:at('17:00'),approved:true}];
 assert.deepEqual(productionStaffNotes({employeeId:'NV01',date,events,reference}),['Đăng ký nghỉ HC 08:00–17:00','Đăng ký nghỉ TC 17:30–21:00','Có mặt thực tế 08:00–17:00']);
 assert.deepEqual(productionStaffNotes({employeeId:'NV01',date:'2026-10-05',events,reference}),[]);
});
