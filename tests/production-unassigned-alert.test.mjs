import test from 'node:test';import assert from 'node:assert/strict';
import {unassignedAlerts} from '../lib/production-unassigned-alert.mjs';
const at=time=>Date.parse(`2026-10-28T${time}:00+07:00`),iso=time=>new Date(at(time)).toISOString();
const employees=['1','2'].map(id=>({id,name:`TEST ${id}`,line:'A',active:true}));
const day={date:'2026-10-28',working:true,hcStart:'08:00',hcEnd:'17:00',lunchStart:'12:00',lunchEnd:'13:00',breaks:[{start:'10:00',end:'10:10'},{start:'15:00',end:'15:10'}]};
const reference={key:'2026-10-26:A',days:[day],roster:[{date:day.date,hc:['1','2'],ot:[]}]};
const base={schedules:[reference],employees,orders:[{id:'O',line:'A',lsxQty:10,processes:['CUT']}],reports:[],events:[]};
const check=(time,extra={})=>unassignedAlerts({...base,now:at(time),...extra});
const stage=(time,people,status='running')=>({id:time,kind:'stage-work',sourceId:'O',stageName:'CUT',stageReporting:true,effectiveAt:iso(time),stageAfter:{orderId:'O',stage:'CUT',status,people,at:iso(time)}});
test('strictly over ten minutes; only working time and own line',()=>{assert.equal(check('08:10').length,0);assert.equal(check('08:11').length,2);assert.equal(check('08:11',{line:'B'}).length,0);for(const t of ['07:59','10:05','12:30','17:01'])assert.equal(check(t).length,0);assert.equal(check('13:00').length,2);assert.equal(check('13:11')[0].since,at('08:00'));assert.equal(check('13:11')[0].minutes,241);});
test('assigning waiting, running or paused stage suppresses warning; release creates a new episode',()=>{for(const status of ['waiting','running','paused'])assert.deepEqual(check('09:00',{events:[stage('08:00',['1'],status)]}).map(p=>p.id),['2']);const events=[stage('08:00',['1']),stage('09:00',[],'partial')];assert.equal(check('09:10',{events}).some(p=>p.id==='1'),false);assert.equal(check('09:11',{events}).find(p=>p.id==='1').since,at('09:00'));assert.notEqual(check('09:11',{events})[0].key,check('08:11')[0].key);});
test('absence, helper work, other work, departure and employment boundaries do not alert',()=>{for(const absenceType of ['Nghỉ','Phụ kho','CV khác','Đi trễ','Về sớm']){const events=[{id:'absence',kind:'line-absence',line:'A',employees:['1'],absenceType,effectiveAt:iso('08:00'),endsAt:iso('09:00')}];assert.deepEqual(check('08:20',{events}).map(p=>p.id),['2']);assert.equal(check('09:10',{events}).some(p=>p.id==='1'),false);assert.equal(check('09:11',{events}).find(p=>p.id==='1').since,at('09:00'));}assert.deepEqual(check('09:00',{employees:[{...employees[0],endDate:day.date},employees[1]]}).map(p=>p.id),['2']);});
test('unknown roster stays excluded, but anonymous legacy labor does not suppress named unassigned workers',()=>{assert.equal(check('09:00',{schedules:[{key:reference.key,days:[day]}]}).length,0);assert.equal(check('09:00',{events:[{id:'old',kind:'start',sourceId:'O',count:1,effectiveAt:iso('08:00')}]}).length,2);assert.deepEqual(check('09:00',{events:[{id:'old',kind:'start',sourceId:'O',count:1,employees:['1'],effectiveAt:iso('08:00')}]}).map(p=>p.id),['2']);});
test('temporary movement follows destination line and effective roster window',()=>{const move={id:'move',kind:'line-movement',line:'A',destinationLine:'B',employees:['1'],effectiveAt:iso('09:00'),endsAt:iso('11:00')};const b={...reference,key:'2026-10-26:B',roster:[{date:day.date,hc:[],ot:[]}]};const extra={events:[move],schedules:[reference,b]};assert.equal(check('09:10',extra).some(p=>p.id==='1'),false);assert.equal(check('09:11',extra).find(p=>p.id==='1').line,'B');assert.equal(check('09:11',{...extra,line:'A'}).some(p=>p.id==='1'),false);});

test('persistent reminder counts, five-minute acknowledgement, retries, concurrent tabs and permissions',async()=>{
 const {openDatabase,migrate}=await import('../scripts/local/database.mjs'),{mkdtempSync}=await import('node:fs'),{tmpdir}=await import('node:os'),{join}=await import('node:path');
 const {productionUnassignedReminder:remind}=await import('../scripts/local/production-unassigned-alert.mjs');
 const c=await openDatabase(mkdtempSync(join(tmpdir(),'reminder-test-')));try{await migrate(c.db);
 const actor={login:'TEST',line:'A'},workflow={...base,approvedSchedules:base.schedules,rights:{work:true}};
 let r=await remind(c.db,actor,workflow,null,at('08:11'));assert.equal(r.rows[0].count,0);const key=r.rows[0].key;
 await Promise.all([1,2].map(()=>remind(c.db,actor,workflow,{action:'show',keys:[key]},at('08:11'))));
 r=await remind(c.db,actor,workflow,null,at('08:12'));assert.equal(r.rows[0].count,1);assert.equal(r.rows[0].due,false);assert.equal(r.rows[0].acknowledgedAt,null);
 r=await remind(c.db,actor,workflow,{action:'acknowledge',keys:[key]},at('08:12'));assert.equal(r.rows[0].nextAt,at('08:17'));
 r=await remind(c.db,actor,workflow,{action:'acknowledge',keys:[key]},at('08:14'));assert.equal(r.rows[0].nextAt,at('08:17'));
 r=await remind(c.db,actor,workflow,{action:'show',keys:[key]},at('08:16'));assert.equal(r.rows[0].count,1);
 r=await remind(c.db,actor,workflow,null,at('08:17'));assert.equal(r.rows[0].due,true);
 r=await remind(c.db,actor,workflow,{action:'show',keys:[key]},at('08:17'));assert.equal(r.rows[0].count,2);
 r=await remind(c.db,actor,workflow,{action:'acknowledge',keys:[key]},at('08:18'));assert.equal(r.rows[0].nextAt,at('08:23'));
 r=await remind(c.db,actor,{...workflow,events:[stage('08:20',['1'])]},{action:'show',keys:[key]},at('08:24'));assert.equal(r.rows.some(p=>p.id==='1'),false);
 const record=await c.db.prepare("SELECT payload FROM app_records WHERE entity='production_unassigned_reminder'").first();assert.equal(JSON.parse(record.payload).count,2);
 assert.equal((await remind(c.db,{login:'OTHER',line:'B'},workflow,null,at('08:30'))).rows.length,0);
 await assert.rejects(()=>remind(c.db,actor,{...workflow,rights:{work:false}},null,at('08:30')),/quyền/);
 assert.equal((await c.db.prepare("SELECT count(*) n FROM app_records WHERE entity IN ('production_event','production_report','users','permissions')").first()).n,0);
 }finally{await c.close();}
});


test('old anonymous paused stage cannot silence the entire line; named assignments still suppress only those people',()=>{
 const events=[{...stage('08:00',[],'paused'),sourceVerified:true}];assert.equal(check('09:00',{events}).length,2);
 events.push(stage('08:30',['1']));assert.deepEqual(check('09:00',{events}).map(r=>r.id),['2']);
});
test('lunch preserves elapsed working wait, excludes lunch minutes and recognizes assignments made during lunch',()=>{
 const events=[stage('08:00',['1','2']),stage('11:55',[],'partial')];assert.equal(check('12:30',{events}).length,0);assert.equal(check('13:05',{events}).length,0);
 const rows=check('13:06',{events});assert.equal(rows.length,2);assert.equal(rows[0].minutes,11);assert.equal(rows[0].since,at('11:55'));
 events.push(stage('12:10',['1']),stage('12:20',[],'partial'));const after=check('13:06',{events});assert.deepEqual(after.map(r=>r.id),['2']);assert.equal(check('13:11',{events}).find(r=>r.id==='1').since,at('13:00'));
});
