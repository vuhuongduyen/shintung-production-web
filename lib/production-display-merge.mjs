// Same verified scope only. A background write from a long-lived tab must not
// drop other menus or replace a newer entry that another tab has already saved.
export function mergeProductionDisplay(saved,incoming,{now=Date.now(),ttl=7*24*60*60*1000,limit=48,maxBytes=32*1024*1024,changed=[]}={}){
 const entries=new Map();
 for(const snapshot of [saved?.scope===incoming.scope?saved:null,incoming])for(const pair of snapshot?.entries||[]){
  if(!Array.isArray(pair)||pair.length!==2)continue;
  const [key,entry]=pair;
  if(typeof key!=='string'||!Number.isFinite(entry?.at)||entry.at>now||now-entry.at>=ttl)continue;
  if(!entries.has(key)||entries.get(key).at<entry.at||(snapshot===incoming&&changed.includes(key)&&entries.get(key).at===entry.at))entries.set(key,entry);
 }
 let bytes=0;const retained=[];
 for(const pair of [...entries].sort((a,b)=>b[1].at-a[1].at)){
  const size=JSON.stringify(pair[1]).length*2;
  if(retained.length<limit&&bytes+size<=maxBytes){retained.push(pair);bytes+=size;}
 }
 return {scope:incoming.scope,entries:retained.reverse()};
}
