import test from 'node:test';
import assert from 'node:assert/strict';
import {auditMutation,auditContext,clientReceipt} from '../worker/action-audit.mjs';
const actor={userId:'cnphuong',login:'source@example.test'};
function database(failAt=0){const values=[];let n=0;return {values,prepare(sql){let args;return {bind(...a){args=a;return this;},async run(){if(++n===failAt)throw Error('DB unavailable');values.push({sql,args});return {success:true};}};}};}
const request=(action='complete')=>new Request('https://test.example/api/production-workflow',{method:'POST',headers:{origin:'https://test.example','content-type':'application/json'},body:JSON.stringify({action,orderId:'LSX1',password:'secret',employees:['NV1']})});
test('server receipt is saved before mutation and resolved from server response with authenticated user',async()=>{
 const db=database();const response=await auditMutation({request:request(),env:{DB:db},actor,run:async()=>{assert.equal(db.values.length,1);return Response.json({ok:true});}});
 const initial=JSON.parse(db.values[0].args[1]),final=JSON.parse(db.values[1].args[0]);assert.equal(initial.outcome,'received');assert.equal(final.outcome,'succeeded');assert.equal(final.actorId,'cnphuong');assert.equal(final.record,'LSX1');assert.ok(response.headers.get('X-ONSPA-Action-ID'));assert.ok(!JSON.stringify(db.values).includes('secret'));
});
test('denied and invalid responses do not become successful receipts',async()=>{for(const status of [403,422,500]){const db=database();await auditMutation({request:request(),env:{DB:db},actor,run:()=>Response.json({error:status===500?'SQLITE secret':'Không có quyền thao tác.'},{status})});const value=JSON.parse(db.values[1].args[0]);assert.equal(value.outcome,status===403?'denied':'failed');assert.ok(!value.reason.includes('SQLITE'));}});
test('journal failure before dispatch blocks write; completion failure retains received evidence',async()=>{
 let calls=0;const db=database(1);const res=await auditMutation({request:request(),env:{DB:db},actor,run:()=>{calls++;return Response.json({ok:true});}});assert.equal(res.status,503);assert.equal(calls,0);
 const partial=database(2);const done=await auditMutation({request:request(),env:{DB:partial},actor,run:()=>Response.json({ok:true})});assert.equal(done.status,200);assert.equal(done.headers.get('X-ONSPA-Audit'),'pending');assert.equal(JSON.parse(partial.values[0].args[1]).outcome,'received');
});
test('client cannot forge success or identity, records are explicitly client evidence',async()=>{
 const db=database(),make=body=>new Request('https://test.example/api/action-audit',{method:'POST',headers:{origin:'https://test.example','content-type':'application/json'},body:JSON.stringify(body)});
 const input={id:'12345678-12345678',operation:'Lưu ghi nhận',outcome:'succeeded',actorId:'admin'};assert.equal((await clientReceipt(make(input),{DB:db},actor)).status,400);assert.equal(db.values.length,0);
 await clientReceipt(make({...input,outcome:'ui-blocked'}),{DB:db},actor);const p=JSON.parse(db.values[0].args[1]);assert.equal(p.actorId,'cnphuong');assert.equal(p.evidence,'client');assert.equal(p.outcome,'ui-blocked');
});
test('context stores only allowlisted identifiers and excludes payloads and credentials',()=>{const c=auditContext('/api/records',{entity:'users',key:'u1',payload:{password:'secret'},token:'secret',action:'save'});assert.equal(c.record,'u1');assert.ok(!JSON.stringify(c).includes('secret'));});
test('vthduyen is excluded using authenticated aliases while business authorization still runs',async()=>{
 for(const identity of [{userId:'vthduyen'},{userId:'internal-id',permissionLogin:'VTHDUYEN'},{login:' vthduyen '}]){const db=database();let calls=0;const response=await auditMutation({request:request(),env:{DB:db},actor:identity,run:()=>{calls++;return Response.json({error:'Không có quyền'},{status:403});}});assert.equal(calls,1);assert.equal(response.status,403);assert.equal(db.values.length,0);
 const req=new Request('https://test.example/api/action-audit',{method:'POST',headers:{origin:'https://test.example','content-type':'application/json'},body:JSON.stringify({id:'12345678-12345678',outcome:'ui-blocked'})});assert.equal((await clientReceipt(req,{DB:db},identity)).status,200);assert.equal(db.values.length,0);}
 const db=database();await auditMutation({request:request(),env:{DB:db},actor:{userId:'vthduyen2'},run:()=>Response.json({ok:true})});assert.equal(db.values.length,2);
});
test('failed warehouse save retains submitted rows and filters nested credentials',async()=>{
 const db=database();const body={action:'warehouse-duty',line:'B',week:'2026-10-19',rows:[{date:'2026-10-24',employee:'VIET',start:'08:00',end:'10:30',token:'never-log'}]};
 const req=new Request('https://test.example/api/production-workflow',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 await auditMutation({request:req,env:{DB:db},actor,run:()=>Response.json({error:'Trùng thời gian phụ kho'},{status:409})});
 const saved=JSON.parse(db.values[1].args[0]);assert.equal(saved.outcome,'failed');assert.deepEqual(saved.submittedInput.fields.rows,[{date:'2026-10-24',employee:'VIET',start:'08:00',end:'10:30'}]);assert.equal(saved.reason,'Trùng thời gian phụ kho');assert.ok(!JSON.stringify(saved).includes('never-log'));
});
test('client validation includes submitted business fields but cannot forge server evidence',async()=>{
 const db=database();const req=new Request('https://test.example/api/action-audit',{method:'POST',headers:{origin:'https://test.example','content-type':'application/json'},body:JSON.stringify({id:'12345678-12345678',outcome:'ui-blocked',reasonCode:'validation',validationMessage:'Giờ đến phải sau giờ từ',submittedInput:{start:'08:00',end:'07:00',password:'never-log'},evidence:'server'})});
 await clientReceipt(req,{DB:db},actor);const saved=JSON.parse(db.values[0].args[1]);assert.equal(saved.validationMessage,'Giờ đến phải sau giờ từ');assert.equal(saved.submittedInput.fields.end,'07:00');assert.equal(saved.evidence,'client');assert.ok(!JSON.stringify(saved).includes('never-log'));
});

test('client attempt stores rejected input and correlation without claiming success',async()=>{const db=database();await clientReceipt(new Request('https://test.example/api/action-audit',{method:'POST',headers:{origin:'https://test.example','content-type':'application/json'},body:JSON.stringify({id:'12345678-12345678',outcome:'attempted',requestId:'request-123456789',record:'ticket-1',operation:'Gửi',submittedInput:{text:'Làm lệnh 510',password:'DO-NOT-LOG'}})}),{DB:db},actor);const p=JSON.parse(db.values[0].args[1]);assert.equal(p.submittedInput.fields.text,'Làm lệnh 510');assert.equal(p.requestId,'request-123456789');assert.equal(p.record,'ticket-1');assert.equal(p.outcome,'attempted');assert.equal(p.evidence,'client');assert.ok(!JSON.stringify(p).includes('DO-NOT-LOG'));});


test('422 receipt retains safe SKU-specific reasons alongside submitted selection',async()=>{
 const db=database();
 await auditMutation({request:request(),env:{DB:db},actor,run:()=>Response.json({error:'batchRejected',details:[{id:'PE-1',sku:'SKU-1',reason:'skuPending',token:'do-not-log'}]},{status:422})});
 const all=JSON.stringify(db.values);
 assert.ok(all.includes('skuPending'));assert.ok(all.includes('SKU-1'));assert.ok(!all.includes('do-not-log'));
});
