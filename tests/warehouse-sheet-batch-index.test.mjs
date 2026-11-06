import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
const source=readFileSync(new URL('../scripts/warehouse-sheet/ONSPA_KHO_WEB.gs',import.meta.url),'utf8');
function fixture({count=1000,receipts=50,moveTarget=false,reportIds=null,duplicate=false,duplicateAfterAck=false}={}){
 const data=[Array(21).fill('')];for(let i=0;i<count;i++){const row=Array(21).fill('');Object.assign(row,{2:'SYNTHETIC-SKU',4:100,7:'ONSPA_WEB',8:'SYNTHETIC-LSX',9:`SYNTHETIC-${i}`,12:'CHỜ KHO XÁC NHẬN'});data.push(row);}
 if(duplicate&&data.length>2)data[2][9]=data[1][9];
 const before=structuredClone(data),reads=[],calls=[],finds=[],sheet={getLastRow:()=>data.length,getMaxRows:()=>2000,insertRowsAfter:()=>{},getRange:(row,col,h=1,w=1)=>({createTextFinder:query=>{const opts={};return {matchEntireCell(value){opts.entire=value;return this;},matchCase(value){opts.case=value;return this;},useRegularExpression(value){opts.regex=value;return this;},findAll(){assert.deepEqual(opts,{entire:true,case:true,regex:false});finds.push(query);return data.slice(row-1,row-1+h).flatMap((r,i)=>String(r[col-1])===query?[{getRow:()=>row+i}]:[]);}};},getValues:()=>{reads.push({row,col,h,w});if(moveTarget&&row===2&&col===1&&h===1)data[1][9]='SYNTHETIC-OTHER';return data.slice(row-1,row-1+h).map(r=>r.slice(col-1,col-1+w));},setValue(value){data[row-1]??=Array(21).fill('');data[row-1][col-1]=value;return this;},setNumberFormat(){return this;},setValues(values){values.forEach((r,i)=>{data[row-1+i]??=Array(21).fill('');r.forEach((v,j)=>data[row-1+i][col-1+j]=v);});return this;}})};
 const context=vm.createContext({Date,Number,String,Error,Map,LockService:{getDocumentLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},PropertiesService:{getScriptProperties:()=>({getProperties:()=>({ONSPA_SHEET:'SYNTHETIC'})})},SpreadsheetApp:{openById:()=>({getSheetByName:()=>sheet}),flush:()=>{}}});vm.runInContext(source,context);context.ONSPA_api_=body=>{calls.push(body);if(duplicateAfterAck&&body.action==='ack'&&data[3])data[3][9]='SYNTHETIC-1';return body.action==='pull'?{receipts:(reportIds||Array.from({length:receipts},(_,i)=>`SYNTHETIC-${i}`)).map(reportId=>({id:`SX:${reportId}`,reportId,sku:'SYNTHETIC-SKU',lsxCode:'SYNTHETIC-LSX',proposedQuantity:100,sourceCompletedAt:'2026-11-04T02:00:00Z'}))}:{ok:true};};
 context.ONSPA_dongBoTuDong();return {data,before,reads,calls,finds};
}
test('batch indexes only report-ID column once, rereads each target and preserves every other value',t=>{
 const {data,before,reads,calls,finds}=fixture();assert.equal(finds.length,50);assert.equal(calls.filter(c=>c.action==='ack').length,50);assert.equal(calls.filter(c=>c.action==='error').length,0);
 assert.equal(reads.filter(r=>r.col===10&&r.h===1000&&r.w===1).length,1);assert.equal(reads.filter(r=>r.col===1&&r.h===1000&&r.w===21).length,1,'one confirmation scan, no repeated full scans per receipt');assert.equal(reads.filter(r=>r.h===1&&r.w===21).length,50);
 for(let i=1;i<data.length;i++){assert.deepEqual(data[i].slice(1),before[i].slice(1));if(i>50)assert.deepEqual(data[i],before[i]);}
 t.diagnostic(`1000 rows/50 receipts: ${reads.reduce((n,r)=>n+r.h*r.w,0)} cells fetched plus 50 fresh ID-column searches; old scan shape 1072050 cells. Synthetic mock, not live Sheet latency.`);
});
test('changed target report ID between index and reread fails closed even when SKU/LSX/source still match',()=>{
 const {data,calls}=fixture({count:1,receipts:1,moveTarget:true});assert.equal(calls.filter(c=>c.action==='ack').length,0);assert.equal(calls.filter(c=>c.action==='error').length,1);assert.equal(data[1][0],'');assert.equal(data[1][4],100);
});

test('duplicate IDs stay blocked and a repeated new receipt appends only one row',()=>{
 const duplicate=fixture({count:2,receipts:1,duplicate:true});assert.equal(duplicate.calls.filter(c=>c.action==='ack').length,0);assert.equal(duplicate.calls.filter(c=>c.action==='error').length,1);assert.deepEqual(duplicate.data,duplicate.before);
 const repeated=fixture({count:0,reportIds:['SYNTHETIC-NEW','SYNTHETIC-NEW']});assert.equal(repeated.data.length,2);assert.equal(repeated.data[1][9],'SYNTHETIC-NEW');assert.equal(repeated.calls.filter(c=>c.action==='ack').length,2);assert.equal(repeated.calls.filter(c=>c.action==='error').length,0);
});

test('copyable txt handoff stays byte-identical to executable gs source',()=>{assert.equal(readFileSync(new URL('../scripts/warehouse-sheet/ONSPA_KHO_WEB.txt',import.meta.url),'utf8'),source);});

test('a duplicate introduced after an earlier ack is detected before touching the next target',()=>{const {data,calls}=fixture({count:3,receipts:2,duplicateAfterAck:true});assert.equal(calls.filter(c=>c.action==='ack').length,1);assert.equal(calls.filter(c=>c.action==='error').length,1);assert.equal(data[2][0],'');assert.equal(data[2][4],100);});
