// One refresh signal per browser wake/poll, irrespective of mounted menu count.
// Hidden workspaces keep their UI state and mark themselves dirty via notify.
export function createRefreshCoordinator({expire=()=>{},now=()=>Date.now(),wakeWindow=1000}={}) {
  const listeners=new Set();
  let lastRefresh=-Infinity;
  return {
    subscribe(notify,{poll=true,active=()=>Boolean(true)}={}) {
      const item={notify,poll,active};listeners.add(item);
      return ()=>listeners.delete(item);
    },
    refresh(reason='focus') {
      const eligible=[...listeners].filter(item=>reason!=='poll'||item.poll);
      if(!eligible.some(item=>item.active())||now()-lastRefresh<wakeWindow)return false;
      lastRefresh=now();
      // Expiry keeps an already-running read: focus is not a business mutation.
      expire();
      for(const item of eligible)item.notify();
      return true;
    },
  };
}
