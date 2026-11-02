import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {stageEmployeeChoices} from '../lib/production-stage-staff.mjs';
import {openDatabase,migrate} from '../scripts/local/database.mjs';
import {readProductionWorkflow,mutateProductionWorkflow} from '../scripts/local/production-workflow.mjs';
const date='2026-09-25',day={date,working:true,ot:true,hcStart:'08:00',hcEnd:'17:00',otStart:'17:30',otEnd:'21:00',lunchStart:'12:00',lunchEnd:'13:00',breaks:[],cleaning:[]};
const employees=[{id:'C1',line:'C',name:'Loan 1',active:true},{id:'C2',line:'C',name:'Loan 2',active:true},{id:'C3',line:'C',name:'Unrelated',active:true},{id:'B1',line:'B',active:true}];
const roster={date,hc:['B1','C1','C2'],hcWindows:{C1:[[540,720]],C2:[[480,1020]]},ot:['B1']};
const reference={key:'2026-09-21:B',days:[day],roster:[roster],input:{dailySchedule:[day]}};
test('picker follows loan windows, shifts and actual absence, not home Line',()=>{
 const choose=(time,events=[])=>stageEmployeeChoices({employees,events,schedules:[reference],line:'B',effectiveAt:`${date}T${time}:00+07:00`}).map(p=>p.id).sort();
 assert.deepEqual(choose('08:30'),['B1','C2']);assert.deepEqual(choose('09:00'),['B1','C1','C2']);assert.deepEqual(choose('12:00'),['B1','C2']);assert.deepEqual(choose('18:00'),['B1']);
 assert.deepEqual(choose('09:30',[{kind:'line-absence',line:'B',employees:['C1'],effectiveAt:`${date}T09:00:00+07:00`,endsAt:`${date}T10:00:00+07:00`,approved:true}]),['B1','C2']);
});
test('Line B reader gets loaned names only; stage API accepts them in roster window and rejects unrelated/outside window',async()=>{
 const c=await openDatabase(mkdtempSync(join(tmpdir(),'stage-roster-')));
 try{const db=c.db;await migrate(db);const put=(entity,id,p)=>db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind(entity,id,JSON.stringify(p),'TEST','2026-09-20').run();
 const days=Array.from({length:7},(_,i)=>({...day,date:`2026-09-${21+i}`}));
 await put('capacity','2026-09-21',{schemaVersion:1,rows:[{line:'B',status:'Đã xác nhận',reviewStatus:'approved',version:1,input:{workers:3,dailySchedule:days,dailyRoster:[roster]}}]});
 for(const e of employees)await put('employees',e.id,{...e,privateNote:'not exposed to borrowed Line'});
 await put('in_transit','O',{id:'O',planId:'O',lsxCode:'O',sku:'O',line:'B',lsxQty:100,lsxOpenedAt:'2026-09-21',syncStatus:'ĐÃ ĐỒNG BỘ'});
 const actor={login:'TEST',isAdmin:true,line:'B'},catalog=[{code:'O',processes:['CUT','FINAL']}];
 const state=await readProductionWorkflow(db,{login:'B_READER',line:'B',grants:['Quản lý sản xuất / Báo công sản xuất / Xem']},catalog);
 assert.equal(state.employees.some(e=>e.id==='C3'),false);
 assert.ok(state.employees.some(e=>e.id==='C1'));assert.ok(state.employees.some(e=>e.id==='C2'));assert.equal(state.employees.find(e=>e.id==='C1').privateNote,undefined);
 const send=(id,time,stage='CUT')=>mutateProductionWorkflow(db,{action:'start',orderId:'O',effectiveAt:`${date}T${time}:00+07:00`,stageEntries:[{stage,people:[id]}],requestIdempotency:crypto.randomUUID()},actor,catalog);
 await assert.rejects(()=>send('C1','08:30'),/chưa thuộc ca/);await assert.rejects(()=>send('C3','09:00'),/chưa thuộc ca/);
 await send('C1','09:00');await send('C2','09:00','FINAL');
 const end=await mutateProductionWorkflow(db,{action:'complete',orderId:'O',effectiveAt:`${date}T11:00:00+07:00`,stageEntries:[{stage:'CUT',quantity:100}],requestIdempotency:crypto.randomUUID()},actor,catalog);
 assert.equal(end.reports[0].hours.total,1.8333); // Default 10-minute morning break remains excluded.
 }finally{await c.close();}
});
