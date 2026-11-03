import test from 'node:test';
import assert from 'node:assert/strict';
import {demandWeekLabel,demandMatchesWeek} from '../lib/demand-week.mjs';
import {validateNewDemand} from '../scripts/local/demand-validation.mjs';
test('chosen week determines both demand types independently of delivery',()=>{
 for(const type of ['Phát sinh','Bù tải']) {
  const row={type,planningWeekStart:'2026-09-21',delivery:'03/10/2026'};
  assert.equal(demandWeekLabel(row),'21/09/2026–27/09/2026');
  assert.equal(demandMatchesWeek(row,'2026-09-21'),true);
  assert.equal(demandMatchesWeek(row,'2026-09-28'),false);
 }
 assert.equal(demandMatchesWeek({delivery:'26/09/2026'},'2026-09-21'),true);
 assert.equal(demandMatchesWeek({delivery:'invalid'},'2026-09-21'),false);
});
test('new demand requires Monday and computes Sunday on backend',async()=>{
 const db={prepare:()=>({bind:()=>({first:async()=>null})})};
 const base={sku:'T',qty:1,requestDate:'22/09/2026',delivery:'26/09/2026',type:'Phát sinh',priority:'Thường'};
 const missing=await validateNewDemand(db,{...base});
 assert.ok(missing.fields.planningWeekStart);
 const invalid=await validateNewDemand(db,{...base,planningWeekStart:'2026-09-22'});
 assert.ok(invalid.fields.planningWeekStart);
 const row={...base,planningWeekStart:'2026-09-21',planningWeekEnd:'2000-01-01'};
 const result=await validateNewDemand(db,row);
 assert.equal(result.fields.planningWeekStart,undefined);
 assert.equal(row.planningWeekEnd,'2026-09-27');
});
