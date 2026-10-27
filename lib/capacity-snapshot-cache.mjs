// Capacity business data stays in bounded browser memory, never localStorage.
export class CapacityReadCancelled extends Error {
  constructor(){super('Phiên làm việc đã thay đổi. Vui lòng tải lại Capacity.');this.name='CapacityReadCancelled';}
}
export const isCapacityReadCancelled=error=>error instanceof CapacityReadCancelled;
export function validCapacityWeek(week){
  if(typeof week!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(week))return false;
  const date=new Date(`${week}T00:00:00Z`);
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===week&&date.getUTCDay()===1;
}
export function validateCapacitySnapshot(data,week){
  if(!validCapacityWeek(week)||!data||data.week!==week||!Number.isSafeInteger(data.revision)||data.revision<0||!Array.isArray(data.rows)||!Array.isArray(data.employees)||!data.permissions||typeof data.permissions!=='object'||Array.isArray(data.permissions)||data.rows.some(row=>!row||row.week!==week||typeof row.line!=='string'||!row.input||typeof row.input!=='object'||Array.isArray(row.input))){
    throw new Error('Dữ liệu Capacity chưa hợp lệ. Vui lòng thử tải lại.');
  }
  return data;
}
export function validateCapacityLatest(data){
  if(!data||!(data.week===null||validCapacityWeek(data.week)))throw new Error('Tuần Capacity mới nhất chưa hợp lệ. Vui lòng thử tải lại.');
  return data;
}
/** @template T
 * @param {{fetchLatest:(force:boolean)=>Promise<{week:string|null}>, fetchWeek:(week:string,force:boolean)=>Promise<T>, getSession?:()=>number, getGeneration?:()=>number, now?:()=>number, ttl?:number, limit?:number}} options
 */
export function createCapacitySnapshotCache({fetchLatest,fetchWeek,getSession=()=>0,getGeneration=()=>0,now=()=>Date.now(),ttl=30000,limit=8}){
  const weeks=new Map(),pending=new Map(),listeners=new Set();
  let latest=null,session=getSession(),generation=getGeneration(),epoch=0,version=0,restrictedError=null;
  function notify(){version++;for(const listener of listeners)listener();}
  /** @param {Error|null} [error] */
  function clear(error=null){epoch++;pending.clear();weeks.clear();latest=null;session=getSession();generation=getGeneration();restrictedError=error;notify();}
  function sync(){if(session!==getSession())clear();else if(generation!==getGeneration()){generation=getGeneration();pending.clear();}}
  function snapshot(week){sync();const entry=weeks.get(week);if(entry){weeks.delete(week);weeks.set(week,entry);}return entry||null;}
  function latestSnapshot(){sync();return latest;}
  function read(key,force=false){
    sync();if(pending.has(key))return pending.get(key);
    const cached=key==='latest'?latest:weeks.get(key);
    if(!force&&cached&&cached.generation===generation&&now()-cached.updatedAt<ttl)return Promise.resolve(cached);
    const requestEpoch=epoch,requestSession=session,requestGeneration=generation;
    const request=Promise.resolve().then(()=>key==='latest'?fetchLatest(force):fetchWeek(key,force)).then(data=>{
      sync();if(requestEpoch!==epoch||requestSession!==session)throw new CapacityReadCancelled();
      if(requestGeneration!==generation)return read(key);
      if(key==='latest')validateCapacityLatest(data);else validateCapacitySnapshot(data,key);
      const previous=key==='latest'?latest:weeks.get(key);
      if(previous&&JSON.stringify(previous.data)===JSON.stringify(data))data=previous.data;
      const entry={data,updatedAt:now(),generation};restrictedError=null;
      if(key==='latest')latest=entry;else {weeks.delete(key);weeks.set(key,entry);while(weeks.size>Math.max(1,limit))weeks.delete(weeks.keys().next().value);}
      return entry;
    },error=>{
      sync();if(requestEpoch!==epoch||requestSession!==session)throw new CapacityReadCancelled();
      if(requestGeneration!==generation)return read(key);
      if(error?.status===401||error?.status===403)clear(error);
      throw error;
    }).finally(()=>{if(pending.get(key)===request)pending.delete(key);});
    pending.set(key,request);return request;
  }
  return {snapshot,latestSnapshot,readWeek:(week,force=false)=>read(week,force),readLatest:(force=false)=>read('latest',force),clear,
    version(){sync();return version;},restrictedError(){return restrictedError;},
    subscribe(listener){listeners.add(listener);return ()=>listeners.delete(listener);},
    // Successful writes contain a server-validated snapshot. Draft rows never enter this store.
    remember(week,data){sync();validateCapacitySnapshot(data,week);const previous=weeks.get(week);if(previous&&JSON.stringify(previous.data)===JSON.stringify(data))data=previous.data;const entry={data,updatedAt:now(),generation};weeks.delete(week);weeks.set(week,entry);while(weeks.size>Math.max(1,limit))weeks.delete(weeks.keys().next().value);return entry;},
  };
}
// Dirty forms retain their original revision so a later save still detects conflicts.
export function reconcileCapacityRefresh(current,incoming,dirty){return dirty&&current&&current.week===incoming.week?{...current,permissions:incoming.permissions}:incoming;}
