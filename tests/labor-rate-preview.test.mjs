import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {execFileSync} from 'node:child_process';
test('offline preview preserves outer history timestamp and uses the same business day as resolver',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'labor-preview-')),input=join(directory,'synthetic.json');
 try {
  const source={labor:[{key:'SYNTHETIC',updatedAt:'2026-11-08T17:30:00Z',payload:{sku:'SYNTHETIC',version:1,laborHour:.03}}],history:[{key:'H1',updatedAt:'2026-11-08T17:30:00Z',payload:{id:'H1',sku:'SYNTHETIC',version:1,newLaborHour:.03}}],reports:[{id:'R',sku:'SYNTHETIC',productionDate:'2026-11-09'}]},raw=JSON.stringify(source);
  await writeFile(input,raw);const preview=JSON.parse(execFileSync(process.execPath,['scripts/verification/labor-rate-preview.mjs',input],{encoding:'utf8'}));
  assert.equal(preview.history[0].recordedAt,'2026-11-08T17:30:00Z');assert.equal(preview.menu[0].versions[0].recordedAt,preview.history[0].recordedAt);assert.equal(preview.menu[0].versions[0].validFrom,'2026-11-09');assert.equal(preview.reports[0].proposedBasis.value,.03);assert.equal(await readFile(input,'utf8'),raw);
 }finally{await rm(directory,{recursive:true,force:true});}
});
