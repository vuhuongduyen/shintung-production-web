import test from 'node:test';
import assert from 'node:assert/strict';
import {assertRejectedRequestAudit,assertRequestAudit,assertSnapshotWithReceipts} from './helpers/rejected-request-audit.mjs';
const at='2026-11-03T00:00:00.000Z',id='12345678-1234-1234-1234-123456789abc';
const body={action:'save',week:'2026-11-02'};
const before=[{entity:'production_plan',record_key:'plan',payload:'unchanged'},{entity:'website_action_audit',record_key:'old',payload:'immutable'}];
const receipt={entity:'website_action_audit',record_key:id,updated_by:'TEST-user',updated_at:at,payload:JSON.stringify({id,actor:'TEST-user',actorId:'TEST-user',route:'/api/production-plan',entity:'production_plan',line:'',httpStatus:403,evidence:'server',outcome:'denied',reason:'Không có quyền',at,finishedAt:at,submittedInput:{fields:body,limited:false},record:body.week,operation:'Lưu'})};
const response=()=>Response.json({error:'Không có quyền'},{status:403,headers:{'X-ONSPA-Action-ID':id}});
const check=after=>assertRejectedRequestAudit({before,after,response:response(),actorId:'TEST-user',route:'/api/production-plan',body});
test('rejected audit checker rejects business/old-audit changes, extra receipts and forged evidence',async()=>{
 assert.deepEqual(await check([...before,receipt]),receipt);
 for(const index of [0,1]){const rows=structuredClone([...before,receipt]);rows[index].payload='changed';await assert.rejects(check(rows));}
 await assert.rejects(check([...before,receipt,{...receipt,record_key:'extra'}]));
 for(const [field,value] of Object.entries({actorId:'forged',actor:'forged',route:'/wrong',entity:'wrong',line:'B',httpStatus:200,evidence:'client',outcome:'succeeded',reason:'wrong',submittedInput:{fields:{},limited:false},record:'wrong',operation:'wrong'})){
  const changed={...receipt,payload:JSON.stringify({...JSON.parse(receipt.payload),[field]:value})};await assert.rejects(check([...before,changed]),undefined,field);
 }
 assertSnapshotWithReceipts(before,[...before,receipt],[receipt]);
 assert.throws(()=>assertSnapshotWithReceipts(before,[...before,{...receipt,updated_by:'forged'}],[receipt]));
 await assertRejectedRequestAudit({before,after:before,response:Response.json({error:'denied'},{status:403}),receipt:false});
 await assert.rejects(assertRejectedRequestAudit({before,after:[...before,receipt],response:Response.json({error:'denied'},{status:403}),receipt:false}));
});

test('successful request may change only explicit business entities and never existing audits',async()=>{
 const success={...receipt,payload:JSON.stringify({...JSON.parse(receipt.payload),httpStatus:200,outcome:'succeeded',reason:'Máy chủ xác nhận xử lý thành công.'})};
 const original=[...before,{entity:'production_plan_audit',record_key:'old-plan-audit',payload:'immutable'}];
 const options={before:original,response:Response.json({ok:true},{headers:{'X-ONSPA-Action-ID':id}}),actorId:'TEST-user',route:'/api/production-plan',body,mutableEntities:['production_plan','production_plan_audit']};
 const after=structuredClone([...original,success]);after[0].payload='permitted plan update';
 await assertRequestAudit({...options,after});
 after[2].payload='corrupt old audit';await assert.rejects(assertRequestAudit({...options,after}));
 await assert.rejects(assertRequestAudit({...options,after:[...original,success],mutableEntities:['website_action_audit']}));
});
