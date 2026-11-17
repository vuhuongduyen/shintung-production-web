import {mergeProductionSavedResult} from './production-saved-result.mjs';
import {productionBoundedRead} from './production-bounded-read.mjs';
import {productionDisplayStore,displayOnlyWorkflow,compactWorkflowDisplay} from './production-display-store.mjs';
import {readProgressResponse} from './production-progress-request.mjs';
export type WorkflowReadProfile='full'|'work'|'progress'|'progress-all'|'workspace'|'journal';
import {productionApiFetch} from './production-api';
import {clientReadGeneration,subscribeClientReadInvalidation} from './data-sync';
import {createProductionSnapshotCache} from './production-snapshot-cache.mjs';

async function fetchWorkflow(force=false,profile:WorkflowReadProfile='full') {
  if(profile==='progress'||profile==='progress-all'){const body=await readProgressResponse(productionApiFetch,{cache:force?'reload':'no-store'},25000,profile==='progress-all'?'all':'active');validateWorkflow(body);return body;}
  const body=await productionBoundedRead(productionApiFetch,profile==='work'?'/api/production-workflow?view=work':profile==='workspace'?'/api/production-workflow?view=workspace':profile==='journal'?'/api/production-workflow?view=journal':'/api/production-workflow',{cache:force?'reload':'no-store'},profile==='journal'?60000:profile==='full'?25000:15000);
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
const work=createProductionSnapshotCache({fetcher:(force:boolean)=>fetchWorkflow(force,'work'),getGeneration:clientReadGeneration,restore:()=>displayOnlyWorkflow(productionDisplayStore.get('workflow:work')),remember:(value:any)=>productionDisplayStore.put('workflow:work',compactWorkflowDisplay(value))});
const progress=createProductionSnapshotCache({fetcher:(force:boolean)=>fetchWorkflow(force,'progress'),getGeneration:clientReadGeneration,restore:()=>displayOnlyWorkflow(productionDisplayStore.get('workflow:progress')),remember:(value:any)=>productionDisplayStore.put('workflow:progress',value)});
const progressAll=createProductionSnapshotCache({fetcher:(force:boolean)=>fetchWorkflow(force,'progress-all'),getGeneration:clientReadGeneration,restore:()=>displayOnlyWorkflow(productionDisplayStore.get('workflow:progress-all')),remember:(value:any)=>productionDisplayStore.put('workflow:progress-all',value)});
const workspace=createProductionSnapshotCache({fetcher:(force:boolean)=>fetchWorkflow(force,'workspace'),getGeneration:clientReadGeneration,restore:()=>displayOnlyWorkflow(productionDisplayStore.get('workflow:workspace')),remember:(value:any)=>productionDisplayStore.put('workflow:workspace',value)});
const journal=createProductionSnapshotCache({fetcher:(force:boolean)=>fetchWorkflow(force,'journal'),getGeneration:clientReadGeneration,restore:()=>displayOnlyWorkflow(productionDisplayStore.get('workflow:journal')),remember:(value:any)=>productionDisplayStore.put('workflow:journal',value)});
const cache=(profile:WorkflowReadProfile)=>profile==='journal'?journal:profile==='workspace'?workspace:profile==='work'?work:profile==='progress'?progress:profile==='progress-all'?progressAll:full;
subscribeClientReadInvalidation(reason=>{if(reason==='session'){if(productionDisplayStore.active())productionDisplayStore.clear();full.clear();work.clear();progress.clear();progressAll.clear();workspace.clear();journal.clear();}});
export function productionSnapshot(profile:WorkflowReadProfile='full'){return typeof window==='undefined'?null:(profile==='work'?(full.freshSnapshot()||workspace.freshSnapshot()):null)||cache(profile).snapshot();}
export function clearProductionSnapshot(){full.clear();work.clear();progress.clear();progressAll.clear();workspace.clear();journal.clear();}
export function readProductionWorkflow(force=false,profile:WorkflowReadProfile='full'){
  return (typeof window==='undefined'?fetchWorkflow(force,profile):(profile==='work'&&!force&&(full.freshSnapshot()||workspace.freshSnapshot())?Promise.resolve((full.freshSnapshot()||workspace.freshSnapshot())):cache(profile).read(force))).catch(error=>{if(error?.status===401||error?.status===403){clearProductionSnapshot();productionDisplayStore.clear();}throw error;});
}

// Update only existing scoped display snapshots from an acknowledged report.
export function acceptProductionReview(report:any){for(const entry of [full,work,progress,progressAll,workspace,journal])entry.applyMutation((value:any)=>mergeProductionSavedResult(value,{reports:[report]}));}
