import test from 'node:test';
import assert from 'node:assert/strict';
import {warehouseSyncAlert,warehouseSyncAlerts,WAREHOUSE_SYNC_WARNING_MS} from '../lib/warehouse-sync-alerts.mjs';
const now=Date.parse('2026-11-16T03:00:00Z'),old='2026-11-16T02:50:00Z';
const receipt=()=>({id:'SX:SYNTHETIC',source:'Sản xuất',reportId:'SYNTHETIC',lsxCode:'LSX-TEST',sku:'SKU-TEST',line:'A',createdAt:old,updatedAt:old,sheetSync:{status:'sent'},proposedQuantity:100,receivedQuantity:100});
const cancel=()=>({...receipt(),withdrawalRequest:{id:'WITHDRAWAL-TEST',status:'approved-awaiting-sheet',decidedAt:old},sheetSync:{status:'pending',command:{kind:'withdrawal-approved',id:'WITHDRAWAL-TEST',revision:2}}});
test('sent receipts and non-ONSPA/manual/ERP records do not create warnings or mutate data',()=>{
 const values=[receipt(),{...receipt(),source:'ERP'},{...receipt(),sheetSync:undefined},{...receipt(),_deleted:true}];const before=structuredClone(values);
 assert.deepEqual(warehouseSyncAlerts(values,{now}),[]);assert.deepEqual(values,before);
});
test('approved cancellation awaiting proof warns without claiming stock is wrong; original quantities stay intact',()=>{
 const p=cancel(),before=structuredClone(p),alert=warehouseSyncAlert(p,{now});
 assert.equal(alert.code,'cancel-ack-overdue');assert.match(alert.message,/chờ bằng chứng/);assert.equal(alert.commandId,'WITHDRAWAL-TEST');assert.equal(alert.commandRevision,2);assert.deepEqual(p,before);
});
test('normal delay under threshold is quiet; threshold is inclusive and uses approved business timestamp',()=>{
 const p=cancel();p.withdrawalRequest.decidedAt=new Date(now-WAREHOUSE_SYNC_WARNING_MS+1).toISOString();assert.equal(warehouseSyncAlert(p,{now}),null);
 p.withdrawalRequest.decidedAt=new Date(now-WAREHOUSE_SYNC_WARNING_MS).toISOString();p.updatedAt=new Date(now).toISOString();assert.equal(warehouseSyncAlert(p,{now}).code,'cancel-ack-overdue');
});
test('waiting for warehouse approval is distinguished from missing stock-exclusion ACK',()=>{
 const p=cancel();p.withdrawalRequest={id:'WITHDRAWAL-TEST',status:'pending',requestedAt:old};p.sheetSync.command={kind:'withdrawal-request',id:'WITHDRAWAL-TEST',revision:1};
 assert.equal(warehouseSyncAlert(p,{now}).code,'warehouse-decision-overdue');assert.match(warehouseSyncAlert(p,{now}).message,/Chưa phải xác nhận đã trừ tồn/);
});
test('pending cancellation/edit and rejected withdrawal have separate proof/ACK warnings',()=>{
 for(const [kind,operation,code] of [['daily-pending-cancel','daily-output-cancel','cancel-ack-overdue'],['daily-pending-edit','daily-output-edit','correction-ack-overdue']]){
  const p={...receipt(),pendingCorrection:{id:'CHANGE-TEST',status:'pending',operation},sheetSync:{status:'pending',command:{kind,id:'CHANGE-TEST',revision:1}}};assert.equal(warehouseSyncAlert(p,{now}).code,code);
 }
 const p=cancel();p.withdrawalRequest.status='rejected';p.sheetSync.command.kind='withdrawal-rejected';assert.equal(warehouseSyncAlert(p,{now}).code,'correction-ack-overdue');
});
test('sync error is immediate, while wrong/missing command identity/revision fails visibly',()=>{
 const p=cancel();p.sheetSync.status='error';p.withdrawalRequest.decidedAt=new Date(now).toISOString();assert.equal(warehouseSyncAlert(p,{now}).code,'sync-error');
 for(const command of [{kind:'withdrawal-approved',id:'OTHER',revision:2},{kind:'withdrawal-approved',id:'WITHDRAWAL-TEST',revision:'2'},{kind:'withdrawal-approved',id:'WITHDRAWAL-TEST',revision:1},{kind:'withdrawal-approved',id:'WITHDRAWAL-TEST',revision:3},{kind:'unknown',id:'WITHDRAWAL-TEST',revision:2}]){
  const q=cancel();q.sheetSync.command=command;assert.equal(warehouseSyncAlert(q,{now}).code,'command-mismatch');
 }
 const q=cancel();q.sheetSync.command=null;assert.equal(warehouseSyncAlert(q,{now}).code,'command-missing');
});
test('cancelled receipt stays alarming until original bridge completion and explicit exclusion exist',()=>{
 const p={...receipt(),cancelled:true};assert.equal(warehouseSyncAlert(p,{now}).code,'cancel-proof-missing');
 p.stockExcluded='true';p.pendingCorrection={id:'CHANGE-TEST',status:'completed'};assert.equal(warehouseSyncAlert(p,{now}).code,'cancel-proof-missing');
 p.stockExcluded=true;assert.equal(warehouseSyncAlert(p,{now}),null);
 p.sheetSync.status='pending';assert.equal(warehouseSyncAlert(p,{now}).code,'cancel-proof-missing');
});
test('completed/replayed proof resolves the same receipt once; no per-poll duplicate or write',()=>{
 const p=cancel(),before=structuredClone(p);assert.equal(warehouseSyncAlerts([{key:p.id,payload:p},{key:p.id,payload:p}],{now}).length,1);assert.deepEqual(p,before);
 p.cancelled=true;p.stockExcluded=true;p.withdrawalRequest.status='completed';p.sheetSync={status:'sent',command:null,withdrawalId:'WITHDRAWAL-TEST'};assert.deepEqual(warehouseSyncAlerts([p],{now}),[]);
});
test('missing/future timestamps never invent an elapsed delay; timezone-less business timestamps use GMT+7',()=>{
 const p=cancel();delete p.withdrawalRequest.decidedAt;assert.equal(warehouseSyncAlert(p,{now}).code,'sync-time-missing');
 p.withdrawalRequest.decidedAt='2026-11-16T11:00:00+07:00';assert.equal(warehouseSyncAlert(p,{now}),null);
 p.withdrawalRequest.decidedAt='2026-11-16T09:50:00';assert.equal(warehouseSyncAlert(p,{now}).code,'cancel-ack-overdue');
});
