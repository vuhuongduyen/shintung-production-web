import {Buffer} from 'node:buffer';
import {createHash} from 'node:crypto';
// Same coverage as the original importer: no business source entity is omitted.
const scope="entity NOT IN ('production_labor_reference_snapshot','admin_audit','active_viewer')";
const pageBytes=128*1024;
export const laborImportGuardBudget=40*1024*1024;
const fail=()=>{throw Object.assign(new Error('Nguồn kiểm toàn vẹn vượt ngân sách bộ nhớ an toàn của lần nhập. Chưa ghi căn cứ; cần kiểm kích thước nguồn trước khi tiếp tục.'),{status:413});};
const encode=new TextEncoder();
async function* pages(db){
 let entity='',key='';
 for(;;){
  const keys=(await db.prepare(`SELECT entity,record_key,length(CAST(payload AS BLOB)) AS bytes FROM app_records WHERE ${scope} AND (entity>? OR (entity=? AND record_key>?)) ORDER BY entity,record_key LIMIT 256`).bind(entity,entity,key).all()).results;
  if(!keys.length)return;
  for(let offset=0;offset<keys.length;){
   const selected=[];let bytes=0;
   while(offset<keys.length&&(!selected.length||bytes+keys[offset].bytes<=pageBytes)){const row=keys[offset++];selected.push([row.entity,row.record_key]);bytes+=row.bytes;}
   // Sequential fetch: a completed page is released before fetching another.
   const rows=(await db.prepare(`SELECT entity,record_key,payload,updated_by,updated_at FROM app_records WHERE ${scope} AND (entity,record_key) IN (SELECT json_extract(value,'$[0]'),json_extract(value,'$[1]') FROM json_each(?)) ORDER BY entity,record_key`).bind(JSON.stringify(selected)).all()).results;
   if(rows.length!==selected.length)throw Object.assign(new Error('Nguồn thay đổi khi đọc; chưa nhập căn cứ.'),{status:409});
   yield rows;
  }
  const last=keys.at(-1);entity=last.entity;key=last.record_key;
  if(keys.length<256)return;
 }
}
const pageGuard=`SELECT json(CASE WHEN NOT EXISTS (
 SELECT 1 FROM json_each(?) expected LEFT JOIN app_records actual
 ON actual.entity=json_extract(expected.value,'$[0]') AND actual.record_key=json_extract(expected.value,'$[1]')
 WHERE actual.payload IS NOT json_extract(expected.value,'$[2]')
 OR actual.updated_by IS NOT json_extract(expected.value,'$[3]')
 OR actual.updated_at IS NOT json_extract(expected.value,'$[4]')
) THEN 'true' ELSE 'SOURCE_CHANGED' END)`;
// Only bounded pages are materialized. A preview retains no source payloads;
// apply retains one bounded set of exact SQL guard bindings, never row copies.
export async function scanLaborImportSource(db,{retainGuards=false}={}){
 const hash=createHash('sha256'),guards=[];let count=0,sourceBytes=0,guardBytes=0,maxPageBytes=0;
 function guard(sql,args){
  const size=encode.encode(JSON.stringify(args)).byteLength;
  guardBytes+=size;if(guardBytes>laborImportGuardBudget)fail();
  if(retainGuards)guards.push(db.prepare(sql).bind(...args));
 }
 for await(const rows of pages(db)){
  const small=[];let bytes=0;
  for(const row of rows){
   const tuple=[row.entity,row.record_key,row.payload,row.updated_by,row.updated_at];
   const text=JSON.stringify(tuple);hash.update(text);hash.update('\n');count++;
   const payloadBytes=encode.encode(row.payload).byteLength;sourceBytes+=payloadBytes;bytes+=payloadBytes;
   if(encode.encode(text).byteLength<=pageBytes){small.push(tuple);continue;}
   guard("SELECT json(CASE WHEN EXISTS(SELECT 1 FROM app_records WHERE entity=? AND record_key=? AND updated_at IS ? AND updated_by IS ? AND length(CAST(payload AS BLOB))=?) THEN 'true' ELSE 'SOURCE_CHANGED' END)",[row.entity,row.record_key,row.updated_at,row.updated_by,payloadBytes]);
   const raw=encode.encode(row.payload);
   for(let start=0;start<raw.length;start+=65536){
    const part=raw.subarray(start,start+65536),hex=Buffer.from(part.buffer,part.byteOffset,part.byteLength).toString('hex').toUpperCase();
    guard("SELECT json(CASE WHEN EXISTS(SELECT 1 FROM app_records WHERE entity=? AND record_key=? AND hex(substr(CAST(payload AS BLOB),?,?))=?) THEN 'true' ELSE 'SOURCE_CHANGED' END)",[row.entity,row.record_key,start+1,part.length,hex]);
   }
  }
  if(small.length)guard(pageGuard,[JSON.stringify(small)]);
  maxPageBytes=Math.max(maxPageBytes,bytes);
 }
 if(retainGuards)guards.unshift(db.prepare(`SELECT json(CASE WHEN (SELECT count(*) FROM app_records WHERE ${scope})=? THEN 'true' ELSE 'SOURCE_CHANGED' END)`).bind(count));
 return {revision:hash.digest('hex'),count,sourceBytes,guardBytes,maxPageBytes,guards};
}
