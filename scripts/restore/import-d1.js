// Run from a handover bundle, with an existing ONSPA source folder and installed dependencies.
(async()=>{
 const fs=await import('node:fs'),path=await import('node:path'),url=await import('node:url');
 const [project,bundle,target]=process.argv.slice(2);if(!project||!bundle||!target)throw Error('Usage: node import-d1.js <project> <unpacked-bundle> <new-test-directory>');
 const api=await import(url.pathToFileURL(path.resolve(project,'scripts/local/database.mjs')).href);
 const safe=path.resolve(project,'.local-data/restore-tests'),dest=path.resolve(target);
 if(!dest.startsWith(safe+path.sep)||fs.existsSync(dest))throw Error('Destination must be a NEW directory under Project/.local-data/restore-tests.');
 const raw=JSON.parse(fs.readFileSync(path.resolve(bundle,'database/d1-raw-data.json'),'utf8'));
 if(raw.format!=='ONSPA-D1-RAW-v1'||raw.environment!=='TEST')throw Error('Only TEST backup accepted.');
 const sums=fs.readFileSync(path.resolve(bundle,'manifests/checksums.sha256'),'utf8');
 for(const line of sums.split('\n').filter(Boolean)){const [hash,name]=line.split('  ');const file=path.resolve(bundle,name);if(!file.startsWith(path.resolve(bundle)+path.sep)||api.sha256(fs.readFileSync(file))!==hash)throw Error('Checksum mismatch: '+name);}
 const c=await api.openDatabase(dest);try{
  const q=s=>'"'+s.replaceAll('"','""')+'"';
  const stmts=raw.schema.filter(s=>s.type==='table').map(s=>c.db.prepare(s.sql));
  for(const [name,rows] of Object.entries(raw.tables))for(const row of rows){const cols=Object.keys(row);stmts.push(c.db.prepare(`INSERT INTO ${q(name)}(${cols.map(q)}) VALUES(${cols.map(()=>'?')})`).bind(...Object.values(row)));}
  stmts.push(...raw.schema.filter(s=>s.type!=='table').map(s=>c.db.prepare(s.sql)));
  await c.db.batch(stmts);console.log('D1 restored to '+dest);
 }finally{await c.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
