import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {openDatabase,migrate,root} from '../scripts/local/database.mjs';
import {mutateBom} from '../scripts/local/bom-lifecycle.mjs';
import {mutateBomBulk} from '../scripts/local/bom-bulk.mjs';
import {recordRevision} from '../lib/record-revision.mjs';
import {bomLineActive,bomPositive} from '../lib/bom-rules.mjs';
import {canBomAction} from '../lib/bom-permissions.mjs';

const actor={login:'bom-manager@test',isAdmin:true};
const catalog=['ROOT','PART','NEW'].map(code=>({key:code,payload:{code,name:code,group:'Nhóm',mode:code==='ROOT'?'Tự sản xuất':'Mua hàng',confirmation_status:'Đã xác nhận',usage_status:'Đang sử dụng'}}));
const draft=()=>({sku:'ROOT',name:'ROOT',category:'THÀNH PHẨM',items:[{code:'PART',name:'PART',source:'Mua',qty:'1',denominator:'10',waste:'2%',effective:'—',expiry:'—'}]});
async function fixture(){const dir=resolve(root,'.local-data/tests');mkdirSync(dir,{recursive:true});const c=await openDatabase(mkdtempSync(resolve(dir,'bom-life-')));await migrate(c.db);return c;}
async function stored(db,entity,key){const row=await db.prepare('SELECT payload FROM app_records WHERE entity=? AND record_key=?').bind(entity,key).first();return row&&JSON.parse(row.payload);}
async function confirmed(db){const save=await mutateBom(db,{action:'save',key:'ROOT',payload:draft(),expectedRevision:null,createOnly:true},actor,catalog);return mutateBom(db,{action:'confirm',key:'ROOT',expectedRevision:save.revision},actor,catalog);}
async function change(db,bom,key='ONE',line={code:'PART',action:'Thay đổi',newQty:'2',denominator:'10',waste:'3%'}){
 return mutateBomBulk(db,{single:true,action:'save',key,sku:'ROOT',reason:'Đổi định mức',lines:[line],expectedRevision:null,sourceRevision:bom.revision},actor,catalog);
}

test('new BOM requires usable master, rejects bad numeric data, confirms and restores draft with audit',async()=>{const c=await fixture();try{
 await assert.rejects(mutateBom(c.db,{action:'save',key:'NO-MASTER',expectedRevision:null,payload:{...draft(),sku:'NO-MASTER'}},actor,catalog),e=>e.status===409);
 for(const [qty,denominator] of [['-1','1'],['1','0'],['abc','1'],['1','-2']]){
  const b=draft();Object.assign(b.items[0],{qty,denominator});
  await assert.rejects(mutateBom(c.db,{action:'save',key:'ROOT',expectedRevision:null,payload:b},actor,catalog),e=>e.status===400);
 }
 const b=await confirmed(c.db);assert.equal(b.bom.status,'Đã xác nhận');assert.equal(b.bom.group,'Nhóm');assert.equal(b.bom.category,'THÀNH PHẨM');assert.notEqual(b.bom.items[0].effective,'—');
 const undo=await mutateBom(c.db,{action:'undo',key:'ROOT',expectedRevision:b.revision},actor,catalog);
 assert.equal(undo.bom.status,'Chờ xác nhận');assert.deepEqual(undo.bom.items,b.bom.confirmationSnapshot.items);
 assert.equal((await stored(c.db,'bom','ROOT')).status,'Chờ xác nhận');
 }finally{await c.close();}});

test('single change saves source, confirms atomically, undo restores all BOM fields',async()=>{const c=await fixture();try{
 const b=await confirmed(c.db),before=JSON.stringify(b.bom);
 const saved=await change(c.db,b);
 assert.equal(saved.change.bulk,false);assert.equal(JSON.stringify(await stored(c.db,'bom','ROOT')),before);
 const result=await mutateBomBulk(c.db,{single:true,action:'confirm',key:'ONE',expectedRevision:saved.revision},actor,catalog);
 assert.equal(result.boms[0].items.at(-1).qty,'2');assert.equal(result.boms[0].version,'0002');
 const undo=await mutateBomBulk(c.db,{single:true,action:'undo',key:'ONE',expectedRevision:result.revision},actor,catalog);
 assert.equal(undo.change.status,'Đã hủy xác nhận');assert.equal(JSON.stringify(await stored(c.db,'bom','ROOT')),before);
 }finally{await c.close();}});

test('single stale confirmation and later-write undo are rejected without partial writes',async()=>{const c=await fixture();try{
 const b=await confirmed(c.db),saved=await change(c.db,b);
 const raw=JSON.stringify({...b.bom,version:'0002'});
 await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='bom' AND record_key='ROOT'").bind(raw).run();
 await assert.rejects(mutateBomBulk(c.db,{single:true,action:'confirm',key:'ONE',expectedRevision:saved.revision},actor,catalog),e=>e.status===409);
 assert.equal((await stored(c.db,'bom_change','ONE')).status,'Chờ xác nhận');
 await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='bom' AND record_key='ROOT'").bind(JSON.stringify(b.bom)).run();
 const result=await mutateBomBulk(c.db,{single:true,action:'confirm',key:'ONE',expectedRevision:saved.revision},actor,catalog);
 await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='bom' AND record_key='ROOT'").bind(JSON.stringify({...result.boms[0],modifiedDate:'01/10/2026'})).run();
 await assert.rejects(mutateBomBulk(c.db,{single:true,action:'undo',key:'ONE',expectedRevision:result.revision},actor,catalog),e=>e.status===409);
 assert.equal((await stored(c.db,'bom_change','ONE')).status,'Đã xác nhận');
 }finally{await c.close();}});

test('denominator-only change, pending edit and decimal comma are valid; invalid numbers cannot persist',async()=>{const c=await fixture();try{
 const b=await confirmed(c.db),line={code:'PART',action:'Thay đổi',newQty:'',denominator:'20',waste:''};
 const saved=await change(c.db,b,'DENOM',line);
 const edited=await mutateBomBulk(c.db,{single:true,action:'save',key:'DENOM',sku:'ROOT',reason:'Sửa mẫu số',lines:[{...line,denominator:'25'}],expectedRevision:saved.revision,sourceRevision:b.revision},actor,catalog);
 const result=await mutateBomBulk(c.db,{single:true,action:'confirm',key:'DENOM',expectedRevision:edited.revision},actor,catalog);
 assert.equal(result.boms[0].items.at(-1).denominator,'25');assert.equal(result.boms[0].items.at(-1).qty,'1');
 await assert.rejects(change(c.db,{revision:result.bomRevisions.ROOT},'BAD',{...line,denominator:'0'}),e=>e.status===400);
 assert.equal(await stored(c.db,'bom_change','BAD'),null);assert.equal(bomPositive('0,136','Lượng dùng'),'0.136');
 }finally{await c.close();}});

test('legacy confirmed single document restores only matching before/after audit evidence',async()=>{const c=await fixture();try{
 const b=await confirmed(c.db),saved=await change(c.db,b);
 const result=await mutateBomBulk(c.db,{single:true,action:'confirm',key:'ONE',expectedRevision:saved.revision},actor,catalog);
 const legacy={...result.change};delete legacy.appliedRevisions;delete legacy.sourceSnapshots;
 await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='bom_change' AND record_key='ONE'").bind(JSON.stringify(legacy)).run();
 const undo=await mutateBomBulk(c.db,{single:true,action:'undo',key:'ONE',expectedRevision:await recordRevision(JSON.stringify(legacy))},actor,catalog);
 assert.deepEqual(undo.boms[0],b.bom);
 }finally{await c.close();}});

test('effective date rules and exact action permissions are shared and cannot confuse cancel with approve',()=>{
 assert.equal(bomLineActive({effective:'01/10/2026',expiry:'—'},'2026-09-30'),false);
 assert.equal(bomLineActive({effective:'—',expiry:'01/10/2026'},'2026-09-30'),true);
 assert.equal(bomLineActive({effective:'—',expiry:'30/09/2026'},'2026-09-30'),false);
 const writer={login:'writer',grants:['Cấu trúc thành phẩm / BOM / Sửa']};
 assert.equal(canBomAction(writer,'save',true),true);assert.equal(canBomAction(writer,'save',false),false);assert.equal(canBomAction(writer,'confirm'),false);
 const undo={login:'undo',grants:['Cấu trúc thành phẩm / Phiếu thay đổi BOM / Hủy xác nhận']};
 assert.equal(canBomAction(undo,'undo',false,'Phiếu thay đổi BOM'),true);assert.equal(canBomAction(undo,'undo',false,'Dữ liệu lượng dùng BOM'),false);
 assert.equal(canBomAction(undo,'undo'),true);assert.equal(canBomAction(undo,'confirm'),false);
});
