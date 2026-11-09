import {recordRevision} from './record-revision.mjs';
export const engineBasisEntities=['leadtime','leadtime_versions','safety_rules','sku'];
export const engineBasisScope="entity IN ('leadtime','leadtime_versions','safety_rules','sku')";
export async function engineSourceRevisions(db) {
 const rows=(await db.prepare(`SELECT entity,record_key,payload FROM app_records WHERE ${engineBasisScope} ORDER BY entity,record_key`).all()).results;
 return Object.fromEntries(await Promise.all(engineBasisEntities.map(async entity=>[entity,await Promise.all(rows.filter(r=>r.entity===entity).map(async r=>({key:r.record_key,revision:await recordRevision(r.payload)})))])));
}
export function sameEngineRevisions(a,b) {
 if(!a || typeof a!=='object')return false;
 const canonical=rows=>Array.isArray(rows)?JSON.stringify([...rows].sort((x,y)=>String(x.key).localeCompare(String(y.key))).map(r=>[r.key,r.revision])):null;
 return engineBasisEntities.every(entity=>canonical(a[entity])!==null&&canonical(a[entity])===canonical(b[entity]));
}
