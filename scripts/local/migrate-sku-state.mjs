import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import vm from 'node:vm';import ts from 'typescript';
import {openDatabase,migrate,records,root} from './database.mjs';
import {confirmationStatus,usageStatus} from '../../lib/sku-state.mjs';
export function legacySkuSource(){
 const src=readFileSync(resolve(root,'app/page.tsx'),'utf8');
 const json=p=>JSON.parse(readFileSync(resolve(root,p),'utf8'));
 const ctx=vm.createContext({skuExtraData:json('app/sku-extra-data.json'),skuTpData:json('app/sku-tp-data.json'),skuProcessData:json('app/sku-process-data.json'),leadtimeBySku:new Map(json('app/leadtime-data.json').map(r=>[r.sku,r])),safetyBreakdown:()=>({total:0}),safetyDaysForSku:()=>0,activeSafetyRuleFor:()=>undefined});
 const a=src.indexOf('const skuDetailOverrides:'),b=src.indexOf('const purchasedSkuCodes');if(a<0||b<=a)throw Error('Không tìm được danh mục gốc; dừng migration.');
 vm.runInContext(ts.transpileModule(src.slice(a,b).split('const BusinessSkuContext')[0]+'\nglobalThis.master=skus;',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ctx);return ctx.master;
}
export async function migrateSkuStates(db,legacy){
 const id='SKU_STATE_LEGACY_V1';const done=await db.prepare('SELECT report FROM sku_data_migrations WHERE id=?').bind(id).first();if(done)return {alreadyApplied:true,...JSON.parse(done.report)};
 const existing=(await records(db)).filter(r=>r.entity==='sku');const map=new Map(legacy.map(p=>[p.code.toUpperCase(),p]));for(const r of existing)map.set(r.record_key,JSON.parse(r.payload));
 const now=new Date().toISOString(),statements=[],report={total:map.size,legacyConfirmed:0,pendingPreserved:0,confirmedPreserved:0,at:now};
 for(const [code,old] of map){if(old._deleted)continue;let p={...old,revision:(old.revision||0)+1};const active=usageStatus(old)==='Đang sử dụng',confirmed=confirmationStatus(old)==='Đã xác nhận';
  if(active){report.legacyConfirmed+=!confirmed?1:0;const actor=old.confirmed_by||old.confirmedBy;const at=old.confirmed_at||old.confirmedAt;Object.assign(p,{status:'Đã xác nhận',confirmation_status:'Đã xác nhận',usage_status:'Đang sử dụng',confirmation_source:actor&&at?(old.confirmation_source||'LEGACY_EXISTING'):'LEGACY_MIGRATION',confirmed_by:actor&&at?actor:'SYSTEM_MIGRATION',confirmed_at:actor&&at?at:now});}
  else if(confirmed){report.confirmedPreserved++;Object.assign(p,{confirmation_status:'Đã xác nhận',usage_status:old.usage_status||'Đang sử dụng',confirmation_source:old.confirmation_source||'LEGACY_EXISTING',confirmed_by:old.confirmed_by||old.confirmedBy||'SYSTEM_MIGRATION',confirmed_at:old.confirmed_at||old.confirmedAt||now});if(!old.confirmedBy&&!old.confirmed_by)p.confirmation_source='LEGACY_MIGRATION';}
  else{report.pendingPreserved++;Object.assign(p,{status:'Chờ xác nhận',confirmation_status:'Chờ xác nhận',usage_status:old.status==='Ngừng sử dụng'?'Ngừng sử dụng':'Chưa sử dụng'});}
  p.confirmedBy=p.confirmed_by||null;p.confirmedAt=p.confirmed_at||null;
  statements.push(db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?) ON CONFLICT(entity,record_key) DO UPDATE SET payload=excluded.payload,updated_by=excluded.updated_by,updated_at=excluded.updated_at').bind('sku',code,JSON.stringify(p),'SYSTEM_MIGRATION',now));
  statements.push(db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('sku_history',`${id}:${code}`,JSON.stringify({sku:code,action:'legacy_migration',migrationId:id,source:'LEGACY_MIGRATION',before:old,data:p,changedBy:'SYSTEM_MIGRATION',changedAt:now,statusBefore:confirmationStatus(old),statusAfter:p.confirmation_status,usageBefore:usageStatus(old),usageAfter:p.usage_status}),'SYSTEM_MIGRATION',now));
 }
 statements.push(db.prepare('INSERT INTO sku_data_migrations VALUES(?,?,?)').bind(id,now,JSON.stringify(report)));await db.batch(statements);return report;
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(root,'scripts/local/migrate-sku-state.mjs')){const c=await openDatabase();try{await migrate(c.db);const report=await migrateSkuStates(c.db,legacySkuSource());mkdirSync(resolve(root,'backups/test'),{recursive:true});writeFileSync(resolve(root,'backups/test/sku-state-migration-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}finally{await c.close();}}
