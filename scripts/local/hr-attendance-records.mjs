import {readRecordPages} from './production-record-pages.mjs';
// Read only lightweight links once. Walk supersession in memory rather than
// recursively scanning every event JSON in D1 for each matching record.
export async function readEmployeeAttendance(db,ids,{payloadExpression='payload'}={}){
 if(!ids.length)return [];
 const people=new Set(ids.map(v=>String(v).toUpperCase()));
 const links=await readRecordPages(db,{where:"entity='production_event'",payloadExpression:"json_object('employees',json_extract(payload,'$.employees'),'supersedes',json_extract(payload,'$.supersedes'),'approvedFrom',json_extract(payload,'$.approvedFrom'))"});
 const children=new Map(),selected=new Set(),queue=[];
 for(const r of links){
  const e=JSON.parse(r.payload);
  if(e.employees?.some(id=>people.has(String(id).toUpperCase()))){selected.add(r.record_key);queue.push(r.record_key);}
  for(const parent of [e.supersedes,e.approvedFrom])if(parent){if(!children.has(parent))children.set(parent,[]);children.get(parent).push(r.record_key);}
 }
 for(let i=0;i<queue.length;i++)for(const child of children.get(queue[i])||[])if(!selected.has(child)){selected.add(child);queue.push(child);}
 if(!queue.length)return [];
 return readRecordPages(db,{where:"entity='production_event' AND record_key IN (SELECT value FROM json_each(?))",args:[JSON.stringify(queue)],payloadExpression});
}
