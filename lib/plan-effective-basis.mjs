import {effectiveValueOn,validBusinessDate} from './effective-dated-value.mjs';

export const planReferenceDate=(instant=new Date().toISOString())=>new Date(Date.parse(instant)+25200000).toISOString().slice(0,10);
// Planning is an estimate at confirmation, not a distribution of output by day.
// Drafts preview today's GMT+7 basis; the server captures its actual close date.
export function planLaborBasis(row,versions=[],businessDate=planReferenceDate()){
 if(!validBusinessDate(businessDate))return {status:'missing',reason:'invalid-date',businessDate,segments:[]};
 const resolved=effectiveValueOn(versions,businessDate);
 if(!resolved.ok||typeof resolved.basis.value!=='number'||!Number.isFinite(resolved.basis.value)||resolved.basis.value<0)return {status:'missing',reason:resolved.reason||'invalid-rate',businessDate,segments:[]};
 return {kind:'plan-close-labor-v2',status:'resolved',businessDate,value:resolved.basis.value,basis:resolved.basis,segments:[{from:businessDate,until:null,through:businessDate,basis:resolved.basis}]};
}
export function applyPlanLaborBasis(row,standards,businessDate=planReferenceDate()){
 if(['ĐÃ CHỐT','ĐÃ CHUYỂN'].includes(row.status))return row;
 const rate=standards.get(String(row.sku||'').trim().toUpperCase());
 const basis=planLaborBasis(row,rate?.resolvedRateVersions||rate?.effectiveVersions||[],businessDate);
 return {...row,laborHour:basis.status==='resolved'?basis.value:null,planLaborBasis:basis};
}
