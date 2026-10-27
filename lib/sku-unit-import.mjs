import {analyzeBomUnitRows} from './bom-unit-rows.mjs';

const encoder=new TextEncoder();
const hex=bytes=>[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
const digest=async value=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(value)));
const write=(db,entity,key,payload,actor,now)=>db.prepare('INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(entity,record_key) DO NOTHING').bind(entity,key,JSON.stringify(payload),actor,now);
const vnTime=value=>new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(value)).replace(',','');

export async function importSkuUnitsFromBom(db,{rows,sourceFile},actor,catalog){
 if(!Array.isArray(rows)||rows.length>30000)throw new Error('Dữ liệu PDF không hợp lệ.');
 const fileName=String(sourceFile||'').trim().split(/[\\/]/).pop()?.slice(0,240)||'PDF BOM';
 const analysis=analyzeBomUnitRows(rows),fingerprint=JSON.stringify({sourceFile:fileName,analysis}),importId=`SKU_UNIT_BOM_${(await digest(fingerprint)).slice(0,20)}`;
 const prior=await db.prepare('SELECT report FROM sku_data_migrations WHERE id=?').bind(importId).first();
 if(prior)return {...JSON.parse(prior.report),alreadyImported:true};
 const master=new Map(catalog.filter(record=>!record.payload?._deleted).map(record=>[record.key,{...record.payload,code:record.payload.code||record.key}]));
 const stored=new Map((await db.prepare("SELECT record_key,payload FROM app_records WHERE entity='sku'").all()).results.map(row=>[row.record_key,row.payload]));
 const pdfCodes=new Set(Object.keys(analysis.units));
 const allPdfCodes=new Set(rows.map(row=>String(row?.productCode||'').trim()).filter(Boolean));
 const notInMaster=[...allPdfCodes].filter(code=>!master.has(code)).sort();
 const matched=[...allPdfCodes].filter(code=>master.has(code)).sort();
 const created=[],changed=[],unchanged=[],operationGroups=[],now=new Date().toISOString(),updatedAtVietnam=vnTime(now);
 for(const code of [...pdfCodes].sort()){
  const old=stored.has(code)?JSON.parse(stored.get(code)):master.get(code);if(!old)continue;
  const nextUnit=analysis.units[code],oldUnit=String(old.unit||'').trim();
  if(oldUnit===nextUnit){unchanged.push(code);if(!stored.has(code))operationGroups.push({code,statements:[write(db,'sku',code,old,actor,now)],check:false});continue;}
  const next={...old,unit:nextUnit,unit_source:'PDF BOM - Cấp 0',unit_source_file:fileName,unit_import_id:importId,unit_updated_by:actor,unit_updated_at:now,revision:Number(old.revision||0)+1};
  const history={sku:code,productName:old.name||'',productGroup:old.group||'',version:Number(next.version||0),action:'unit_pdf_import',oldUnit:oldUnit||null,newUnit:nextUnit,source:'PDF BOM - Cấp 0',sourceFile:fileName,changedBy:actor,changedAt:now,changedAtVietnam:updatedAtVietnam,importId,before:old,data:next};
  const oldRaw=stored.get(code);
  const sourceWrite=oldRaw===undefined
   ? write(db,'sku',code,next,actor,now)
   : db.prepare("UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity='sku' AND record_key=? AND payload=?").bind(JSON.stringify(next),actor,now,code,oldRaw);
  const historyWrite=db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'sku_history',?,?,?,? WHERE changes()=1 ON CONFLICT(entity,record_key) DO NOTHING").bind(`${importId}:${code}`,JSON.stringify(history),actor,now);
  operationGroups.push({code,statements:[sourceWrite,historyWrite],check:true});
  (oldUnit&&oldUnit!=='—'?changed:created).push({sku:code,name:old.name||'',group:old.group||'',oldUnit:oldUnit||null,newUnit:nextUnit});
 }
 let committed=0;
 for(let i=0;i<operationGroups.length;i+=40){
  const groups=operationGroups.slice(i,i+40),result=await db.batch(groups.flatMap(group=>group.statements));
  let position=0;for(const group of groups){
   if(group.check&&result[position].meta.changes!==1){const error=new Error(`SKU ${group.code} đã được người khác thay đổi. ${committed} SKU đã lưu trước xung đột; tải lại SKU Master rồi đối chiếu trước khi nhập tiếp.`);error.status=409;throw error;}
   if(group.check)committed++;position+=group.statements.length;
  }
 }
 const warnings=[
  ...notInMaster.map(productCode=>({productCode,message:'SKU không tồn tại trong SKU Master'})),
  ...analysis.missingLevel0.map(productCode=>({productCode,message:'Không tìm thấy Cấp 0'})),
  ...analysis.blankLevel0.map(productCode=>({productCode,message:'ĐVT tại Cấp 0 đang trống'})),
  ...analysis.duplicateLevel0.map(productCode=>({productCode,message:'Có nhiều dòng Cấp 0'})),
  ...analysis.conflictingLevel0.map(item=>({productCode:item.productCode,message:'Xung đột ĐVT tại Cấp 0',detail:item.units.join(' / ')})),
 ];
 const report={importId,sourceFile:fileName,source:'PDF BOM - Cấp 0',actor,updatedAt:now,updatedAtVietnam,totalProductCodes:analysis.totalProductCodes,matchedSku:matched.length,createdUnits:created.length,changedUnits:changed.length,unchangedUnits:unchanged.length,notInMaster:notInMaster.length,missingLevel0:analysis.missingLevel0.length,blankLevel0:analysis.blankLevel0.length,duplicateLevel0:analysis.duplicateLevel0.length,conflictingLevel0:analysis.conflictingLevel0.length,created,changed,unchanged,warnings};
 await db.batch([
  db.prepare('INSERT INTO sku_data_migrations(id,applied_at,report) VALUES(?,?,?)').bind(importId,now,JSON.stringify(report)),
  write(db,'admin_audit',crypto.randomUUID(),{action:'SKU_UNIT_BOM_IMPORT',actor,role:'SUPER_ADMIN',sourceFile:fileName,importId,at:now,before:null,after:{createdUnits:created.length,changedUnits:changed.length,unchangedUnits:unchanged.length,warnings:warnings.length}},actor,now)
 ]);
 return report;
}
