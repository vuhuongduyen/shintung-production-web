import {productionApiFetch} from './production-api';
import {clientReadGeneration,subscribeClientReadInvalidation} from './data-sync';
import {createProductionSnapshotCache} from './production-snapshot-cache.mjs';
type Row=Record<string,any>;
const pages=new Map<string,ReturnType<typeof createProductionSnapshotCache<Row>>>();
export function clearProductionPages(){for(const cache of pages.values())cache.clear();pages.clear();}
subscribeClientReadInvalidation(reason=>{if(reason==='session')clearProductionPages();});
function entry(url:string,identity:string){
 const key=JSON.stringify([identity,url]);let cache=pages.get(key);
 if(!cache){cache=createProductionSnapshotCache<Row>({getGeneration:clientReadGeneration,fetcher:async()=>{
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),25000);
  try{
   const response=await productionApiFetch(url,{signal:controller.signal,cache:'no-store'});
   const data=await response.json();
   if(!response.ok)throw Object.assign(Error(data.error||'Không tải được danh sách báo công.'),{status:response.status});
   if(data.supported!==false&&(data.supported!==true||!Array.isArray(data.orders)||!Number.isSafeInteger(data.total)||!Number.isSafeInteger(data.page)||!data.totals||!data.rights))throw Error('Phản hồi danh sách báo công không hợp lệ.');
   return data;
  }catch(error:any){if(controller.signal.aborted)throw Error('Tải dữ liệu quá lâu. Bạn có thể chuyển trang hoặc bấm Thử lại.');throw error;}
  finally{clearTimeout(timeout);}
 }});pages.set(key,cache);
 if(pages.size>12){const oldest=pages.keys().next().value;if(oldest&&oldest!==key){pages.get(oldest)?.clear();pages.delete(oldest);}}
 }
 return cache;
}
export function cachedProductionPage(url:string,identity:string){return entry(url,identity).freshSnapshot();}
export function readProductionPage(url:string,identity:string,force=false){return entry(url,identity).read(force).catch(error=>{if(error?.status===401||error?.status===403)clearProductionPages();throw error;});}
