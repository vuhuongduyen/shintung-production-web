import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {vietnamDate,vietnamMonday,vietnamDisplayDate,inventoryDisplayTime} from '../lib/vietnam-calendar.mjs';
import {mutateInventoryImport} from '../scripts/local/inventory-import.mjs';

for(const TZ of ['UTC','America/Los_Angeles','Asia/Ho_Chi_Minh','Pacific/Auckland'])test(`Vietnam displays and calendar boundaries are independent of browser timezone (${TZ})`,()=>{
 const source=`import assert from 'node:assert/strict';
 import {productionDisplayTime as time} from './lib/production-display-time.mjs';
 import {vietnamDate,vietnamMonday,vietnamDisplayDate,inventoryDisplayTime} from './lib/vietnam-calendar.mjs';
 assert.equal(time('2026-10-18T17:30:00Z'),'19/10/2026 00:30:00');
 assert.equal(vietnamDate('2026-10-18T17:30:00Z'),'2026-10-19');
 assert.equal(vietnamMonday('2026-10-18T17:30:00Z'),'2026-10-19');
 assert.equal(vietnamMonday('2026-10-18'),'2026-10-12');
 assert.equal(vietnamMonday('2026-10-19'),'2026-10-19');
 assert.equal(vietnamDate('2026-10-18'),'2026-10-18');
 assert.equal(vietnamDisplayDate('2026-10-18'),'18/10/2026');
 assert.equal(vietnamDisplayDate('2026-10-18T17:30:00Z'),'19/10/2026');
 assert.equal(time('2026-10-18'),'18/10/2026');
 assert.equal(inventoryDisplayTime('2026-10-18T17:30:00Z'),'19/10/2026 00:30:00');
 assert.equal(inventoryDisplayTime('18/10/2026 17:30:00'),'18/10/2026 17:30:00');
 assert.equal(inventoryDisplayTime('2026-10-18T17:30:00'),'2026-10-18T17:30:00');`;
 const result=spawnSync(process.execPath,['--input-type=module','-e',source],{cwd:new URL('..',import.meta.url),env:{...process.env,TZ},encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
});
test('empty or invalid dates never become current dates',()=>{
 for(const v of ['',null,'bad','2026-02-30'])assert.equal(vietnamDate(v),'');
 assert.equal(vietnamDisplayDate('bad'),'—');assert.equal(vietnamMonday('bad'),'');
});
test('inventory upload preserves ISO and legacy source values without reparsing or database access',async()=>{
 const statements=[];
 const db={prepare(sql){return {bind(...args){const statement={sql,args};statements.push(statement);return statement;}};},async batch(){return [{meta:{changes:1}},{meta:{changes:1}}];}};
 const now='2026-10-18T17:30:00.000Z';
 const rows=[{sku:'ISO',warehouse:'TP',qty:1,snapshotAt:now},{sku:'OLD',warehouse:'KD',qty:2,snapshotAt:'18/10/2026 17:30:00'}];
 const result=await mutateInventoryImport(db,{action:'upload',sourceFile:'test.xlsx',rows},{login:'TEST'},()=>new Date(now));
 assert.deepEqual(result.record.rows,rows);assert.equal(result.record.importedAt,now);
 assert.deepEqual(JSON.parse(statements[0].args[2]).rows,rows);
 assert.equal(inventoryDisplayTime(result.record.rows[0].snapshotAt),'19/10/2026 00:30:00');
 assert.equal(result.record.rows[1].snapshotAt,'18/10/2026 17:30:00');
});
test('confirmed display and current-date call sites use explicit Vietnam helpers',()=>{
 const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
 const approval=read('components/sku-approval.tsx');assert.match(approval,/approvalTime\(value\?:string\)\{return productionDisplayTime/);assert.match(approval,/productionDisplayTime\(new Date\(state.updatedAt\)\)/);
 const storage=read('components/storage-handover.tsx');for(const field of ['data.latest','h.created_at'])assert.ok(storage.includes(`productionDisplayTime(${field})`));
 const page=read('app/page.tsx');assert.match(page,/formatDateTimeDisplay\(setupAdmin.expiresAt\)/);assert.match(page,/const importedAt = new Date\(\).toISOString\(\);/);assert.equal((page.match(/updated: inventoryDisplayTime\(row.snapshotAt\)/g)||[]).length,2);assert.doesNotMatch(page,/activeSafetyRuleFor\(\s*new Date\(\).toISOString/);
 const reports=read('components/planning-reports.tsx');assert.ok(reports.includes("if(key==='actualCompletedAt')return vietnamDisplayDate(v)"));assert.ok(reports.includes("['start','end','requestDate','delivery'].includes(key)"));
 assert.match(read('components/demand-event-dialog.tsx'),/const today=\(\)=>vietnamDate\(\)/);
 assert.match(read('components/production-management.tsx'),/const monday = vietnamMonday/);
});
