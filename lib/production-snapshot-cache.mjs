// Memory only. A mutation advances the read generation; a session reset also
// cancels old consumers so data can never cross an authenticated session.
export class ProductionReadCancelled extends Error {
  constructor() {
    super('Phiên làm việc đã thay đổi. Vui lòng tải lại dữ liệu.');
    this.name = 'ProductionReadCancelled';
  }
}

export function isProductionReadCancelled(error) {
  return error instanceof ProductionReadCancelled;
}

/**
 * @template T
 * @param {{fetcher:(force:boolean)=>Promise<T>, ttl?:number, now?:()=>number, getGeneration?:()=>number}} options
 */
export function createProductionSnapshotCache({fetcher, ttl=30000, now=()=>Date.now(), getGeneration=()=>0}) {
  /** @type {T|null} */
  let snapshot = null;
  let signature = null;
  /** @type {Promise<T>|null} */
  let pending = null;
  let loadedAt = -Infinity;
  let generation = 0;
  let session = 0;
  let sourceGeneration = getGeneration();

  function invalidate() {
    generation++;
    pending = null;
    loadedAt = -Infinity;
  }
  function syncGeneration() {
    const current = getGeneration();
    if (current !== sourceGeneration) {
      sourceGeneration = current;
      invalidate();
    }
  }
  function clear() {
    session++;
    invalidate();
    snapshot = null;
    signature = null;
    sourceGeneration = getGeneration();
  }
  /** @returns {Promise<T>} */
  function read(force=false) {
    syncGeneration();
    // A force refresh joins the current generation, rather than queuing a
    // second read behind it. Only a write/reset makes that pending read stale.
    if (pending) return pending;
    if (!force && snapshot !== null && now()-loadedAt < ttl) return Promise.resolve(snapshot);
    const revision = generation;
    const requestSession = session;
    const request = Promise.resolve().then(() => fetcher(force)).then(body => {
      syncGeneration();
      if (requestSession !== session) throw new ProductionReadCancelled();
      if (revision !== generation) return read();
      const nextSignature = JSON.stringify(body);
      if (signature !== nextSignature) { snapshot = body; signature = nextSignature; }
      loadedAt = now();
      return snapshot;
    }, error => {
      syncGeneration();
      if (requestSession !== session) throw new ProductionReadCancelled();
      // A response from before a write, including an old failure, must not
      // replace the current view or invalidate a newer successful response.
      if (revision !== generation) return read();
      if (error?.status === 401 || error?.status === 403) clear();
      throw error;
    }).finally(() => {
      if (pending === request) pending = null;
    });
    pending = request;
    return request;
  }
  return {
    snapshot() { syncGeneration(); return snapshot; },
    freshSnapshot() { syncGeneration(); return now()-loadedAt < ttl ? snapshot : null; },
    read,
    clear,
  };
}
