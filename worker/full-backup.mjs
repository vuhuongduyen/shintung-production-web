import {stagedDatabaseSnapshot} from './backup-snapshot.mjs';
import {sessionUser,isAdminRole} from './password-auth.mjs';
import {sourceDevice} from './source-sync.mjs';
export const BACKUP_RESTORE_GUIDE='Bản sao lưu gồm source/ONSPA-source.zip, database/database.sql và files/*.bin. manifest.json ánh xạ mỗi file về object key và metadata R2; checksums.json ghi SHA-256. Chỉ phục hồi vào môi trường trống, kiểm tra đủ bảng/bản ghi và checksum; vô hiệu auth_sessions, cấp lại mã thiết bị, thiết lập secrets riêng. Không ghi đè dữ liệu đang dùng. Dữ liệu chứa nhân sự và hash mật khẩu: giữ folder riêng.';
const PREFIX='_onspa_pc_backup/';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const json=(v,status=200)=>Response.json(v,{status,headers});
export async function backupObjects(bucket){
 const all=[];let cursor;
 do{const p=await bucket.list({limit:1000,...(cursor?{cursor}:{}),include:['httpMetadata','customMetadata']});all.push(...p.objects.filter(o=>!o.key.startsWith(PREFIX)));cursor=p.truncated?p.cursor:undefined;}while(cursor);
 return all.sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0);
}
const signature=objects=>JSON.stringify(objects.map(o=>[o.key,o.size,o.etag]));
export async function fullBackupApi(request,env,snapshot){
 const url=new URL(request.url);if(!url.pathname.startsWith('/api/full-backup'))return null;
 try{
  if(!env.DB?.prepare||!env.FILES?.list)return json({error:'Thiếu DB/FILES'},503);
  const user=await sessionUser(request,env),admin=user&&isAdminRole(user.role),device=admin?null:await sourceDevice(request,env);
  // Existing source-only codes cannot access company data. A new explicit full-backup grant is required.
  if(!admin&&device?.scope!=='full-backup')return json({error:'Cần mã sao lưu đầy đủ còn hiệu lực hoặc tài khoản Admin.'},403);
  const owner=admin?'admin:'+user.login:'device:'+device.id;
  if(request.method==='POST'){
   if(!request.headers.get('content-type')?.startsWith('application/json')||(admin&&request.headers.get('origin')!==url.origin))return json({error:'Yêu cầu không hợp lệ'},403);
   const raw=await request.text();if(raw.length>4096)return json({error:'Yêu cầu quá lớn'},413);
   const body=JSON.parse(raw);
   if(url.pathname==='/api/full-backup/start'){
    // Reclaim only expired internal transport, never user objects or local backups.
    const temp=await env.FILES.list({prefix:PREFIX,limit:1000});let reclaimed=0;
    for(const o of temp.objects){if(o.key.endsWith('/manifest.json')&&o.uploaded&&Date.now()-new Date(o.uploaded).getTime()>86400000&&reclaimed<20){await env.FILES.delete([o.key,o.key.replace(/manifest\.json$/,'database.sql')]);reclaimed++;}}
    const id=crypto.randomUUID(),createdAt=new Date().toISOString(),prefix=PREFIX+id+'/';
    const objects=await backupObjects(env.FILES),db=await stagedDatabaseSnapshot(env.DB,env.FILES,prefix+'database.sql');
    const objectMap=new Map(objects.map(o=>[o.key,o])),fileMap=new Map(db.files.map(f=>[f.object_key,f]));
    for(const f of db.files){const o=objectMap.get(f.object_key);if(!o||o.size!==f.size)throw Error('Thiếu hoặc sai dung lượng file gốc: '+f.original_name);}
    const entries=[{kind:'database',path:'database/database.sql',key:prefix+'database.sql',size:db.size,sha256:db.sha256},
     {kind:'source',path:'source/ONSPA-source.zip',size:snapshot.metadata.size,sha256:snapshot.metadata.sha256}];
    for(let i=0;i<objects.length;i++){
     const o=objects[i],f=fileMap.get(o.key);
     // Numbered local paths also preserve objects with names Windows cannot represent.
     entries.push({kind:'object',path:`files/${String(i+1).padStart(8,'0')}.bin`,key:o.key,size:o.size,etag:o.etag,...(f?.checksum?{sha256:f.checksum}:{}),httpMetadata:o.httpMetadata||{},customMetadata:o.customMetadata||{}});
    }
    const manifest={format:'ONSPA-FULL-BACKUP-v1',id,projectId:snapshot.metadata.projectId,createdAt,expiresAt:new Date(Date.now()+86400000).toISOString(),sourceSnapshotId:snapshot.metadata.snapshotId,tableCounts:db.counts,schema:db.schema,entries,fileCount:objects.length,recordCount:Object.values(db.counts).reduce((a,b)=>a+b,0),excluded:'Only Cloudflare internal tables and temporary PC-backup and labor-import staging tables/transport objects; no business records excluded.',restoreGuide:BACKUP_RESTORE_GUIDE,auth:'Includes account password hashes and permissions. On restore, invalidate auth_sessions and issue fresh device codes. Deployment secrets must be configured separately.'};
    await env.FILES.put(prefix+'manifest.json',JSON.stringify({owner,manifest,objectSignature:signature(objects)}),{httpMetadata:{contentType:'application/json'}});
    return json(manifest);
   }
   if(url.pathname==='/api/full-backup/complete'){
    const state=await load(body.id);if(!state)return json({error:'Không tìm thấy phiên sao lưu hoặc đã hết hạn'},404);
    if(signature(await backupObjects(env.FILES))!==state.objectSignature)return json({error:'Danh sách file thay đổi trong lúc sao lưu. Bản này chưa hoàn tất; thử lại.'},409);
    // Called only after the PC verified every download. Keep manifest for retry; remove temporary SQL.
    await env.FILES.delete(PREFIX+body.id+'/database.sql');
    return json({ok:true,id:body.id});
   }
  }
  if(request.method==='GET'&&url.pathname==='/api/full-backup/item'){
   const state=await load(url.searchParams.get('id'));if(!state)return json({error:'Phiên sao lưu hết hạn hoặc không thuộc mã này'},404);
   const n=Number(url.searchParams.get('index'));if(!Number.isInteger(n)||n<0||n>=state.manifest.entries.length)return json({error:'File không hợp lệ'},400);
   const entry=state.manifest.entries[n];
   if(entry.kind==='source'){
    if(snapshot.metadata.snapshotId!==state.manifest.sourceSnapshotId)return json({error:'Website vừa đổi source; tạo lại bản sao lưu.'},409);
    return new Response(Uint8Array.from(atob(snapshot.sourceBase64),c=>c.charCodeAt(0)),{headers:{...headers,'Content-Type':'application/zip'}});
   }
   const o=await env.FILES.get(entry.key,entry.etag?{onlyIf:{etagMatches:entry.etag}}:undefined);
   if(!o||!o.body||o.size!==entry.size)return json({error:'File thay đổi hoặc thiếu; dừng bản sao lưu này.'},409);
   return new Response(o.body,{headers:{...headers,'Content-Type':'application/octet-stream','Content-Length':String(o.size)}});
  }
  return json({error:'Không có thao tác sao lưu này'},404);
  async function load(id){
   if(typeof id!=='string'||!/^[a-f0-9-]{36}$/.test(id))return null;
   const obj=await env.FILES.get(PREFIX+id+'/manifest.json');if(!obj)return null;
   const s=await obj.json();return s.owner===owner&&Date.parse(s.manifest.expiresAt)>Date.now()?s:null;
  }
 }catch(e){return json({error:e instanceof Error?e.message:'Không tạo được sao lưu đầy đủ'},500);}
}
