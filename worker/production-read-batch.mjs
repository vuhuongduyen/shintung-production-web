// Created after authentication, for one GET only. Independent SELECTs queued
// in the same turn share a D1 round trip. Never cache a result across requests.
// Three byte-bounded payload pages per batch keep transport memory bounded.
export function productionReadBatch(db) {
  if (typeof db.batch !== 'function') return db;
  let queue = [], scheduled = false;
  const flush = async () => {
    scheduled = false;
    const pending = queue; queue = [];
    for (let i=0; i<pending.length; i+=9) {
      // Independent entity reads must not wait behind earlier batches. Keep
      // at most three byte-bounded batches in flight for this flush.
      await Promise.all([0,3,6].map(async offset=>{
        const group=pending.slice(i+offset,Math.min(i+offset+3,i+9));
        if(!group.length)return;
        try {
          const results = await db.batch(group.map(item=>item.statement));
          group.forEach((item,index)=>item.resolve(results[index]));
        } catch (error) { group.forEach(item=>item.reject(error)); }
      }));
    }
  };
  const enqueue = statement => new Promise((resolve,reject)=>{
    queue.push({statement,resolve,reject});
    if (!scheduled) { scheduled=true; queueMicrotask(flush); }
  });
  const wrap = statement => new Proxy(statement,{get(target,key){
    if (key==='bind') return (...values)=>wrap(target.bind(...values));
    if (key==='all') return ()=>enqueue(target);
    const value=target[key]; return typeof value==='function'?value.bind(target):value;
  }});
  return new Proxy(db,{get(target,key){
    if (key==='prepare') return sql=>/^\s*(?:SELECT\b|WITH\s+onspa_production_scope\s*\()/i.test(sql)?wrap(target.prepare(sql)):target.prepare(sql);
    const value=target[key]; return typeof value==='function'?value.bind(target):value;
  }});
}
