import {createHash} from 'node:crypto';
const q=s=>'"'+s.replaceAll('"','""')+'"';
const literal=s=>"'"+s.replaceAll("'","''")+"'";
const stagePattern=/^_onspa_pc_snapshot_[0-9]{13}_[a-f0-9]{32}$/;
const schemaQuery="SELECT type,name,tbl_name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT GLOB 'sqlite_*' AND name NOT GLOB '_cf_*' ORDER BY type,name";
const readSchema=async db=>(await db.prepare(schemaQuery).all()).results.filter(s=>!stagePattern.test(s.name));
const encode=s=>new TextEncoder().encode(s);
// Freeze SQL rows inside one D1 transaction. Only bounded pages cross into the Worker.
export async function stagedDatabaseSnapshot(db,bucket,key){
 const stale=(await db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()).results;
 for(const {name} of stale)if(stagePattern.test(name)&&Date.now()-Number(name.split('_')[4])>86400000)await db.prepare(`DROP TABLE ${q(name)}`).run();
 const schema=await readSchema(db),tables=schema.filter(s=>s.type==='table');
 const columns=await db.batch(tables.map(t=>db.prepare(`PRAGMA table_xinfo(${q(t.name)})`)));
 const info=tables.map((t,i)=>({...t,columns:columns[i].results.filter(c=>!c.hidden).map(c=>c.name)}));
 if(info.some(t=>!t.columns.length))throw Error('Không đọc được cấu trúc bảng; dừng sao lưu.');
 const stage='_onspa_pc_snapshot_'+Date.now()+'_'+crypto.randomUUID().replaceAll('-','');
 const hasSequence=await db.prepare("SELECT name FROM sqlite_master WHERE name='sqlite_sequence'").first();
 let upload,finished=false;
 try{
  const statements=[db.prepare(`CREATE TABLE ${q(stage)} (id INTEGER PRIMARY KEY, sql TEXT NOT NULL)`),db.prepare(schemaQuery)];
  for(const t of info){
   const values=t.columns.map(c=>`CASE WHEN typeof(${q(c)})='text' AND instr(${q(c)},char(0))>0 THEN 'CAST(X''' || hex(CAST(${q(c)} AS BLOB)) || ''' AS TEXT)' ELSE quote(${q(c)}) END`).join(" || ',' || ");
   statements.push(db.prepare(`INSERT INTO ${q(stage)}(sql) SELECT ${literal(`INSERT INTO ${q(t.name)} (${t.columns.map(q).join(',')}) VALUES (`)} || ${values} || ');' FROM ${q(t.name)}`));
  }
  statements.push(db.prepare('SELECT * FROM file_objects'));
  if(hasSequence)statements.push(db.prepare('SELECT quote(name) AS name,quote(seq) AS seq FROM sqlite_sequence'));
  const result=await db.batch(statements);
  if(result.some(r=>r.success===false)||JSON.stringify(result[1].results.filter(s=>!stagePattern.test(s.name)))!==JSON.stringify(schema))throw Error('Cấu trúc DB thay đổi; thử sao lưu lại.');
  const counts=Object.fromEntries(info.map((t,i)=>[t.name,result[i+2].meta.changes]));
  const digest=createHash('sha256');let size=0,buffer=[],bufferSize=0,partNumber=0;const parts=[];
  upload=await bucket.createMultipartUpload(key,{httpMetadata:{contentType:'application/sql'}});
  async function flush(){if(!bufferSize)return;const out=new Uint8Array(bufferSize);let offset=0;for(const b of buffer){out.set(b,offset);offset+=b.length;}buffer=[];bufferSize=0;parts.push(await upload.uploadPart(++partNumber,out));}
  async function write(text){const b=encode(text+'\n');size+=b.length;digest.update(b);let offset=0;while(offset<b.length){const n=Math.min(b.length-offset,5*1024*1024-bufferSize);buffer.push(b.subarray(offset,offset+n));bufferSize+=n;offset+=n;if(bufferSize===5*1024*1024)await flush();}}
  await write('-- ONSPA full database backup. Restore only to an empty database.\nPRAGMA foreign_keys=OFF;\nBEGIN TRANSACTION;');
  for(const t of info)await write(t.sql+';');
  let cursor=0,rowsWritten=0;
  while(true){
   const rows=(await db.prepare(`SELECT id,sql FROM (SELECT id,sql,SUM(length(CAST(sql AS BLOB))) OVER (ORDER BY id) AS total,ROW_NUMBER() OVER (ORDER BY id) AS n FROM (SELECT id,sql FROM ${q(stage)} WHERE id>? ORDER BY id LIMIT 256)) WHERE total<=2097152 OR n=1 ORDER BY id`).bind(cursor).all()).results;
   if(!rows.length)break;
   for(const row of rows){await write(row.sql);cursor=row.id;rowsWritten++;}
  }
  if(rowsWritten!==Object.values(counts).reduce((a,b)=>a+b,0))throw Error('Không xuất đủ bản ghi; bản sao chưa hoàn tất.');
  if(hasSequence){await write('DELETE FROM sqlite_sequence;');for(const r of result.at(-1).results)await write(`INSERT INTO sqlite_sequence(name,seq) VALUES (${r.name},${r.seq});`);}
  for(const s of schema.filter(s=>s.type!=='table'))await write(s.sql+';');
  await write('COMMIT;\nPRAGMA foreign_keys=ON;');await flush();await upload.complete(parts);finished=true;
  return {schema,counts,files:result[info.length+2].results,size,sha256:digest.digest('hex')};
 }finally{
  if(upload&&!finished)await upload.abort().catch(()=>{});
  await db.prepare(`DROP TABLE IF EXISTS ${q(stage)}`).run();
 }
}
