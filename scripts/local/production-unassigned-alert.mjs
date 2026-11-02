import {unassignedAlerts} from '../../lib/production-unassigned-alert.mjs';
const entity='production_unassigned_reminder';
const fail=(message,status=403)=>{throw Object.assign(Error(message),{status});};
const actorId=actor=>String(actor?.userId||actor?.login||'');
const recordKey=(actor,key)=>JSON.stringify([actorId(actor),key]);
export async function productionUnassignedReminder(db,actor,workflow,body=null,now=Date.now()){
 if(!actorId(actor)||!workflow.rights?.work)fail('Không có quyền xử lý cảnh báo báo công.');
 const rows=unassignedAlerts({schedules:workflow.approvedSchedules,events:workflow.events,orders:workflow.orders,reports:workflow.reports,employees:workflow.employees,line:actor.line||'all',now});
 const keys=rows.map(r=>recordKey(actor,r.key));
 const records=keys.length?(await db.prepare(`SELECT record_key,payload FROM app_records WHERE entity=? AND record_key IN (${keys.map(()=>'?').join(',')})`).bind(entity,...keys).all()).results:[];
 const byKey=new Map(records.map(r=>[r.record_key,r.payload]));
 if(body){
  if(!['show','acknowledge'].includes(body.action)||!Array.isArray(body.keys)||!body.keys.length||body.keys.length>100)fail('Cảnh báo không hợp lệ.',422);
  const writes=[];
  for(const key of new Set(body.keys)){
   const row=rows.find(r=>r.key===key);if(!row)continue; // Assignment/absence can resolve a visible warning before acknowledgement.
   const id=recordKey(actor,key),raw=byKey.get(id),old=raw?JSON.parse(raw):null;
   let next;
   if(body.action==='show'){
    if(old&&(!old.acknowledgedAt||now<old.nextAt))continue;
    next={...row,count:(old?.count||0)+1,lastShownAt:now,acknowledgedAt:null,nextAt:null,actor:actorId(actor)};
   }else{
    if(!old||old.acknowledgedAt)continue;
    next={...old,acknowledgedAt:now,nextAt:now+5*60000};
   }
   const time=new Date(now).toISOString();
   writes.push(raw?db.prepare('UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity=? AND record_key=? AND payload=?').bind(JSON.stringify(next),actorId(actor),time,entity,id,raw):db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?) ON CONFLICT(entity,record_key) DO NOTHING').bind(entity,id,JSON.stringify(next),actorId(actor),time));
  }
  if(writes.length)await db.batch(writes);
  return productionUnassignedReminder(db,actor,workflow,null,now);
 }
 return {rows:rows.map(row=>{const raw=byKey.get(recordKey(actor,row.key)),record=raw?JSON.parse(raw):null;return {...row,count:record?.count||0,lastShownAt:record?.lastShownAt||null,acknowledgedAt:record?.acknowledgedAt||null,nextAt:record?.nextAt||null,due:!record||!!record.acknowledgedAt&&now>=record.nextAt};}),serverNow:now};
}
