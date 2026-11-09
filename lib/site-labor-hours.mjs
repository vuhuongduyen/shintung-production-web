import {projectCancelledMaster} from './basic-master.mjs';
import {effectiveValueOn} from './effective-dated-value.mjs';
import base from '../app/labor-hours-data.json' with {type:'json'};

const source='FORECAST SX 082026 - GIO_CONG.pdf';

// Only callers asking for a current/date-specific master projection pass a
// businessDate. Legacy preservation readers keep their observed stored scalar.
export function siteLaborHours(records=[],businessDate=null) {
 const map=new Map(base.map(item=>[item.sku,{key:item.sku,payload:{sku:item.sku,laborHour:Number(item.laborHour),note:item.note||'',source:item.source||source,version:1,configuredAt:'2026-09-17T00:00:00.000Z'},updatedBy:'PDF_IMPORT',updatedAt:'2026-09-17T00:00:00.000Z'}]));
 for(const record of records)map.set(String(record.key).toUpperCase(),record);
 return [...map.values()].map(row=>{
  let payload=row.payload;
  if(businessDate&&payload.effectiveVersions?.length&&!payload.cancelled&&payload.status!=='Đã hủy'){
   const resolved=effectiveValueOn(payload.effectiveVersions,businessDate);
   payload={...payload,laborHour:resolved.ok?resolved.basis.value:null,currentRateDate:businessDate,currentRateIssue:resolved.ok?null:resolved.reason};
  }
  return {...row,payload:projectCancelledMaster('labor_hours',payload)};
 });
}

export function siteLaborHoursHistory(records=[],sku='') {
 const wanted=String(sku||'').trim().toUpperCase();
 const initial=base.filter(item=>!wanted||item.sku===wanted).map(item=>({
  key:`PDF:${item.sku}:V1`,
  payload:{id:`PDF:${item.sku}:V1`,sku:item.sku,version:1,oldLaborHour:null,newLaborHour:Number(item.laborHour),oldNote:'',newNote:item.note||'',reason:'Khởi tạo từ PDF giờ công',actor:'PDF_IMPORT',at:'2026-09-17T00:00:00.000Z',source:item.source||source},
  updatedBy:'PDF_IMPORT',updatedAt:'2026-09-17T00:00:00.000Z'
 }));
 const live=records.filter(record=>!wanted||String(record.payload?.sku||'').toUpperCase()===wanted);
 return [...live,...initial].sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
}

export const laborHoursImportSummary={pdfRows:419,matched:base.length,missing:79,duplicates:0,source};
