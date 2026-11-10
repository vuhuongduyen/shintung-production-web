import {readRecordPages} from './production-record-pages.mjs';
import {siteLaborHours} from '../../lib/site-labor-hours.mjs';
import {effectiveValueOn} from '../../lib/effective-dated-value.mjs';
import {outputDate} from '../../lib/production-output-summary.mjs';
export async function engineLaborBasis(db,skus,at){
 const keys=JSON.stringify([...new Set(skus.map(s=>String(s).trim().toUpperCase()))]);
 const scope="(entity='labor_hours' AND record_key IN (SELECT value FROM json_each(?))) OR (entity='labor_hours_history' AND upper(trim(json_extract(payload,'$.sku'))) IN (SELECT value FROM json_each(?)))";
 const rows=await readRecordPages(db,{where:scope,args:[keys,keys]});
 const snapshot=JSON.stringify(rows.map(r=>[r.entity,r.record_key,r.payload,r.updated_at]));
 if(new TextEncoder().encode(snapshot).length>8*1024*1024)throw Object.assign(Error('Lịch sử Giờ công quá lớn để chốt an toàn. Chưa lưu Engine; liên hệ quản trị để kiểm tra nguồn.'),{status:409});
 const wrap=r=>({key:r.record_key,payload:JSON.parse(r.payload),updatedAt:r.updated_at});
 const menu=siteLaborHours(rows.filter(r=>r.entity==='labor_hours').map(wrap),null,rows.filter(r=>r.entity==='labor_hours_history').map(wrap));
 const date=outputDate({completedAt:at}),bySku=new Map(menu.map(r=>[String(r.payload.sku||r.key).trim().toUpperCase(),r.payload]));
 const values=new Map(JSON.parse(keys).map(sku=>{const rate=bySku.get(sku),result=rate&&!rate.cancelled&&!rate._deleted&&rate.status!=='Đã hủy'?effectiveValueOn(rate.resolvedRateVersions||[],date):{ok:false,reason:'missing-labor-record'};return [sku,result.ok?{standardHours:result.basis.value,laborBasis:result.basis,laborBasisDate:date,laborBasisStatus:'resolved'}:{standardHours:null,laborBasis:null,laborBasisDate:date,laborBasisStatus:'missing',laborBasisReason:result.reason}];}));
 const sql=`(WITH actual AS MATERIALIZED (SELECT entity,record_key,payload,updated_at FROM app_records WHERE ${scope}), expected AS MATERIALIZED (SELECT value FROM json_each(?)) SELECT (SELECT count(*) FROM actual)=(SELECT count(*) FROM expected) AND NOT EXISTS(SELECT 1 FROM expected e WHERE NOT EXISTS(SELECT 1 FROM actual a WHERE a.entity=json_extract(e.value,'$[0]') AND a.record_key=json_extract(e.value,'$[1]') AND a.payload=json_extract(e.value,'$[2]') AND a.updated_at IS json_extract(e.value,'$[3]'))))`;
 return {values,sql,args:[keys,keys,snapshot]};
}
