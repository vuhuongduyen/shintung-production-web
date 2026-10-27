// Binding-only service: used by TEST Miniflare and the Site Worker adapter.
const digest=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
export async function isSuperAdmin(db,session){
 if(!session?.login)return false;
 const adminRole=role=>['ADMIN','SUPER_ADMIN','SUPER ADMIN'].includes(String(role||'').trim().toUpperCase().replaceAll('-','_'));
 // SETUP_ADMIN is created only by the backend after the private device
 // entitlement has been verified. It deliberately has no row in `users`.
 if(session.isSetupAdmin===true)return session.login==='SETUP_ADMIN'&&adminRole(session.role);
 if(session.role==='site-owner')return true;
 if(session.role&&!adminRole(session.role))return false;
 const login=String(session.permissionLogin||session.login).toLowerCase();
 const rows=(await db.prepare("SELECT payload FROM app_records WHERE entity='users'").all()).results.map(r=>JSON.parse(r.payload)).filter(p=>String(p.login||'').toLowerCase()===login);
 // sessionUser already rejects inactive/deleted users. This second check keeps
 // direct callers safe while preserving Super Admin's unconditional grants.
 return !rows.some(p=>p._deleted||p.active===false)&&(adminRole(session.role)||rows.some(p=>adminRole(p.role)&&p.active===true));
}
export async function storeFile(db,bucket,input,actor){
 if(!new Set(['base-forecast','demand-event','warehouse','bom','reports','attachments']).has(input.module)||typeof input.name!=='string'||!input.name.trim()||input.name.length>240||typeof input.recordId!=='string')throw Error('Metadata tệp không hợp lệ.');
 const bytes=Uint8Array.from(atob(input.base64||''),c=>c.charCodeAt(0));
 if(!bytes.length||bytes.length>5*1024*1024)throw Error('Tệp phải có dung lượng từ 1 byte đến 5 MiB.');
 const id=crypto.randomUUID(),key=`${input.module}/${id}/${input.name.replace(/[^\p{L}\p{N}_.-]/gu,'_')}`;
 const row={file_id:id,object_key:key,original_name:input.name,content_type:input.contentType||'application/octet-stream',size:bytes.length,module:input.module,record_id:input.recordId,uploaded_by:actor,uploaded_at:new Date().toISOString(),checksum:await digest(bytes),status:'ready'};
 await bucket.put(key,bytes,{httpMetadata:{contentType:row.content_type}});
 // Preserve an object on D1 failure. Reconciliation reports it; no implicit deletion.
 // Only stored metadata is audited; upload bytes and request extras never enter history.
 const audit={entity:'file_objects',key:id,before:null,after:row,actor,actorId:actor,at:row.uploaded_at,source:'file-store',action:'add'};
 await db.batch([
  db.prepare('INSERT INTO file_objects VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(...Object.values(row)),
  db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'admin_audit',?,?,?,? WHERE changes()=1").bind(crypto.randomUUID(),JSON.stringify(audit),actor,row.uploaded_at),
 ]);
 return row;
}
