// Every instance is local to one GET request. Never cache authentication or
// business records across requests, users, or writes.
export function observeReadDatabase(db) {
  const started = performance.now();
  const stats = { calls: 0, dbMs: 0, maxDbMs: 0, authMs: 0, principalMs: 0 };
  const originals = new WeakMap();
  const measure = async (operation, phase, entity) => {
    const before = performance.now();
    try { return await operation(); }
    finally {
      const elapsed = performance.now() - before;
      if (phase) stats[phase] += elapsed;
      else { stats.calls += 1; stats.dbMs += elapsed; stats.maxDbMs = Math.max(stats.maxDbMs, elapsed); if(entity){stats[entity+"Calls"]=(stats[entity+"Calls"]||0)+1;stats[entity+"Ms"]=(stats[entity+"Ms"]||0)+elapsed;} }
    }
  };
  // Log only fixed entity categories, never SQL, bindings or record identifiers.
  const measuredEntities=new Set(['sku','in_transit','production_event','production_report','production_history_import','capacity','production_schedule','employees','users','labor_hours','leadtime','leadtime_versions']);
  const statement = (target, sql='', values=[]) => {
    const selected=/entity\s*=\s*'([a-z_]+)'/.exec(sql)?.[1]||(/entity\s*=\s*\?/.test(sql)?values[0]:null);
    const entity=measuredEntities.has(selected)?selected:undefined;
    const wrapped = new Proxy(target, { get(object, key) {
      if (key === 'bind') return (...values) => statement(object.bind(...values),sql,values);
      if (['all', 'first', 'raw', 'run'].includes(key)) return (...args) => measure(() => object[key](...args),undefined,entity);
      const value = object[key];
      return typeof value === 'function' ? value.bind(object) : value;
    } });
    originals.set(wrapped, target);
    return wrapped;
  };
  const database = db?.prepare ? new Proxy(db, { get(object, key) {
    if (key === 'prepare') return sql => statement(object.prepare(sql),sql);
    if (key === 'batch') return statements => measure(() => object.batch(statements.map(item => originals.get(item) || item)));
    const value = object[key];
    return typeof value === 'function' ? value.bind(object) : value;
  } }) : db;
  const summary = () => {
    const totalMs = performance.now() - started;
    return { ...stats, totalMs, handlerMs: Math.max(0, totalMs - stats.authMs - stats.principalMs) };
  };
  return { database, measure, summary };
}

const sharedEntities = new Set(['production_event', 'production_report', 'production_history_import', 'capacity', 'production_schedule']);
const entityQuery = /^SELECT record_key,payload,updated_by,updated_at FROM app_records WHERE entity=\? ORDER BY updated_at( DESC)?,record_key$/;

// Workflow and transit need the same three entities with opposite timestamp
// ordering. Reuse a request's first successful read, retaining SQLite BINARY
// order for timestamps and the ascending record-key tie breaker in both views.
// This is one snapshot per entity, not a transaction across different entities.
export function workflowReadSnapshot(db) {
  const pages = new Map(), reads = new Map(), encoded = new Map(), encoder = new TextEncoder();
  const bytes = value => { if (!encoded.has(value)) encoded.set(value, encoder.encode(value)); return encoded.get(value); };
  const compare = (left, right) => {
    if (left === right) return 0;
    const a = bytes(left), b = bytes(right);
    for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i];
    return a.length - b.length;
  };
  return new Proxy(db, { get(object, key) {
    if (key !== 'prepare') { const value = object[key]; return typeof value === 'function' ? value.bind(object) : value; }
    return sql => {
      const match = entityQuery.exec(sql.replace(/\s+/g, ' ').trim());
      const prepared = object.prepare(sql);
      // Byte-bounded record pagination replaced the legacy whole-entity SQL.
      // Share identical pages only inside this authenticated GET request.
      const pageSql=sql.replace(/\s+/g,' ').trim();
      const paged=pageSql.startsWith('SELECT ')&&pageSql.includes(' FROM app_records WHERE (entity=?) AND ')&&pageSql.includes('ORDER BY entity,record_key');
      if(!match&&paged)return new Proxy(prepared,{get(statement,method){
        if(method!=='bind'){const value=statement[method];return typeof value==='function'?value.bind(statement):value;}
        return (...values)=>{const bound=statement.bind(...values);if(!sharedEntities.has(values[0]))return bound;
          return new Proxy(bound,{get(query,operation){if(operation!=='all'){const value=query[operation];return typeof value==='function'?value.bind(query):value;}
            return async()=>{const key=JSON.stringify([pageSql,values]);if(!pages.has(key))pages.set(key,query.all().catch(error=>{pages.delete(key);throw error;}));const result=await pages.get(key);return {...result,results:result.results.map(row=>({...row}))};};
          }});
        };
      }});
      if (!match) return prepared;
      return new Proxy(prepared, { get(statement, method) {
        if (method !== 'bind') { const value = statement[method]; return typeof value === 'function' ? value.bind(statement) : value; }
        return (...values) => {
          const bound = statement.bind(...values), entity = values[0];
          if (values.length !== 1 || !sharedEntities.has(entity)) return bound;
          return new Proxy(bound, { get(query, operation) {
            if (operation !== 'all') { const value = query[operation]; return typeof value === 'function' ? value.bind(query) : value; }
            return async () => {
              if (!reads.has(entity)) reads.set(entity, query.all().catch(error => { reads.delete(entity); throw error; }));
              const result = await reads.get(entity), direction = match[1] ? -1 : 1;
              return { ...result, results: result.results.map(row => ({ ...row })).sort((a, b) =>
                direction * compare(a.updated_at, b.updated_at) || compare(a.record_key, b.record_key)) };
            };
          } });
        };
      } });
    };
  } });
}
