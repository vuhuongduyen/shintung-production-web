import {effectiveValueOn,validBusinessDate} from './effective-dated-value.mjs';

// Quantities per day are not known. Never distribute them or average standards.
export function planLaborBasis(row,versions=[]){
 if(!validBusinessDate(row.start)||!validBusinessDate(row.end)||row.end<row.start)return {status:'missing',reason:'invalid-date',segments:[]};
 const cuts=[...new Set([row.start,...versions.filter(v=>v.status==='published').flatMap(v=>[v.validFrom,v.validTo]).filter(d=>validBusinessDate(d)&&d>row.start&&d<=row.end)])].sort();
 const segments=cuts.map((from,i)=>{const resolved=effectiveValueOn(versions,from);return {from,until:cuts[i+1]||null,through:i+1===cuts.length?row.end:null,...(resolved.ok?{basis:resolved.basis}:{reason:resolved.reason})};});
 if(segments.some(s=>!s.basis||typeof s.basis.value!=='number'||!Number.isFinite(s.basis.value)||s.basis.value<0))return {status:'missing',reason:'missing-or-ambiguous-rate',segments};
 if(new Set(segments.map(s=>s.basis.value)).size>1)return {status:'split-required',reason:'different-rates',segments};
 return {status:'resolved',value:segments[0].basis.value,segments};
}
export function applyPlanLaborBasis(row,standards){
 if(['ĐÃ CHỐT','ĐÃ CHUYỂN'].includes(row.status))return row;
 const rate=standards.get(String(row.sku||'').trim().toUpperCase());
 const basis=planLaborBasis(row,rate?.effectiveVersions||[]);
 return {...row,laborHour:basis.status==='resolved'?basis.value:null,planLaborBasis:basis};
}
