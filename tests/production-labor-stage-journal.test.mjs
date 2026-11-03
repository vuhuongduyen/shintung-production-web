import test from 'node:test';import assert from 'node:assert/strict';
import {laborJournal,filterLabor} from '../lib/production-labor-journal.mjs';
const at=h=>`2026-10-28T${h}:00+07:00`,orders=[{id:'O',lsxCode:'TEST-ONE',line:'B',processes:['PHAO'],lsxQty:2000},{id:'D',lsxCode:'TEST-TWO',line:'B',processes:['PACKING'],lsxQty:2000}],people=[{id:'A',name:'Nhân viên giả A',line:'B'},{id:'B',name:'Nhân viên giả B',line:'C'}];
const event=(id,action,time,before,after,order='O',extra={})=>({id,kind:'stage-work',stageReporting:true,stageAction:action,sourceId:order,stageName:order==='O'?'PHAO':'PACKING',line:'B',actorId:'TEST-OPERATOR',effectiveAt:at(time),recordedAt:at(time),stageBefore:{people:before,status:'running'},stageAfter:{people:after,status:after.length?'running':'partial',at:at(time),completed:0},employees:after,...extra});
const now=Date.parse(at('16:00'));
test('partial exit A→B records both people and uses current stage instead of obsolete legacy assignment',()=>{
 const events=[{id:'legacy',kind:'start',sourceId:'D',employees:['A'],count:1,effectiveAt:at('07:00')},event('donor','start','07:30',[],[],'D'),event('start','start','08:00',[],['A']),event('exit','complete','10:00',['A'],['B'])];
 const before=JSON.stringify(events),d=laborJournal(events,orders,people,now);
 const a=d.positions.find(p=>p.id==='A'),b=d.positions.find(p=>p.id==='B');assert.equal(a.status,'Chờ phân bổ');assert.equal(b.order.id,'O');assert.equal(b.stage,'PHAO');assert.equal(b.line,'B');assert.equal(a.history[0].operation,'Xuất trạm');assert.equal(b.history[0].assignmentNote,'Bắt đầu phân công');assert.equal(a.history[0].destination.id,null);assert.equal(b.history[0].destination.stage,'PHAO');assert.equal(JSON.stringify(events),before);
});
test('linked transfer is attached to receiving operation once per employee; unmatched transfer remains',()=>{
 const events=[event('old','start','08:00',[],['B'],'D'),event('release','transfer','09:00',['B'],[],'D'),event('receive','add','09:00',[],['B'])];
 const d=laborJournal(events,orders,people,now),p=d.positions.find(p=>p.id==='B');assert.equal(p.history.length,2);assert.equal(p.history[0].operation,'Bổ sung người');assert.equal(p.history[0].source.id,'D');assert.equal(p.history[0].source.stage,'PACKING');assert.equal(p.history[0].destination.id,'O');assert.equal(d.rows.some(r=>r.eventId==='release'),false);
 assert.ok(laborJournal(events.slice(0,2),orders,people,now).rows.some(r=>r.eventId==='release'));
});
test('pause/resume, cancelled/future exit and date/name search preserve assignment evidence',()=>{
 const events=[event('start','start','08:00',[],['A']),event('pause','pause','09:00',['A'],['A'],'O',{stageAfter:{people:['A'],status:'paused',at:at('09:00')}}),event('cancel','complete','10:00',['A'],[],'O',{voided:true}),event('future','complete','17:00',['A'],[])];
 const d=laborJournal(events,orders,people,now);assert.equal(d.positions[0].stageStatus,'paused');assert.equal(d.positions[0].order.id,'O');assert.ok(d.positions[0].history.some(r=>r.status==='Đã hủy'));assert.equal(filterLabor(d.rows,{field:'employee',value:'giả A',from:'2026-10-28',to:'2026-10-28'}).length,4);assert.equal(filterLabor(d.rows,{from:'2026-10-29'}).length,0);assert.equal(d.positions[1].status,'Chưa xác định');
});
test('verified historical report creates named stage history without assigning anonymous staff',()=>{
 const reports=[{id:'R',erpStageImport:true,transitId:'O',stageName:'PHAO',employees:['A'],stageQuantity:1000,startedAt:at('08:00'),completedAt:at('10:00'),reportedAt:at('10:01')}];
 const d=laborJournal([],orders,people,now,reports);assert.equal(d.positions[0].history.length,2);assert.equal(d.positions[0].history[0].operation,'Xuất trạm');assert.equal(d.positions[0].status,'Chờ phân bổ');assert.equal(d.positions[1].history.length,0);
});

test('adding another worker does not invent a movement for existing crew',()=>{
 const events=[event('start','start','08:00',[],['A']),event('add','add','09:00',['A'],['A','B'])];const before=JSON.stringify(events),d=laborJournal(events,orders,people,now);
 assert.equal(d.positions.find(p=>p.id==='A').history.length,1);assert.equal(d.positions.find(p=>p.id==='B').history.length,1);assert.equal(d.positions.find(p=>p.id==='B').history[0].operation,'Bổ sung người');assert.equal(JSON.stringify(events),before);
});
