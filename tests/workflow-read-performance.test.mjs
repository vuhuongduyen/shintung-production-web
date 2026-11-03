import test from 'node:test';
import assert from 'node:assert/strict';
import {readProductionWorkflow} from '../scripts/local/production-workflow.mjs';
import {readEmployees} from '../scripts/local/employees.mjs';
import {permissionProfiles} from '../lib/user-permission-profiles.mjs';
import {pendingReportReview,reportReviewBlocker} from '../lib/production-progress-review.mjs';
const directory=[{record_key:'TEST-E1',payload:JSON.stringify({name:'Fake employee',line:'A',active:true})}];
function database(){const reads=[];return {reads,prepare(sql){let args=[];return {bind(...values){args=values;return this;},async all(){const entity=args[0]||(/entity='([^']+)'/.exec(sql)||[])[1];reads.push(entity);return {results:entity!=='employees'?[]:sql.includes('length(CAST')?(args.at(-1)?[]:directory.map(r=>({entity:'employees',record_key:r.record_key,bytes:r.payload.length}))):directory};}};}};}
test('workflow reads capacity once per request without cross-user cache',async()=>{
 const db=database(),qlsx={login:'TEST-QLSX',grants:permissionProfiles.QLSX.grants};
 const first=await readProductionWorkflow(db,qlsx);assert.equal(first.rights.manager,true);assert.equal(db.reads.filter(e=>e==='capacity').length,1);
 const before=db.reads.length;const hr=await readProductionWorkflow(db,{login:'TEST-HR',grants:permissionProfiles.HR.grants});assert.equal(hr.rights.manager,false);assert.equal(hr.rights.hr,true);assert.ok(db.reads.length>before);assert.equal(db.reads.filter(e=>e==='capacity').length,2);
});
test('employee directory reads one entity and enforces view permission before SQL',async()=>{
 const db=database();await assert.rejects(()=>readEmployees(db,{login:'NONE',grants:[]}),e=>e.status===403);assert.equal(db.reads.length,0);
 const result=await readEmployees(db,{login:'CUSTOM-HR',grants:['Dữ liệu cơ bản / Danh sách nhân viên / Xem']});assert.equal(result.employees.length,1);assert.deepEqual(db.reads,['employees']);assert.equal(result.permissions.edit,false);
});
test('review fixtures distinguish pending, confirmed, cancelled and incomplete reports',()=>{
 const valid={reviewStatus:'Chờ kiểm tra',hours:{hc:8,ot:0,total:8}};
 assert.equal(pendingReportReview(valid),true);assert.equal(reportReviewBlocker(valid),'');
 assert.equal(pendingReportReview({...valid,reviewStatus:'Đã xác nhận'}),false);
 assert.equal(pendingReportReview({...valid,cancelled:true}),false);
 assert.notEqual(reportReviewBlocker({...valid,hours:null}),'');
 assert.notEqual(reportReviewBlocker({...valid,pendingAttendance:['TEST-A']}),'');
});
test('progress edit grant does not become schedule manager or confirmation authority',async()=>{
 const editOnly={login:'TEST-EDIT',grants:['Quản lý sản xuất / Tiến độ sản xuất / Sửa']};
 assert.equal((await readProductionWorkflow(database(),editOnly)).rights.manager,false);
 assert.equal(editOnly.grants.some(g=>g.endsWith('/ Xác nhận')),false);
 assert.equal((await readProductionWorkflow(database(),editOnly)).rights.confirm,false);
 const confirmOnly={login:'TEST-CONFIRM',grants:['Quản lý sản xuất / Tiến độ sản xuất / Xác nhận']};
 assert.equal((await readProductionWorkflow(database(),confirmOnly)).rights.confirm,true);
 assert.equal((await readProductionWorkflow(database(),{login:'TEST-VIEW',grants:['Quản lý sản xuất / Tiến độ sản xuất / Xem']})).rights.manager,false);
});
