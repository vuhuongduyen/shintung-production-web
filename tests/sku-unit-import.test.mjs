import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {openDatabase,migrate,root} from '../scripts/local/database.mjs';
import {analyzeBomUnitRows} from '../lib/bom-unit-rows.mjs';
import {importSkuUnitsFromBom} from '../lib/sku-unit-import.mjs';

test('BOM unit analysis accepts only an exact trimmed level 0 and reports unsafe cases',()=>{
 const rows=[
  {productCode:'102XS02001',level:'0 ',unit:' sợi '},
  {productCode:'102XS02001',level:'.1',unit:'TỜ'},
  {productCode:'102XS02001',level:'..2',unit:'CÁI'},
  {productCode:'102XS02001',level:'...3',unit:'KG'},
  {productCode:'NOLEVEL01',level:'.1',unit:'CÁI'},
  {productCode:'DOTZERO01',level:'.0',unit:'KG'},
  {productCode:'BLANK0001',level:'0',unit:' '},
  {productCode:'DUPL00001',level:'0',unit:'CÁI'},
  {productCode:'DUPL00001',level:'0',unit:'CÁI'},
  {productCode:'CONFLICT1',level:'0',unit:'KG'},
  {productCode:'CONFLICT1',level:'0',unit:'TỜ'},
 ];
 const result=analyzeBomUnitRows(rows);
 assert.equal(result.units['102XS02001'],'SỢI');
 assert.equal(result.units['DUPL00001'],'CÁI');
 assert.equal(result.units.CONFLICT1,undefined);
 assert.deepEqual(result.missingLevel0.sort(),['DOTZERO01','NOLEVEL01']);
 assert.deepEqual(result.blankLevel0,['BLANK0001']);
 assert.deepEqual(result.duplicateLevel0.sort(),['CONFLICT1','DUPL00001']);
 assert.deepEqual(result.conflictingLevel0,[{productCode:'CONFLICT1',units:['KG','TỜ']}]);
});

test('SKU unit import persists unit and immutable history without changing SKU state or duplicating history',async()=>{
 const base=resolve(root,'.local-data/tests');mkdirSync(base,{recursive:true});
 const path=mkdtempSync(resolve(base,'sku-unit-'));const context=await openDatabase(path);
 try{
  await migrate(context.db);
  const old={code:'102XS02001',name:'Sản phẩm thử',group:'Sợi',unit:'CÁI',status:'Đã xác nhận',confirmation_status:'Đã xác nhận',usage_status:'Đang sử dụng',line:'Line C'};
  await context.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('sku',old.code,JSON.stringify(old),'fixture','fixture').run();
  const catalog=[{key:old.code,payload:old},{key:'EXIST0001',payload:{code:'EXIST0001',name:'Giữ nguyên',group:'Khác',unit:'KG'}}];
  const rows=[
   {productCode:'102XS02001',level:'0',unit:'SỢI'},
   {productCode:'102XS02001',level:'.1',unit:'TỜ'},
   {productCode:'EXIST0001',level:'0',unit:'KG'},
   {productCode:'MISSING01',level:'0',unit:'CÁI'},
  ];
  const first=await importSkuUnitsFromBom(context.db,{rows,sourceFile:'BOM.pdf'},'SETUP_ADMIN',catalog);
  assert.equal(first.changedUnits,1);assert.equal(first.unchangedUnits,1);assert.equal(first.notInMaster,1);
  const saved=JSON.parse((await context.db.prepare("SELECT payload FROM app_records WHERE entity='sku' AND record_key='102XS02001'").first()).payload);
  assert.equal(saved.unit,'SỢI');assert.equal(saved.status,'Đã xác nhận');assert.equal(saved.confirmation_status,'Đã xác nhận');assert.equal(saved.usage_status,'Đang sử dụng');
  const history=(await context.db.prepare("SELECT payload FROM app_records WHERE entity='sku_history'").all()).results.map(row=>JSON.parse(row.payload));
  assert.equal(history.length,1);assert.equal(history[0].oldUnit,'CÁI');assert.equal(history[0].newUnit,'SỢI');assert.equal(history[0].source,'PDF BOM - Cấp 0');assert.equal(history[0].changedBy,'SETUP_ADMIN');
  assert.equal(await context.db.prepare("SELECT count(*) AS count FROM app_records WHERE entity='sku' AND record_key='MISSING01'").first().then(row=>row.count),0);
  const second=await importSkuUnitsFromBom(context.db,{rows,sourceFile:'BOM.pdf'},'SETUP_ADMIN',catalog);
  assert.equal(second.alreadyImported,true);
  assert.equal((await context.db.prepare("SELECT count(*) AS count FROM app_records WHERE entity='sku_history'").first()).count,1);
 }finally{await context.close();}
});
