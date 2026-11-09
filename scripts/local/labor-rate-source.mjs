import {siteLaborHours} from '../../lib/site-labor-hours.mjs';
export async function readLaborHistory(db,sku=null){
 const query="SELECT record_key,payload,updated_at FROM app_records WHERE entity='labor_hours_history'"+(sku?" AND upper(trim(json_extract(payload,'$.sku')))=?":'');
 const statement=db.prepare(query),rows=(await (sku?statement.bind(sku):statement).all()).results;
 return rows.map(r=>({key:r.record_key,payload:JSON.parse(r.payload),updatedAt:r.updated_at,raw:r.payload}));
}
export async function readLaborRateSource(db,sku){
 sku=String(sku||'').trim().toUpperCase();
 const [raw,history]=await Promise.all([db.prepare("SELECT payload,updated_at FROM app_records WHERE entity='labor_hours' AND record_key=?").bind(sku).first(),readLaborHistory(db,sku)]);
 const records=raw?[{key:sku,payload:JSON.parse(raw.payload),updatedAt:raw.updated_at}]:[];
 const menu=siteLaborHours(records,null,history).find(r=>r.key===sku)?.payload;
 const scope="entity='labor_hours_history' AND upper(trim(json_extract(payload,'$.sku')))=?";
 const guards=[{sql:`(SELECT count(*) FROM app_records WHERE ${scope})=?`,args:[sku,history.length]},...history.map(r=>({sql:"EXISTS(SELECT 1 FROM app_records WHERE entity='labor_hours_history' AND record_key=? AND payload=? AND updated_at IS ?)",args:[r.key,r.raw,r.updatedAt]})),raw?{sql:"EXISTS(SELECT 1 FROM app_records WHERE entity='labor_hours' AND record_key=? AND payload=? AND updated_at IS ?)",args:[sku,raw.payload,raw.updated_at]}:{sql:"NOT EXISTS(SELECT 1 FROM app_records WHERE entity='labor_hours' AND record_key=?)",args:[sku]}];
 return {menu,guards};
}
