import {employeeActiveOn} from './employee-employment.mjs';
import {capDays} from './capacity.mjs';

const reject=message=>{throw Object.assign(new Error(message),{status:409});};
// This is an opt-in seam, not an environment detector or permission grant.
// Only the isolated QA deployment may supply this policy after its own guard.
// Never derive it from a request body, URL, employee prefix or browser storage.
export function testRosterCapability(state,policy){
 if(policy==null)return null;
 const {week,line,employeeIds}=policy;
 if(week!==state.week||!['A','B'].includes(line)||!Array.isArray(employeeIds)||!employeeIds.length||employeeIds.length>50||new Set(employeeIds).size!==employeeIds.length)reject('Phạm vi roster thử không hợp lệ.');
 for(const id of employeeIds){
  const employee=state.employees.find(e=>e.id===id);
  if(typeof id!=='string'||!/^QAOT[A-Z0-9_-]+$/.test(id)||!employee||!String(employee.name).startsWith('SYNTHETIC QA OT')||employee.line!==line||!capDays(week).some(date=>employeeActiveOn(employee,date)))reject('Roster thử chỉ nhận hồ sơ giả đã được duyệt, đúng Line và ngày hiệu lực.');
 }
 return {week,line,employeeIds:[...employeeIds]};
}
export function withTestRosterCapability(state,policy){
 const capability=testRosterCapability(state,policy);
 return capability?{...state,testRoster:capability}:state;
}
const hasEntries=input=>['dailyHcLeave','dailyOtLeave','otherTime','staffTransfers','hcLeaves','otLeaves','hcLeaveRows','otLeaveRows'].some(key=>input[key]?.length)||input.dailySchedule?.some(day=>day.cleaning?.length);
export function selectTestRoster(row,employees,capability,ids){
 if(!capability||row.line!==capability.line||row.week!==capability.week||row.status!=='Nháp'||Number(row.version)!==0||row.lastConfirmed||row.accepted||row.request||row.reviewStatus)reject('Chỉ chọn roster thử cho lịch nháp mới, chưa xác nhận.');
 if(hasEntries(row.input))reject('Lịch đã có đăng ký nghỉ, vệ sinh hoặc điều phối. Không tự thay roster của lịch này.');
 if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length||ids.some(id=>!capability.employeeIds.includes(id)))reject('Chọn ít nhất một nhân viên giả trong danh sách được phép.');
 testRosterCapability({week:row.week,employees},capability);
 const p=row.input,dates=capDays(row.week);
 if(!Array.isArray(p.dailySchedule)||p.dailySchedule.length!==7||p.dailySchedule.some((d,i)=>d.date!==dates[i]))reject('Lịch thử phải có đủ bảy ngày đúng tuần.');
 return {...p,workers:ids.length,otWorkers:ids.length,dailyRoster:p.dailySchedule.map(day=>{
  const eligible=ids.filter(id=>employeeActiveOn(employees.find(e=>e.id===id),day.date));
  // Replace dormant savedHc too, so switching HC off/on cannot restore real staff.
  return {date:day.date,hc:day.working?[...eligible]:[],ot:day.working&&day.ot?[...eligible]:[],...(!day.working?{savedHc:[...eligible]}:{})};
 })};
}
// Called after normal permissions, business validation and before the DB write.
export function assertTestRosterMutation(body,state,next,policy){
 const scope=testRosterCapability(state,policy);if(!scope)return;
 if(body.action==='create'||!Array.isArray(body.lines)||body.lines.length!==1||body.lines[0]!==scope.line)reject('Chỉ thao tác Line của lịch thử được duyệt; không tạo tuần tự động.');
 const before=state.rows.find(row=>row.line===scope.line),after=next.rows.find(row=>row.line===scope.line);
 for(const row of next.rows)if(row.line!==scope.line&&JSON.stringify(row)!==JSON.stringify(state.rows.find(old=>old.line===row.line)))reject('Không được thay đổi Line ngoài phạm vi thử.');
 if(!after?.input.dailyRoster||after.input.dailyRoster.length!==7)reject('Lịch thử cần roster theo tên.');
 const allowed=new Set(scope.employeeIds),people=new Map(state.employees.map(e=>[e.id,e]));
 for(const r of after.input.dailyRoster)for(const key of ['hc','ot','savedHc']){
  if(r[key]!==undefined&&(!Array.isArray(r[key])||r[key].some(id=>!allowed.has(id)||!employeeActiveOn(people.get(id),r.date))))reject('Lịch thử chứa nhân viên ngoài phạm vi hoặc ngoài ngày hiệu lực.');
 }
 // Refuse unrelated personnel changes, including hidden arrays and transfers.
 for(const key of ['dailyHcLeave','dailyOtLeave','otherTime','hcLeaves','otLeaves','hcLeaveRows','otLeaveRows'])for(const entry of after.input[key]||[])if(!Array.isArray(entry.employees)||!entry.employees.length||entry.employees.some(id=>!allowed.has(id)))reject('Đăng ký thử phải chỉ rõ nhân viên giả được phép.');
 if(after.input.staffTransfers?.length||after.input.dailySchedule.some(d=>d.cleaning?.length))reject('Điều phối/vệ sinh nằm ngoài phép thử roster này.');
 // Do not let a direct API request erase dependencies while replacing staff.
 if(JSON.stringify(after.input.dailyRoster)!==JSON.stringify(before.input.dailyRoster)&&hasEntries(before.input))reject('Lịch đã có đăng ký; không thay roster đồng thời xóa dữ liệu liên quan.');
 // Replacing an existing staff list is only safe before the first confirmation.
 if(['save','confirm'].includes(body.action)&&Number(before.version)>0&&JSON.stringify(after.input.dailyRoster)!==JSON.stringify(before.input.dailyRoster))reject('Không thay roster lịch đã từng xác nhận.');
}
