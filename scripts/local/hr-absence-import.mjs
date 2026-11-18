import {readEmployeeAttendance} from './hr-attendance-records.mjs';
import {dailyPolicyGuards} from './production-daily-output.mjs';
import {previewAbsences,cancellationIssues,matchAbsenceEmployee,HR_IMPORT_LIMIT} from '../../lib/hr-absence-import.mjs';
import {readRecordPages} from './production-record-pages.mjs';
import {productionActorId} from '../../lib/production-actor.mjs';
import {productionEventDuration} from '../../lib/production-event-duration.mjs';
const fail=(s,status=422)=>{throw Object.assign(Error(s),{status});};
const entity='hr_absence_import';
const decode=r=>JSON.parse(r.payload);
const fingerprint=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))))).map(x=>x.toString(16).padStart(2,'0')).join('');
export async function handleHrAbsenceImport(db,body,actor,{commit,calendar,policy}){
 if(actor?.line||!(actor?.isAdmin||actor?.grants?.includes('Quản lý sản xuất / Lịch SX thực tế / Ghi vắng mặt')))fail('Chỉ HR không giới hạn Line hoặc Admin được nhập/hủy file.',403);
 if(body.action==='hr-import-history'){
  const page=Math.max(0,Number.isSafeInteger(body.page)?body.page:0);
  const result=await db.prepare("SELECT json_object('id',record_key,'fileName',json_extract(payload,'$.fileName'),'createdAt',json_extract(payload,'$.createdAt'),'actor',json_extract(payload,'$.actor'),'status',json_extract(payload,'$.status'),'count',json_array_length(payload,'$.events'),'cancelledAt',json_extract(payload,'$.cancelledAt'),'cancelledBy',json_extract(payload,'$.cancelledBy'),'cancelReason',json_extract(payload,'$.cancelReason')) AS payload FROM app_records WHERE entity=? ORDER BY updated_at DESC,record_key LIMIT 21 OFFSET ?").bind(entity,page*20).all();
  return {rows:(result.results||[]).slice(0,20).map(decode),hasMore:(result.results||[]).length>20,page};
 }
 if(!policy?.policy?.active)fail('Chức năng nhập Excel chỉ áp dụng sau khi chuyển sang báo sản lượng; giữ nguyên lịch sử cũ.',409);
 const id=String(body.importId||'');if(!/^[a-zA-Z0-9-]{16,80}$/.test(id))fail('Mã lần nhập không hợp lệ.');
 const oldRow=await db.prepare('SELECT payload FROM app_records WHERE entity=? AND record_key=?').bind(entity,id).first();
 const old=oldRow?decode(oldRow):null;
 const cancel=body.action.startsWith('hr-import-cancel');
 if(cancel&&!old)fail('Không tìm thấy lần nhập.',404);
 if(cancel&&old.status==='cancelled')return {cancelled:true,replayed:true,count:old.events.length};
 const source=cancel?null:{fileName:String(body.fileName||'').slice(0,180),fileHash:String(body.fileHash||''),month:body.month,rows:body.rows};
 if(!cancel&&(!source.fileName||!/^\w[\w.-]*$/.test(id)||!/^[a-f0-9]{64}$/.test(source.fileHash)))fail('Thiếu thông tin file.');
 const hash=cancel?null:await fingerprint(source);
 if(old&&!cancel){if(old.sourceHash!==hash)fail('Lần nhập đã dùng cho nội dung khác.',409);return {saved:true,replayed:true,cancelled:old.status==='cancelled',count:old.events.length,results:old.results};}
 const cursorRow=await db.prepare("SELECT payload FROM app_records WHERE entity='production_cursor' AND record_key='global'").first();
 const expectedCursor=cursorRow?.payload||JSON.stringify({version:0,token:''});
 const directoryRaw=await readRecordPages(db,{where:"entity='employees'"});
 const directory=directoryRaw.map(r=>({...decode(r),id:r.record_key}));
 if(!cancel&&(!Array.isArray(body.rows)||!body.rows.length||body.rows.length>HR_IMPORT_LIMIT))fail(`Mỗi lần nhập từ 1 đến ${HR_IMPORT_LIMIT} dòng.`);
 const ids=cancel?[...new Set(old.events.map(e=>e.employeeId))]:[...new Set(body.rows.flatMap(r=>matchAbsenceEmployee(r.code,directory).map(e=>e.id)))];
 // One JSON binding avoids D1 parameter limits. Include all versions for these
 // people, not just current dates, so supersession and cancellation stay correct.
 const eventRows=await readEmployeeAttendance(db,ids);
 const events=eventRows.map(decode),now=new Date().toISOString();
 const guards=dailyPolicyGuards(policy);
 if(cancel){
  const issues=cancellationIssues(old,events);
  if(body.action==='hr-import-cancel-preview')return {batch:{id:old.id,fileName:old.fileName,createdAt:old.createdAt,actor:old.actor,count:old.events.length},issues,rows:old.results.filter(r=>r.status==='valid'),canCancel:!issues.length};
  if(issues.length)fail(issues.map(r=>`Dòng ${r.row}: ${r.issue}`).join('\n'),409);
  const reason=String(body.reason||'').trim();if(!reason||reason.length>1000)fail('Nhập lý do hủy (tối đa 1.000 ký tự).');
  const cancellations=old.events.map(e=>{const original=events.find(x=>x.id===e.id);return {id:crypto.randomUUID(),kind:'attendance-cancel',attendanceScope:'employee',line:original.line,employees:original.employees,count:1,supersedes:e.id,importId:id,approved:true,effectiveAt:original.effectiveAt,endsAt:original.endsAt,recordedAt:now,actor:actor.login,reason};});
  const updated={...old,status:'cancelled',cancelledAt:now,cancelledBy:actor.login,cancelReason:reason};
  await commit(db,actor,now,cancellations,null,null,expectedCursor,[{entity,key:id,payload:updated,expected:oldRow.payload}],guards);
  return {cancelled:true,count:cancellations.length,events:cancellations};
 }
 const results=previewAbsences(body.rows,directory,events,{month:body.month});
 if(body.action==='hr-import-preview'){
  const schedules=await calendar();
  return {results:results.map(r=>r.status!=='valid'?r:{...r,durationResult:productionEventDuration({kind:'line-absence',employees:[r.employeeId],line:directory.find(p=>p.id===r.employeeId)?.line,effectiveAt:r.effectiveAt,endsAt:r.endsAt},schedules,{events,employees:directory})}),sourceHash:hash};
 }
 if(body.automatic!==true&&body.previewHash!==hash)fail('Nội dung thay đổi; hãy kiểm tra lại trước khi nhập.',409);
 if(body.automatic!==true&&results.some(r=>r.status==='error'))return {saved:false,count:0,results};
 const valid=results.filter(r=>r.status==='valid');
 if(!valid.length)return {saved:false,count:0,results};
 const directoryGuard={sql:"NOT EXISTS(SELECT 1 FROM json_each(?) x WHERE NOT EXISTS(SELECT 1 FROM app_records a WHERE a.entity='employees' AND a.record_key=json_extract(x.value,'$.id') AND a.payload=json_extract(x.value,'$.payload')))",args:[JSON.stringify([...new Set(valid.map(r=>r.employeeId))].map(id=>({id,payload:directoryRaw.find(r=>r.record_key===id).payload})))]};
 guards.push(directoryGuard);
 const created=valid.map(r=>({id:crypto.randomUUID(),kind:'line-absence',attendanceScope:'employee',sourceId:null,line:directory.find(p=>p.id===r.employeeId)?.line||null,employees:[r.employeeId],employeeDetails:[{id:r.employeeId,name:r.name}],count:1,effectiveAt:r.effectiveAt,endsAt:r.endsAt,absenceType:r.kind,approved:true,openArrival:false,recordedAt:now,actor:actor.login,actorId:productionActorId(actor),reason:`${r.leaveCode} · ${r.leaveName}`,importId:id,importRow:r.row,sourceLeaveCode:r.leaveCode,sourceDuration:r.duration}));
 const batch={id,fileName:source.fileName,fileHash:source.fileHash,sourceHash:hash,month:body.month,actor:actor.login,createdAt:now,status:'active',results,events:created.map((e,i)=>({id:e.id,employeeId:e.employees[0],date:valid[i].date,row:valid[i].row,snapshot:JSON.stringify(e)}))};
 await commit(db,actor,now,created,null,null,expectedCursor,[{entity,key:id,payload:batch,expected:null}],guards);
 return {saved:true,count:created.length,results,events:created};
}
