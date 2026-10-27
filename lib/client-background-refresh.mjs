// A background reader owns one request, even when focus and a timer coincide.
// A real change during that request queues ONE reread; visibility does not.
export function createBackgroundRefresh({read,apply,visible=()=>true,now=()=>Date.now(),minimumInterval=1000}) {
  let pending=null,changed=false,disposed=false,lastStarted=-Infinity;
  const refresh=({invalidate=false}={})=>{
    if(disposed||!visible())return Promise.resolve();
    if(pending){if(invalidate)changed=true;return pending;}
    if(!invalidate&&now()-lastStarted<minimumInterval)return Promise.resolve();
    pending=(async()=>{
      do {
        changed=false;lastStarted=now();
        try {const result=await read();if(!disposed&&!changed)apply(result);}
        catch(error){if(!changed)throw error;}
      } while(changed&&!disposed&&visible());
    })().finally(()=>{pending=null;});
    return pending;
  };
  return {refresh,dispose(){disposed=true;changed=false;}};
}
