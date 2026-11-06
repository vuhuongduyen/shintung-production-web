import test from 'node:test';import assert from 'node:assert/strict';
import {dailyFixture} from './helpers/daily-output-fixture.mjs';
import {mutateTransit,readAdditionalCreationScope,acknowledgeAdditionalCreation} from '../scripts/local/in-transit.mjs';
import {records} from '../scripts/local/database.mjs';
const actor={login:'SYNTHETIC-KHSX',isAdmin:true};
const input=(id,revision=null)=>({action:'add-lsx',id,planStart:'2026-11-05',planEnd:'2026-11-06',line:'A',priority:'THƯỜNG',sequence:2,planningNote:'SYNTHETIC_PRIVATE_NOTE',requestIdempotency:crypto.randomUUID(),expectedCreationRevision:revision});
const ack=s=>({expectedCreationRevision:s.revision,id:s.pending.rowId});
const protectedRows=rows=>rows.filter(r=>!['in_transit_creation_scope','in_transit_creation_ack'].includes(r.entity));
const lostResponse=db=>new Proxy(db,{get(target,key){if(key==='batch')return async statements=>{await target.batch(statements);throw Error('Synthetic response lost after commit');};const v=target[key];return typeof v==='function'?v.bind(target):v;}});

test('reload recovers the owned committed result without persisting client content; ACK and stale retries never create another LSX',()=>dailyFixture(async c=>{
 const before=await records(c.db),empty=await readAdditionalCreationScope(c.db,actor);assert.deepEqual(empty,{revision:null,pending:null});assert.deepEqual(await records(c.db),before);
 const body=input(c.order.id);await assert.rejects(()=>mutateTransit(lostResponse(c.db),body,actor),/Synthetic response lost/);
 const committed=await records(c.db),restored=await readAdditionalCreationScope(c.db,actor);assert.ok(restored.pending.rowId);assert.equal(restored.pending.planId,c.order.planId);assert.ok(!JSON.stringify(restored).includes('SYNTHETIC_PRIVATE_NOTE'));assert.deepEqual(await records(c.db),committed);
 const replay=await mutateTransit(c.db,body,actor);assert.equal(replay.replayed,true);assert.equal(replay.row.id,restored.pending.rowId);assert.deepEqual(await records(c.db),committed);
 await acknowledgeAdditionalCreation(c.db,ack(restored),actor);const resolved=await readAdditionalCreationScope(c.db,actor);assert.equal(resolved.pending,null);assert.notEqual(resolved.revision,restored.revision);assert.deepEqual(protectedRows(await records(c.db)),protectedRows(committed));
 const after=await records(c.db);await assert.rejects(()=>mutateTransit(c.db,input(c.order.id),actor),e=>e.status===409);assert.deepEqual(await records(c.db),after,'a late old-page request stays stale even after ACK');
 const next=await mutateTransit(c.db,input(c.order.id,resolved.revision),actor);assert.notEqual(next.row.id,replay.row.id);const second=await readAdditionalCreationScope(c.db,actor);await acknowledgeAdditionalCreation(c.db,ack(second),actor);const final=await records(c.db);await assert.rejects(()=>mutateTransit(c.db,input(c.order.id,resolved.revision),actor),e=>e.status===409);assert.deepEqual(await records(c.db),final,'clearing pending cannot restore an earlier non-empty cursor revision');
}));

test('two tabs with fresh keys and one creation revision commit exactly one result; the losing request remains stale after ACK',()=>dailyFixture(async c=>{
 const before=await records(c.db),a=input(c.order.id),b={...input(c.order.id),sequence:3},results=await Promise.allSettled([mutateTransit(c.db,a,actor),mutateTransit(c.db,b,actor)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.status,409);
 const all=await records(c.db);for(const entity of ['in_transit','in_transit_audit','in_transit_creation_attempt','in_transit_creation_scope'])assert.equal(all.filter(r=>r.entity===entity).length-before.filter(r=>r.entity===entity).length,1);
 const s=await readAdditionalCreationScope(c.db,actor);await acknowledgeAdditionalCreation(c.db,ack(s),actor);const after=await records(c.db),loser=results[0].status==='rejected'?a:b;
 await assert.rejects(()=>mutateTransit(c.db,loser,actor),e=>e.status===409);assert.deepEqual(await records(c.db),after);
}));

test('ACK is owner/result/version bound and an old ACK cannot erase a newer pending creation',()=>dailyFixture(async c=>{
 const first=await mutateTransit(c.db,input(c.order.id),actor),s=await readAdditionalCreationScope(c.db,actor),before=await records(c.db),other={...actor,login:'SYNTHETIC-OTHER'};
 assert.deepEqual(await readAdditionalCreationScope(c.db,other),{revision:null,pending:null});await assert.rejects(()=>acknowledgeAdditionalCreation(c.db,ack(s),other),e=>e.status===409);
 await assert.rejects(()=>acknowledgeAdditionalCreation(c.db,{...ack(s),id:c.order.id},actor),e=>e.status===409);assert.deepEqual(await records(c.db),before);
 await acknowledgeAdditionalCreation(c.db,ack(s),actor);const ready=await readAdditionalCreationScope(c.db,actor),next=await mutateTransit(c.db,input(c.order.id,ready.revision),actor),pending=await readAdditionalCreationScope(c.db,actor),snapshot=await records(c.db);
 assert.notEqual(next.row.id,first.row.id);assert.equal((await acknowledgeAdditionalCreation(c.db,ack(s),actor)).replayed,true);assert.deepEqual(await records(c.db),snapshot);assert.deepEqual(await readAdditionalCreationScope(c.db,actor),pending);
}));

for(const mode of ['insert','delete'])test(`a creation-scope ${mode} at the write boundary cannot leave an orphan LSX or receipt`,()=>dailyFixture(async c=>{
 let revision=null;if(mode==='delete'){await mutateTransit(c.db,input(c.order.id),actor);const s=await readAdditionalCreationScope(c.db,actor);await acknowledgeAdditionalCreation(c.db,ack(s),actor);revision=(await readAdditionalCreationScope(c.db,actor)).revision;}
 let expected;const raced=new Proxy(c.db,{get(target,key){if(key==='batch')return async statements=>{
  if(mode==='insert'){const {recordRevision}=await import('../lib/record-revision.mjs'),key=await recordRevision(['additional-lsx-scope',actor.login]);await c.put('in_transit_creation_scope',key,{owner:actor.login,actor:actor.login,version:crypto.randomUUID(),pending:null});}
  else await target.prepare("DELETE FROM app_records WHERE entity='in_transit_creation_scope'").run();expected=await records(target);return target.batch(statements);
 };const v=target[key];return typeof v==='function'?v.bind(target):v;}});
 await assert.rejects(()=>mutateTransit(raced,input(c.order.id,revision),actor),e=>e.status===409);assert.deepEqual(await records(c.db),expected);
}));

test('SQL failure rolls back scope/result/audit together and lost ACK response replays without rewriting business records',()=>dailyFixture(async c=>{
 const before=await records(c.db),broken=new Proxy(c.db,{get(target,key){if(key==='batch')return statements=>target.batch([...statements,target.prepare('INSERT INTO SYNTHETIC_ABSENT_TABLE VALUES(1)')]);const v=target[key];return typeof v==='function'?v.bind(target):v;}});
 await assert.rejects(()=>mutateTransit(broken,input(c.order.id),actor));assert.deepEqual(await records(c.db),before);
 await mutateTransit(c.db,input(c.order.id),actor);const pending=await readAdditionalCreationScope(c.db,actor),committed=await records(c.db);await assert.rejects(()=>acknowledgeAdditionalCreation(broken,ack(pending),actor));assert.deepEqual(await records(c.db),committed);
 await assert.rejects(()=>acknowledgeAdditionalCreation(lostResponse(c.db),ack(pending),actor),/Synthetic response lost/);const closed=await records(c.db);assert.equal((await acknowledgeAdditionalCreation(c.db,ack(pending),actor)).replayed,true);assert.deepEqual(await records(c.db),closed);assert.deepEqual(protectedRows(closed),protectedRows(committed));
}));

test('missing or damaged result proof stops recovery and new creation without changing records',()=>dailyFixture(async c=>{
 await mutateTransit(c.db,input(c.order.id),actor);await c.db.prepare("DELETE FROM app_records WHERE entity='in_transit_creation_attempt'").run();const before=await records(c.db);
 await assert.rejects(()=>readAdditionalCreationScope(c.db,actor),e=>e.status===409);await assert.rejects(()=>mutateTransit(c.db,input(c.order.id),actor),e=>e.status===409);assert.deepEqual(await records(c.db),before);
}));

test('recovery follows the trusted account identity through email changes, never another account with the same display login',()=>dailyFixture(async c=>{
 const original={...actor,userId:'SYNTHETIC-ACCOUNT',login:'old@example.invalid'},changed={...original,login:'new@example.invalid'},other={...original,userId:'SYNTHETIC-OTHER-ACCOUNT'},body=input(c.order.id);
 const created=await mutateTransit(c.db,body,original),before=await records(c.db),scope=await readAdditionalCreationScope(c.db,changed);assert.equal(scope.pending.rowId,created.row.id);assert.deepEqual(await readAdditionalCreationScope(c.db,other),{revision:null,pending:null});
 const retry=await mutateTransit(c.db,body,changed);assert.equal(retry.replayed,true);assert.equal(retry.row.id,created.row.id);assert.equal(retry.row.createdBy,original.login);assert.deepEqual(await records(c.db),before);await acknowledgeAdditionalCreation(c.db,ack(scope),changed);assert.equal((await readAdditionalCreationScope(c.db,changed)).pending,null);
}));

test('a copied result body cannot redirect recovery or retry to a different LSX',()=>dailyFixture(async c=>{
 const body=input(c.order.id);await mutateTransit(c.db,body,actor);const stored=(await records(c.db)).find(r=>r.entity==='in_transit_creation_attempt'),value=JSON.parse(stored.payload);value.result.row.id=c.order.id;await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='in_transit_creation_attempt' AND record_key=?").bind(JSON.stringify(value),stored.record_key).run();const before=await records(c.db);
 await assert.rejects(()=>readAdditionalCreationScope(c.db,actor),e=>e.status===409);await assert.rejects(()=>mutateTransit(c.db,body,actor),e=>e.status===409);assert.deepEqual(await records(c.db),before);
}));

test('malformed owner journals fail closed and never become an empty fresh scope',()=>dailyFixture(async c=>{
 await mutateTransit(c.db,input(c.order.id),actor);const scope=(await records(c.db)).find(r=>r.entity==='in_transit_creation_scope');
 for(const payload of ['null','[]','{}','not JSON']){await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='in_transit_creation_scope' AND record_key=?").bind(payload,scope.record_key).run();const before=await records(c.db);await assert.rejects(()=>readAdditionalCreationScope(c.db,actor),e=>e.status===409);await assert.rejects(()=>mutateTransit(c.db,input(c.order.id),actor),e=>e.status===409);assert.deepEqual(await records(c.db),before);}
}));

test('the guarded create co-reads retry proof and cursor, without fetching global workflow or reports',()=>dailyFixture(async c=>{
 let selects=0,batches=0;const forbidden=['production_report','production_event','production_history_import'];
 const db=new Proxy(c.db,{get(target,key){if(key==='prepare')return sql=>{if(/^\s*SELECT\b/i.test(sql))selects++;for(const entity of forbidden)assert.ok(!sql.includes("'"+entity+"'"));return target.prepare(sql);};if(key==='batch')return statements=>{batches++;return target.batch(statements);};const v=target[key];return typeof v==='function'?v.bind(target):v;}});
 const created=await mutateTransit(db,input(c.order.id),actor);assert.equal(created.ok,true);assert.equal(selects,2);assert.equal(batches,1);
}));
