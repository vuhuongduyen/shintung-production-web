import test from 'node:test';import assert from 'node:assert/strict';
import {hasScheduledWorkday} from '../lib/production-extra-policy.mjs';
import {openDatabase,migrate} from '../scripts/local/database.mjs';
import {mutateProductionWorkflow} from '../scripts/local/production-workflow.mjs';
import {mkdtempSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
test('daily policy follows Line, date, resolved day, including OT-only dates',()=>{
 const refs=[{key:'2026-09-21:A',days:[{date:'2026-09-25',working:true},{date:'2026-09-26',working:false,ot:true},{date:'2026-09-27',working:false,ot:false}]}];assert.equal(hasScheduledWorkday(refs,'A','2026-09-25'),true);assert.equal(hasScheduledWorkday(refs,'A','2026-09-26'),true);assert.equal(hasScheduledWorkday(refs,'A','2026-09-27'),false);assert.equal(hasScheduledWorkday(refs,'B','2026-09-25'),false);assert.equal(hasScheduledWorkday([],'A','2026-09-25'),false);
});
test('API rejects extra work on scheduled day even during lunch and outside shift, without writing; unscheduled day is accepted',async()=>{
 const c=await openDatabase(mkdtempSync(join(tmpdir(),'extra-policy-')));try{const db=c.db;await migrate(db);const put=(e,k,p)=>db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind(e,k,JSON.stringify(p),'TEST','2026-09-20').run();
 await put('capacity','2026-09-21',{rows:[{line:'A',status:'Đã xác nhận',reviewStatus:'approved',version:1,input:{workers:1,dailySchedule:Array.from({length:7},(_,i)=>({date:`2026-09-${21+i}`,working:i<5,ot:false,hcStart:'08:00',hcEnd:'17:00',lunchStart:'12:00',lunchEnd:'13:00',breaks:[],cleaning:[]}))}}]});await put('employees','N',{id:'N',name:'TEST ONLY',line:'A',active:true});await put('in_transit','O',{id:'O',planId:'O',lsxCode:'O',sku:'O',line:'A',lsxQty:100,lsxOpenedAt:'2026-09-21',syncStatus:'ĐÃ ĐỒNG BỘ'});
 const send=(at,extra={})=>mutateProductionWorkflow(db,{action:'extra',orderId:'O',effectiveAt:at,stageEntries:[{stage:'FINAL',people:['N']}],requestIdempotency:crypto.randomUUID(),...extra},{login:'ADMIN',isAdmin:true},[{code:'O',processes:['FINAL']}]);
 for(const time of ['07:00','09:00','12:30','18:00'])await assert.rejects(()=>send(`2026-09-25T${time}:00+07:00`),/đã có lịch làm việc/);
 assert.equal((await db.prepare("SELECT count(*) n FROM app_records WHERE entity='production_event'").first()).n,0);
 await send('2026-09-26T08:00:00+07:00');assert.equal((await db.prepare("SELECT count(*) n FROM app_records WHERE entity='production_event'").first()).n,1);
 }finally{await c.close();}
});
