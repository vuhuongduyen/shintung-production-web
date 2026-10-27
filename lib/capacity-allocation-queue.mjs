// Planning-only adapter. Queue acceptance changes the saved Capacity draft;
// normal confirmation and KHSX approval still publish the accepted baseline.
import {calculateCapacity,capacityDiff,capDays,newDailyCapacity} from './capacity.mjs';
import {clockMinute,rosterRanges,subtractRanges,transferCapacityStaff,removeCapacityTransfer,validateCapacityAssignments} from './capacity-transfers.mjs';
import {allocationInstant} from './production-allocation-queue.mjs';
import {monday} from './production-plan.mjs';

const fail=(message,status=409)=>{throw Object.assign(new Error(message),{status});};
const vnDate=at=>new Date(at+7*3600000).toISOString().slice(0,10);
const minuteText=value=>`${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;
const queueTransfers=row=>(row.input?.staffTransfers||[]).filter(t=>t.queuePlanning===true);
const overlaps=(ranges,a,b)=>ranges.some(([s,e])=>s<b&&a<e);
const keyOf=record=>record.key||record.record_key||record.payload?.week;

function adjustmentOpen(week,now){
 const cutoff=new Date(`${week}T00:00:00Z`);cutoff.setUTCDate(cutoff.getUTCDate()-2);
 return vnDate(now)<=cutoff.toISOString().slice(0,10);
}
function editable(row,week,now,{reopenPast=false}={}){
 if(!row?.input?.dailySchedule||!row.input.dailyRoster)fail(`Line ${row?.line||''}: cần lưu lịch làm việc có danh sách nhân viên trước khi nhận phân bổ.`);
 if(['adjusting','adjust-approved'].includes(row.reviewStatus)&&!adjustmentOpen(week,now)&&!(reopenPast&&row.historicalReopen))fail(`Line ${row.line}: đã qua hạn điều chỉnh Capacity của tuần này.`);
 // Compatibility with versions approved before automatic adjustment unlock.
 if(row.reviewStatus==='adjust-approved'){
  if(!row.editPermission||row.editPermission.version!==row.version||row.editPermission.used)fail(`Line ${row.line}: chưa được KHSX cho phép sửa.`);
  row.status='Nháp';row.reviewStatus='adjusting';row.unlockedBy=row.editPermission.approvedBy;row.unlockedAt=row.editPermission.approvedAt;row.editPermission.used=true;
 }
 if(row.status!=='Nháp')fail(`Line ${row.line}: lịch làm việc đang khóa; cần mở quyền điều chỉnh trước khi nhận phân bổ.`);
}
function recordPayload(record){return record?.payload||record;}
function completeWeek(record,week){
 const state=recordPayload(record);
 if(!state||state._deleted||state.schemaVersion!==1||!Array.isArray(state.rows)||!Number.isInteger(state.revision)||state.revision<0)fail(`Tuần ${week}: hãy lưu nháp Capacity trước khi nhận phân bổ.`);
 return state;
}

// Existing records are accepted as {key,payload}; flattened snapshot records are
// also accepted. Only changed weeks are returned, never a generated C week/row.
export function applyCapacityAllocation(records,employees,offer,allocation,options={}){
 const now=options.now||new Date().toISOString(),at=allocationInstant(now),from=allocationInstant(allocation.effectiveAt),to=allocationInstant(allocation.endsAt);
 if(to<=from||to-from>366*86400000||from%60000||to%60000)fail('Chọn khoảng phân bổ hợp lệ, chính xác đến phút và không quá 366 ngày.',422);
 if(from<at)fail('Không được nhận phân bổ khoảng giờ đã qua.');
 if(from<allocationInstant(offer.effectiveAt)||to>allocationInstant(offer.endsAt))fail('Khoảng nhận phải nằm trong đề nghị phân bổ.',422);
 const source=offer.sourceLine,target=allocation.targetLine,employeeId=allocation.employeeId;
 if(!['A','B','C'].includes(source)||!['A','B','C'].includes(target)||source===target||(source==='C')===(target==='C'))fail('Phân bổ kế hoạch chỉ áp dụng giữa Line C và Line A/B.',422);
 if(!allocation.id||!offer.id||!offer.people?.some(p=>p.id===employeeId)||!employees.some(e=>e.id===employeeId&&e.active!==false&&e.line===source))fail('Nhân viên không còn thuộc Line nguồn đang hoạt động.');
 const actorId=String(options.actorId||allocation.actorId||'');if(!actorId)fail('Thiếu tài khoản ghi nhận phân bổ.',422);
 const saved=new Map(records.map(record=>[keyOf(record),record])),working=new Map(),segments=[];
 const startDate=vnDate(from),endDate=vnDate(to-1);
 for(let date=startDate;date<=endDate;){
  const week=monday(date),record=saved.get(week);
  if(!record)fail(`Tuần ${week}: hãy lưu nháp Capacity trước khi nhận phân bổ.`);
  if(!working.has(week))working.set(week,{before:completeWeek(record,week),state:structuredClone(completeWeek(record,week)),lines:new Set()});
  const item=working.get(week),line=target==='C'?source:target,row=item.state.rows.find(r=>r.line===line);
  if(!row?.input?.dailySchedule||!row.input.dailyRoster)fail(`Tuần ${week}, Line ${line}: cần lưu lịch làm việc có danh sách nhân viên.`);
  const day=row.input.dailySchedule.find(d=>d.date===date);
  if(!day)fail(`Ngày ${date}: lịch làm việc không đầy đủ.`);
  const midnight=Date.parse(`${date}T00:00:00+07:00`),a=Math.max(0,(from-midnight)/60000),b=Math.min(1440,(to-midnight)/60000);
  for(const shift of ['hc','ot']){
   if(!day.working||shift==='ot'&&!day.ot)continue;
   const start=Math.max(a,clockMinute(day[shift==='hc'?'hcStart':'otStart'])),end=Math.min(b,clockMinute(day[shift==='hc'?'hcEnd':'otEnd']));
   if(end<=start)continue;
   if(!item.lines.has(line)){editable(row,week,at,options);item.lines.add(line);}
   const sourceRow=item.state.rows.find(r=>r.line===source);
   if(sourceRow&&!item.lines.has(source)){editable(sourceRow,week,at,options);item.lines.add(source);}
   const id=`capacity-${allocation.id}-${date}-${shift}`;
   if(item.state.rows.some(r=>(r.input.staffTransfers||[]).some(t=>t.id===id)))fail('Phân bổ này đã có trong lịch làm việc. Tải lại trước khi tiếp tục.');
   const request={id,ids:[employeeId],from:source,to:target,date,toDate:date,shift,start:minuteText(start),end:minuteText(end)};
   if(target==='C'){
    // C has no Capacity summary row. A temporary empty receiving roster lets
    // the shared transfer primitive check/subtract the source consistently.
    if(item.state.rows.some(r=>r.line==='C'))fail('Tuần này đã có dòng Capacity Line C riêng; cần đối chiếu trước khi nhận phân bổ.');
    const virtual=newDailyCapacity(week,'C',row.input.factor);
    virtual.input.dailySchedule=structuredClone(row.input.dailySchedule);
    virtual.input.dailyRoster=capDays(week).map(date=>({date,hc:[],ot:[]}));
    item.state.rows=transferCapacityStaff([...item.state.rows,virtual],employees,request).rows.filter(r=>r.line!=='C');
   }else item.state.rows=transferCapacityStaff(item.state.rows,employees,request).rows;
   for(const changed of item.state.rows){
    const transfer=changed.input.staffTransfers?.find(t=>t.id===id);
    if(transfer)Object.assign(transfer,{queuePlanning:true,allocationId:allocation.id,offerId:offer.id,actorId,recordedAt:now});
   }
   segments.push({week,date,shift,start:request.start,end:request.end,from:source,to:target,employeeId,transferId:id});
  }
  const nextDate=new Date(`${date}T00:00:00Z`);nextDate.setUTCDate(nextDate.getUTCDate()+1);date=nextDate.toISOString().slice(0,10);
 }
 if(!segments.length)fail('Khoảng nhận không có giờ HC/TC theo lịch làm việc đã lưu.');
 const changed=[];
 for(const [week,item] of working){
  if(!item.lines.size)continue;
  // A prior queue allocation cannot be reallocated through another offer.
  assertCapacityAllocationPreserved(item.before.rows,item.state.rows,{allowNew:true});
  validateCapacityAssignments(item.state.rows);
  for(const line of item.lines){
   const row=item.state.rows.find(r=>r.line===line),previous=item.before.rows.find(r=>r.line===line),before=structuredClone(previous.input);
   row.result=calculateCapacity(row.input,week);row.availableHours=row.result.availableHours;
   row.updatedBy=actorId;row.updatedAt=now;row.draftEditedBy=actorId;row.draftEditedAt=now;
   row.history=[...(row.history||[]),{action:'staffAllocation',at:now,actor:actorId,actorId,week,line,version:row.version,editCount:row.editCount,allocationId:allocation.id,offerId:offer.id,changes:capacityDiff(before,row.input),before,after:structuredClone(row.input),result:structuredClone(row.result),previousHours:previous.availableHours??null,newHours:row.availableHours,editedBy:actorId,editedAt:now}];
  }
  item.state.revision++;changed.push({key:week,payload:item.state});
 }
 return {records:changed,weeks:changed.map(r=>r.key),lines:[...new Set(segments.flatMap(s=>[s.from,s.to]).filter(line=>line!=='C'))],planningSegments:segments};
}

// Call from every legacy Capacity save/confirm before its whole-week CAS. The
// previous persisted snapshot is authoritative; UI inputs cannot invent, erase,
// move or widen a queue transfer. Unrelated roster/schedule edits remain valid.
export function assertCapacityAllocationPreserved(previousRows,nextRows,{allowNew=false}={}){
 const previous=new Map(previousRows.map(row=>[row.line,queueTransfers(row)]));
 for(const row of previousRows){
  const next=nextRows.find(r=>r.line===row.line);
  for(const transfer of queueTransfers(row)){
   const copies=(next?.input?.staffTransfers||[]).filter(t=>t.id===transfer.id);
   if(copies.length!==1||JSON.stringify(copies[0])!==JSON.stringify(transfer))fail('Phân bổ đã nhận phải được giữ nguyên; không thể xóa hoặc sửa trực tiếp trong Lịch làm việc.');
   if(!allowNew)for(const date of transfer.dates||[])for(const employeeId of transfer.employees||[]){
    const beforeDay=row.input.dailySchedule?.find(d=>d.date===date),afterDay=next.input.dailySchedule?.find(d=>d.date===date),beforeRoster=row.input.dailyRoster?.find(r=>r.date===date),afterRoster=next.input.dailyRoster?.find(r=>r.date===date);
    if(JSON.stringify(rosterRanges(beforeRoster,beforeDay,transfer.shift,employeeId))!==JSON.stringify(rosterRanges(afterRoster,afterDay,transfer.shift,employeeId)))fail('Khoảng giờ của nhân viên đã nhận phân bổ phải được thay đổi qua quy trình phối hợp.');
   }
  }
 }
 for(const row of nextRows)for(const transfer of queueTransfers(row)){
  if(!allowNew&&!previous.get(row.line)?.some(t=>t.id===transfer.id))fail('Không thể thêm phân bổ Chờ phân bổ qua thao tác lưu Capacity.');
  const a=clockMinute(transfer.start),b=clockMinute(transfer.end);
  for(const date of transfer.dates||[])for(const employeeId of transfer.employees||[]){
   if(transfer.to!=='C'){
    const target=nextRows.find(r=>r.line===transfer.to),day=target?.input?.dailySchedule?.find(d=>d.date===date),roster=target?.input?.dailyRoster?.find(r=>r.date===date);
    const active=day?.working&&(transfer.shift==='hc'||day.ot);
    if(!active||subtractRanges([[a,b]],rosterRanges(roster,day,transfer.shift,employeeId)).length)fail('Lịch làm việc phải giữ đủ khoảng giờ của phân bổ đã nhận.');
   }
   for(const other of nextRows){
    const day=other.input?.dailySchedule?.find(d=>d.date===date),roster=other.input?.dailyRoster?.find(r=>r.date===date);
    for(const shift of ['hc','ot'])if((other.line!==transfer.to||shift!==transfer.shift)&&overlaps(rosterRanges(roster,day,shift,employeeId),a,b))fail('Nhân viên đã được phân bổ; không thể gán lại cùng khoảng giờ tại Line khác.');
   }
  }
 }
}

// Explicit receiver cancellation reverses only this allocation's draft segments.
// Never restore an entire old row: unrelated edits and audit history survive.
export function applyCapacityAllocationCancellation(records,employees,offer,allocation,options={}){
 const now=options.now||new Date().toISOString(),at=allocationInstant(now),actorId=String(options.actorId||''),reason=String(options.reason||'').trim();
 if(!actorId||!reason||reason.length>500)fail('Cần tài khoản và lý do hủy hợp lệ.',422);
 if(allocation.planning!==true||!allocation.id||!Array.isArray(allocation.planningSegments)||!allocation.planningSegments.length)fail('Chỉ hủy được phân bổ kế hoạch có đầy đủ lịch sử điều phối.');
 if(allocationInstant(allocation.effectiveAt)<=at)fail('Không thể hủy phân bổ đã bắt đầu hoặc đã qua.');
 const expectedTransfers=new Set(allocation.planningSegments.map(s=>s.transferId));
 for(const record of records)for(const row of recordPayload(record)?.rows||[])for(const transfer of row.input?.staffTransfers||[])if(transfer.allocationId===allocation.id&&(!expectedTransfers.has(transfer.id)||!allocation.planningSegments.some(s=>s.transferId===transfer.id&&s.week===keyOf(record))))fail('Lịch sử điều phối có phần không khớp; cần đối chiếu trước khi hủy.');
 const saved=new Map(records.map(record=>[keyOf(record),record])),working=new Map(),removed=new Set();
 for(const segment of allocation.planningSegments){
  const {week,date,shift,start,end,from,to,employeeId,transferId}=segment;
  if(from!==offer.sourceLine||to!==allocation.targetLine||employeeId!==allocation.employeeId||!['hc','ot'].includes(shift)||removed.has(transferId))fail('Lịch sử phân bổ không khớp; cần đối chiếu trước khi hủy.');
  const a=Date.parse(`${date}T${start}:00+07:00`),b=Date.parse(`${date}T${end}:00+07:00`);
  if(!Number.isFinite(a)||!Number.isFinite(b)||a<allocationInstant(allocation.effectiveAt)||b>allocationInstant(allocation.endsAt)||b<=a)fail('Khoảng lịch sử phân bổ không hợp lệ.');
  if(!working.has(week)){const before=completeWeek(saved.get(week),week);working.set(week,{before,state:structuredClone(before),lines:new Set()});}
  const item=working.get(week),line=to==='C'?from:to,row=item.state.rows.find(r=>r.line===line);
  const expectedLines=[from,to].filter(l=>l!=='C');
  for(const affected of expectedLines){const current=item.state.rows.find(r=>r.line===affected);editable(current,week,at,options);item.lines.add(affected);}
  const copies=item.state.rows.flatMap(r=>(r.input.staffTransfers||[]).filter(t=>t.id===transferId));
  if(copies.length!==expectedLines.length||copies.some(t=>!t.queuePlanning||t.allocationId!==allocation.id||t.offerId!==offer.id||t.from!==from||t.to!==to||t.shift!==shift||t.start!==start||t.end!==end||JSON.stringify(t.employees)!==JSON.stringify([employeeId])||JSON.stringify(t.dates)!==JSON.stringify([date])))fail('Điều phối đã thay đổi; không thể hủy âm thầm.');
  const unrelated=new Map(item.state.rows.filter(r=>!expectedLines.includes(r.line)).map(r=>[r.line,r]));
  if(to==='C'){
   if(item.state.rows.some(r=>r.line==='C'))fail('Cần đối chiếu dòng Capacity C trước khi hủy.');
   const virtual=newDailyCapacity(week,'C',row.input.factor);virtual.input.dailySchedule=structuredClone(row.input.dailySchedule);
   virtual.input.dailyRoster=capDays(week).map(d=>({date:d,hc:[],ot:[]}));
   const roster=virtual.input.dailyRoster.find(r=>r.date===date);roster[shift]=[employeeId];roster[shift+'Windows']={[employeeId]:[[clockMinute(start),clockMinute(end)]]};
   item.state.rows=removeCapacityTransfer([...item.state.rows,virtual],transferId).rows.filter(r=>r.line!=='C');
  }else item.state.rows=removeCapacityTransfer(item.state.rows,transferId).rows;
  item.state.rows=item.state.rows.map(row=>unrelated.get(row.line)||row);
  removed.add(transferId);
 }
 const changed=[];
 for(const [week,item] of working){
  const protectedBefore=structuredClone(item.before.rows);for(const row of protectedBefore)row.input.staffTransfers=(row.input.staffTransfers||[]).filter(t=>!removed.has(t.id));
  assertCapacityAllocationPreserved(protectedBefore,item.state.rows,{allowNew:true});validateCapacityAssignments(item.state.rows);
  for(const line of item.lines){const row=item.state.rows.find(r=>r.line===line),previous=item.before.rows.find(r=>r.line===line),before=structuredClone(previous.input);
   row.result=calculateCapacity(row.input,week);row.availableHours=row.result.availableHours;row.updatedBy=actorId;row.updatedAt=now;row.draftEditedBy=actorId;row.draftEditedAt=now;
   row.history=[...(row.history||[]),{action:'staffAllocationCancel',at:now,actor:actorId,actorId,reason,week,line,allocationId:allocation.id,offerId:offer.id,changes:capacityDiff(before,row.input),before,after:structuredClone(row.input),result:structuredClone(row.result),previousHours:previous.availableHours??null,newHours:row.availableHours}];
  }
  item.state.revision++;changed.push({key:week,payload:item.state});
 }
 return {records:changed,weeks:changed.map(r=>r.key),planningSegments:structuredClone(allocation.planningSegments)};
}
