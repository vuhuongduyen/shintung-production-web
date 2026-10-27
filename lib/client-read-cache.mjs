// Memory only, one browser session. No server-side or persistent record cache.
export function createReadCache({ttl=10000,limit=24,now=()=>Date.now()}={}) {
  const entries=new Map();let generation=0;
  return {
    clear(){generation++;entries.clear();},
    expire(){for(const entry of entries.values())if(!entry.pending)entry.at=-Infinity;},
    async read(key,fetcher,{fresh=false}={}) {
      const old=entries.get(key);
      if(old?.pending)return (await old.pending).clone();
      if(!fresh&&old?.response&&now()-old.at<ttl)return old.response.clone();
      const epoch=generation;const entry={at:0,response:null,pending:null};
      entry.pending=Promise.resolve().then(fetcher).then(response=>{
        if(response.ok&&epoch===generation){entry.response=response.clone();entry.at=now();}else if(entries.get(key)===entry)entries.delete(key);
        return response;
      }).catch(error=>{if(entries.get(key)===entry)entries.delete(key);throw error;}).finally(()=>{entry.pending=null;});
      entries.set(key,entry);
      if(entries.size>limit){for(const [k,v] of entries){if(!v.pending&&k!==key){entries.delete(k);break;}}}
      return (await entry.pending).clone();
    }
  };
}
