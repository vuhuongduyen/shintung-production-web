import {readWebsiteTestLog} from './website-test-log.mjs';
// Read-only administrative summaries shared by local TEST and Site Worker.
// No mutation, no generic audit access, no per-Line report rows.
export const adminReadPaths = new Set(['/api/admin-audit','/api/website-test-log','/api/data-status-counts']);
export async function adminReadResponse({path,method,authorized,db,searchParams}) {
 if(!adminReadPaths.has(path))return null;
 if(method!=='GET')return {status:405,body:{error:'Phương thức không hợp lệ'}};
 if(!authorized)return {status:403,body:{error:'Không có quyền xem dữ liệu quản trị.'}};
 if(path==='/api/website-test-log')return {status:200,body:await readWebsiteTestLog(db,searchParams)};
 if(path==='/api/admin-audit'){
  const rows=(await db.prepare("SELECT payload FROM app_records WHERE entity='admin_audit' ORDER BY updated_at DESC").all()).results;
  return {status:200,body:{records:rows.map(row=>({payload:JSON.parse(row.payload)}))}};
 }
 const rows=(await db.prepare('SELECT entity,COUNT(*) AS count FROM app_records GROUP BY entity').all()).results;
 const counts=Object.fromEntries(['users','departments','department_permissions','permissions','sku','leadtime_versions','safety_rules','safety_rule_groups','forecast','demand_event','production_engine','production_plan','in_transit','production_report','inventory_snapshot','warehouse_docs'].map(entity=>[entity,0]));
 for(const row of rows)if(Object.hasOwn(counts,row.entity))counts[row.entity]=Number(row.count);
 return {status:200,body:{counts}};
}
