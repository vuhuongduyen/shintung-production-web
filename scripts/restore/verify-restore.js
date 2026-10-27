(async()=>{
 const fs=await import('node:fs'),path=await import('node:path'),url=await import('node:url');
 const args=process.argv.slice(2),legacy=args.includes('--legacy-bytes-only');
 const [project,bundle,target]=args.filter(a=>a!=='--legacy-bytes-only');if(!project||!bundle||!target)throw Error('Usage: node verify-restore.js <project> <unpacked-bundle> <restored-test-directory> [--legacy-bytes-only]');
 const dest=path.resolve(target);if(!dest.startsWith(path.resolve(project,'.local-data/restore-tests')+path.sep))throw Error('Only restore-tests permitted.');
 const api=await import(url.pathToFileURL(path.resolve(project,'scripts/local/database.mjs')).href);
 const meta=await import(url.pathToFileURL(path.resolve(project,'lib/r2-backup-metadata.mjs')).href);
 const raw=JSON.parse(fs.readFileSync(path.resolve(bundle,'database/d1-raw-data.json'),'utf8')),manifest=JSON.parse(fs.readFileSync(path.resolve(bundle,'manifests/backup-manifest.json'),'utf8'));
 const mode=meta.assertManifest(manifest,{allowLegacyBytesOnly:legacy});
 const c=await api.openDatabase(dest);try{
  for(const [name,rows]of Object.entries(raw.tables)){const actual=(await c.db.prepare('SELECT * FROM "'+name.replaceAll('"','""')+'" ORDER BY rowid').all()).results;if(JSON.stringify(actual)!==JSON.stringify(rows))throw Error('Rows differ: '+name);}
  let count=0,cursor;do{const page=await c.bucket.list({cursor});count+=page.objects.length;cursor=page.truncated?page.cursor:undefined;}while(cursor);
  if(count!==manifest.objects.length)throw Error('Object count differs.');
  for(const item of manifest.objects){
   const object=await c.bucket.get(item.object_key);
   if(!object||api.sha256(Buffer.from(await object.arrayBuffer()))!==item.checksum||object.size!==item.size)throw Error('Missing/corrupt object: '+item.object_key);
   if(mode==='full'&&!meta.metadataEqual(item.metadata,{httpMetadata:object.httpMetadata,customMetadata:object.customMetadata}))throw Error('R2 metadata mismatch: '+item.object_key);
  }
  console.log(JSON.stringify({verified:mode==='full',metadataVerified:mode==='full',metadataStatus:mode==='full'?'verified':'unknown',mode,tables:Object.keys(raw.tables).length,files:count}));
 }finally{await c.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
