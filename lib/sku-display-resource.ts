import {clientReadGeneration,clientSessionGeneration,subscribeClientReadInvalidation} from './data-sync';
import {recordFetch} from './record-fetch';
import {createSkuDisplayCache} from './sku-display-cache.mjs';

export type SkuDisplayRecord<T>={key:string;payload:T;updatedAt:string;revision?:string|null};
export type SkuDisplayState<T>={records:Array<SkuDisplayRecord<T>>|null;loading:boolean;error:Error|null;updatedAt:number|null};
async function read(force:boolean){
 const response=await recordFetch('/api/records?entity=sku',{cache:force?'reload':'no-store'});
 if(!response.ok)throw Object.assign(new Error('Không tải được dữ liệu SKU.'),{status:response.status});
 const data=await response.json();
 if(!Array.isArray(data.records))throw new Error('Dữ liệu SKU chưa hợp lệ. Vui lòng thử tải lại.');
 return data.records;
}
const cache=createSkuDisplayCache({read,getSession:clientSessionGeneration,getGeneration:clientReadGeneration});
subscribeClientReadInvalidation(reason=>{if(reason==='session')cache.clear();});
const empty={records:null,loading:false,error:null,updatedAt:null};
export function skuDisplayState<T>():SkuDisplayState<T>{return typeof window==='undefined'?empty:cache.snapshot();}
export function skuRecordSnapshot<T>(){return skuDisplayState<T>().records;}
export const subscribeSkuDisplay=(listener:()=>void)=>cache.subscribe(listener);
export function loadSkuRecords<T>(force=false):Promise<Array<SkuDisplayRecord<T>>>{return typeof window==='undefined'?read(force):cache.load(force);}
export function replaceSkuRecords<T>(records:Array<SkuDisplayRecord<T>>){if(typeof window!=='undefined')cache.replace(records);}
