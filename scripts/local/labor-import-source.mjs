import {createHash} from 'node:crypto';
// Same coverage as the original importer: no business source entity is omitted.
export const laborImportSourceScope="entity NOT IN ('production_labor_reference_snapshot','admin_audit','active_viewer')";
const pageBytes=256*1024;
const encode=new TextEncoder();
async function* pages(db){
 let entity='',key='';
 for(;;){
  const keys=(await db.prepare(`SELECT entity,record_key,length(CAST(payload AS BLOB)) AS bytes FROM app_records WHERE ${laborImportSourceScope} AND (entity>? OR (entity=? AND record_key>?)) ORDER BY entity,record_key LIMIT 256`).bind(entity,entity,key).all()).results;
  if(!keys.length)return;
  for(let offset=0;offset<keys.length;){
   const selected=[];let bytes=0;
   while(offset<keys.length&&(!selected.length||bytes+keys[offset].bytes<=pageBytes)){const row=keys[offset++];selected.push([row.entity,row.record_key]);bytes+=row.bytes;}
   // Sequential fetch: a completed page is released before fetching another.
   const rows=(await db.prepare(`SELECT entity,record_key,payload,updated_by,updated_at FROM app_records WHERE ${laborImportSourceScope} AND (entity,record_key) IN (SELECT json_extract(value,'$[0]'),json_extract(value,'$[1]') FROM json_each(?)) ORDER BY entity,record_key`).bind(JSON.stringify(selected)).all()).results;
   if(rows.length!==selected.length)throw Object.assign(new Error('Nguồn thay đổi khi đọc; chưa nhập căn cứ.'),{status:409});
   yield rows;
  }
  const last=keys.at(-1);entity=last.entity;key=last.record_key;
  if(keys.length<256)return;
 }
}
// Stream the complete source digest; payloads are never retained as SQL bindings.
export async function scanLaborImportSource(db){
 const hash=createHash('sha256');let count=0,sourceBytes=0,maxPageBytes=0;
 for await(const rows of pages(db)){
  let bytes=0;
  for(const row of rows){
   hash.update(JSON.stringify([row.entity,row.record_key,row.payload,row.updated_by,row.updated_at]));hash.update('\n');count++;
   bytes+=encode.encode(row.payload).byteLength;
  }
  sourceBytes+=bytes;maxPageBytes=Math.max(maxPageBytes,bytes);
 }
 return {revision:hash.digest('hex'),count,sourceBytes,guardBytes:0,maxPageBytes};
}
