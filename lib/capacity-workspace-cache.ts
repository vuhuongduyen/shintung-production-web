import {productionBoundedRead} from './production-bounded-read.mjs';
import {productionDisplayStore} from './production-display-store.mjs';
import {apiFetch,clientReadGeneration,clientSessionGeneration,subscribeClientReadInvalidation} from './data-sync';
import {createCapacitySnapshotCache,validateCapacityLatest,validateCapacitySnapshot} from './capacity-snapshot-cache.mjs';

async function readJson(url:string,force:boolean){
 try{return await productionBoundedRead(apiFetch,url,{cache:force?'reload':'no-store'});}
 catch(error:any){if([401,403].includes(error?.status))productionDisplayStore.clear();throw error;}
}
const capacity=createCapacitySnapshotCache({
 fetchLatest:async force=>validateCapacityLatest(await readJson('/api/capacity?latest=1&bootstrap=1',force)),
 fetchWeek:async (week,force)=>validateCapacitySnapshot(await readJson(`/api/capacity?week=${week}`,force),week),
 getGeneration:clientReadGeneration,getSession:clientSessionGeneration,
});
subscribeClientReadInvalidation(reason=>{if(reason==='session')capacity.clear();});
export const subscribeCapacityReset=(listener:()=>void)=>capacity.subscribe(listener);
export const capacityResetVersion=()=>capacity.version();
export const capacityRestrictedError=()=>typeof window==='undefined'?null:capacity.restrictedError() as Error|null;
export const clearCapacitySnapshots=(error?:Error)=>{capacity.clear(error);if(error)productionDisplayStore.clear();};
const displayEntry=(entry:any)=>entry?{...entry,data:{...entry.data,permissions:{}}}:null;
export function retainedCapacity(week:string){return typeof window==='undefined'?null:capacity.snapshot(week)||displayEntry(productionDisplayStore.get('capacity:'+week));}
export function retainedCapacityLatest(){return typeof window==='undefined'?null:capacity.latestSnapshot()||productionDisplayStore.get('capacity:latest');}
export function initialCapacityWeek(fallback:string){
 const latest=retainedCapacityLatest(),week=latest?.data.week||fallback;
 return {week,ready:Boolean(latest),snapshot:latest?retainedCapacity(week):null,version:capacityResetVersion()};
}
export function readCapacityLatest(force=false){return typeof window==='undefined'?readJson('/api/capacity?latest=1',force).then(data=>({data:validateCapacityLatest(data),updatedAt:Date.now()})):capacity.readLatest(force).then((entry:{data:any;updatedAt:number})=>{if(entry.data.snapshot){capacity.remember(entry.data.week,entry.data.snapshot);productionDisplayStore.put('capacity:'+entry.data.week,{data:entry.data.snapshot,updatedAt:entry.updatedAt});}productionDisplayStore.put('capacity:latest',{data:{week:entry.data.week},updatedAt:entry.updatedAt});return entry;});}
export function readCapacityWeek(week:string,force=false){return typeof window==='undefined'?readJson(`/api/capacity?week=${week}`,force).then(data=>({data:validateCapacitySnapshot(data,week),updatedAt:Date.now()})):capacity.readWeek(week,force).then((entry:any)=>{productionDisplayStore.put('capacity:'+week,entry);return entry;});}
export function rememberCapacityWeek(week:string,data:Record<string,any>){return typeof window==='undefined'?{data:validateCapacitySnapshot(data,week),updatedAt:Date.now()}:capacity.remember(week,data);}
