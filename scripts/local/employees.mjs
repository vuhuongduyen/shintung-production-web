import {employeeActiveOn,validEmploymentDate} from '../../lib/employee-employment.mjs';
// Employees are a production directory, independent from website login users.
const reject=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const permissions=actor=>{
 const grants=(actor?.grants||[]).map(x=>String(x).toLowerCase());
 const admin=Boolean(actor?.login&&actor.isAdmin);
 const allowed=action=>admin||grants.some(x=>x.includes('danh sách nhân viên')&&x.endsWith('/ '+action));
 return {cancel:false,view:allowed('xem')||allowed('thêm')||allowed('sửa')||grants.some(x=>x.includes('capacity tuần')&&x.endsWith('/ xem')),edit:allowed('thêm')||allowed('sửa')};
};
export async function readEmployees(db,actor){
 const rights=permissions(actor);if(!rights.view)reject('Không có quyền xem Danh sách nhân viên',403);
 const rows=(await db.prepare("SELECT record_key,payload FROM app_records WHERE entity='employees' ORDER BY record_key").all()).results;
 return {employees:rows.map(r=>({...JSON.parse(r.payload),id:r.record_key,active:employeeActiveOn(JSON.parse(r.payload))})),permissions:rights};
}
export async function saveEmployee(db,body,actor){
 if(!permissions(actor).edit)reject('Không có quyền sửa Danh sách nhân viên',403);
 const id=String(body.id||'').trim().toUpperCase(),name=String(body.name||'').trim(),secondaryId=String(body.secondaryId||'').trim().toUpperCase();
 const line=String(body.line||'').trim().toUpperCase();
 if(!/^[\p{L}\p{N}_-]{2,40}$/u.test(id)||!name||name.length>160||secondaryId.length>40||!['A','B','C'].includes(line))reject('Nhập mã, họ tên và Line A, B hoặc C hợp lệ');
 const old=await db.prepare("SELECT payload FROM app_records WHERE entity='employees' AND record_key=?").bind(id).first();
 const before=old?JSON.parse(old.payload):null,expected=Number(body.version||0);
 const restoring=body.action==='restore';
 if(restoring&&!before?.cancelled)reject('Nhân viên không ở trạng thái đã hủy.',409);
 if(before?.cancelled&&!restoring)reject('Nhân viên đã Hủy; không được sửa để tự áp dụng lại.',409);
 if(expected!==Number(before?.version||0))reject('Nhân viên đã được người khác cập nhật. Hãy tải lại trước khi sửa.',409);
 const startDate=String(body.startDate??before?.startDate??'').trim(),endDate=String(body.endDate??before?.endDate??'').trim();
 if(!before&&!startDate)reject('Vui lòng nhập Ngày bắt đầu cho nhân viên mới.');
 if(startDate&&!validEmploymentDate(startDate)||endDate&&!validEmploymentDate(endDate))reject('Ngày bắt đầu hoặc ngày ngưng làm việc không hợp lệ.');
 if(startDate&&endDate&&endDate<startDate)reject('Ngày ngưng làm việc không được trước ngày bắt đầu.');
 const active=employeeActiveOn({startDate,endDate,employmentDatesManaged:true});
 const now=new Date().toISOString(),value={...before,id,name,secondaryId,line,active,startDate,endDate,employmentDatesManaged:true,version:expected+1,updatedAt:now,updatedBy:actor.login,createdAt:before?.createdAt||now,
  ...(restoring?{cancelled:false,status:'',cancelledAt:null,cancelledBy:null,restoredAt:now,restoredBy:actor.login}:{}),
  history:[...(before?.history||[]),{at:now,by:actor.login,action:restoring?'Khôi phục':'Cập nhật',before:before?{name:before.name,secondaryId:before.secondaryId||'',line:before.line,active:before.active,startDate:before.startDate||'',endDate:before.endDate||'',cancelled:!!before.cancelled}:null,after:{name,secondaryId,line,active,startDate,endDate,employmentDatesManaged:true}}]};
 const result=old?await db.prepare("UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity='employees' AND record_key=? AND payload=?").bind(JSON.stringify(value),actor.login,now,id,old.payload).run():await db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) VALUES('employees',?,?,?,?) ON CONFLICT(entity,record_key) DO NOTHING").bind(id,JSON.stringify(value),actor.login,now).run();
 if(result.meta.changes!==1)reject('Danh sách vừa thay đổi. Tải lại để đối chiếu.',409);
 return {employee:value};
}

export async function importEmployees(db,body,actor){
 if(!permissions(actor).edit)reject('Không có quyền nhập Danh sách nhân viên',403);
 const rows=body?.rows;
 if(!Array.isArray(rows)||!rows.length||rows.length>500)reject('File cần có từ 1 đến 500 nhân viên');
 const seen=new Set(),prepared=[];
 for(const entry of rows){
  const id=String(entry?.id||'').trim().toUpperCase(),secondaryId=String(entry?.secondaryId||'').trim().toUpperCase(),name=String(entry?.name||'').trim(),line=String(entry?.line||'').trim().toUpperCase();
  if(!/^[\p{L}\p{N}_-]{2,40}$/u.test(id)||!name||name.length>160||secondaryId.length>40||!['A','B','C'].includes(line))reject(`Dòng ${prepared.length+1}: mã, họ tên hoặc Line không hợp lệ`);
  if(seen.has(id))reject(`Trùng mã nhân viên ${id} trong file`);
  const startDate=String(entry.startDate||'').trim();if(!validEmploymentDate(startDate))reject(`Dòng ${prepared.length+1}: cần Ngày bắt đầu hợp lệ (yyyy-MM-dd).`);
  seen.add(id);prepared.push({id,secondaryId,name,line,startDate,endDate:'',employmentDatesManaged:true});
 }
 const existing=(await db.prepare("SELECT record_key FROM app_records WHERE entity='employees'").all()).results.map(r=>r.record_key);
 const matches=prepared.filter(x=>existing.includes(x.id)).map(x=>x.id);
 if(matches.length)return {imported:0,duplicates:matches,unchanged:true};
 const now=new Date().toISOString(),statements=prepared.map(x=>{
  const payload={...x,active:employeeActiveOn(x),version:1,createdAt:now,updatedAt:now,updatedBy:actor.login,history:[{at:now,by:actor.login,before:null,after:{name:x.name,secondaryId:x.secondaryId,line:x.line,active:true}}]};
  return db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) VALUES('employees',?,?,?,?)").bind(x.id,JSON.stringify(payload),actor.login,now);
 });
 try{await db.batch(statements);}catch{reject('Danh sách vừa thay đổi; chưa nhập dòng nào. Tải lại và đối chiếu.',409);}
 return {imported:prepared.length,duplicates:[]};
}
