import {readRecordPages} from './production-record-pages.mjs';
// Short-lived comparison copies stay inside SQLite. They are never sent back
// as a huge bound parameter. Original business records are never changed here.
const table='_onspa_correction_compare';
export async function withCorrectionSnapshot(db,scope,run){
 await db.prepare(`CREATE TABLE IF NOT EXISTS ${table} (token TEXT NOT NULL, created_at INTEGER NOT NULL, entity TEXT NOT NULL, record_key TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(token,entity,record_key))`).run();
 const token=crypto.randomUUID(),now=Date.now();
 await db.batch([
  db.prepare(`DELETE FROM ${table} WHERE created_at<?`).bind(now-3600000),
  db.prepare(`INSERT INTO ${table} SELECT ?,?,entity,record_key,payload FROM app_records WHERE entity IN (${scope})`).bind(token,now)
 ]);
 try{
  const records=await readRecordPages(db,{table,where:'token=?',args:[token],columns:'entity,record_key,payload'});
  const sql=`(SELECT count(*) FROM app_records WHERE entity IN (${scope}))=? AND NOT EXISTS(SELECT 1 FROM ${table} s LEFT JOIN app_records a ON a.entity=s.entity AND a.record_key=s.record_key WHERE s.token=? AND (a.record_key IS NULL OR a.payload<>s.payload))`;
  return await run(records,{sql,args:[records.length+(records.some(r=>r.entity==='production_cursor'&&r.record_key==='global')?0:1),token]});
 }finally{await db.prepare(`DELETE FROM ${table} WHERE token=?`).bind(token).run().catch(()=>{});}
}
