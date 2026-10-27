import {isProductionReadCancelled} from './production-snapshot-cache.mjs';

/**
 * Read lifecycle shared by the mounted production workspace and its tests.
 * Hiding a tab keeps its data and UI alive, but defers new reads until activation.
 * @template T
 * @param {{read:(force:boolean)=>Promise<T>, initial?:T|null}} options
 */
export function createProductionWorkspaceReader({read, initial=null}) {
  /** @type {{value:T|null, loading:boolean, error:Error|null}} */
  let state = {value:initial, loading:initial === null, error:null};
  /** @type {Set<(state:{value:T|null, loading:boolean, error:Error|null})=>void>} */
  const listeners = new Set();
  let active = false;
  let started = false;
  let dirty = false;
  let revision = 0;
  function publish(next) {
    state = next;
    for (const listener of listeners) listener(state);
  }
  async function refresh(force=true) {
    dirty = true;
    if (!active) return false;
    dirty = false;
    started = true;
    const requestRevision = ++revision;
    publish({...state, loading:true, error:null});
    try {
      const value = await read(force);
      if (requestRevision === revision) publish({value, loading:false, error:null});
      return true;
    } catch (error) {
      if (requestRevision === revision) {
        const discard = isProductionReadCancelled(error) || error?.status === 401 || error?.status === 403;
        publish({value:discard ? null : state.value, loading:false, error:error instanceof Error ? error : new Error('Không tải được dữ liệu sản xuất.')});
      }
      return false;
    }
  }
  return {
    getState: () => state,
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    setActive(value) {
      const activated = value && !active;
      active = value;
      return active && (activated || !started || dirty) ? refresh(dirty) : Promise.resolve(false);
    },
    refresh,
  };
}
