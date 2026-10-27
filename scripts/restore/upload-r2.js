(async()=>{
 const fs=await import('node:fs'),path=await import('node:path'),url=await import('node:url');
 const args=process.argv.slice(2),legacy=args.includes('--legacy-bytes-only');
 const [project,bundle,target]=args.filter(a=>a!=='--legacy-bytes-only');if(!project||!bundle||!target)throw Error('Usage: node upload-r2.js <project> <unpacked-bundle> <restored-test-directory> [--legacy-bytes-only]');
 const dest=path.resolve(target),safe=path.resolve(project,'.local-data/restore-tests');if(!dest.startsWith(safe+path.sep))throw Error('Only restore-tests destination permitted.');
 const api=await import(url.pathToFileURL(path.resolve(project,'scripts/local/database.mjs')).href);
 const meta=await import(url.pathToFileURL(path.resolve(project,'lib/r2-backup-metadata.mjs')).href);
 const manifest=JSON.parse(fs.readFileSync(path.resolve(bundle,'manifests/backup-manifest.json'),'utf8'));
 const mode=meta.assertManifest(manifest,{allowLegacyBytesOnly:legacy});
 const items=[];
 for(const item of manifest.objects){
  const file=path.resolve(bundle,'r2',item.object_key);
  if(!file.startsWith(path.resolve(bundle,'r2')+path.sep))throw Error('Unsafe object key');
  const bytes=fs.readFileSync(file);
  if(api.sha256(bytes)!==item.checksum||bytes.length!==item.size)throw Error('Checksum/size mismatch: '+item.object_key);
  items.push({item,bytes});
 }
 const c=await api.openDatabase(dest);try{
  let count=0,cursor;do{const page=await c.bucket.list({cursor});count+=page.objects.length;cursor=page.truncated?page.cursor:undefined;}while(cursor);
  if(count)throw Error('R2 restore requires an empty bucket.');
  for(const {item,bytes} of items)await c.bucket.put(item.object_key,bytes,mode==='full'?meta.metadataForPut(item.metadata):undefined);
  console.log(JSON.stringify({restored:true,mode,metadataVerified:false,files:items.length}));
 }finally{await c.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
