import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {openDatabase,migrate,root} from '../scripts/local/database.mjs';
import {saveEmployee,readEmployees} from '../scripts/local/employees.mjs';
import {cancelBasicMaster} from '../scripts/local/basic-master.mjs';
import {employeeActiveOn} from '../lib/employee-employment.mjs';
const actor={login:'TEST-admin',isAdmin:true};
test('employment dates are inclusive start and exclusive end; legacy records remain unchanged',()=>{
 const p={startDate:'2026-10-26',endDate:'2026-10-28',employmentDatesManaged:true};
 assert.equal(employeeActiveOn(p,'2026-10-25'),false);assert.equal(employeeActiveOn(p,'2026-10-26'),true);assert.equal(employeeActiveOn(p,'2026-10-28'),false);
 assert.equal(employeeActiveOn({active:false}),false);assert.equal(employeeActiveOn({active:true}),true);assert.equal(employeeActiveOn({...p,cancelled:true},'2026-10-26'),false);
});
test('new employee requires start; validates dates, restores only explicitly, retains history and version guard',async()=>{
 const dir=resolve(root,'.local-data/tests');mkdirSync(dir,{recursive:true});const c=await openDatabase(mkdtempSync(resolve(dir,'employment-')));await migrate(c.db);
 try{
 const body={id:'TEST-NEW',name:'Synthetic employee',line:'C',version:0};
 await assert.rejects(saveEmployee(c.db,body,actor),/Ngày bắt đầu/);
 await assert.rejects(saveEmployee(c.db,{...body,startDate:'2026-02-30'},actor),/không hợp lệ/);
 await assert.rejects(saveEmployee(c.db,{...body,startDate:'2026-10-26',endDate:'2026-10-25'},actor),/trước/);
 const created=(await saveEmployee(c.db,{...body,startDate:'2026-10-26'},actor)).employee;
 await assert.rejects(saveEmployee(c.db,{...created,endDate:'2026-10-28'},{login:'viewer',grants:[]}),e=>e.status===403);
 await assert.rejects(cancelBasicMaster(c.db,{entity:'employees',key:body.id,expectedVersion:1},actor),/Ngày ngưng/);
 const old={...created,cancelled:true,status:'Đã hủy',active:false,version:2};
 await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='employees' AND record_key=?").bind(JSON.stringify(old),body.id).run();
 await assert.rejects(saveEmployee(c.db,old,actor),/đã Hủy/);
 const restored=(await saveEmployee(c.db,{...old,action:'restore'},actor)).employee;
 assert.equal(restored.cancelled,false);assert.equal(restored.version,3);assert.equal(restored.history.at(-1).action,'Khôi phục');assert.equal(restored.history.at(-1).before.cancelled,true);
 await assert.rejects(saveEmployee(c.db,{...old,action:'restore'},actor),/không ở trạng thái/);
 const stopped=(await saveEmployee(c.db,{...restored,endDate:'2026-10-26'},actor)).employee;assert.equal(stopped.active,false);assert.equal(stopped.history.length,3);
 const active=(await saveEmployee(c.db,{...stopped,endDate:''},actor)).employee;assert.equal(active.active,true);
 assert.equal((await readEmployees(c.db,actor)).permissions.cancel,false);
 }finally{await c.close();}
});
