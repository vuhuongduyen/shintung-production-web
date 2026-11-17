import {effectiveAttendance} from './production-attendance.mjs';
import {hrAttendancePeriodOpen} from './hr-attendance-period.mjs';
import {employeeActiveOn} from './employee-employment.mjs';
export const HR_IMPORT_LIMIT=100;
export const hrImportActions=new Set(['hr-import-preview','hr-import-save','hr-import-history','hr-import-cancel-preview','hr-import-cancel']);
const upper=v=>String(v??'').trim().toUpperCase();
const dateOk=v=>/^\d{4}-\d\d-\d\d$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
const clock=v=>/^([01]\d|2[0-3]):[0-5]\d$/.test(v);
export function matchAbsenceEmployee(code,employees){return employees.filter(p=>[p.id,p.sourceEmployeeId].some(v=>v&&upper(v)===upper(code)));}
const normalizedName=v=>String(v||'').normalize('NFC').trim().replace(/\s+/g,' ').toLocaleUpperCase('vi');
export function previewAbsences(rows,employees,events,{month,now=Date.now()}={}){
 if(!Array.isArray(rows)||!rows.length||rows.length>HR_IMPORT_LIMIT)throw Error(`Mỗi lần nhập từ 1 đến ${HR_IMPORT_LIMIT} dòng.`);
 const existing=effectiveAttendance(events,true).filter(e=>['absence','line-absence','attendance-override'].includes(e.kind)&&e.absenceType!=='Phụ kho');
 if(rows.some(r=>!r||typeof r!=='object'||Object.values(r).some(v=>typeof v==='string'&&v.length>500)))throw Error('Dòng dữ liệu quá dài hoặc không hợp lệ.');
 const seen=[];
 return rows.map((raw,index)=>{
  const r={row:Number(raw.row)||index+2,code:String(raw.code||'').trim(),name:String(raw.name||'').trim(),date:String(raw.date||''),start:String(raw.start||''),end:String(raw.end||''),leaveCode:upper(raw.leaveCode),leaveName:String(raw.leaveName||''),duration:String(raw.duration||''),kind:String(raw.kind||''),employeeId:null,status:'valid',issue:''};
  const candidates=matchAbsenceEmployee(r.code,employees),person=candidates.length===1?candidates[0]:null;
  if(!r.code||!person)r.issue=candidates.length>1?'Mã nhân viên khớp nhiều người.':'Mã nhân viên không tồn tại.';
  else if(!r.name||normalizedName(r.name)!==normalizedName(person.name))r.issue='Tên không khớp mã nhân viên; đối chiếu file gốc.';
  else if(!dateOk(r.date)||r.date.slice(0,7)!==month)r.issue='Ngày không hợp lệ hoặc khác tháng đang chọn.';
  else if(!employeeActiveOn(person,r.date))r.issue='Nhân viên chưa hoặc không còn làm việc vào ngày này.';
  else if(!hrAttendancePeriodOpen(r.date,now))r.issue='Tháng ghi nhận đã hết hạn.';
  else if(!clock(r.start)||!clock(r.end)||r.start>=r.end)r.issue='Giờ bắt đầu/kết thúc không hợp lệ trong cùng ngày.';
  else if(!/^\d{2}:[0-5]\d$/.test(r.duration)||r.duration==='00:00')r.issue='Thời gian xin phép không hợp lệ.';
  else if(!['PN','VR','HL1','TRVS','15P'].includes(r.leaveCode))r.issue='Mã nghỉ chưa được quy định; cần đối chiếu.';
  else if(['PN','VR','HL1'].includes(r.leaveCode)&&r.kind!=='Nghỉ'||r.leaveCode==='15P'&&r.kind!=='Đi trễ'||r.leaveCode==='TRVS'&&r.kind!=='Đi trễ, về sớm')r.issue='Chọn đúng loại ghi nhận cho mã nghỉ.';
  if(r.issue)return {...r,status:'error'};
  r.employeeId=person.id;
  const start=new Date(`${r.date}T${r.start}:00+07:00`).toISOString(),end=new Date(`${r.date}T${r.end}:00+07:00`).toISOString();
  const duration=Number(r.duration.slice(0,2))*60+Number(r.duration.slice(3));
  if(duration>(Date.parse(end)-Date.parse(start))/60000)return {...r,status:'error',issue:'Giờ xin phép vượt khoảng bắt đầu–kết thúc.'};
  const same=e=>e.employees?.some(id=>upper(id)===upper(person.id))&&Date.parse(e.effectiveAt)<Date.parse(end)&&Date.parse(e.endsAt)>Date.parse(start);
  const conflict=existing.find(same),internal=seen.find(same);
  seen.push({employees:[person.id],effectiveAt:start,endsAt:end,row:r.row});
  if(internal)return {...r,status:'error',issue:`Chồng thời gian với dòng ${internal.row} trong file.`};
  if(conflict){const exact=Date.parse(conflict.effectiveAt)===Date.parse(start)&&Date.parse(conflict.endsAt)===Date.parse(end)&&(conflict.absenceType===r.kind||r.kind==='Đi trễ, về sớm'&&['Đi trễ','Về sớm'].includes(conflict.absenceType))&&conflict.approved!==false;
   return {...r,status:exact?'duplicate':'error',issue:exact?'Đã ghi nhận; bỏ qua.':'Chồng thời gian với ghi nhận hiện có; không ghi đè.'};}
  return {...r,effectiveAt:start,endsAt:end};
 });
}
export function cancellationIssues(batch,events,now=Date.now()){
 const active=new Map(effectiveAttendance(events,true).map(e=>[e.id,e]));
 return batch.events.flatMap(e=>{
  if(!hrAttendancePeriodOpen(e.date,now))return [{row:e.row,issue:'Tháng ghi nhận đã hết hạn; không tự mở khóa.'}];
  const current=active.get(e.id);
  if(!current||current.importId!==batch.id||JSON.stringify(current)!==e.snapshot)return [{row:e.row,issue:'Bản ghi đã sửa, hủy hoặc thay đổi sau lần nhập; cần đối chiếu riêng.'}];
  return [];
 });
}
