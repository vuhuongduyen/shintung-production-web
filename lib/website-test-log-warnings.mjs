// Review hints only. No writes, notifications, profiling, or account restrictions.
export const warningThresholds=Object.freeze({windowMs:300000,updates:20,deletes:5,actors:2,laborHourDelta:1,laborHourRatio:0.5});
const batch=/import|batch|bulk|nhập/i;
export function annotateTestLogWarnings(entries,config=warningThresholds){
 const ordered=entries.map(e=>({e,time:Date.parse(e.at)})).filter(p=>Number.isFinite(p.time)).sort((a,b)=>a.time-b.time||a.e.id.localeCompare(b.e.id));
 const transactionKey=(e,time)=>JSON.stringify([e.actorId,e.entity,e.action,time]);
 const transactionCounts=new Map();for(const {e,time} of ordered){const key=transactionKey(e,time);transactionCounts.set(key,(transactionCounts.get(key)||0)+1);}
 const inferredBatch=new Set(ordered.filter(({e,time})=>e.actorId&&transactionCounts.get(transactionKey(e,time))>1).map(({e})=>e.id));
 const hints=new Map(entries.map(e=>[e.id,[]]));
 const add=(e,code,evidence)=>hints.get(e.id).push({code,evidence});
 const frequency=new Map(),records=new Map(),emitted=new Map();
 const once=(key,now)=>{if(emitted.has(key)&&now-emitted.get(key)<=config.windowMs)return false;emitted.set(key,now);return true;};
 for(const {e,time:now} of ordered){
  const isBatch=e.batchOperation||inferredBatch.has(e.id)||batch.test(e.operation||'');
  if(e.actorId&&!isBatch&&(e.action==='update'||e.action==='delete')){
   const key=JSON.stringify([e.actorId,e.entity,e.action]);
   const group=frequency.get(key)||{rows:[],head:0};frequency.set(key,group);
   while(group.head<group.rows.length&&now-group.rows[group.head].time>config.windowMs)group.head++;
   // Legacy multi-row transactions share a timestamp: conservatively count once.
   if(group.rows.at(-1)?.time!==now)group.rows.push({e,time:now});
   const count=group.rows.length-group.head,threshold=e.action==='delete'?config.deletes:config.updates;
   if(count>=threshold&&once(`frequency:${key}`,now)){const recent=group.rows.slice(group.head).map(p=>p.e);add(e,e.action==='delete'?'rapid_deletes':'rapid_updates',{count,threshold,windowMinutes:config.windowMs/60000,eventIds:recent.map(p=>p.id),from:recent[0].at,to:e.at});}
  }
  if(e.actorId&&e.record&&!isBatch){
   const key=JSON.stringify([e.entity,e.record]);const group=records.get(key)||{rows:[],head:0,actors:new Map()};records.set(key,group);
   while(group.head<group.rows.length&&now-group.rows[group.head].time>config.windowMs){const old=group.rows[group.head++].e.actorId;const count=group.actors.get(old)-1;if(count)group.actors.set(old,count);else group.actors.delete(old);}
   group.rows.push({e,time:now});group.actors.set(e.actorId,(group.actors.get(e.actorId)||0)+1);
   if(group.actors.size>=config.actors&&once(`record:${key}`,now)){const recent=group.rows.slice(group.head).map(p=>p.e);add(e,'multiple_editors',{actors:[...group.actors.keys()],eventIds:recent.map(p=>p.id),windowMinutes:config.windowMs/60000,from:recent[0].at,to:e.at});}
  }
  if(e.entity==='labor_hours'&&e.action==='update'&&e.hasBefore&&e.hasAfter){
   const before=e.before?.laborHour,after=e.after?.laborHour;
   if(typeof before==='number'&&typeof after==='number'&&Number.isFinite(before)&&Number.isFinite(after)&&before>=0&&after>=0){
    const delta=Math.abs(after-before),ratio=before===0?null:delta/before;
    if(delta>=config.laborHourDelta&&(before===0||ratio>=config.laborHourRatio))add(e,'large_labor_hour_change',{field:'laborHour',before,after,absoluteDelta:delta,relativeChange:ratio,minimumDelta:config.laborHourDelta,minimumRatio:config.laborHourRatio});
   }
  }
 }
 return entries.map(e=>({...e,batchInferred:inferredBatch.has(e.id),batchOperation:!!e.batchOperation||inferredBatch.has(e.id)||batch.test(e.operation||''),warnings:hints.get(e.id)}));
}
