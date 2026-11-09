import {siteLaborHours} from '../../lib/site-labor-hours.mjs';
export async function readLaborHistory(db,sku=null){
 const query="SELECT record_key,payload,updated_at FROM app_records WHERE entity='labor_hours_history'"+(sku?" AND upper(trim(json_extract(payload,'$.sku')))=?":'');
 const statement=db.prepare(query),rows=(await (sku?statement.bind(sku):statement).all()).results;
 return rows.map(r=>({key:r.record_key,payload:JSON.parse(r.payload),updatedAt:r.updated_at,raw:r.payload}));
}
export async function readLaborRateSource(db,sku){
 sku=String(sku||'').trim().toUpperCase();
 // One scoped snapshot keeps the output read budget independent of revision count.
 const scope="(entity='labor_hours' AND record_key=?) OR (entity='labor_hours_history' AND upper(trim(json_extract(payload,'$.sku')))=?)";
 const rows=(await db.prepare(`SELECT entity,record_key,payload,updated_at FROM app_records WHERE ${scope}`).bind(sku,sku).all()).results;
 const snapshot=JSON.stringify(rows.map(r=>[r.entity,r.record_key,r.payload,r.updated_at]));
 if(new TextEncoder().encode(snapshot).byteLength>512*1024)throw Object.assign(Error('Lịch sử Giờ công vượt giới hạn đối chiếu an toàn; chưa lưu phiếu, cần đối chiếu dữ liệu.'),{status:409});
 const raw=rows.find(r=>r.entity==='labor_hours');
 const history=rows.filter(r=>r.entity==='labor_hours_history').map(r=>({key:r.record_key,payload:JSON.parse(r.payload),updatedAt:r.updated_at,raw:r.payload}));
 const records=raw?[{key:sku,payload:JSON.parse(raw.payload),updatedAt:raw.updated_at}]:[];
 const menu=siteLaborHours(records,null,history).find(r=>r.key===sku)?.payload;
 // Exact count and every raw row (including audit timestamp) must still match.
 // Bind the snapshot once rather than three SQL variables per history row.
 const guards=[{sql:`(WITH actual AS MATERIALIZED (SELECT entity,record_key,payload,updated_at FROM app_records WHERE ${scope}), expected AS MATERIALIZED (SELECT value FROM json_each(?)) SELECT (SELECT count(*) FROM actual)=(SELECT count(*) FROM expected) AND NOT EXISTS(SELECT 1 FROM expected e WHERE NOT EXISTS(SELECT 1 FROM actual a WHERE a.entity=json_extract(e.value,'$[0]') AND a.record_key=json_extract(e.value,'$[1]') AND a.payload=json_extract(e.value,'$[2]') AND a.updated_at IS json_extract(e.value,'$[3]'))))`,args:[sku,sku,snapshot]}];
 return {menu,guards};
}
