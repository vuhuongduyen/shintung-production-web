export {isSuperAdmin,storeFile} from '../../lib/file-store.mjs';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {zipSync} from 'fflate';
import {root,sha256} from './database.mjs';
import {rejectSecrets} from '../handoff/safety.mjs';
import {canonicalMetadata} from '../../lib/r2-backup-metadata.mjs';

export async function allObjects(bucket){
 const result=[];let cursor;
 do{const page=await bucket.list({cursor});result.push(...page.objects);cursor=page.truncated?page.cursor:undefined;}while(cursor);
 return result.sort((a,b)=>a.key.localeCompare(b.key));
}
const modules=new Set(['base-forecast','demand-event','warehouse','bom','reports','attachments']);
export async function storageStatus(db,bucket){
 const entities=(await db.prepare('SELECT entity,count(*) AS count FROM app_records GROUP BY entity ORDER BY entity').all()).results;
 const objects=await allObjects(bucket),files=objects.filter(o=>!o.key.startsWith('backups/'));
 const metadata=(await db.prepare('SELECT * FROM file_objects ORDER BY object_key').all()).results;
 const problems=[];
 for(const row of metadata){const object=await bucket.get(row.object_key);if(!object)problems.push(`Thiếu tệp: ${row.object_key}`);else if(sha256(Buffer.from(await object.arrayBuffer()))!==row.checksum)problems.push(`Sai checksum: ${row.object_key}`);}
 for(const file of files)if(!metadata.some(r=>r.object_key===file.key))problems.push(`Tệp chưa có metadata D1: ${file.key}`);
 return {environment:'TEST',d1:'DB',r2:'FILES (local)',entities,recordCount:entities.reduce((n,r)=>n+r.count,0),fileCount:files.length,fileSize:files.reduce((n,o)=>n+o.size,0),latest:(await db.prepare('SELECT max(updated_at) AS time FROM app_records').first()).time,files:metadata,problems,history:(await db.prepare('SELECT * FROM backup_exports ORDER BY created_at DESC LIMIT 30').all()).results};
}
const quote=s=>'"'+s.replaceAll('"','""')+'"';
export async function snapshot(db){
 const schema=(await db.prepare("SELECT type,name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY type,name").all()).results;
 const names=schema.filter(s=>s.type==='table').map(s=>s.name);
 const batch=await db.batch(names.map(name=>db.prepare(`SELECT * FROM ${quote(name)} ORDER BY rowid`)));
 const tables=Object.fromEntries(names.map((name,i)=>[name,batch[i].results]));
 for(const [name,rows]of Object.entries(tables))for(const row of rows){
  rejectSecrets(row,name);if(typeof row.payload==='string'){
   const payload=JSON.parse(row.payload);
   // This exact audit sentence is a user-approval note, not an Authorization header/token.
   const inspected=row.entity==='admin_audit'&&payload.authorization==='User explicitly approved in Codex'?{...payload,authorization:null}:payload;
   rejectSecrets(inspected,`${name}/payload`);
  }
  const check=v=>{if(typeof v==='number'&&Number.isInteger(v)&&!Number.isSafeInteger(v))throw new Error('Unsafe numeric export; refusing precision loss.');if(v&&typeof v==='object')Object.values(v).forEach(check);};check(row);
 }
 return {format:'ONSPA-D1-RAW-v1',environment:'TEST',exportedAt:new Date().toISOString(),timezone:'UTC',schema,tables};
}
export async function createExport(db,bucket,kind,actor){
 if(!['full','d1','r2'].includes(kind))throw new Error('Loại xuất không hợp lệ.');
 const id=randomUUID(),created=new Date().toISOString();
 await db.prepare('INSERT INTO backup_exports(id,created_at,created_by,kind,status) VALUES(?,?,?,?,?)').bind(id,created,actor,kind,'Đang chuẩn bị').run();
 try{
  const status=await storageStatus(db,bucket);if(status.problems.length)throw new Error(status.problems.join('; '));
  const raw=await snapshot(db),contents={},put=(name,value)=>{contents[name]=Buffer.from(typeof value==='string'?value:JSON.stringify(value,null,2));};
  const journal=JSON.parse(readFileSync(resolve(root,'drizzle/meta/_journal.json'),'utf8'));
  put('database/schema.sql',journal.entries.map(e=>readFileSync(resolve(root,'drizzle',e.tag+'.sql'),'utf8')).join('\n--> statement-breakpoint\n'));
  // All export variants retain the database metadata needed to verify links.
  put('database/d1-raw-data.json',raw);
  const counts=Object.fromEntries(Object.entries(raw.tables).map(([name,rows])=>[name,rows.length]));
  put('database/record-counts.json',{tables:counts,entities:status.entities});put('database/schema-version.json',raw.tables._onspa_migrations);
  const aliases={forecast:'base-forecast',demand_event:'demand-event',safety_rules:'safety-rules',in_transit:'in-transit',production_engine:'production-engine',production_plan:'production-plan',sku_history:'audit-log'};
  const entities=new Set(['users','permissions','sku','leadtime','safety_rules','forecast','demand_event','inventory','in_transit','production_engine','production_plan','bom','sku_history',...status.entities.map(r=>r.entity)]);
  for(const entity of entities)put(`database/entities/${aliases[entity]||entity}.json`,raw.tables.app_records.filter(r=>r.entity===entity));
  for(const module of modules)put(`r2/${module}/.keep`,'');
  const manifest=[];let total=0;
  for(const object of await allObjects(bucket)){
   if(object.key.startsWith('backups/'))continue;
   if(object.key.split('/').some(p=>p==='..'||p==='.'||!p)||object.key.includes('\\')||object.key.startsWith('/'))throw new Error('Object key không an toàn.');
   total+=object.size;if(total>64*1024*1024)throw new Error('Gói vượt 64 MiB: cần hỗ trợ chia phần; chưa tạo gói thiếu.');
   const source=await bucket.get(object.key);
   if(!source)throw new Error('Tệp biến mất khi xuất: '+object.key);
   const bytes=Buffer.from(await source.arrayBuffer());
   const metadata=raw.tables.file_objects.find(r=>r.object_key===object.key);
   if(!metadata||metadata.checksum!==sha256(bytes))throw new Error('Tệp thay đổi trong khi xuất; vui lòng xuất lại: '+object.key);
   rejectSecrets(bytes.toString('utf8'),object.key);
   manifest.push({object_key:object.key,size:bytes.length,checksum:sha256(bytes),metadata:canonicalMetadata(source.httpMetadata,source.customMetadata)});
   if(kind!=='d1')contents['r2/'+object.key]=bytes;
  }
  if(raw.tables.file_objects.length!==manifest.length)throw new Error('Danh sách tệp thay đổi trong khi xuất; vui lòng xuất lại.');
  const csv=v=>'"'+String(v).replaceAll('"','""')+'"';
  put('manifests/r2-manifest.csv','object_key,size,checksum,httpMetadata,customMetadata\n'+manifest.map(r=>[r.object_key,r.size,r.checksum,JSON.stringify(r.metadata.httpMetadata),JSON.stringify(r.metadata.customMetadata)].map(csv).join(',')).join('\n'));
  put('manifests/backup-manifest.json',{format:'ONSPA-FULL-v2',id,kind,createdAt:created,timezone:'UTC',environment:'TEST',objects:manifest,includesFiles:kind!=='d1',excludedPrefixes:['backups/'],auth:'Local credentials and sessions excluded. Set a new password on the destination.'});
  for(const name of ['import-d1.js','upload-r2.js','verify-restore.js','README-RESTORE.md'])put('restore/'+name,readFileSync(resolve(root,'scripts/restore',name),'utf8'));
  put('manifests/checksums.sha256',Object.entries(contents).map(([name,bytes])=>`${sha256(bytes)}  ${name}`).join('\n'));
  const bytes=Buffer.from(zipSync(contents,{level:6})),stamp=created.slice(0,19).replaceAll(':','').replace('T','-');
  const filename=`ONSPA-${kind==='full'?'FULL-HANDOVER':kind.toUpperCase()}-${stamp}Z.zip`,key=`backups/${id}/${filename}`;
  await bucket.put(key,bytes,{httpMetadata:{contentType:'application/zip'}});
  await db.prepare('UPDATE backup_exports SET status=?,object_key=?,filename=?,size=?,checksum=? WHERE id=?').bind('Thành công',key,filename,bytes.length,sha256(bytes),id).run();
  return {id,filename,size:bytes.length,records:status.recordCount,files:manifest.length};
 }catch(error){await db.prepare('UPDATE backup_exports SET status=?,error=? WHERE id=?').bind('Thất bại',error.message,id).run();throw error;}
}
