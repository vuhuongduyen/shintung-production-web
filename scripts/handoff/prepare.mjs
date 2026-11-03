import { openDatabase,migrate,records,importBackup,sha256,root,configuration } from '../local/database.mjs';
import { sourceFiles,checkSource,rejectSecrets } from './safety.mjs';
import { mkdirSync,readFileSync,writeFileSync,copyFileSync,mkdtempSync,existsSync } from 'node:fs';
import { resolve,dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

configuration();
const stamp=new Date().toISOString().replaceAll(':','-');
const reportDir=resolve(root,'handoff');mkdirSync(reportDir,{recursive:true});
const report={timestamp:stamp,status:'BLOCKED',checks:[],version:JSON.parse(readFileSync(resolve(root,'package.json'),'utf8')).version};
const reportFile=resolve(reportDir,`report-${stamp}.json`);
function run(label,args){const r=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',maxBuffer:20*1024*1024,env:{...process.env,WRANGLER_SEND_METRICS:'false'}});report.checks.push({label,passed:r.status===0,output:(r.stdout+'\n'+r.stderr).slice(-12000)});if(r.status!==0)throw new Error(`${label} failed; see ${reportFile}`);}
try{
 run('local tests',['--test','tests/local-environment.test.mjs','tests/production-plan.test.mjs']);
 run('typecheck',['node_modules/typescript/bin/tsc','--noEmit','--incremental','false']);
 run('build',['scripts/local/run.mjs','build']);
 run('existing tests',['--test','tests/ui-components.test.mjs','tests/rendered-html.test.mjs']);
 const live=await openDatabase();let rows;
 try{await migrate(live.db);rows=await records(live.db);}finally{await live.close();}
 for(const row of rows){rejectSecrets(JSON.parse(row.payload),`${row.entity}/${row.record_key}`);rejectSecrets(row.updated_by,'updated_by');}
 const backup={format:'ONSPA-TEST-v1',environment:'TEST',exportedAt:new Date().toISOString(),records:rows,sha256:sha256(JSON.stringify(rows))};
 const backups=resolve(root,'backups/test');mkdirSync(backups,{recursive:true});const backupFile=resolve(backups,`handoff-${stamp}.json`);writeFileSync(backupFile,JSON.stringify(backup,null,2),{flag:'wx'});
 const verificationPath=mkdtempSync(resolve(reportDir,'verify-'));
 const verify=await openDatabase(verificationPath);
 try{await migrate(verify.db);await importBackup(verify.db,backup);if(JSON.stringify(await records(verify.db))!==JSON.stringify(rows))throw new Error('Restore verification mismatch');}finally{await verify.close();}
 const names=sourceFiles(root);for(const name of names)if(/\.(?:[cm]?[jt]sx?|gs|json|md|css|sql|sh|ps1|txt)$|^\.npmrc$/.test(name))checkSource(readFileSync(resolve(root,name),'utf8'),name);
 const folder=resolve(reportDir,`ONSPA-TEST-${stamp}`);mkdirSync(folder);
 for(const name of names){const dest=resolve(folder,name);mkdirSync(dirname(dest),{recursive:true});copyFileSync(resolve(root,name),dest);}
 const hosting=JSON.parse(readFileSync(resolve(root,'.openai/hosting.json'),'utf8'));
 mkdirSync(resolve(folder,'.openai'));writeFileSync(resolve(folder,'.openai/hosting.json'),JSON.stringify({project_id:hosting.project_id,d1:hosting.d1,r2:hosting.r2},null,2));
 mkdirSync(resolve(folder,'test-data'));copyFileSync(backupFile,resolve(folder,'test-data/latest.json'));
 report.status='READY';report.folder=folder;report.backup=backupFile;report.records=rows.length;report.entities=Object.fromEntries([...new Set(rows.map(r=>r.entity))].map(e=>[e,rows.filter(r=>r.entity===e).length]));
 const git=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});report.baseCommit=git.status===0?git.stdout.trim():null;
 const diff=spawnSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'});report.workingTreeChanges=diff.status===0?diff.stdout.trim():null;
 report.files=Object.fromEntries([...names,'.openai/hosting.json','test-data/latest.json'].map(n=>[n,sha256(readFileSync(resolve(folder,n)))]));
 writeFileSync(resolve(folder,'HANDOFF-REPORT.json'),JSON.stringify(report,null,2));
 console.log(`Folder bàn giao: ${folder}`);
}catch(error){report.error=error.message;console.error(error.message);process.exitCode=1;}finally{writeFileSync(reportFile,JSON.stringify(report,null,2));console.log(`Báo cáo: ${reportFile}`);}
