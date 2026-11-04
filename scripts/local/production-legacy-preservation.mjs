import {readRecordPages} from './production-record-pages.mjs';
import {preservationModel} from '../../lib/production-legacy-preservation.mjs';
export async function readLegacyPreservation(db,policy,actor,{full=true}={}){
 if(!policy?.active||!policy.legacySnapshotId)return null;
 const snapshotId=policy.legacySnapshotId,prefix=snapshotId+':',upper=snapshotId+';';
 const read=async entity=>(await readRecordPages(db,{where:'entity=? AND record_key>=? AND record_key<?',args:[entity,prefix,upper]})).map(r=>JSON.parse(r.payload));
 const [basis,monthly,orders]=await Promise.all([full?read('production_legacy_basis'):[],full?read('production_legacy_month'):[],read('production_legacy_order')]);
 return {snapshotId,basis:basis.filter(b=>!actor.line||b.line===actor.line),monthly:monthly.map(m=>({...m,lines:actor.line?{[actor.line]:m.lines[actor.line]}:m.lines})),orders,required:full,historyProtection:{requiredBeforeMonth:policy.effectiveFrom.slice(0,7),snapshotId}};
}
export function preservationManifestValid(manifest,policy){
 return manifest?.id===policy.legacySnapshotId&&manifest?.kind===preservationModel&&manifest.status==='complete'&&manifest.cutoverDate===policy.effectiveFrom&&['earned','reportPresentation','monthlyAttendance','orderMetadata'].every(k=>manifest.scope?.[k]===true);
}
