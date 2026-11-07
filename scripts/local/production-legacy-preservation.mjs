import {readRecordPages} from './production-record-pages.mjs';
import {preservationModel} from '../../lib/production-legacy-preservation.mjs';
import {attendancePrefixModel} from '../../lib/production-attendance-prefix.mjs';
const borrowedAttendanceFields=['id','name','line','active','include','calendarHc','calendarOt','absentHc','absentOt','hc','ot','helper','otherWork','transferFromHours'];
const projectMonth=(m,line)=>{if(!line)return m;const allowed=m.lines[line];return {...m,lines:{[line]:m.kind===attendancePrefixModel&&allowed?{...allowed,people:allowed.people.map(p=>p.line===line?p:Object.fromEntries(borrowedAttendanceFields.filter(k=>p[k]!==undefined).map(k=>[k,p[k]])))}:allowed}};};
export async function readLegacyPreservation(db,policy,actor,{full=true}={}){
 if(!policy?.active||!policy.legacySnapshotId||policy.intakeModel==='server-receipt-quantity-v1')return null;
 const snapshotId=policy.legacySnapshotId,prefix=snapshotId+':',upper=snapshotId+';';
 const read=async entity=>(await readRecordPages(db,{where:'entity=? AND record_key>=? AND record_key<?',args:[entity,prefix,upper]})).map(r=>JSON.parse(r.payload));
 const [basis,monthly,orders]=await Promise.all([full?read('production_legacy_basis'):[],full?read('production_legacy_month'):[],read('production_legacy_order')]);
 return {snapshotId,basis:basis.filter(b=>!actor.line||b.line===actor.line),attendancePrefix:monthly.find(m=>m.kind===attendancePrefixModel),monthly:monthly.map(({integrity,livePrefixMatches,...m})=>projectMonth(m,actor.line)),orders,required:full,historyProtection:{requiredBeforeMonth:policy.effectiveFrom.slice(0,7),cutoverDate:policy.effectiveFrom,snapshotId}};
}
export function preservationManifestValid(manifest,policy){
 return manifest?.id===policy.legacySnapshotId&&manifest?.kind===preservationModel&&manifest.status==='complete'&&manifest.cutoverDate===policy.effectiveFrom&&['earned','reportPresentation','monthlyAttendance','orderMetadata','cutoverMonthAttendance'].every(k=>manifest.scope?.[k]===true);
}
