import {readProgressResponse} from './production-progress-request.mjs';
export type WorkflowReadProfile='full'|'work'|'progress'|'progress-all';
import {productionApiFetch} from './production-api';
import {clientReadGeneration,subscribeClientReadInvalidation} from './data-sync';
import {createProductionSnapshotCache} from './production-snapshot-cache.mjs';

async function fetchWorkflow(force=false,profile:WorkflowReadProfile='full') {
  if(profile==='progress'||profile==='progress-all'){const body=await readProgressResponse(productionApiFetch,{cache:force?'reload':'no-store'},25000,profile==='progress-all'?'all':'active');validateWorkflow(body);return body;}
  const response=await productionApiFetch(profile==='work'?'/api/production-workflow?view=work':'/api/production-workflow',{cache:force?'reload':'no-store'});
  const body=await response.json().catch(()=>{
    throw Object.assign(new Error('Không đọc được phản hồi dữ liệu sản xuất.'),{status:response.status});
  });
  if(!response.ok) {
    const error=Object.assign(new Error(body?.error||'Không tải được dữ liệu báo công.'),{status:response.status});
    throw error;
  }
  validateWorkflow(body);
  return body;
}
function validateWorkflow(body:any){
  if(!body || ['orders','reports','events','employees','actualSchedules','approvedSchedules'].some(key=>!Array.isArray(body[key])) || !body.rights || typeof body.rights!=='object') {
    throw new Error('Dữ liệu sản xuất chưa hợp lệ. Vui lòng thử tải lại.');
  }
}

// Browser-session cache only. SSR reads never enter this module's shared cache.
const full=createProductionSnapshotCache({fetcher:(force:boolean)=>fetchWorkflow(force,'full'),getGeneration:clientReadGeneration});
const work=createProductionSnapshotCache({fetcher:(force:boolean)=>fetchWorkflow(force,'work'),getGeneration:clientReadGeneration});
const progress=createProductionSnapshotCache({fetcher:(force:boolean)=>fetchWorkflow(force,'progress'),getGeneration:clientReadGeneration});
const progressAll=createProductionSnapshotCache({fetcher:(force:boolean)=>fetchWorkflow(force,'progress-all'),getGeneration:clientReadGeneration});
const cache=(profile:WorkflowReadProfile)=>profile==='work'?work:profile==='progress'?progress:profile==='progress-all'?progressAll:full;
subscribeClientReadInvalidation(reason=>{if(reason==='session'){full.clear();work.clear();progress.clear();progressAll.clear();}});
export function productionSnapshot(profile:WorkflowReadProfile='full'){return typeof window==='undefined'?null:(profile==='work'?full.freshSnapshot():null)||cache(profile).snapshot();}
export function clearProductionSnapshot(){full.clear();work.clear();progress.clear();progressAll.clear();}
export function readProductionWorkflow(force=false,profile:WorkflowReadProfile='full'){
  return (typeof window==='undefined'?fetchWorkflow(force,profile):(profile==='work'&&!force&&full.freshSnapshot()?Promise.resolve(full.freshSnapshot()):cache(profile).read(force))).catch(error=>{if(error?.status===401||error?.status===403)clearProductionSnapshot();throw error;});
}
