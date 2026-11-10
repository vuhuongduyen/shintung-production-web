import {laborImportSourceScope as scope} from './labor-import-source.mjs';
export const laborImportTablePattern=/^_onspa_labor_import_[0-9]{13}_[a-f0-9]{32}$/;
const quote=name=>'"'+name+'"';
// Apply-only transport, not business data. No payload crosses into a binding.
export async function createLaborImportSnapshot(db){
 const stale=(await db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()).results;
 for(const {name} of stale.filter(({name})=>laborImportTablePattern.test(name)&&Date.now()-Number(name.split('_')[4])>86400000).slice(0,10))await db.prepare(`DROP TABLE ${quote(name)}`).run();
 const name='_onspa_labor_import_'+Date.now()+'_'+crypto.randomUUID().replaceAll('-',''),table=quote(name);
 const drop=()=>db.prepare(`DROP TABLE IF EXISTS ${table}`).run();
 try{
  await db.batch([
   db.prepare(`CREATE TABLE ${table}(entity TEXT NOT NULL,record_key TEXT NOT NULL,payload TEXT NOT NULL,updated_by TEXT,updated_at TEXT,PRIMARY KEY(entity,record_key))`),
   db.prepare(`INSERT INTO ${table} SELECT entity,record_key,payload,updated_by,updated_at FROM app_records WHERE ${scope}`)
  ]);
 }catch(error){await drop();throw error;}
 return {
  // Only internal, fixed SELECTs use this reader. No client SQL or table name.
  reader:{prepare(sql){if(!/^SELECT\b/i.test(sql.trim()))throw Error('Snapshot reader is read-only');return db.prepare(sql.replace(/\bapp_records\b/g,table));}},
  guard:db.prepare(`SELECT json(CASE WHEN
   (SELECT count(*) FROM app_records WHERE ${scope})=(SELECT count(*) FROM ${table})
   AND NOT EXISTS(SELECT 1 FROM ${table} expected LEFT JOIN app_records actual
    ON actual.entity=expected.entity AND actual.record_key=expected.record_key
    WHERE actual.entity IS NULL OR actual.payload IS NOT expected.payload
    OR actual.updated_by IS NOT expected.updated_by OR actual.updated_at IS NOT expected.updated_at)
   THEN 'true' ELSE 'SOURCE_CHANGED' END)`),
  dropStatement:db.prepare(`DROP TABLE ${table}`),drop,name
 };
}
