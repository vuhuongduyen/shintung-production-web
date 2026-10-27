import {productionApiFetch} from './production-api';
import {clientReadGeneration,subscribeClientReadInvalidation} from './data-sync';
import {createProductionSnapshotCache} from './production-snapshot-cache.mjs';

async function fetchWorkflow(force=false) {
  const response=await productionApiFetch('/api/production-workflow',{cache:force?'reload':'no-store'});
  const body=await response.json().catch(()=>{
    throw Object.assign(new Error('Không đọc được phản hồi dữ liệu sản xuất.'),{status:response.status});
  });
  if(!response.ok) {
    const error=Object.assign(new Error(body?.error||'Không tải được dữ liệu báo công.'),{status:response.status});
    throw error;
  }
  if(!body || ['orders','reports','events','employees','actualSchedules','approvedSchedules'].some(key=>!Array.isArray(body[key])) || !body.rights || typeof body.rights!=='object') {
    throw new Error('Dữ liệu sản xuất chưa hợp lệ. Vui lòng thử tải lại.');
  }
  return body;
}

// Browser-session cache only. SSR reads never enter this module's shared cache.
const workflow=createProductionSnapshotCache({fetcher:fetchWorkflow,getGeneration:clientReadGeneration});
subscribeClientReadInvalidation(reason=>{if(reason==='session')workflow.clear();});
export function productionSnapshot(){return typeof window==='undefined'?null:workflow.snapshot();}
export function clearProductionSnapshot(){workflow.clear();}
export function readProductionWorkflow(force=false){
  return typeof window==='undefined'?fetchWorkflow(force):workflow.read(force);
}
