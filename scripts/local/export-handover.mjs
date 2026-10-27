import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {openDatabase,migrate,root} from './database.mjs';
import {isSuperAdmin,createExport} from './storage.mjs';
const session={login:JSON.parse(readFileSync(resolve(root,'.local-data/auth.json'),'utf8')).login};
const c=await openDatabase();try{
 await migrate(c.db);if(!await isSuperAdmin(c.db,session))throw Error('Chỉ Super Admin TEST được xuất.');
 const result=await createExport(c.db,c.bucket,'full',session.login);
 const row=await c.db.prepare('SELECT object_key FROM backup_exports WHERE id=?').bind(result.id).first();
 const dir=resolve(root,'handoff');mkdirSync(dir,{recursive:true});const out=resolve(dir,result.filename);
 writeFileSync(out,Buffer.from(await(await c.bucket.get(row.object_key)).arrayBuffer()),{flag:'wx'});
 console.log(JSON.stringify({...result,path:out}));
}finally{await c.close();}
