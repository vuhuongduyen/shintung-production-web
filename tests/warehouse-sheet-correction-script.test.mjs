import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
const code=readFileSync(new URL('../scripts/warehouse-sheet/ONSPA_KHO_WEB.gs',import.meta.url),'utf8');
function run(status='CHỜ KHO XÁC NHẬN'){
 const row=Array(21).fill('');Object.assign(row,{2:'sku',4:100,7:'ONSPA_WEB',8:'LSX',9:'r',12:status});const calls=[];
 const sheet={getLastRow:()=>2,getRange:(r,c,h=1,w=1)=>({createTextFinder:q=>({matchEntireCell(){return this;},matchCase(){return this;},useRegularExpression(){return this;},findAll:()=>String(row[9])===q?[{getRow:()=>2}]:[]}),getValues:()=>[row.slice(c-1,c-1+w)],setValue:v=>{row[c-1]=v;return {setNumberFormat:()=>{}};},setNumberFormat:()=>{},setValues:vs=>{vs[0].forEach((v,i)=>row[c-1+i]=v);}})};
 const context=vm.createContext({Date,Number,String,Error,LockService:{getDocumentLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},PropertiesService:{getScriptProperties:()=>({getProperties:()=>({ONSPA_SHEET:'TEST'})})},SpreadsheetApp:{openById:()=>({getSheetByName:()=>sheet}),flush:()=>{}}});vm.runInContext(code,context);
 context.ONSPA_api_=b=>{calls.push(b);return b.action==='pull'?{receipts:[{id:'SX:r',reportId:'r',sku:'sku',lsxCode:'LSX',proposedQuantity:60,sourceCompletedAt:'2026-10-30T03:00:00Z',sheetSync:{correctionRevision:'rev2'}}]}:{ok:true};};context.ONSPA_dongBoTuDong();return {row,calls};
}
test('Sheet corrects same pending row and acknowledges quantity/revision, refuses local confirmed row',()=>{
 const changed=run();assert.equal(changed.row[4],60);const ack=changed.calls.find(c=>c.action==='ack');assert.equal(ack.proposedQuantity,60);assert.equal(ack.correctionRevision,'rev2');
 const blocked=run('KHO ĐÃ XÁC NHẬN');assert.equal(blocked.row[4],100);assert.ok(blocked.calls.some(c=>c.action==='error'));assert.equal(blocked.calls.some(c=>c.action==='ack'),false);
});
