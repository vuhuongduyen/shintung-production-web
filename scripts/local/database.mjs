import { Miniflare } from 'miniflare';
import { readFileSync, readdirSync, mkdirSync, lstatSync, existsSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export const sha256 = value => createHash('sha256').update(value).digest('hex');
export function assertLocal(config, environment = process.env) {
  const expected = { environment: 'TEST', host: '127.0.0.1', port: 5173, databaseId: 'onspa-test-local-v1', binding: 'DB', remote: false, persistPath: '.local-data/d1' };
  if (JSON.stringify(Object.keys(config).sort()) !== JSON.stringify(Object.keys(expected).sort()) || Object.entries(expected).some(([key,value]) => config[key] !== value)) throw new Error('BLOCKED: cấu hình không phải database TEST local đã phê duyệt.');
  const forbidden = /^(CLOUDFLARE_(API_TOKEN|TOKEN|ACCOUNT_ID|D1_DATABASE_ID|R2_ACCESS_KEY_ID|R2_SECRET_ACCESS_KEY|ACCESS_KEY_ID|SECRET_ACCESS_KEY)|CF_API_(TOKEN|KEY)|D1_(DATABASE_ID|TOKEN)|WRANGLER_REMOTE|DATABASE_URL|ONSPA_LIVE)/i;
  for (const [key,value] of Object.entries(environment)) if (value && forbidden.test(key)) throw new Error(`BLOCKED: biến môi trường ${key} có thể cấu hình LIVE.`);
  for (const dir of ['.local-data', '.local-data/d1']) if (existsSync(resolve(root,dir)) && lstatSync(resolve(root,dir)).isSymbolicLink()) throw new Error('BLOCKED: database directory is a symbolic link.');
  const path = resolve(root, config.persistPath);
  if (isAbsolute(relative(root,path)) || relative(root,path).startsWith('..')) throw new Error('BLOCKED: database outside Project.');
  return path;
}
export function configuration() {
  const config = JSON.parse(readFileSync(resolve(root,'config/local-test.json'),'utf8'));
  assertLocal(config);
  return config;
}
export async function openDatabase(persistPath) {
  const config = configuration();
  const path = persistPath || assertLocal(config);
  mkdirSync(path,{recursive:true});
  const files=JSON.parse(readFileSync(resolve(root,'config/local-files.json'),'utf8'));
  if(JSON.stringify(files)!==JSON.stringify({environment:'TEST',binding:'FILES',bucketId:'onspa-test-files-v1',persistPath:'.local-data/r2',remote:false}))throw new Error('BLOCKED: R2 must use approved local TEST configuration.');
  const r2Path=persistPath?resolve(path,'r2'):resolve(root,files.persistPath);
  if(existsSync(r2Path)&&lstatSync(r2Path).isSymbolicLink())throw new Error('BLOCKED: R2 symbolic link.');
  const runtime = new Miniflare({ modules: true, script: 'export default {fetch(){return new Response("TEST")}}', compatibilityDate: '2026-05-15', host: '127.0.0.1', port: 0, cf: false, d1Databases: { DB: config.databaseId }, d1Persist: path, r2Buckets:{FILES:files.bucketId},r2Persist:r2Path });
  try { return { db: await runtime.getD1Database('DB'), bucket:await runtime.getR2Bucket('FILES'), close: () => runtime.dispose(), path, r2Path }; }
  catch(error) { await runtime.dispose(); throw error; }
}
export async function migrate(db) {
  await db.prepare('CREATE TABLE IF NOT EXISTS _onspa_migrations (name TEXT PRIMARY KEY, sha256 TEXT NOT NULL, applied_at TEXT NOT NULL)').run();
  const journal = JSON.parse(readFileSync(resolve(root,'drizzle/meta/_journal.json'),'utf8'));
  const applied = (await db.prepare('SELECT * FROM _onspa_migrations').all()).results;
  const names = journal.entries.map(entry=>entry.tag+'.sql');
  if (applied.some(row=>!names.includes(row.name))) throw new Error('Unknown applied migration; refusing to proceed.');
  for (const name of names) {
    const sql = readFileSync(resolve(root,'drizzle',name),'utf8');
    const hash = sha256(sql.replaceAll('\r\n','\n'));
    const old = applied.find(row=>row.name===name);
    if(old) { if(old.sha256!==hash) throw new Error(`Migration changed after application: ${name}`); continue; }
    const statements = sql.split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean);
    await db.batch([...statements.map(sql=>db.prepare(sql)), db.prepare('INSERT INTO _onspa_migrations VALUES (?,?,?)').bind(name,hash,new Date().toISOString())]);
  }
}
export async function records(db) { return (await db.prepare('SELECT entity,record_key,payload,updated_by,updated_at FROM app_records ORDER BY entity,record_key').all()).results; }
export function validateBackup(backup) {
  if(backup.format!=='ONSPA-TEST-v1'||backup.environment!=='TEST'||!Array.isArray(backup.records)) throw new Error('Only ONSPA TEST backups are accepted.');
  const keys=new Set();
  for(const row of backup.records) {
    const columns=['entity','record_key','payload','updated_by','updated_at'];
    if(Object.keys(row).sort().join()!==columns.sort().join()||columns.some(k=>typeof row[k]!=='string')) throw new Error('Invalid backup columns.');
    JSON.parse(row.payload);
    const key=JSON.stringify([row.entity,row.record_key]);if(keys.has(key))throw new Error('Duplicate entity + record_key');keys.add(key);
  }
  if(backup.sha256 && backup.sha256!==sha256(JSON.stringify(backup.records)))throw new Error('Backup checksum mismatch');
  return backup.records;
}
export async function importBackup(db,backup) {
  const rows=validateBackup(backup);
  if((await records(db)).length)throw new Error('Import requires empty TEST database; no existing data will be overwritten.');
  if(rows.length)await db.batch(rows.map(r=>db.prepare('INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) VALUES(?,?,?,?,?)').bind(r.entity,r.record_key,r.payload,r.updated_by,r.updated_at)));
}
