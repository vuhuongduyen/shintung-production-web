import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {zipSync,strToU8} from 'fflate';
import {sourceFiles,checkSource} from './handoff/safety.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
export function createSourceSnapshot(root){
 const names=sourceFiles(root),entries={},files=[];
 for(const name of names){
  const bytes=readFileSync(resolve(root,name));
  if(/\.(?:[cm]?[jt]sx?|gs|json|md|css|sql|sh|ps1|cmd|txt)$|^\.npmrc$/.test(name))checkSource(bytes.toString('utf8'),name);
  entries[name]=new Uint8Array(bytes);files.push({path:name,sha256:hash(bytes),size:bytes.length});
 }
 const hosting=JSON.parse(readFileSync(resolve(root,'.openai/hosting.json'),'utf8'));
 const sanitized=strToU8(JSON.stringify({project_id:hosting.project_id,d1:hosting.d1,r2:hosting.r2},null,2));
 entries['.openai/hosting.json']=sanitized;files.push({path:'.openai/hosting.json',sha256:hash(sanitized),size:sanitized.length});files.sort((a,b)=>a.path.localeCompare(b.path));
 const snapshotId=hash(JSON.stringify(files)),manifest={format:'ONSPA-SOURCE-v1',projectId:hosting.project_id,snapshotId,builtAt:new Date().toISOString(),files};
 entries['_ONSPA_SOURCE.json']=strToU8(JSON.stringify(manifest));
 const bytes=zipSync(entries,{level:6});
 const kit={};for(const name of ['Cai-dong-bo.cmd','Dong-bo-ngay.cmd','Sao-luu-ngay.cmd','OnspaSync.ps1','HUONG-DAN.txt'])kit[name]=new Uint8Array(readFileSync(resolve(root,'scripts/windows',name)));
 const kitBytes=zipSync(kit,{level:6});
 return {metadata:{format:manifest.format,projectId:manifest.projectId,snapshotId,builtAt:manifest.builtAt,fileCount:files.length,size:bytes.length,sha256:hash(bytes)},sourceBase64:Buffer.from(bytes).toString('base64'),installerBase64:Buffer.from(kitBytes).toString('base64')};
}
