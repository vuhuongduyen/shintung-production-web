import {productionApiFetch} from './production-api';
import {clientSessionGeneration,clientReadGeneration,subscribeClientReadInvalidation} from './data-sync';
let retained:any=null,pending:Promise<any>|null=null,loadedAt=0,generation=-1;
subscribeClientReadInvalidation(reason=>{pending=null;if(reason==='session'){retained=null;loadedAt=0;}});
export function retainedAllocation(){return typeof window==='undefined'?null:retained;}
export async function readAllocationWorkspace(force=false):Promise<any>{
 if(pending)return pending;
 if(!force&&retained&&generation===clientReadGeneration()&&Date.now()-loadedAt<15000)return retained;
 const session=clientSessionGeneration(),readGeneration=clientReadGeneration();
 const request=(async()=>{
  const response=await productionApiFetch('/api/production-allocation',{cache:force?'reload':'no-store'});
  const result=await response.json().catch(()=>({error:'Không đọc được dữ liệu Điều phối nhân sự.'}));
  if(!response.ok){if([401,403].includes(response.status))retained=null;throw Object.assign(Error(result.error||'Không tải được Điều phối nhân sự.'),{status:response.status});}
  if(!Array.isArray(result.offers)||!Array.isArray(result.candidates)||!Array.isArray(result.sourceLines)||!Number.isInteger(result.revision)||!['C','AB','ADMIN'].includes(result.group))throw Error('Chưa xác minh được dữ liệu Điều phối nhân sự. Vui lòng tải lại.');
  if(session!==clientSessionGeneration())throw Error('Phiên làm việc đã thay đổi.');
  if(readGeneration!==clientReadGeneration()){pending=null;return readAllocationWorkspace(true);}
  if(!retained||JSON.stringify(retained)!==JSON.stringify(result))retained=result;
  loadedAt=Date.now();generation=readGeneration;return retained;
 })();pending=request;
 try{return await request;}finally{if(pending===request)pending=null;}
}
