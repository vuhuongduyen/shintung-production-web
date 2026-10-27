import {warehouseHelpers,dutyDates,latestDuty,dutyRows} from '../../lib/warehouse-duty.mjs';
import {effectiveAttendance,transferStaffCandidates} from '../../lib/production-attendance.mjs';
const fail=(message,status=422)=>{throw Object.assign(new Error(message),{status});};
const validTime=s=>/^([01]\d|2[0-3]):[0-5]\d$/.test(s);
// Plans and unfinished intervals never become attendance deductions. All six
// days and completed attendance events are committed by the caller atomically.
export function buildWarehouseDuty({body,state,actor,now,canManage,permitted,affectedReport}){
 if(!canManage(actor))fail('Chỉ QLSX được xếp lịch và ghi nhận phụ kho.',403);
 const {week,line}=body;
 if(!['A','B'].includes(line)||!permitted(actor,line))fail('Không có quyền ghi phụ kho cho Line này.',403);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(week||'')||!Number.isFinite(Date.parse(week))||new Date(week).toISOString().slice(0,10)!==week||new Date(week).getUTCDay()!==1)fail('Chọn tuần bắt đầu vào Thứ Hai.');
 const old=latestDuty(state.events,week,line);
 if((body.expectedId||null)!==(old?.id||null))fail('Lịch phụ kho đã thay đổi. Tải lại trước khi lưu.',409);
 const dates=dutyDates(week),active=effectiveAttendance(state.events,true),before=dutyRows(state.events,week,line,active);
 if(!Array.isArray(body.rows)||body.rows.length<6||body.rows.length>120||new Set(body.rows.map(r=>r.date)).size!==6||body.rows.some(r=>!dates.includes(r.date)))fail('Lịch cần đủ sáu ngày từ Thứ Hai đến Thứ Bảy.');
 const ids=body.rows.map(r=>String(r.rowId||r.date));
 if(new Set(ids).size!==ids.length||ids.some(id=>!/^[-a-zA-Z0-9]{1,80}$/.test(id)))fail('Dòng phụ kho không hợp lệ hoặc bị trùng.');
 if(before.some(r=>r.attendanceId&&!ids.includes(r.rowId)))fail('Dùng Hủy để hủy khoảng phụ kho đã ghi nhận.',409);
 const candidates=warehouseHelpers(state.employees),created=[],rows=[];
 for(const input of [...body.rows].sort((a,b)=>a.date.localeCompare(b.date))){
  const date=input.date,rowId=String(input.rowId||date),previous=before.find(r=>r.rowId===rowId);
  if(previous&&previous.date!==date)fail('Không thể đổi ngày của dòng phụ kho.');
  const row={date,rowId,employee:String(input.employee||''),start:String(input.start||''),end:String(input.end||'')};
  if(previous?.attendanceId){
   if(['employee','start','end'].some(k=>row[k]!==previous[k]))fail(`Ngày ${date}: đã ghi giờ thực tế. Dùng Sửa hoặc Hủy bản ghi trong Biến động đã ghi.`,409);
   rows.push({...row,attendanceId:previous.attendanceId});continue;
  }
  if(row.employee&&!candidates.some(p=>p.id===row.employee))fail(`Ngày ${date}: chọn một trong ba nhân viên phụ kho.`);
  if((row.start||row.end)&&!row.employee)fail(`Ngày ${date}: chọn nhân viên trước khi nhập giờ.`);
  if(row.start&&!validTime(row.start)||row.end&&!validTime(row.end)||row.end&&(!row.start||row.end<=row.start))fail(`Ngày ${date}: nhập giờ 24h và Đến giờ sau Từ giờ.`);
  if(!row.end){rows.push(row);continue;}
  const effectiveAt=new Date(`${date}T${row.start}:00+07:00`).toISOString(),endsAt=new Date(`${date}T${row.end}:00+07:00`).toISOString();
  const duplicate=[...active,...created].find(e=>['absence','line-absence','attendance-override'].includes(e.kind)&&e.employees?.includes(row.employee)&&Date.parse(e.effectiveAt)<Date.parse(endsAt)&&Date.parse(e.endsAt)>Date.parse(effectiveAt));
  if(duplicate)fail(`Ngày ${date}: nhân viên có nghỉ hoặc phụ kho trùng khoảng giờ. Chưa lưu thay đổi nào.`,409);
  const reference=state.approvedSchedules.find(r=>r.key===`${week}:${line}`);
  if(!reference?.days?.some(d=>d.date===date&&d.working))fail(`Ngày ${date}: chưa có lịch làm việc được duyệt tại Line ${line}.`,409);
  const eligible=transferStaffCandidates({references:state.approvedSchedules,events:state.events,employees:state.employees,line,effectiveAt,endsAt});
  if(!eligible.some(p=>p.id===row.employee))fail(`Ngày ${date}: nhân viên không có mặt đủ khoảng giờ tại Line ${line}. Kiểm tra lịch, nghỉ hoặc chuyển Line.`,409);
  const person=candidates.find(p=>p.id===row.employee);
  const event={id:crypto.randomUUID(),kind:'line-absence',absenceType:'Phụ kho',sourceId:null,line,employees:[row.employee],employeeDetails:[{id:person.id,name:person.name}],count:1,effectiveAt,endsAt,approved:true,recordedAt:now,actor:actor.login,reason:'Phụ kho · ghi giờ từ lịch trực tuần',warehouseDutyKey:`${week}:${line}:${rowId}`};
  created.push(event);rows.push({...row,attendanceId:event.id});
 }
 const event={id:crypto.randomUUID(),kind:'warehouse-duty',week,line,sourceId:null,rows,employees:[...new Set(rows.map(r=>r.employee).filter(Boolean))],effectiveAt:new Date(`${week}T00:00:00+07:00`).toISOString(),recordedAt:now,actor:actor.login,reason:'Cập nhật lịch trực phụ kho và giờ thực tế',before:old?.rows||[],previousId:old?.id||null,requestIdempotency:body.requestIdempotency};
 return {event,events:[event,...created],pendingHours:created.some(e=>!e.approved)};
}
