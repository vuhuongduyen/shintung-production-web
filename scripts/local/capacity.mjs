import {withTestRosterCapability,assertTestRosterMutation} from '../../lib/capacity-test-roster.mjs';
import {employeeActiveOn} from '../../lib/employee-employment.mjs';
import {assertCapacityAllocationPreserved} from '../../lib/capacity-allocation-queue.mjs';
import {assertPlanningReservations} from '../../lib/capacity-allocation-reservations.mjs';
import {hasQuickLineReadScope} from '../../lib/user-permission-profiles.mjs';
import {validateCapacityAssignments} from '../../lib/capacity-transfers.mjs';
import {productionActorId} from "../../lib/production-actor.mjs";
import {newDailyCapacity,hasCapacityCleaning,calculateCapacity,capacityDiff,capDays,isBlankCountedLeave,stripBlankDailyRows,capacityHasAcceptedVersion} from '../../lib/capacity.mjs';
import {monday} from '../../lib/production-plan.mjs';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
// A plan week closes for adjustments at 00:00 Sunday in Vietnam, immediately
// after the Saturday preceding its Monday start. Compare calendar dates in VN,
// never the server's UTC day or the viewer's browser timezone.
export function capacityAdjustmentOpen(week,at=Date.now()){
 const start=new Date(`${week}T00:00:00Z`);
 if(!Number.isFinite(start.getTime())||monday(week)!==week)return false;
 start.setUTCDate(start.getUTCDate()-2);
 const saturday=start.toISOString().slice(0,10);
 const local=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at));
 return local<=saturday;
}
export function capacityPermissions(actor){
 const grants=actor?.grants||[],admin=actor?.isAdmin||actor?.role==='local-owner';
 const has=actions=>Boolean(actor?.login&&(admin||grants.some(g=>{const parts=String(g).split('/').map(x=>x.trim().toLowerCase());return parts.includes('capacity tuần')&&actions.some(a=>parts.at(-1)===a.toLowerCase());})));
 const planReview=Boolean(actor?.login&&(admin||grants.some(g=>{const p=String(g).split('/').map(x=>x.trim().toLowerCase());return p.includes('production_plan')&&['xác nhận','chốt','confirm'].includes(p.at(-1));})));
 return {reopenPast:Boolean(admin&&actor?.login&&!actor?.line),view:has(['Xem'])||planReview,edit:has(['Thêm','Sửa','Lưu','Nhập','Tạo']),confirm:has(['Xác nhận']),revoke:has(['Hủy xác nhận'])||Boolean(actor?.login&&actor?.authMode!=='quick_line'&&['cnphuong','ntnphung'].includes(String(actor.permissionLogin||actor.userId||actor.login).toLowerCase())),factor:has(['Sửa hệ số','Sửa']),review:planReview};
}
async function records(db,entity){return (await db.prepare('SELECT record_key,payload FROM app_records WHERE entity=?').bind(entity).all()).results.map(r=>({key:r.record_key,payload:JSON.parse(r.payload)}));}
export async function latestCapacityWeek(db,actor){
 if(!capacityPermissions(actor).view)fail('Không có quyền xem Capacity / No permission',403);
 const all=await records(db,'capacity'),line=hasQuickLineReadScope(actor)?actor.line:null;
 const weeks=all.filter(r=>r.payload&&!r.payload._deleted&&(!line||(r.payload.schemaVersion===1?r.payload.rows?.some(row=>row.line===line):r.payload.line===line))).map(r=>r.payload.schemaVersion===1?r.key:monday(r.payload.week)).filter(w=>w&&monday(w)===w);
 return weeks.sort().at(-1)||null;
}
// One statement gives a consistent calendar/directory snapshot, without four
// separate remote reads before each save. Keep raw bytes for the existing CAS.
async function capacitySnapshot(db,includeQueue=false){
 const sql=includeQueue
  ? "SELECT entity,record_key,payload FROM app_records WHERE entity IN ('capacity','employees') OR (entity='production_allocation_queue' AND record_key='global')"
  : "SELECT entity,record_key,payload FROM app_records WHERE entity IN ('capacity','employees')";
 const rows=(await db.prepare(sql).all()).results;
 const list=entity=>rows.filter(r=>r.entity===entity).map(r=>({key:r.record_key,payload:JSON.parse(r.payload)}));
 return {rows,all:list('capacity'),directory:list('employees')};
}
// Resolve the newest week and its rows/directory from one database snapshot.
export async function readLatestCapacity(db,actor){
 if(!capacityPermissions(actor).view)fail('Không có quyền xem Capacity / No permission',403);
 const {all,directory}=await capacitySnapshot(db),line=hasQuickLineReadScope(actor)?actor.line:null;
 const weeks=all.filter(r=>r.payload&&!r.payload._deleted&&(!line||(r.payload.schemaVersion===1?r.payload.rows?.some(row=>row.line===line):r.payload.line===line))).map(r=>r.payload.schemaVersion===1?r.key:monday(r.payload.week)).filter(w=>w&&monday(w)===w);
 const week=weeks.sort().at(-1)||monday(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh'}).format(new Date()));
 return {week,snapshot:capacityFromRecords(all,directory,week,actor)};
}
export async function readCapacity(db,week,actor,testRosterPolicy=null){
 if(!capacityPermissions(actor).view)fail('Không có quyền xem Capacity / No permission',403);
 if(!week||monday(week)!==week)fail('Tuần kế hoạch không hợp lệ / Invalid week');
 const {all,directory}=await capacitySnapshot(db);
 return withTestRosterCapability(capacityFromRecords(all,directory,week,actor),testRosterPolicy);
}
export function capacityFromRecords(all,directory,week,actor){
 const current=all.find(r=>r.key===week&&r.payload.schemaVersion===1);
 const legacy=all.filter(r=>r!==current&&!r.payload._deleted&&monday(r.payload.week)===week);
 // The 95% setting is the default for new weeks. Persisted weeks retain the
 // exact percentage confirmed in their own version; never borrow another week.
 const factor=95;
 const employees=directory.filter(r=>!r.payload._deleted).map(r=>({id:r.key,name:r.payload.name||r.payload.employeeName||r.key,line:r.payload.line||'',startDate:r.payload.startDate,endDate:r.payload.endDate,employmentDatesManaged:r.payload.employmentDatesManaged,cancelled:r.payload.cancelled,active:employeeActiveOn(r.payload,week)}));
 const fresh=['A','B'].map(line=>{const row=newDailyCapacity(week,line,factor),ids=employees.filter(e=>e.active&&e.line===line).map(e=>e.id);row.input.workers=ids.length;row.input.otWorkers=ids.length;row.input.dailyRoster=row.input.dailySchedule.map(d=>({date:d.date,hc:d.working?employees.filter(e=>e.line===line&&employeeActiveOn(e,d.date)).map(e=>e.id):[],ot:[]}));return row;});
 const state=current?.payload||{schemaVersion:1,week,revision:0,rows:fresh},line=hasQuickLineReadScope(actor)?actor.line:null;
 // Runtime capabilities are server-owned, never trusted from persisted payloads.
 const projected={...state};delete projected.testRoster;
 return {...projected,rows:state.rows.filter(row=>!line||row.line===line),permissions:capacityPermissions(actor),employees:employees.filter(row=>!line||row.line===line),legacy:legacy.map(r=>r.payload).filter(row=>!line||row.line===line)};
}
export async function listCapacityRequests(db,actor){
 if(!capacityPermissions(actor).review)fail('Không có quyền xét duyệt Capacity',403);
 return (await records(db,'capacity')).filter(x=>x.payload?.schemaVersion===1).flatMap(x=>(x.payload.rows||[]).filter(row=>row.request?.status==='pending').map(row=>({week:x.key,line:row.line,revision:x.payload.revision,version:row.version,availableHours:row.availableHours,request:row.request,confirmedBy:row.confirmedBy,confirmedAt:row.confirmedAt}))).sort((a,b)=>a.request.at.localeCompare(b.request.at));
}
export async function mutateCapacity(db,body,actor,clock=()=>Date.now(),testRosterPolicy=null){
 const rights=capacityPermissions(actor),action=body.action;
 if(!actor?.login)fail('Vui lòng đăng nhập / Sign in',401);
 const required=action==='review'?'review':['confirm','sync'].includes(action)?'confirm':action==='revoke'?'revoke':'edit';
 if(!rights[required])fail('Không có quyền thực hiện thao tác Capacity / Permission denied',403);
 if(action==='employee'&&testRosterPolicy)fail('Không sửa danh mục nhân viên trong phép thử roster.',403);
 if(action==='employee'){
  const id=String(body.id||'').trim(),name=String(body.name||'').trim();if(!id||!name||id.length>80||name.length>200)fail('Nhập mã và tên nhân viên / Enter employee ID and name');
  const now=new Date(clock()).toISOString(),value={id,name,createdBy:actor.login,history:[{action:'add',at:now,by:actor.login,actorId:productionActorId(actor),before:null,after:{id,name}}]};
  const result=await db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) VALUES('employees',?,?,?,?) ON CONFLICT(entity,record_key) DO NOTHING").bind(id,JSON.stringify(value),actor.login,now).run();
  if(!result.meta.changes)fail('Mã nhân viên đã tồn tại / Employee exists',409);return {ok:true};
 }
 if(!['create','save','confirm','sync','revoke','requestChange','review'].includes(action))fail('Thao tác không hợp lệ');
 if(body.allocations!==undefined)fail('Lưu phân bổ riêng tại Điều phối nhân sự; không gộp với Lưu nháp lịch.',422);
 const week=body.week;if(!week||monday(week)!==week)fail('Chọn tuần bắt đầu thứ Hai');
 if(!rights.view)fail('Không có quyền xem Capacity / No permission',403);
 const snapshot=await capacitySnapshot(db,true);
 const allocationRaw=snapshot.rows.find(r=>r.entity==='production_allocation_queue'&&r.record_key==='global');
 const raw=snapshot.rows.find(r=>r.entity==='capacity'&&r.record_key===week);
 const state=capacityFromRecords(snapshot.all,snapshot.directory,week,actor);
 // Preserve the legacy/mismatched-envelope guard as well as the write CAS.
 if(raw){const stored=JSON.parse(raw.payload);if(stored.revision!==state.revision||JSON.stringify(stored.rows)!==JSON.stringify(state.rows))fail('Capacity vừa thay đổi trong khi tải. Không ghi đè; bản nhập vẫn được giữ.',409);}
 const {next,now}=prepareCapacityMutation(body,actor,{state,hasRaw:!!raw,queue:allocationRaw?JSON.parse(allocationRaw.payload):null,clock,testRosterPolicy});
 // One compare-and-swap statement commits both Lines, full snapshots and history together.
 const result=raw?await db.prepare("UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity='capacity' AND record_key=? AND payload=? AND COALESCE((SELECT payload FROM app_records WHERE entity='production_allocation_queue' AND record_key='global'),'')=?").bind(JSON.stringify(next),actor.login,now,week,raw.payload,allocationRaw?.payload||'').run():await db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'capacity',?,?,?,? WHERE COALESCE((SELECT payload FROM app_records WHERE entity='production_allocation_queue' AND record_key='global'),'')=? ON CONFLICT(entity,record_key) DO NOTHING").bind(week,JSON.stringify(next),actor.login,now,allocationRaw?.payload||'').run();
 if(result.meta.changes!==1)fail('Có người vừa cập nhật Capacity. Không ghi đè; tải lại và đối chiếu.',409);
 return withTestRosterCapability({...next,permissions:rights,employees:state.employees,legacy:[]},testRosterPolicy);
}

// Shared validation prepares a calendar draft without writing. Allocation is
// saved independently through its own guarded queue transaction.
export function prepareCapacityMutation(body,actor,{state,hasRaw,queue,clock=()=>Date.now(),testRosterPolicy=null}){
 const rights=capacityPermissions(actor),action=body.action;
 if(!actor?.login)fail('Vui lòng đăng nhập / Sign in',401);
 const required=action==='review'?'review':['confirm','sync'].includes(action)?'confirm':action==='revoke'?'revoke':'edit';
 if(!rights[required])fail('Không có quyền thực hiện thao tác Capacity / Permission denied',403);
 const week=body.week;if(monday(week)!==week||!week)fail('Chọn tuần bắt đầu thứ Hai');
 if(testRosterPolicy&&!hasRaw)fail('Phép thử cần tuần nháp riêng đã chuẩn bị; không tạo tuần tự động.',409);
 if(state.legacy.length)fail('Tuần này có dữ liệu Capacity cũ. Cần đối chiếu trước khi tạo bản hiện hành; dữ liệu cũ được giữ nguyên.',409);
 if(body.revision!==state.revision)fail('Dữ liệu đã được người khác sửa. Tải lại để đối chiếu; bản nhập của bạn vẫn được giữ.',409);
 if(action==='create'&&hasRaw)fail('Tuần Capacity đã tồn tại',409);
 if(action!=='create'&&!hasRaw&&action!=='save')fail('Hãy lưu nháp tuần trước');
 const lines=action==='create'?['A','B']:body.lines;
 if(!Array.isArray(lines)||!lines.length||new Set(lines).size!==lines.length||lines.some(l=>!['A','B'].includes(l)))fail('Chọn Line A hoặc B');
 if(['requestChange','review'].includes(action)&&lines.length!==1)fail('Mỗi yêu cầu chỉ xử lý một Line');
 if(action==='revoke'&&!String(body.reason||'').trim())fail('Nhập lý do hủy xác nhận');
 if(action==='requestChange'&&!String(body.reason||'').trim())fail('Nhập lý do và nội dung dự kiến điều chỉnh');
 if(action==='requestChange'&&(!String(body.intendedChange||'').trim()||String(body.reason).length>2000||String(body.intendedChange).length>3000))fail('Nhập nội dung dự kiến sửa (tối đa 3000 ký tự) và lý do (tối đa 2000 ký tự)');
 if(action==='review'&&(!['approve','reject'].includes(body.decision)||body.decision==='reject'&&!String(body.reason||'').trim()))fail('Chọn đồng ý hoặc nhập lý do từ chối');
 const nowMs=clock();
 if(action==='requestChange'&&!capacityAdjustmentOpen(week,nowMs))fail(`Tuần ${week}: đã qua thứ Bảy trước tuần kế hoạch; không thể yêu cầu hoặc thực hiện điều chỉnh Capacity.`,409);
 const next={schemaVersion:1,week,revision:state.revision+1,rows:structuredClone(state.rows)},now=new Date(nowMs).toISOString();
 const employees=new Set(state.employees.map(e=>e.id));
 for(const line of lines){
  const row=next.rows.find(r=>r.line===line),before=structuredClone(row.input);
  if(['save','confirm'].includes(action)){
   if(['adjusting','adjust-approved'].includes(row.reviewStatus)&&!capacityAdjustmentOpen(week,nowMs)&&!(rights.reopenPast&&row.historicalReopen))fail(`Line ${line}: đã qua hạn điều chỉnh Capacity của tuần này.`,409);
   // Versions approved before automatic unlocking may still be stored as
   // adjust-approved. The first save opens those versions without a revoke.
   if(row.reviewStatus==='adjust-approved'){
    if(!row.editPermission||row.editPermission.version!==row.version||row.editPermission.used)fail(`Line ${line}: chưa được KHSX cho phép sửa`,409);
    row.status='Nháp';row.reviewStatus='adjusting';row.unlockedBy=row.editPermission.approvedBy;row.unlockedAt=row.editPermission.approvedAt;row.editPermission.used=true;
   }
   if(row.status==='Đã xác nhận')fail(`Line ${line}: hủy xác nhận trước khi sửa`,409);
   if(action==='confirm'&&!rights.edit&&body.inputs?.[line]&&JSON.stringify(body.inputs[line])!==JSON.stringify(row.input))fail('Không có quyền sửa dữ liệu khi xác nhận',403);
   const input=stripBlankDailyRows(structuredClone(body.inputs?.[line]||row.input));
   if(input.leaveMode==='counted')for(const kind of ['hc','ot'])if(input[kind+'LeaveMode']==='rows'&&Array.isArray(input[kind+'LeaveRows']))input[kind+'LeaveRows']=input[kind+'LeaveRows'].filter(leave=>!isBlankCountedLeave(leave));
   if(input.factor!==row.input.factor&&!rights.factor)fail('Không có quyền sửa hệ số',403);
   if(input.dailyRoster){
    if(!Array.isArray(input.dailyRoster)||input.dailyRoster.length!==7)fail(`Line ${line}: lịch nhân viên phải đủ 7 ngày`);
    for(let i=0;i<7;i++){
     const r=input.dailyRoster[i],day=capDays(week)[i];
     if(r?.date!==day||!Array.isArray(r.hc)||!Array.isArray(r.ot))fail(`${day}: lịch nhân viên không hợp lệ`);
     for(const shift of ['hc','ot']){
      if(new Set(r[shift]).size!==r[shift].length||r[shift].some(id=>!employees.has(id)))fail(`${day}: nhân viên ${shift.toUpperCase()} trùng hoặc chưa có trong danh mục`);
      if((shift==='hc'&&!input.dailySchedule[i].working||shift==='ot'&&!input.dailySchedule[i].ot)&&r[shift].length)fail(`${day}: nhân viên được phân công vào ngày không có lịch ${shift.toUpperCase()}`);
     }
    }
   }
   if(!['aggregate','counted'].includes(input.leaveMode))for(const leave of [...(input.hcLeaves||[]),...(input.otLeaves||[])])for(const id of leave.employees||[])if(!employees.has(id))fail(`${id}: nhân viên chưa có trong danh mục`);
   if(!['aggregate','counted'].includes(input.leaveMode))for(let i=0;i<7;i++)if(row.input.otEnabled&&row.input.otDays[i].enabled&&(!input.otEnabled||!input.otDays[i].enabled)){
    const date=capDays(week)[i];if(input.hcLeaves.some(l=>l.otFull&&l.from<=date&&l.to>=date)||input.otLeaves.some(l=>l.date===date))fail(`${date}: cần xử lý đăng ký nghỉ tăng ca trước khi bỏ lịch`);
   }
   if(input.leaveMode==='counted')for(let i=0;i<7;i++)if(row.input.otEnabled&&row.input.otDays[i].enabled&&(!input.otEnabled||!input.otDays[i].enabled)){
    const date=capDays(week)[i];
    if((input.otLeaveMode==='rows'&&(input.otLeaveRows||[]).some(l=>Number(l.people)>0&&l.from<=date&&(l.to||l.from)>=date))||(input.otLeaveMode==='legacy'&&(input.otLeaves||[]).some(l=>l.date===date))||(input.hcLeaveMode==='legacy'&&(input.hcLeaves||[]).some(l=>l.otFull&&l.from<=date&&l.to>=date)))fail(`${date}: cần sửa/xóa dòng nghỉ tăng ca liên quan trước khi bỏ lịch`);
   }
   row.result=calculateCapacity(input,week);row.input=input;row.availableHours=row.result.availableHours;
   if(capacityDiff(before,input).length){row.draftEditedBy=actor.login;row.draftEditedAt=now;}
  }
  let changes=capacityDiff(before,row.input);
  if(action==='confirm'){
   if(!hasCapacityCleaning(row.input,week)&&!(Array.isArray(body.noCleaningAcknowledgedLines)&&body.noCleaningAcknowledgedLines.includes(line)))fail(`Line ${line}: chưa ghi nhận lịch vệ sinh tuần. Hãy bổ sung hoặc đồng ý xác nhận không có lịch vệ sinh.`,422);
   changes=capacityDiff(row.lastConfirmed?.input,row.input);
   if(row.lastConfirmed&&changes.length)row.editCount++;
   row.version++;row.updateNumber=row.version;row.status='Đã xác nhận';row.confirmedBy=actor.login;row.confirmedAt=now;
   row.reviewStatus='await-sync';row.request=null;row.editPermission=null;
   if(row.lastConfirmed&&changes.length)row.lastEditedAt=row.draftEditedAt||now;
   row.lastConfirmed={input:structuredClone(row.input),availableHours:row.availableHours,version:row.version,confirmedAt:now,confirmedBy:actor.login};
  }
  if(action==='sync'){
   if(row.status!=='Đã xác nhận'||row.reviewStatus!=='await-sync'||row.request?.status==='pending')fail(`Line ${line}: chỉ đồng bộ Capacity đã xác nhận, chưa gửi KHSX`,409);
   row.reviewStatus='pending';row.request={kind:'capacity',status:'pending',at:now,by:actor.login,version:row.version};row.syncedBy=actor.login;row.syncedAt=now;
  }
  if(action==='revoke'){
   if(row.status!=='Đã xác nhận'||row.reviewStatus!=='await-sync'||row.request?.status==='pending')fail(`Line ${line}: chỉ hủy xác nhận phiên bản chưa đồng bộ KHSX; bản đã đồng bộ phải theo quy trình điều chỉnh, kể cả Admin.`,409);
   row.status='Nháp';row.revokedBy=actor.login;row.revokedAt=now;row.revokeReason=String(body.reason).trim();
   row.reviewStatus=capacityHasAcceptedVersion(row)?'adjusting':null;row.request=null;row.editPermission=null;
  }
  if(action==='requestChange'){
   if(row.status!=='Đã xác nhận'||row.reviewStatus!=='approved'||row.request?.status==='pending')fail(`Line ${line}: Capacity chưa ở trạng thái được KHSX đồng ý`,409);
   row.request={kind:'adjust',previousReviewStatus:row.reviewStatus,status:'pending',at:now,by:actor.login,version:row.version,reason:String(body.reason).trim(),intendedChange:String(body.intendedChange).trim(),previousHours:row.availableHours};
   row.reviewStatus='adjust-pending';
  }
  if(action==='review'){
   if(row.status!=='Đã xác nhận'||row.request?.status!=='pending'||row.request.version!==row.version||body.requestAt!==row.request.at)fail(`Line ${line}: yêu cầu đã được xử lý hoặc phiên bản đã thay đổi`,409);
   const kind=row.request.kind;
   if(kind==='adjust'&&body.decision==='approve'&&!capacityAdjustmentOpen(week,nowMs))fail(`Line ${line}: đã qua hạn điều chỉnh; KHSX không thể mở khóa sửa.`,409);
   row.request={...row.request,status:body.decision==='approve'?'approved':'rejected',reviewedAt:now,reviewedBy:actor.login,reviewReason:String(body.reason||'').trim()};
   row.reviewStatus=body.decision==='approve'?(kind==='adjust'?'adjusting':'approved'):(kind==='adjust'?(row.request.previousReviewStatus||'approved'):'rejected');
   if(kind==='capacity'&&body.decision==='approve'){row.khsxAcceptedBy=actor.login;row.khsxAcceptedAt=now;}
   if(kind==='adjust'&&body.decision==='approve'){
    row.status='Nháp';row.unlockedBy=actor.login;row.unlockedAt=now;row.editPermission=null;
   }
  }
  row.updatedBy=actor.login;row.updatedAt=now;
  row.history.push({action,noCleaningAcknowledged:action==='confirm'&&!hasCapacityCleaning(row.input,week),at:now,actor:actor.login,actorId:productionActorId(actor),reason:body.reason||(action==='confirm'&&!hasCapacityCleaning(row.input,week)?'Đồng ý xác nhận không có lịch vệ sinh tuần.':''),decision:body.decision||null,request:row.request?structuredClone(row.request):null,week,line,version:row.version,editCount:row.editCount,changes,before,after:structuredClone(row.input),result:row.result||null,previousHours:action==='confirm'?state.rows.find(r=>r.line===line).lastConfirmed?.availableHours??null:state.rows.find(r=>r.line===line).availableHours??null,newHours:row.availableHours??null,revokedBy:row.revokedBy,revokedAt:row.revokedAt,unlockedBy:row.unlockedBy,unlockedAt:row.unlockedAt,editedBy:row.draftEditedBy,editedAt:row.draftEditedAt});
 }
 assertCapacityAllocationPreserved(state.rows,next.rows);
 assertPlanningReservations(queue,next.rows);
 validateCapacityAssignments(next.rows);
 assertTestRosterMutation(body,state,next,testRosterPolicy);
 return {next,now};
}
