import {recordRevision} from '../lib/record-revision.mjs';
const content=p=>{if(!p)return null;const {revision,...rest}=p;return rest;};
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export async function skuTransfer(db,actor,body,catalog,training){
 if(!actor?.isAdmin)fail('Chỉ Admin được đồng bộ SKU Master.',403);
 if(body.action==='export')return {snapshot:{format:'onspa-sku-v1',source:training?'training':'production',exportedAt:new Date().toISOString(),records:catalog.map(r=>({key:r.key,payload:r.payload}))}};
 if(!training)fail('Chỉ được nhập dữ liệu đồng bộ vào môi trường thử.',403);
 const snapshot=body.snapshot;
 if(snapshot?.format!=='onspa-sku-v1'||snapshot.source!=='production'||!Array.isArray(snapshot.records)||!snapshot.records.length||snapshot.records.length>5000)fail('Bản đồng bộ SKU không hợp lệ.');
 const keys=new Set();for(const r of snapshot.records){if(typeof r.key!=='string'||!r.key||r.payload?.code!==r.key||keys.has(r.key))fail('Mã SKU trùng hoặc không hợp lệ.');keys.add(r.key);}
 const rows=(await db.prepare("SELECT record_key,payload FROM app_records WHERE entity='sku' ORDER BY record_key").all()).results;
 const revision=await recordRevision(JSON.stringify(rows));
 const old=new Map(catalog.map(r=>[r.key,r.payload]));
 const changed=snapshot.records.filter(r=>JSON.stringify(content(old.get(r.key)))!==JSON.stringify(content(r.payload)));
 const summary={total:snapshot.records.length,changed:changed.length,cancelled:snapshot.records.filter(r=>r.payload.cancelled).length};
 if(body.action==='preview')return {summary,revision};
 if(body.action!=='import'||body.revision!==revision)fail('SKU thử đã thay đổi. Kiểm tra lại trước khi đồng bộ.',409);
 const now=new Date().toISOString(),id=crypto.randomUUID();
 // One transaction; preserve only SKU records, without touching other modules.
 const rawSnapshot=JSON.stringify(rows.map(r=>({record_key:r.record_key,payload:r.payload})));
 const writes=[db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'sku_sync_guard',?,'{}',?,? WHERE (SELECT json_group_array(json_object('record_key',record_key,'payload',payload)) FROM (SELECT record_key,payload FROM app_records WHERE entity='sku' ORDER BY record_key))=?").bind(id,actor.login,now,rawSnapshot)];
 for(const r of changed){
 const stored=rows.find(row=>row.record_key===r.key);
 const payload={...r.payload,revision:stored?Number(JSON.parse(stored.payload).revision||0)+1:1};
 writes.push(db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'sku',?,?,?,? WHERE EXISTS(SELECT 1 FROM app_records WHERE entity='sku_sync_guard' AND record_key=?) ON CONFLICT(entity,record_key) DO UPDATE SET payload=excluded.payload,updated_by=excluded.updated_by,updated_at=excluded.updated_at").bind(r.key,JSON.stringify(payload),actor.login,now,id));
 writes.push(db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'sku_sync_history',?,?,?,? WHERE EXISTS(SELECT 1 FROM app_records WHERE entity='sku_sync_guard' AND record_key=?)").bind(crypto.randomUUID(),JSON.stringify({batch:id,key:r.key,at:now,by:actor.login,source:snapshot.exportedAt,before:old.get(r.key)||null,after:payload}),actor.login,now,id));
 }
 writes.push(db.prepare("DELETE FROM app_records WHERE entity='sku_sync_guard' AND record_key=?").bind(id));
 const result=await db.batch(writes);if(result[0].meta.changes!==1)fail('SKU thử đã thay đổi. Kiểm tra lại trước khi đồng bộ.',409);
 return {ok:true,summary};
}
