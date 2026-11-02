// Bound each D1 response by payload bytes, not just row count. Only trusted SQL
// predicates from server code are accepted here; values always use bindings.
// Scan lightweight keys in larger windows; reuse the remaining keys when a
// payload page reaches 512 KiB. This avoids two round trips per 100 small rows.
export async function readRecordPages(db,{table='app_records',where='1',args=[],columns='entity,record_key,payload,updated_by,updated_at',payloadExpression='payload'}={}){
 const selectedColumns=payloadExpression==='payload'?columns:columns.replace(/\bpayload\b/g,`(${payloadExpression}) AS payload`);
 const rows=[];let entity='',key='';
 for(;;){
  const candidates=(await db.prepare(`SELECT entity,record_key,length(CAST((${payloadExpression}) AS BLOB)) AS bytes FROM ${table} WHERE (${where}) AND (entity>? OR (entity=? AND record_key>?)) ORDER BY entity,record_key LIMIT 1000`).bind(...args,entity,entity,key).all()).results;
  if(!candidates.length)break;
  // The key window already tells us every page boundary. Fetch up to three
  // independent, byte-bounded pages together rather than waiting for each one.
  // Promise.all preserves record ordering even when responses finish out of order.
  const pages=[];let chosen=[],bytes=0;
  for(const row of candidates){
   if(chosen.length&&bytes+row.bytes>512*1024){pages.push(chosen);chosen=[];bytes=0;}
   chosen.push([row.entity,row.record_key]);bytes+=row.bytes;
  }
  if(chosen.length)pages.push(chosen);
  for(let start=0;start<pages.length;start+=3){
   const results=await Promise.all(pages.slice(start,start+3).map(keys=>db.prepare(`SELECT ${selectedColumns} FROM ${table} WHERE (${where}) AND (entity,record_key) IN (SELECT json_extract(value,'$[0]'),json_extract(value,'$[1]') FROM json_each(?)) ORDER BY entity,record_key`).bind(...args,JSON.stringify(keys)).all()));
   for(const result of results)rows.push(...result.results);
  }
  const last=candidates.at(-1);entity=last.entity;key=last.record_key;
  // A short key window exhausted the scope; a second empty metadata query
  // cannot add anything to this request's snapshot.
  if(candidates.length<1000)break;
 }
 return rows;
}
