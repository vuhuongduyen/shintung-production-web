import test from 'node:test';
import assert from 'node:assert/strict';
import {journalContext,filterJournal} from '../lib/production-journal.mjs';

test('time journal resolves product names for report-linked and historical SKU entries without changing records',()=>{
 const orders=[{id:'order',sku:'SKU-01',name:'Dây xả inox',lsxCode:'LSX-01'}];
 const reports=[{id:'report',transitId:'order',sku:'SKU-01',name:'Dây xả inox'}];
 const event={id:'event',kind:'complete',reportId:'report'};
 const before=JSON.stringify({orders,reports,event});
 const row=journalContext(event,orders,[],reports);
 assert.equal(row.name,'Dây xả inox');assert.equal(row.sku,'SKU-01');assert.equal(row.lsx,'LSX-01');
 assert.equal(filterJournal([row],{field:'name',value:'inox'}).length,1);
 assert.equal(journalContext({kind:'pause',sku:'SKU-01'},orders).name,'Dây xả inox');
 assert.equal(journalContext({kind:'complete',reportId:'report'},[],[],reports).name,'Dây xả inox');
 assert.equal(journalContext({kind:'pause',orderSnapshot:{sku:'SKU-02',name:'Tên trong LSX cũ'}},orders).name,'Tên trong LSX cũ');
 assert.equal(journalContext({kind:'pause',sku:'SKU-khác'},orders).name,'');
 assert.equal(journalContext({kind:'pause'},[{id:'other',name:'Không có SKU'}]).name,'');
 assert.equal(JSON.stringify({orders,reports,event}),before);
});

import {timeJournalHours,timeJournalColumns,timeJournalEventNames,groupTimeJournalRows} from '../lib/production-time-journal.mjs';
test('cumulative labor hours use workforce quantities and exclude lunch, breaks and pauses',()=>{
 const at=time=>`2026-10-05T${time}:00+07:00`;
 const events=[['s','start','08:00'],['p','pause','09:00'],['r','resume','09:30'],['c1','complete','11:00'],['c2','complete','13:00'],['c3','complete','17:00']].map(([id,kind,time])=>({id,kind,sourceId:'o',effectiveAt:at(time),count:10,finalCompletion:id==='c3'}));
 const day={working:true,ot:false,hcStart:480,hcEnd:1020,lunchStart:720,lunchEnd:780,breakMorningStart:600,breakMorningEnd:610,breakAfternoonStart:900,breakAfternoonEnd:910};
 const map=timeJournalHours(events,'o',{'2026-10-05':day});
 assert.equal(map.get('s'),0);assert.equal(map.get('p'),10);assert.equal(map.get('r'),10);
 assert.equal(map.get('c1'),23.3333);assert.equal(map.get('c2'),33.3333);assert.equal(map.get('c3'),71.6667);
 assert.equal(timeJournalHours(events,'o',{}).get('c1'),null);
 assert.equal(timeJournalHours(events.map(e=>e.id==='p'?{...e,voided:true}:e),'o',{'2026-10-05':day}).get('c1'),28.3333);
 assert.deepEqual(timeJournalColumns.slice(1,7),['Plan ID','LSX','SKU','Tên sản phẩm','Quy cách','Line']);
});


test('cumulative hours credit each worker after late arrival and cleaning; shared station action names remain intact',()=>{
 const at=time=>`2026-10-05T${time}:00+07:00`;
 const events=[{id:'s',kind:'start',sourceId:'o',count:2,employees:['NV1','NV2'],effectiveAt:at('08:00')},{id:'c',kind:'complete',sourceId:'o',effectiveAt:at('10:00')}];
 const day={working:true,hcStart:480,hcEnd:1020,lunchStart:720,lunchEnd:780,breakMorningStart:0,breakMorningEnd:0,breakAfternoonStart:0,breakAfternoonEnd:0,cleaning:[{start:570,end:600,people:1,employees:['NV1']}]};
 const policy={present:(id,date,minute)=>id!=='NV2'||minute>=540,edges:()=>[540]};
 assert.equal(timeJournalHours(events,'o',{'2026-10-05':day},policy).get('c'),2.5);
 assert.equal(timeJournalEventNames.start,'Nhập trạm');assert.equal(timeJournalEventNames.complete,'Xuất trạm');
});


test('time journal groups each LSX chronologically with stable distinct colors after filtering',()=>{
 const rows=[{id:'a2',sourceId:'a',kind:'complete',effectiveAt:'2026-10-05T04:00:00Z'},{id:'b1',sourceId:'b',kind:'start',effectiveAt:'2026-10-05T02:00:00Z'},{id:'a1',sourceId:'a',kind:'start',effectiveAt:'2026-10-05T01:00:00Z'},{id:'a3',sourceId:'a',kind:'pause',effectiveAt:'2026-10-05T03:00:00Z'}];
 const before=JSON.stringify(rows),grouped=groupTimeJournalRows(rows);
 assert.deepEqual(grouped.map(r=>r.id),['a1','a3','a2','b1']);
 assert.equal(grouped[0].journalGroupStart,true);assert.equal(grouped[2].journalGroupEnd,true);
 assert.equal(grouped[0].journalGroupHue,grouped[2].journalGroupHue);assert.notEqual(grouped[0].journalGroupHue,grouped[3].journalGroupHue);
 assert.equal(groupTimeJournalRows([rows[1]],rows)[0].journalGroupHue,grouped[3].journalGroupHue);
 assert.equal(timeJournalColumns[timeJournalColumns.indexOf('Sự kiện')+1],'Thời gian sự kiện');
 assert.equal(JSON.stringify(rows),before);
});

import {timeJournalQuantities} from '../lib/production-time-journal.mjs';
test('output quantities stay per event, accumulate before filtering and exclude cancellations',()=>{
 const events=[{id:'s',sourceId:'o',kind:'start',effectiveAt:'2026-10-06T01:00:00Z'},{id:'a',sourceId:'o',kind:'complete',reportId:'r1',effectiveAt:'2026-10-06T04:00:00Z'},{id:'b',sourceId:'o',kind:'complete',reportId:'r2',effectiveAt:'2026-10-06T09:00:00Z'}];
 const reports=[{id:'r1',reportedQuantity:100},{id:'r2',reportedQuantity:200}];
 const result=timeJournalQuantities(events,reports);
 assert.deepEqual(result.map(r=>[r.completedQuantity,r.cumulativeQuantity]),[[null,0],[100,100],[200,300]]);
 assert.equal(timeJournalQuantities(events.map(e=>e.id==='a'?{...e,voided:true}:e),reports).at(-1).cumulativeQuantity,200);
 assert.equal(timeJournalQuantities(events,[]).at(-1).cumulativeQuantity,null);
 assert.equal(timeJournalQuantities(events,reports.map(r=>({...r,reportedQuantity:0}))).at(-1).cumulativeQuantity,0);
});

test('withdrawal journal preserves each historical phase instead of claiming all events are applied or completed',()=>{for(const [kind,phase,status] of [['daily-output-withdrawal-request','pending','Chờ Kho xử lý thu hồi'],['daily-output-withdrawal-decision','approved-awaiting-sheet','Kho đồng ý, chờ đối soát Sheet'],['daily-output-withdrawal-decision','rejected','Kho từ chối thu hồi'],['daily-output-withdrawal-completed','completed','Đã thu hồi']]){const entry={id:kind+phase,kind,reportingModel:'daily-finished-v1',quantityOnly:true,after:{status:phase}},before=JSON.stringify(entry);assert.equal(journalContext(entry,[]).status,status);assert.equal(JSON.stringify(entry),before);}});

test('pending pre-receipt correction is visible as waiting and a raced warehouse receipt is not shown as an applied edit',()=>{assert.equal(journalContext({kind:'daily-output-pending-request'},[]).status,'Chờ đối soát sửa/hủy');assert.equal(journalContext({kind:'daily-output-pending-conflict'},[]).status,'Kho đã nhận: cần thu hồi trước khi sửa');assert.equal(journalContext({kind:'completion',reviewStatus:'Đã xác nhận',pendingCorrection:{status:'pending'}},[]).status,'Chờ đối soát sửa/hủy');});
