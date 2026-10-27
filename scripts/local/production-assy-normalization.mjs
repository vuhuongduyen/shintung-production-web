import {PlanError} from './production-plan.mjs';
export const assyLabel=value=>typeof value==='string'?value.replace(/^(\s*(?:[ABC]\s*[-–]\s*)?)ASSY\s+1\s*$/i,'$1ASSY'):value;
export function normalizeAssy(value,key='') {
 if(['sourceRow','sourceReferences','before'].includes(key))return value;
 if(Array.isArray(value))return value.map(v=>key==='stages'?assyLabel(v):normalizeAssy(v));
 if(!value||typeof value!=='object')return ['stageName','stage','process'].includes(key)?assyLabel(value):value;
 return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,normalizeAssy(v,k)]));
}
const hash=async v=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(v)))),b=>b.toString(16).padStart(2,'0')).join('');
const chunks=rows=>{const out=[];let part=[],n=0;for(const row of rows){const size=new TextEncoder().encode(JSON.stringify(row)).length;if(part.length&&n+size>120000){out.push(part);part=[];n=0;}part.push(row);n+=size;}if(part.length)out.push(part);return out;};
export async function normalizeStoredAssy(db,body,actor){
 if(!actor.isAdmin||actor.line)throw new PlanError('Chỉ Admin toàn quyền được chuẩn hóa công đoạn.',403);
 const records=(await db.prepare("SELECT entity,record_key,payload FROM app_records WHERE entity IN ('production_report','production_event','production_history_import') ORDER BY entity,record_key").all()).results;
 const changes=records.flatMap(r=>{const p=JSON.parse(r.payload);if(!p.erpStageImport&&!String(p.parentBatchId||'').startsWith('ERP-STAGES:'))return [];const after=JSON.stringify(normalizeAssy(p));return after===r.payload||JSON.stringify(p)===after?[]:[{entity:r.entity,key:r.record_key,before:r.payload,after}];});
 const revision=await hash(changes),id='ASSY-NORMALIZE:'+revision,reports=changes.filter(r=>r.entity==='production_report').map(r=>JSON.parse(r.after));
 const timeEvents=changes.flatMap(r=>{const a=JSON.parse(r.before);return (a.timeEvents||[]).filter(e=>assyLabel(e.stageName)!==e.stageName);}).length;
 const summary={reports:reports.length,timeEvents,records:changes.length};const batch={id,normalization:true,summary,reports,warnings:[]};
 if(body.action==='preview')return {ok:true,revision,batch};
 if(body.revision!==revision)throw new PlanError('Dữ liệu đã thay đổi. Hãy kiểm tra lại trước khi lưu.',409);
 if(!changes.length)return {ok:true,saved:true,batch};
 const parts=chunks(changes),now=new Date().toISOString(),token=crypto.randomUUID();
 const guards=parts.map(()=>"AND NOT EXISTS(SELECT 1 FROM json_each(?) e WHERE NOT EXISTS(SELECT 1 FROM app_records a WHERE a.entity=json_extract(e.value,'$.entity') AND a.record_key=json_extract(e.value,'$.key') AND a.payload=json_extract(e.value,'$.before'))) ").join('');
 const marker=JSON.stringify({id,normalization:true,summary,token,createdAt:now});
 const first=db.prepare(`INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'production_history_import',?,?,?,? WHERE 1=1 ${guards} ON CONFLICT(entity,record_key) DO NOTHING`).bind(id,marker,actor.login,now,...parts.map(p=>JSON.stringify(p.map(({entity,key,before})=>({entity,key,before})))));
 const stmts=[first,...parts.map(p=>db.prepare("UPDATE app_records SET payload=(SELECT json_extract(e.value,'$.after') FROM json_each(?) e WHERE json_extract(e.value,'$.entity')=app_records.entity AND json_extract(e.value,'$.key')=app_records.record_key),updated_by=?,updated_at=? WHERE EXISTS(SELECT 1 FROM json_each(?) e WHERE json_extract(e.value,'$.entity')=app_records.entity AND json_extract(e.value,'$.key')=app_records.record_key) AND EXISTS(SELECT 1 FROM app_records m WHERE m.entity='production_history_import' AND m.record_key=? AND m.payload=?)").bind(JSON.stringify(p.map(({entity,key,after})=>({entity,key,after}))),actor.login,now,JSON.stringify(p.map(({entity,key})=>({entity,key}))),id,marker)),db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'production_cursor','global',?,?,? WHERE EXISTS(SELECT 1 FROM app_records WHERE entity='production_history_import' AND record_key=? AND payload=?) ON CONFLICT(entity,record_key) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at").bind(JSON.stringify({version:Date.now(),token}),actor.login,now,id,marker)];
 const result=await db.batch(stmts);if(result[0].meta.changes!==1)throw new PlanError('Dữ liệu vừa thay đổi; chưa cập nhật. Hãy kiểm tra lại.',409);
 return {ok:true,saved:true,batch};
}
