import test from 'node:test';
import assert from 'node:assert/strict';
import {laborJournal,filterLabor} from '../lib/production-labor-journal.mjs';
const orders=[{id:'source',lsxCode:'510-26091801',name:'DÂY XẢ INOX SỌC',sku:'102XS05001',line:'A'},{id:'target',lsxCode:'510-26091802',name:'DÂY TẮM INOX',sku:'102TC06001',line:'B'}];
const employees=[{id:'EMP01',name:'Nhân viên theo ID',line:'A'}];
const event=(id,kind,h,extra={})=>({id,kind,effectiveAt:`2026-10-06T${h}:00:00+07:00`,recordedAt:`2026-10-06T${h}:01:00+07:00`,sourceId:'source',count:1,employees:['EMP01'],...extra});
const now=Date.parse('2026-10-06T12:00:00+07:00');
test('transfer tracks destination and before/after on both sides; absence does not move employee',()=>{
 const es=[event('s','start','08'),event('t','transfer','09',{destinationId:'target'}),event('a','absence','10',{sourceId:'target'})];
 const d=laborJournal(es,orders,employees,now);assert.equal(d.positions[0].order.id,'target');assert.equal(d.positions[0].effectiveAt,es[1].effectiveAt);
 const t=d.rows.find(e=>e.id==='t');assert.deepEqual([t.sourceBefore,t.sourceAfter,t.destinationBefore,t.destinationAfter],[1,0,null,1]);
 assert.equal(filterLabor(d.rows,{field:'lsx',value:'510-26091802'}).length,2);
});
test('partial output retains location; final completion releases; voiding replays original assignment',()=>{
 const s=event('s','start','08'),partial=event('p','complete','09',{finalCompletion:false}),final=event('f','complete','10',{finalCompletion:true});
 assert.equal(laborJournal([s,partial],orders,employees,now).positions[0].status,'Đang ở LSX');
 assert.equal(laborJournal([s,partial,final],orders,employees,now).positions[0].status,'Chờ phân bổ');
 assert.equal(laborJournal([s,partial,{...final,voided:true}],orders,employees,now).positions[0].status,'Đang ở LSX');
});
test('future events do not move current position; conflicting/anonymous data is not presented as waiting',()=>{
 const s=event('s','start','08'),future=event('t','transfer','13',{destinationId:'target'});
 assert.equal(laborJournal([s,future],orders,employees,now).positions[0].order.id,'source');
 assert.equal(laborJournal([s,event('s2','start','09',{sourceId:'target'})],orders,employees,now).positions[0].status,'Cần kiểm tra');
 assert.equal(laborJournal([event('old','start','08',{employees:[]})],orders,employees,now).positions[0].status,'Chưa xác định');
});
