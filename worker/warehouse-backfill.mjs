import {isDailyOutput} from '../lib/production-report-model.mjs';
import {planWarehouseBackfill} from '../lib/warehouse-backfill.mjs';
const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
const scope="('production_report','production_history_import','warehouse_in')";
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)))),b=>b.toString(16).padStart(2,'0')).join('');
export async function warehouseBackfill(db,body,actor){
 if(!actor.isAdmin||actor.line)fail('Chỉ Admin toàn quyền được bù phiếu.',403);
 if(!['preview','apply'].includes(body.action))fail('Thao tác không hợp lệ',400);
 const rows=(await db.prepare(`SELECT entity,record_key,payload,updated_at FROM app_records WHERE entity IN ${scope} ORDER BY entity,record_key`).all()).results;
 const revision=await hash(rows),reports=[...new Map([...rows.filter(r=>r.entity==='production_history_import').flatMap(r=>JSON.parse(r.payload).reports||[]),...rows.filter(r=>r.entity==='production_report').map(r=>({...JSON.parse(r.payload),id:r.record_key}))].map(r=>[r.id,r])).values()];
 const receipts=rows.filter(r=>r.entity==='warehouse_in').map(r=>({...JSON.parse(r.payload),id:r.record_key}));
 const plan=planWarehouseBackfill(reports,receipts);
 const summary={revision,create:plan.create.map(r=>({reportId:r.id,lsxCode:r.lsxCode,sku:r.sku,quantity:r.approvedQuantity??r.reportedQuantity,completedAt:r.completedAt,...(isDailyOutput(r)?{productionDate:r.productionDate}:{})})),covered:plan.covered,blocked:plan.blocked,alreadyLinked:plan.alreadyLinked,eligible:plan.eligible};
 if(body.action==='preview')return summary;
 if(body.revision!==revision)fail('Dữ liệu vừa thay đổi. Bấm Đối chiếu lại trước khi bù.');
 if(!plan.create.length)return {...summary,ok:true,created:0};
 const now=new Date().toISOString(),runId='WAREHOUSE-BACKFILL:'+revision;
 const guards=rows.map(r=>({e:r.entity,k:r.record_key,u:r.updated_at,n:[...r.payload].length}));
 const marker={id:runId,actor:actor.login,at:now,created:plan.create.map(r=>r.id),covered:plan.covered,blocked:plan.blocked};
 const statements=[db.prepare(`INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'warehouse_sync_run',?,?,?,? WHERE (SELECT count(*) FROM app_records WHERE entity IN ${scope})=? AND NOT EXISTS(SELECT 1 FROM json_each(?) j WHERE NOT EXISTS(SELECT 1 FROM app_records a WHERE a.entity=json_extract(j.value,'$.e') AND a.record_key=json_extract(j.value,'$.k') AND a.updated_at IS json_extract(j.value,'$.u') AND length(a.payload)=json_extract(j.value,'$.n'))) ON CONFLICT(entity,record_key) DO NOTHING`).bind(runId,JSON.stringify(marker),actor.login,now,rows.length,JSON.stringify(guards))];
 for(const r of plan.create){const id='SX:'+r.id;const w={id,source:'Sản xuất',entryMode:'automatic',reportId:r.id,planId:r.planId,lsxCode:r.lsxCode,sku:r.sku,name:r.name,spec:r.spec,line:r.line,proposedQuantity:qty(r),receivedQuantity:null,status:'Chờ xác nhận',createdBy:actor.login,createdAt:now,sourceCompletedAt:isDailyOutput(r)?r.productionDate:r.completedAt,...(isDailyOutput(r)?{sourceProductionDate:r.productionDate}:{}),backfillRun:runId};statements.push(db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'warehouse_in',?,?,?,? WHERE EXISTS(SELECT 1 FROM app_records WHERE entity='warehouse_sync_run' AND record_key=? AND payload=?) ON CONFLICT(entity,record_key) DO NOTHING").bind(id,JSON.stringify(w),actor.login,now,runId,JSON.stringify(marker)));}
 const result=await db.batch(statements);if(result[0].meta.changes!==1)fail('Dữ liệu thay đổi hoặc lần bù này đã được xử lý. Đối chiếu lại.');
 return {...summary,ok:true,created:result.slice(1).reduce((n,r)=>n+r.meta.changes,0)};
}
const qty=r=>Number(r.approvedQuantity??r.reportedQuantity??0);
