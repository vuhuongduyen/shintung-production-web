import { openDatabase,migrate,records,importBackup,root,sha256 } from './database.mjs';
import { readFileSync,writeFileSync,mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const command=process.argv[2];
if(!['init','seed','import','export'].includes(command))throw new Error('Usage: node scripts/local/cli.mjs init|seed|import <file>|export');
const connection=await openDatabase();
try {
 await migrate(connection.db);
 if(command==='seed'||command==='import'){
  const input=command==='seed'?resolve(root,'seed/test/records.json'):resolve(process.argv[3]||'');
  await importBackup(connection.db,JSON.parse(readFileSync(input,'utf8')));
 }
 if(command==='export'){
  const rows=await records(connection.db),timestamp=new Date().toISOString().replaceAll(':','-');
  const dir=resolve(root,'backups/test');mkdirSync(dir,{recursive:true});
  const file=resolve(dir,`onspa-test-${timestamp}.json`);
  writeFileSync(file,JSON.stringify({format:'ONSPA-TEST-v1',environment:'TEST',exportedAt:new Date().toISOString(),sha256:sha256(JSON.stringify(rows)),records:rows},null,2),{flag:'wx'});
  console.log(file);
 }
 console.log(JSON.stringify({environment:'TEST',database:connection.path,records:(await records(connection.db)).length}));
}finally{await connection.close();}
