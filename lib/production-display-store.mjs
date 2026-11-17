// Display snapshots only, never authentication or an authority to write.
// One verified account/permission scope at a time; no credentials are stored.
export function createProductionDisplayStore({storage,sync=null,now=()=>Date.now(),ttl=7*24*60*60*1000,limit=12,maxBytes=32*1024*1024}) {
  let scope='',epoch=0,entries=new Map(),queue=Promise.resolve();
  const listeners=new Set(),sizes=new WeakMap();
  const notify=()=>{for(const fn of listeners)fn();};
  const enqueue=fn=>{queue=queue.then(fn).catch(()=>{});return queue;};
  function deactivate(){const changed=Boolean(scope)||entries.size>0;epoch++;scope='';entries.clear();if(changed)notify();}
  sync?.subscribe(message=>{if(message.scope===null?scope===message.previous:message.scope!==scope)deactivate();});
  function clear(){const previous=scope;deactivate();if(previous){enqueue(()=>storage.clear({scope:previous}));sync?.publish({scope:null,previous});}}
  async function activate(next){
    if(!next){clear();return;}
    if(next===scope)return;
    const revision=++epoch;scope=next;entries.clear();sync?.publish({scope:next});
    // Serialize behind a logout/old write; a late restore cannot resurrect it.
    const saved=await enqueue(()=>storage.read());
    if(revision!==epoch)return;
    if(saved?.scope===scope&&Array.isArray(saved.entries))for(const pair of saved.entries){
      if(!Array.isArray(pair)||pair.length!==2)continue;
      const [key,entry]=pair;
      if(typeof key==='string'&&Number.isFinite(entry?.at)&&entry?.at<=now()&&now()-entry.at<ttl&&!entries.has(key))entries.set(key,entry);
    }
    trim();persist(true);notify();
  }
  function trim(){
    let bytes=0;const keep=[];
    for(const [key,entry] of [...entries].reverse()){
      let size=sizes.get(entry);if(size===undefined){size=JSON.stringify(entry).length*2;sizes.set(entry,size);}
      if(keep.length<limit&&bytes+size<=maxBytes&&now()-entry.at<ttl){keep.push([key,entry]);bytes+=size;}
    }
    entries=new Map(keep.reverse());
  }
  function persist(claim=false){const revision=epoch,saved={scope,entries:[...entries]};enqueue(()=>revision===epoch&&scope?storage.write(saved,{claim,current:()=>revision===epoch&&scope===saved.scope}):undefined);}
  return {activate,clear,active:()=>Boolean(scope),subscribe(fn){listeners.add(fn);return()=>{listeners.delete(fn);};},
    get(key){const entry=scope&&entries.get(key);return entry&&now()-entry.at<ttl?entry.value:null;},
    put(key,value){if(!scope)return;const previous=entries.get(key),entry={at:now(),value};if(previous?.value===value&&sizes.has(previous))sizes.set(entry,sizes.get(previous));entries.delete(key);entries.set(key,entry);trim();persist();},
    settled:()=>queue,
  };
}

// IndexedDB avoids synchronous localStorage writes. Storage failures fall back
// to memory; display snapshots remain bounded and never authorize mutations.
function indexedStorage(){
  let database;
  async function open(){
    if(typeof indexedDB==='undefined')return null;
    if(!database)database=new Promise((resolve,reject)=>{const request=indexedDB.open('onspa-production-display-v1',1);request.onupgradeneeded=()=>request.result.createObjectStore('snapshot');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);request.onblocked=()=>reject(Error('Display storage unavailable'));});
    return database;
  }
  async function operation(mode,action){const db=await open();if(!db)return null;return new Promise((resolve,reject)=>{const tx=db.transaction('snapshot',mode),request=action(tx.objectStore('snapshot'));tx.oncomplete=()=>resolve(request.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
  async function write(value,{claim=false,current=()=>true}={}){
    const db=await open();if(!db||!current())return;
    return new Promise((resolve,reject)=>{const tx=db.transaction('snapshot','readwrite'),store=tx.objectStore('snapshot'),request=store.get('latest');
      // A delayed write from another tab cannot replace the latest verified scope.
      request.onsuccess=()=>{if(current()&&(claim||request.result?.scope===value.scope))store.put(value,'latest');};
      tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });
  }
  async function clear({scope}={}){const db=await open();if(!db)return;
    return new Promise((resolve,reject)=>{const tx=db.transaction('snapshot','readwrite'),store=tx.objectStore('snapshot'),request=store.get('latest');
      request.onsuccess=()=>{if(request.result?.scope===scope)store.delete('latest');};
      tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });
  }
  return {read:()=>operation('readonly',s=>s.get('latest')),write,clear};
}
function scopeChannel(){
  // Broadcast only the display boundary, never records or credentials. A peer
  // message can disable a store; only verified login may activate it again.
  try{if(typeof window==='undefined'||typeof window.BroadcastChannel!=='function')return null;
    const channel=new window.BroadcastChannel('onspa-production-display-session-v1');
    return {publish:message=>channel.postMessage(message),subscribe:listener=>{channel.onmessage=event=>{if(event.data?.scope===null||typeof event.data?.scope==='string')listener(event.data);};}};
  }catch{return null;}
}
export const productionDisplayStore=createProductionDisplayStore({storage:indexedStorage(),sync:scopeChannel()});
export function displayOnlyWorkflow(value){
  if(!value)return null;
  // Preserve role/Line for display calculations; all mutation capability flags
  // remain disabled until the first server response in this page session.
  return {...value,canCancelReportingDay:false,rights:Object.fromEntries(Object.entries(value.rights||{}).map(([key,value])=>[key,typeof value==='boolean'&&!['stageLive','crossLineView'].includes(key)?false:value]))};
}
