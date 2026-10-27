import {readFileSync,writeFileSync} from 'node:fs';import {resolve} from 'node:path';
import {openDatabase,records,sha256} from './database.mjs';
const file=process.argv[2];if(!file)throw Error('Cần file đối chiếu đơn vị tính đã kiểm tra.');
const bytes=readFileSync(resolve(file)),input=JSON.parse(bytes);if(!input.units||Object.keys(input.conflicts||{}).length)throw Error('Đơn vị tính chưa giải quyết xung đột.');
const c=await openDatabase();try{
 const id='SKU_UNIT_PDF_'+sha256(bytes).slice(0,16);if(await c.db.prepare('SELECT id FROM sku_data_migrations WHERE id=?').bind(id).first()){console.log('Already applied');process.exitCode=0;}
 else{
 const all=await records(c.db),masters=all.filter(r=>r.entity==='sku'),now=new Date().toISOString(),ops=[],changed=[],matched=[],notInPdf=[],known=new Set(masters.map(r=>r.record_key));
 for(const r of masters){const old=JSON.parse(r.payload);if(old._deleted)continue;const unit=input.units[r.record_key];if(!unit){notInPdf.push(r.record_key);continue;}matched.push(r.record_key);if(old.unit===unit)continue;
 const p={...old,unit,unit_source:input.source,unit_source_sha256:sha256(bytes),revision:(old.revision||0)+1};
 ops.push(c.db.prepare('UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity=? AND record_key=?').bind(JSON.stringify(p),'SYSTEM_PDF_IMPORT',now,'sku',r.record_key));
 ops.push(c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('sku_history',`${id}:${r.record_key}`,JSON.stringify({sku:r.record_key,action:'unit_pdf_import',source:input.source,changedAt:now,changedBy:'SYSTEM_PDF_IMPORT',before:old,data:p}),'SYSTEM_PDF_IMPORT',now));changed.push({sku:r.record_key,before:old.unit,after:unit});
 }
 const report={at:now,matched:matched.length,changed,notInPdf,pdfOnly:Object.keys(input.units).filter(k=>!known.has(k)),source:input.source};ops.push(c.db.prepare('INSERT INTO sku_data_migrations VALUES(?,?,?)').bind(id,now,JSON.stringify(report)));await c.db.batch(ops);writeFileSync('backups/test/sku-unit-import-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({matched:matched.length,changed:changed.length,notInPdf:notInPdf.length,pdfOnly:report.pdfOnly.length}));
 }
}finally{await c.close();}
