import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {openDatabase,migrate,root} from '../scripts/local/database.mjs';
import {cancelBasicMaster} from '../scripts/local/basic-master.mjs';
import {recordRevision} from '../lib/record-revision.mjs';
import {siteLaborHours} from '../lib/site-labor-hours.mjs';
import {usableSku} from '../lib/sku-state.mjs';
import {isMasterCancelled,newestMasterFirst,canCancelMaster,projectCancelledMaster} from '../lib/basic-master.mjs';
const actor={login:'master-manager@test',isAdmin:true};
async function fixture(){const dir=resolve(root,'.local-data/tests');mkdirSync(dir,{recursive:true});const c=await openDatabase(mkdtempSync(resolve(dir,'basic-master-')));await migrate(c.db);return c;}
async function put(db,entity,key,payload){await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind(entity,key,JSON.stringify(payload),'fixture','fixture').run();return recordRevision(JSON.stringify(payload));}
async function read(db,entity,key){const row=await db.prepare('SELECT payload FROM app_records WHERE entity=? AND record_key=?').bind(entity,key).first();return row&&JSON.parse(row.payload);}

test('cancellation retains SKU, labor and employee values and history, excludes future use and rejects stale/duplicate cancellation',async()=>{const c=await fixture();try{
 const sku={code:'ROOT',name:'Product',revision:4,version:2,confirmation_status:'Đã xác nhận',usage_status:'Đang sử dụng',status:'Đã xác nhận'};
 const rev=await put(c.db,'sku','ROOT',sku);
 await assert.rejects(cancelBasicMaster(c.db,{entity:'sku',key:'ROOT',expectedRevision:null},actor),e=>e.status===409);
 await assert.rejects(cancelBasicMaster(c.db,{entity:'sku',key:'ROOT',expectedRevision:rev},{login:'viewer',grants:['Dữ liệu cơ bản / SKU Master / Xem']}),e=>e.status===403);
 const result=await cancelBasicMaster(c.db,{entity:'sku',key:'ROOT',expectedRevision:rev},actor);
 assert.equal(result.records[0].payload.name,sku.name);assert.equal(usableSku(result.records[0].payload),false);assert.equal(result.records[0].payload.revision,5);assert.equal(result.records[0].payload.version,2);
 assert.equal((await c.db.prepare("SELECT count(*) total FROM app_records WHERE entity='sku_history'").first()).total,1);
 await assert.rejects(cancelBasicMaster(c.db,{entity:'sku',key:'ROOT',expectedRevision:result.records[0].revision},actor),e=>e.status===409);
 await put(c.db,'labor_hours','ROOT',{sku:'ROOT',laborHour:0.136,note:'Original',version:2});
 await assert.rejects(cancelBasicMaster(c.db,{entity:'labor_hours',key:'ROOT',expectedVersion:1},actor),e=>e.status===409);
 await cancelBasicMaster(c.db,{entity:'labor_hours',key:'ROOT',expectedVersion:2},actor);
 const labor=await read(c.db,'labor_hours','ROOT');assert.equal(labor.laborHour,0.136);assert.equal(labor.note,'Original');
 const applied=siteLaborHours([{key:'ROOT',payload:labor}]).find(r=>r.key==='ROOT').payload;assert.equal(applied.laborHour,null);assert.equal(applied.retainedLaborHour,0.136);
 await put(c.db,'employees','NV1',{id:'NV1',name:'Employee',line:'A',active:true,version:1,history:[]});
 await cancelBasicMaster(c.db,{entity:'employees',key:'NV1',expectedVersion:1},actor);
 const employee=await read(c.db,'employees','NV1');assert.equal(employee.active,false);assert.equal(employee.name,'Employee');assert.equal(employee.history.at(-1).action,'Hủy');
 }finally{await c.close();}});

test('Leadtime cancellation atomically stops active and pending versions without restoring legacy values',async()=>{const c=await fixture();try{
 const rev=await put(c.db,'leadtime','ROOT',{sku:'ROOT',leadTime:8});
 const a=await put(c.db,'leadtime_versions','LT1',{id:'LT1',sku:'ROOT',leadTime:8,status:'Đang áp dụng'});
 const b=await put(c.db,'leadtime_versions','LT2',{id:'LT2',sku:'ROOT',leadTime:10,status:'Chờ xác nhận'});
 await assert.rejects(cancelBasicMaster(c.db,{entity:'leadtime',key:'ROOT',expectedRevision:rev,linkedRevisions:{LT1:a,LT2:null}},actor),e=>e.status===409);
 assert.equal((await read(c.db,'leadtime','ROOT')).cancelled,undefined);
 await cancelBasicMaster(c.db,{entity:'leadtime',key:'ROOT',expectedRevision:rev,linkedRevisions:{LT1:a,LT2:b}},actor);
 assert.equal((await read(c.db,'leadtime_versions','LT1')).status,'Đã hủy');assert.equal((await read(c.db,'leadtime_versions','LT2')).status,'Đã hủy');
 const retained=await read(c.db,'leadtime','ROOT');assert.equal(retained.leadTime,8);assert.equal(projectCancelledMaster('leadtime',retained).leadTime,0);
 }finally{await c.close();}});

test('Safety cancellation keeps ranges and cancels linked rule together; built-in records can be cancelled without seeding others',async()=>{const c=await fixture();try{
 const result=await cancelBasicMaster(c.db,{entity:'safety_rule_groups',key:'SD-LT-V1',expectedRevision:null,linkedRevision:null},actor);
 assert.equal(result.records.length,2);assert.ok(result.records[0].payload.rows.length);assert.equal((await read(c.db,'safety_rules','SD-LT-V1')).status,'Đã hủy');
 const count=(await c.db.prepare("SELECT count(*) total FROM app_records WHERE entity='safety_rule_groups'").first()).total;assert.equal(count,1);
 const base=siteLaborHours([])[0];await cancelBasicMaster(c.db,{entity:'labor_hours',key:base.key,expectedVersion:1},actor);
 assert.equal((await read(c.db,'labor_hours',base.key)).laborHour,base.payload.laborHour);
 }finally{await c.close();}});

test('Create - date sorts by newest add/edit time and Cancel permission cannot be mistaken for Cancel confirmation',()=>{
 const rows=[{createdAt:'2026-09-01T00:00:00Z'},{createdAt:'2026-08-01T00:00:00Z',updatedAt:'2026-09-30T00:00:00Z'},{history:[{at:'2026-09-15T00:00:00Z'}]}];
 assert.equal(rows.slice().sort(newestMasterFirst)[0],rows[1]);assert.equal(isMasterCancelled({status:'Đã hủy xác nhận'}),false);
 assert.equal(canCancelMaster({login:'writer',grants:['Dữ liệu cơ bản / Giờ công / Sửa']},'labor_hours'),true);
 assert.equal(canCancelMaster({login:'approver',grants:['Dữ liệu cơ bản / Giờ công / Hủy xác nhận']},'labor_hours'),false);
});
