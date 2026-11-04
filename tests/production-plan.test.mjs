import {newDailyCapacity,calculateCapacity} from '../lib/capacity.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { root, openDatabase, migrate, records, importBackup } from '../scripts/local/database.mjs';
import {mutateTransit} from '../scripts/local/in-transit.mjs';
import { getTransit } from '../scripts/local/in-transit.mjs';
import { getPlan, mutatePlan } from '../scripts/local/production-plan.mjs';
import {remainingPlanWithTransitSummary} from '../lib/plan-transit-backlog.mjs';
import { monday, summary, rebasePlanEdits, plannedLaborHours, rowWarnings } from '../lib/production-plan.mjs';
const week = '2026-09-07', actor = { login: 'TEST-owner', canReopenPlan: true };
async function dbRun(fn) { mkdirSync(resolve(root, '.local-data/tests'), { recursive: true }); const path = mkdtempSync(resolve(root, '.local-data/tests/plan-')); let c = await openDatabase(path); try {
    await migrate(c.db);
    await fn(c, path);
}
finally {
    await c.close();
} }
async function seed(db) { await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('capacity',week,JSON.stringify({schemaVersion:1,week,rows:['A','B','C'].map(line=>({week,line,status:'Đã xác nhận',version:1,availableHours:1000}))}),'TEST','2026-09-15').run(); await db.batch(['TEST-ONE','TEST-TWO','TEST-NO'].map(code=>db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('sku',code,JSON.stringify({code,group:`MASTER-${code}`,confirmation_status:'Đã xác nhận',usage_status:'Đang sử dụng'}),'TEST','2026-09-15')));  await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('production_engine', 'test-source', JSON.stringify({ week, rows: [{ id: 'one', sku: 'TEST-ONE', name: 'TEST', group: 'PDF-WRONG', line: 'A', suggested: 100, priority: 'KHẨN - EVENT' }, { id: 'two', sku: 'TEST-TWO', group: 'PDF-WRONG', line: 'B', suggested: 50, priority: 'CAO - ROP' }, { id: 'skip', sku: 'TEST-NO', line: 'C', suggested: 0, priority: 'KHÔNG BỔ SUNG' }] }), 'TEST', '2026-09-15T00:00:00Z').run(); }
const request = (action, revision, ids, rest = {}) => ({ action, week, revision, ids, ...rest });
test('stale auto-save rebases an untouched quantity but protects a concurrently edited or closed row', () => {
    const pending={one:{plan:'10000'}};
    const original={one:{plan:6000}};
    assert.deepEqual(rebasePlanEdits(pending,original,[{id:'one',plan:6000,status:'DỰ KIẾN'}]),{edits:pending,conflicts:[]});
    assert.deepEqual(rebasePlanEdits(pending,original,[{id:'one',plan:10000,status:'DỰ KIẾN'}]),{edits:{},conflicts:[]});
    assert.deepEqual(rebasePlanEdits(pending,original,[{id:'one',plan:8000,status:'DỰ KIẾN'}]),{edits:{},conflicts:['one']});
    assert.deepEqual(rebasePlanEdits(pending,original,[{id:'one',plan:6000,status:'ĐÃ CHỐT'}]),{edits:{},conflicts:['one']});
});
test('weeks, missing labor and latest capacity use explicit standards without invented hours', () => {
    assert.equal(monday('13/09/2026'), week);
    assert.equal(monday('31/02/2026'), '');
    const row = { line: 'A', plan: 100, laborHour: .1 };
    const result = summary([row], [{ week, line: 'A', status:'Đã xác nhận',updateNumber: 1, availableHours: 20 }, { week, line: 'A', status:'Đã xác nhận',updateNumber: 2, availableHours: 10 }], week);
    assert.equal(result[0].required, 10);
    assert.equal(result[0].ratio, 1);
    assert.equal(result[0].warning, 'near');
    assert.equal(result[1].available, null);
    assert.equal(summary([{ ...row, laborHour: null }], [], week)[0].required, 0);
    assert.equal(summary([row], [{ week, line: 'A', status:'Đã xác nhận',availableHours: 0 }], week)[0].warning, 'overload');
});
test('line totals sum known labor with missing labor counted as zero and preserve warnings', () => {
    const rows = [
        { line:'A', sku:'KNOWN', plan:250, laborHour:0.05, status:'DỰ KIẾN' },
        { line:'A', sku:'102TC10003', plan:2, laborHour:null, status:'DỰ KIẾN' },
        { line:'A', sku:'KNOWN-TWO', plan:20, laborHour:0.034, status:'DỰ KIẾN' },
        { line:'B', sku:'OTHER-LINE', plan:100, laborHour:1, status:'DỰ KIẾN' },
    ];
    const before=structuredClone(rows);
    const result=summary(rows,[{week,line:'A',status:'Đã xác nhận',availableHours:20}],week)[0];
    assert.equal(result.required,13.18);
    assert.equal(result.ratio,13.18/20);
    assert.equal(result.difference,20-13.18);
    assert.equal(result.missingLabor,1);
    assert.equal(result.warning,'missing');
    assert.equal(plannedLaborHours(rows[1]),null);
    assert.ok(rowWarnings(rows[1]).includes('missingLabor'));
    assert.deepEqual(rows,before);
});
test('line totals remain numeric when all labor is missing and preserve capacity guards', () => {
    const rows=[{line:'A',plan:2,laborHour:null},{line:'A',plan:10,laborHour:-1}];
    const capacity={week,line:'A',status:'Đã xác nhận',availableHours:430.83};
    const result=summary(rows,[capacity],week)[0];
    assert.equal(result.required,0);
    assert.equal(result.ratio,0);
    assert.equal(result.difference,430.83);
    assert.equal(result.missingLabor,2);
    assert.equal(result.warning,'missing');
    const zeroCapacity=summary(rows,[{...capacity,availableHours:0}],week)[0];
    assert.equal(zeroCapacity.required,0);
    assert.equal(zeroCapacity.ratio,0);
    assert.equal(zeroCapacity.difference,0);
    const unconfirmed=summary(rows,[{...capacity,status:'Chờ KHSX đồng ý'}],week)[0];
    assert.equal(unconfirmed.required,0);
    assert.equal(unconfirmed.available,null);
    assert.equal(unconfirmed.ratio,null);
    assert.equal(unconfirmed.difference,null);
});
test('line totals flag known overload before missing labor and use the existing red card style', () => {
    const rows=[
        {line:'A',sku:'KNOWN',plan:100,laborHour:5.6472},
        {line:'A',sku:'102TC10003',plan:2,laborHour:null},
        {line:'B',sku:'KNOWN-B',plan:100,laborHour:5.588},
    ];
    const before=structuredClone(rows);
    const capacity=[
        {week,line:'A',status:'Đã xác nhận',availableHours:430.83},
        {week,line:'B',status:'Đã xác nhận',availableHours:517.28},
    ];
    const [a,b]=summary(rows,capacity,week);
    assert.equal(a.required,564.72);
    assert.equal(a.available,430.83);
    assert.equal((a.ratio*100).toFixed(1),'131.1');
    assert.equal(a.difference.toFixed(2),'-133.89');
    assert.equal(a.warning,'overload');
    assert.equal(a.missingLabor,1);
    assert.equal(plannedLaborHours(rows[1]),null);
    assert.ok(rowWarnings(rows[1]).includes('missingLabor'));
    assert.equal(b.required,558.8);
    assert.equal(b.difference.toFixed(2),'-41.52');
    assert.equal(b.warning,'overload');
    assert.equal(b.missingLabor,0);
    const noCapacity=summary(rows,[{...capacity[0],availableHours:0}],week)[0];
    assert.equal(noCapacity.ratio,Infinity);
    assert.equal(noCapacity.warning,'overload');
    assert.equal(noCapacity.missingLabor,1);
    assert.deepEqual(rows,before);
    const component=readFileSync(new URL('../components/production-plan.tsx',import.meta.url),'utf8');
    const css=readFileSync(new URL('../app/production-plan.css',import.meta.url),'utf8');
    assert.ok(component.includes('className={`data-card pp-load-card ${s.warning}`}'));
    assert.ok(component.includes("(s.missingLabor+s.backlogMissing) > 0 && <small>{msg('missingLabor')} ({s.missingLabor+s.backlogMissing})</small>"));
    assert.match(css,/\.pp-loads \.overload\s*\{border-left-color:#b32c26\}/);
    assert.match(css,/\.pp-loads \.overload \.pp-load-head>b\s*\{background:#fde7e5;color:#a1221c\}/);
});
test('line totals distinguish a known zero standard from missing labor', () => {
    const row={line:'A',plan:100,laborHour:0};
    const result=summary([row],[{week,line:'A',status:'Đã xác nhận',availableHours:10}],week)[0];
    assert.equal(result.required,0);
    assert.equal(result.missingLabor,0);
    assert.equal(result.ratio,0);
    assert.equal(result.difference,10);
    assert.equal(result.warning,'ok');
    assert.equal(plannedLaborHours(row),0);
    assert.ok(!rowWarnings(row).includes('missingLabor'));
});
test('line totals still exclude cancelled and deferred rows and guard missing quantities', () => {
    const rows=[{line:'A',plan:10,laborHour:0.1},
        {line:'A',plan:100,laborHour:1,status:'HỦY'},
        {line:'A',plan:100,laborHour:null,status:'TẠM HOÃN'}];
    const capacity=[{week,line:'A',status:'Đã xác nhận',availableHours:10}];
    const result=summary(rows,capacity,week)[0];
    assert.equal(result.required,1);
    assert.equal(result.missingLabor,0);
    const missingQuantity=summary([...rows,{line:'A',plan:null,laborHour:0.1}],capacity,week)[0];
    assert.equal(missingQuantity.required,null);
    assert.equal(missingQuantity.ratio,null);
    assert.equal(missingQuantity.difference,null);
});
test('current SKU labor updates draft capacity but preserves confirmed plan basis', async () => dbRun(async ({db}) => {
    await seed(db);
    await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('labor_hours','TEST-ONE',JSON.stringify({sku:'TEST-ONE',laborHour:0.1}),actor.login,'2026-09-15').run();
    await mutatePlan(db,request('receive',0,['one'],{sourceKey:'test-source'}),actor);
    let state=await getPlan(db,week);
    const id=state.rows[0].id;
    assert.equal(state.rows[0].laborHour,0.1);
    await db.prepare("UPDATE app_records SET payload=? WHERE entity='labor_hours' AND record_key='TEST-ONE'").bind(JSON.stringify({sku:'TEST-ONE',laborHour:0.2})).run();
    state=await getPlan(db,week);
    assert.equal(state.rows[0].laborHour,0.2);
    assert.equal(summary(state.rows,state.capacity,week)[0].required,20);
    assert.equal(plannedLaborHours(state.rows[0]),20);
    assert.equal(plannedLaborHours({...state.rows[0],plan:250}),50);
    assert.equal(plannedLaborHours({...state.rows[0],laborHour:null}),null);
    await mutatePlan(db,request('save',1,[id],{edits:{[id]:{start:week,end:week}}}),actor);
    await mutatePlan(db,request('close',2,[id]),actor);
    await db.prepare("UPDATE app_records SET payload=? WHERE entity='labor_hours' AND record_key='TEST-ONE'").bind(JSON.stringify({sku:'TEST-ONE',laborHour:0.3})).run();
    state=await getPlan(db,week);
    assert.equal(state.rows[0].laborHour,0.2);
    assert.equal(plannedLaborHours(state.rows[0]),20);
    await mutatePlan(db,request('reopen',3,[id],{reason:'Điều chỉnh'}),actor);
    const reopened=(await getPlan(db,week)).rows[0];
    assert.equal(reopened.laborHour,0.3);
    assert.equal(plannedLaborHours(reopened),30);
}));
test('full Engine → Plan → In Transit flow is atomic, repeatable and durable', async () => dbRun(async (c, path) => {
    const db = c.db;
    assert.deepEqual((await getPlan(db, week)).rows, []);
    await seed(db);
    assert.equal((await getPlan(db, week)).sources[0].rows[0].group, 'MASTER-TEST-ONE');
    await assert.rejects(() => mutatePlan(db, request('receive', 0, ['one'], { sourceKey: 'test-source' }), null), e => e.status === 401);
    await assert.rejects(() => mutatePlan(db, request('receive', 0, ['one', 'skip'], { sourceKey: 'test-source' }), actor), e => e.message === 'batchRejected');
    assert.equal((await getPlan(db, week)).rows.length, 0);
    const first = await mutatePlan(db, request('receive', 0, ['one'], { sourceKey: 'test-source' }), actor);
    assert.equal(first.added, 1);
    const second = await mutatePlan(db, request('receive', 1, ['one', 'two'], { sourceKey: 'test-source' }), actor);
    assert.equal(second.added, 1);
    assert.equal(second.existing, 1);
    let state = await getPlan(db, week);
    assert.equal(state.rows.find(r => r.sku === 'TEST-ONE').group, 'MASTER-TEST-ONE');
    const ids = state.rows.map(r => r.id), id = ids[0];
    await assert.rejects(() => mutatePlan(db, request('close', 2, ids), actor), e => e.message === 'cannotClose');
    assert.equal((await getPlan(db, week)).revision, 2);
    await mutatePlan(db, request('save', 2, ids, { edits: Object.fromEntries(ids.map(id => [id, { plan: 80, line: 'C', start: week, end: '2026-09-11', sequence: 2, type: 'GỐI ĐẦU' }])) }), actor);
    await mutatePlan(db, request('receive', 3, ['one', 'two'], { sourceKey: 'test-source' }), actor);
    state = await getPlan(db, week);
    assert.equal(state.rows[0].plan, 80);
    assert.equal(state.rows[0].line, 'C');
    assert.equal(state.rows[0].priority, 'THƯỜNG - GỐI ĐẦU');
    await mutatePlan(db, request('close', 4, ids), actor);
    await assert.rejects(() => mutatePlan(db, request('save', 5, [id], { edits: { [id]: { plan: 90 } } }), actor), e => e.message === 'locked');
    await mutatePlan(db, request('transfer', 5, ids), actor);
    state = await getPlan(db, week);
    assert.equal(state.transit.length, 2);
    const transitView = await getTransit(db);
    assert.equal(transitView.rows.filter(row => ids.includes(row.planRowId)).length, 2);
    assert.equal(state.transit.find(r => r.sku === 'TEST-ONE').group, 'MASTER-TEST-ONE');
    assert.equal(state.transit[0].columns[5], '');
    assert.equal(state.transit[0].columns[13], 80);
    assert.equal(state.transit[0].columns[16], 'CHƯA MỞ LSX');
    const duplicate = await mutatePlan(db, request('transfer', 6, ids), actor);
    assert.equal(duplicate.existing, 2);
    assert.equal(duplicate.revision, 6);
    await assert.rejects(() => mutatePlan(db, request('reopen', 6, [id], { reason: 'TEST' }), { login: 'TEST-reader', canReopenPlan: false }), e => e.status === 403);
    await assert.rejects(() => mutatePlan(db, request('reopen', 6, [id]), actor), e => e.message === 'alreadyTransferred');
    state = await getPlan(db, week);
    assert.equal(state.revision, 6);
    assert.equal(state.transit.length, 2);
    assert.equal(state.rows.find(r => r.id === id).status, 'ĐÃ CHUYỂN');
    assert.equal((await getPlan(db, '2026-09-14')).rows.length, 0);
    const before = await records(db);
    await c.close();
    c.close = async () => { };
    const reopened = await openDatabase(path);
    try {
        await migrate(reopened.db);
        assert.deepEqual(await records(reopened.db), before);
    }
    finally {
        await reopened.close();
    }
    await dbRun(async (second) => { await importBackup(second.db, { format: 'ONSPA-TEST-v1', environment: 'TEST', records: before }); assert.deepEqual(await records(second.db), before); });
}));
test('concurrent receives commit only one version with no duplicate or orphan audit', async () => dbRun(async ({ db }) => {
    await seed(db);
    const results = await Promise.allSettled([mutatePlan(db, request('receive', 0, ['one'], { sourceKey: 'test-source' }), actor), mutatePlan(db, request('receive', 0, ['two'], { sourceKey: 'test-source' }), actor)]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    const state = await getPlan(db, week);
    assert.equal(state.revision, 1);
    assert.equal(state.rows.length, 1);
    assert.equal(state.audit.length, 1);
}));
test('old incomplete records render safely; ambiguous records block mutation without deletion', async () => dbRun(async ({ db }) => {
    await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('production_plan', week, JSON.stringify({ week, rows: [{ id: 'old', sku: 'TEST-OLD' }] }), 'TEST', '2026-09-15').run();
    const state = await getPlan(db, week);
    assert.equal(state.rows[0].name, '');
    assert.equal(state.rows[0].plan, null);
    await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('production_plan', 'legacy', JSON.stringify({ week, rows: [{ id: 'duplicate', sku: 'TEST-OLD' }] }), 'TEST', '2026-09-15').run();
    await assert.rejects(() => mutatePlan(db, request('close', 0, ['old']), actor), e => e.message === 'legacyConflict');
    assert.equal((await records(db)).length, 2);
}));

test('close saves selected drafts atomically and returns authoritative rows without changing other drafts', async () => dbRun(async ({db}) => {
    await seed(db);
    await mutatePlan(db, request('receive', 0, ['one', 'two'], {sourceKey:'test-source'}), actor);
    const initial = await getPlan(db, week);
    const [a,b] = initial.rows;
    const edit = {plan:75,line:'A',start:week,end:'2026-09-11',sequence:1};
    await assert.rejects(() => mutatePlan(db, request('close', 1, [a.id,b.id], {edits:{[a.id]:edit}}), actor), e=>e.message==='cannotClose');
    assert.equal((await getPlan(db,week)).revision,1);
    assert.equal((await getPlan(db,week)).rows.find(r=>r.id===a.id).status,'DỰ KIẾN');
    const result = await mutatePlan(db,request('close',1,[a.id],{edits:{[a.id]:edit,[b.id]:{plan:999}}}),actor);
    assert.equal(result.rows.length,1);
    assert.equal(result.rows[0].plan,75);
    assert.equal(result.rows[0].status,'ĐÃ CHỐT');
    assert.equal(result.revision,2);
    assert.equal(result.audit.action,'close');
    const saved = await getPlan(db,week);
    assert.equal(saved.rows.find(r=>r.id===b.id).plan,b.plan);
    await assert.rejects(()=>mutatePlan(db,request('close',2,[a.id],{edits:{[a.id]:edit}}),actor),e=>e.message==='locked');
    const reopened = await mutatePlan(db,request('reopen',2,[a.id]),actor);
    assert.equal(reopened.rows[0].status,'DỰ KIẾN');
    assert.equal(reopened.audit.reason,'');
    assert.equal(reopened.revision,3);
}));

test('paused and cancelled plans persist and do not prevent closing selected draft rows', async () => dbRun(async ({db}) => {
    await seed(db);
    await mutatePlan(db,request('receive',0,['one','two'],{sourceKey:'test-source'}),actor);
    const [a,b]=(await getPlan(db,week)).rows;
    const paused=await mutatePlan(db,request('save',1,[a.id],{edits:{[a.id]:{status:'TẠM HOÃN'}}}),actor);
    assert.equal(paused.rows[0].status,'TẠM HOÃN');
    const cancelled=await mutatePlan(db,request('save',2,[a.id],{edits:{[a.id]:{status:'HỦY'}}}),actor);
    assert.equal(cancelled.rows[0].status,'HỦY');
    await mutatePlan(db,request('close',3,[b.id],{edits:{[b.id]:{start:week,end:'2026-09-11',sequence:1}}}),actor);
    const saved=await getPlan(db,week);
    assert.equal(saved.rows.length,2);
    assert.equal(saved.rows.find(r=>r.id===a.id).status,'HỦY');
    assert.equal(saved.rows.find(r=>r.id===b.id).status,'ĐÃ CHỐT');
}));

async function prepareTransferRows(db) {
    await seed(db);
    await db.batch(['TEST-ONE','TEST-TWO'].map(sku => db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)')
        .bind('labor_hours',sku,JSON.stringify({sku,laborHour:0.1}),actor.login,'2026-09-15')));
    await mutatePlan(db,request('receive',0,['one','two'],{sourceKey:'test-source'}),actor);
    const state=await getPlan(db,week), ids=state.rows.map(row=>row.id);
    await mutatePlan(db,request('save',state.revision,ids,{edits:Object.fromEntries(ids.map(id=>[id,{start:week,end:'2026-09-11',sequence:1}]))}),actor);
    return getPlan(db,week);
}

for (const status of ['DỰ KIẾN','TẠM HOÃN','HỦY']) {
    test(`transfer rejects ${status} alone and in either batch order without changing any records`, async () => dbRun(async ({db}) => {
        let state=await prepareTransferRows(db);
        const [confirmed,ineligible]=state.rows;
        await mutatePlan(db,request('save',state.revision,[ineligible.id],{edits:{[ineligible.id]:{status}}}),actor);
        state=await getPlan(db,week);
        await mutatePlan(db,request('close',state.revision,[confirmed.id]),actor);
        const before=await getPlan(db,week), storedBefore=await records(db);
        assert.equal(before.rows.find(row=>row.id===ineligible.id).status,status);
        assert.equal(before.rows.find(row=>row.id===confirmed.id).status,'ĐÃ CHỐT');
        assert.deepEqual(rowWarnings(before.rows.find(row=>row.id===ineligible.id)),[],'status is the only transfer blocker');

        for (const ids of [[ineligible.id],[confirmed.id,ineligible.id],[ineligible.id,confirmed.id]]) {
            // A transfer payload cannot promote an unconfirmed row through forged inline edits.
            await assert.rejects(()=>mutatePlan(db,request('transfer',before.revision,ids,{edits:{[ineligible.id]:{status:'ĐÃ CHỐT'}}}),actor),
                error=>error.message==='cannotTransfer'&&error.status===422);
            assert.deepEqual(await records(db),storedBefore,'rejection must roll back plan, transit, capacity and all audit records');
        }
        const after=await getPlan(db,week);
        assert.deepEqual(after,before);
        assert.deepEqual(summary(after.rows,after.capacity,week),summary(before.rows,before.capacity,week));
        assert.equal((await getTransit(db)).rows.length,0);
    }));
}

test('transfer retains plan history and capacity totals; mixed and repeated selections add no duplicates', async () => dbRun(async ({db}) => {
    let state=await prepareTransferRows(db);
    const ids=state.rows.map(row=>row.id);
    await mutatePlan(db,request('close',state.revision,ids),actor);
    const before=await getPlan(db,week), storedBefore=await records(db);
    const first=await mutatePlan(db,request('transfer',before.revision,[ids[0]]),actor);
    assert.deepEqual(first,{added:1,existing:0,updated:1,errors:0,revision:before.revision+1});
    const partial=await getPlan(db,week), storedPartial=await records(db);
    const second=await mutatePlan(db,request('transfer',partial.revision,ids),actor);
    assert.deepEqual(second,{added:1,existing:1,updated:1,errors:0,revision:partial.revision+1});

    state=await getPlan(db,week);
    const storedAfter=await records(db);
    assert.equal(state.rows.length,before.rows.length,'transferred rows remain in persisted plan history');
    assert.equal(state.transit.length,ids.length);
    assert.equal(new Set(state.transit.map(row=>row.planRowId)).size,ids.length);
    assert.equal((await getTransit(db)).rows.filter(row=>ids.includes(row.planRowId)).length,ids.length);
    const calendarOnly=rows=>rows.map(({backlogRows,backlogHours,previousBacklogHours,backlogMissing,otherPlans,...calendar})=>calendar);
    assert.deepEqual(calendarOnly(state.capacity),calendarOnly(before.capacity));
    assert.equal(state.capacity.find(c=>c.line==='A').backlogHours,10);
    assert.equal(state.capacity.find(c=>c.line==='B').backlogHours,5);
    assert.deepEqual(summary(state.rows,state.capacity,week),summary(before.rows,before.capacity,week));
    assert.deepEqual(state.rows.find(row=>row.id===ids[0]),partial.rows.find(row=>row.id===ids[0]),'an already transferred row is untouched');
    for (const oldRow of before.rows) {
        const row=state.rows.find(row=>row.id===oldRow.id);
        assert.ok(row.transferredAt);
        assert.deepEqual(row,{...oldRow,status:'ĐÃ CHUYỂN',transferredAt:row.transferredAt,transferredBy:actor.login,updatedAt:row.transferredAt,updatedBy:actor.login});
    }
    for (const original of storedPartial.filter(row=>row.entity!=='production_plan')) {
        assert.deepEqual(storedAfter.find(row=>row.entity===original.entity&&row.record_key===original.record_key),original,'existing transit, capacity and audit payloads are preserved byte-for-byte');
    }
    assert.equal(storedAfter.length,storedBefore.length+4,'two new transit records and exactly two transfer audits');
    const transferAudits=state.audit.filter(event=>event.action==='transfer');
    assert.equal(transferAudits.length,2);
    const firstAudit=transferAudits.find(event=>event.before.every(row=>row.status==='ĐÃ CHỐT'));
    assert.deepEqual(firstAudit.before,before.rows);
    assert.deepEqual(firstAudit.after,partial.rows);
    const secondAudit=transferAudits.find(event=>event!==firstAudit);
    assert.deepEqual(secondAudit.before,partial.rows);
    assert.deepEqual(secondAudit.after,state.rows);

    const expected={added:0,existing:ids.length,updated:0,errors:0,revision:state.revision};
    assert.deepEqual(await mutatePlan(db,request('transfer',state.revision,ids),actor),expected);
    assert.deepEqual(await Promise.all([
        mutatePlan(db,request('transfer',state.revision,ids),actor),
        mutatePlan(db,request('transfer',state.revision,ids),actor),
    ]),[expected,expected]);
    await assert.rejects(()=>mutatePlan(db,request('transfer',before.revision,ids),actor),error=>error.message==='conflict'&&error.status===409);
    assert.deepEqual(await records(db),storedAfter,'retries, including stale retries, must not rewrite data or append audits');
}));

for (const overlap of [true,false]) {
    test(`concurrent ${overlap?'identical':'disjoint'} transfers commit one revision with no duplicate or orphan history`, {timeout:30000}, async () => dbRun(async ({db}) => {
        let state=await prepareTransferRows(db);
        const ids=state.rows.map(row=>row.id);
        await mutatePlan(db,request('close',state.revision,ids),actor);
        const before=await getPlan(db,week), storedBefore=await records(db);
        // Both requests must finish validation against the same revision before either writes.
        let arrivals=0, release;
        const ready=new Promise(resolve=>{release=resolve;});
        const racingDb={
            prepare:sql=>db.prepare(sql),
            batch:async statements=>{
                if (++arrivals===2) release();
                await ready;
                return db.batch(statements);
            },
        };
        const selections=overlap?[ids,ids]:[[ids[0]],[ids[1]]];
        const results=await Promise.allSettled(selections.map(selection=>mutatePlan(racingDb,request('transfer',before.revision,selection),actor)));
        assert.equal(arrivals,2);
        assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
        const rejected=results.find(result=>result.status==='rejected');
        assert.equal(rejected.reason.message,'conflict');
        assert.equal(rejected.reason.status,409);
        const winnerIndex=results.findIndex(result=>result.status==='fulfilled'), winnerIds=selections[winnerIndex];
        assert.deepEqual(results[winnerIndex].value,{added:winnerIds.length,existing:0,updated:winnerIds.length,errors:0,revision:before.revision+1});
        state=await getPlan(db,week);
        assert.equal(state.revision,before.revision+1);
        assert.equal(state.rows.length,before.rows.length);
        assert.deepEqual(state.rows.filter(row=>row.status==='ĐÃ CHUYỂN').map(row=>row.id).sort(),[...winnerIds].sort());
        assert.equal(state.transit.length,winnerIds.length);
        assert.deepEqual(state.transit.map(row=>row.planRowId).sort(),[...winnerIds].sort());
        assert.equal((await getTransit(db)).rows.filter(row=>ids.includes(row.planRowId)).length,winnerIds.length);
        assert.deepEqual(summary(state.rows,state.capacity,week),summary(before.rows,before.capacity,week));
        const transferAudits=state.audit.filter(event=>event.action==='transfer');
        assert.equal(transferAudits.length,1);
        assert.deepEqual(transferAudits[0].before,before.rows);
        assert.deepEqual(transferAudits[0].after,state.rows);
        const storedAfter=await records(db);
        assert.equal(storedAfter.length,storedBefore.length+winnerIds.length+1);
        for (const original of storedBefore.filter(row=>row.entity!=='production_plan')) {
            assert.deepEqual(storedAfter.find(row=>row.entity===original.entity&&row.record_key===original.record_key),original);
        }
    }));
}

test('Engine receipt and ordinary edits stay draft until an explicit close succeeds',async()=>dbRun(async({db})=>{
 await seed(db);
 const source=JSON.parse((await db.prepare("SELECT payload FROM app_records WHERE entity='production_engine' AND record_key='test-source'").first()).payload);
 source.rows[0].status='ĐÃ CHỐT';source.rows[0].closedAt='2026-01-01T00:00:00Z';source.rows[0].closedBy='engine';
 await db.prepare("UPDATE app_records SET payload=? WHERE entity='production_engine' AND record_key='test-source'").bind(JSON.stringify(source)).run();
 await mutatePlan(db,request('receive',0,['one'],{sourceKey:'test-source'}),actor);
 let state=await getPlan(db,week);const id=state.rows[0].id;
 assert.equal(state.rows[0].status,'DỰ KIẾN');assert.equal(state.rows[0].closedAt,undefined);assert.equal(state.rows[0].closedBy,undefined);
 await mutatePlan(db,request('save',1,[id],{edits:{[id]:{plan:150,start:week,end:week}}}),actor);
 state=await getPlan(db,week);assert.equal(state.rows[0].status,'DỰ KIẾN');
 await assert.rejects(()=>mutatePlan(db,request('save',2,[id],{edits:{[id]:{status:'ĐÃ CHỐT'}}}),actor),e=>e.message==='invalidEdit');
 await assert.rejects(()=>mutatePlan(db,request('transfer',2,[id]),actor),e=>e.message==='cannotTransfer');
 state=await getPlan(db,week);assert.equal(state.revision,2);assert.equal(state.rows[0].status,'DỰ KIẾN');assert.equal(state.audit.some(item=>item.action==='close'),false);
 await mutatePlan(db,request('close',2,[id]),actor);
 state=await getPlan(db,week);assert.equal(state.rows[0].status,'ĐÃ CHỐT');assert.equal(state.rows[0].closedBy,actor.login);assert.ok(state.rows[0].closedAt);assert.equal(state.audit.filter(item=>item.action==='close').length,1);
 await mutatePlan(db,request('receive',3,['one'],{sourceKey:'test-source'}),actor);
 state=await getPlan(db,week);assert.equal(state.rows[0].status,'ĐÃ CHỐT');assert.equal(state.audit.filter(item=>item.action==='close').length,1,'receiving again preserves a previous close without creating another');
}));


test('receive reports specific SKU blockers, stays atomic and clears stale Engine pending flags', async()=>dbRun(async({db})=>{
 await seed(db);
 const row=await db.prepare("SELECT payload FROM app_records WHERE entity='production_engine' AND record_key='test-source'").first();
 const source=JSON.parse(row.payload);source.rows[0].skuPending=true;
 await db.prepare("UPDATE app_records SET payload=? WHERE entity='production_engine' AND record_key='test-source'").bind(JSON.stringify(source)).run();
 assert.equal((await getPlan(db,week)).sources[0].rows[0].skuPending,false);
 await db.prepare("DELETE FROM app_records WHERE entity='sku' AND record_key='TEST-TWO'").run();
 await assert.rejects(mutatePlan(db,request('receive',0,['one','two'],{sourceKey:'test-source'}),actor),e=>{
  assert.equal(e.message,'batchRejected');assert.equal(e.status,422);
  assert.deepEqual(e.details,[{id:'two',sku:'TEST-TWO',reason:'skuMissing'}]);return true;
 });
 assert.equal((await getPlan(db,week)).rows.length,0);
 const result=await mutatePlan(db,request('receive',0,['one'],{sourceKey:'test-source'}),actor);
 assert.equal(result.added,1);
}));

test('daily overload asks before write, confirms exact basis, audits approval and rejects stale approval',async()=>dbRun(async({db})=>{
 const {newDailyCapacity}=await import('../lib/capacity.mjs');const c=newDailyCapacity(week,'A',100);Object.assign(c,{status:'Đã xác nhận',reviewStatus:'approved',syncedAt:'2026-09-01',khsxAcceptedAt:'2026-09-01'});c.input.workers=1;c.input.dailySchedule=c.input.dailySchedule.map(d=>({...d,breaks:[]}));
 await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('capacity',week,JSON.stringify({schemaVersion:1,week,rows:[c]}),'TEST','now').run();
 const base={id:'daily',sku:'DAILY',week,line:'A',plan:20,laborHour:1,type:'TUẦN CHÍNH',priority:'THƯỜNG',status:'DỰ KIẾN',start:'',end:''};
 await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('production_plan',week,JSON.stringify({schemaVersion:2,week,revision:1,rows:[base]}),'TEST','now').run();
 const body={action:'save',week,revision:1,ids:['daily'],edits:{daily:{start:week,end:week}}};let first;
 await assert.rejects(()=>mutatePlan(db,body,actor),e=>{assert.equal(e.message,'dailyCapacityConfirmation');first=JSON.parse(e.details[0].reason);assert.equal(first.warnings[0].over,12);return true;});
 assert.equal((await getPlan(db,week)).revision,1);
 c.input.workers=2;await db.prepare("UPDATE app_records SET payload=? WHERE entity='capacity' AND record_key=?").bind(JSON.stringify({schemaVersion:1,week,rows:[c]}),week).run();let fresh;
 await assert.rejects(()=>mutatePlan(db,{...body,dailyCapacityAck:first.token},actor),e=>{fresh=JSON.parse(e.details[0].reason);assert.equal(fresh.warnings[0].over,4);assert.notEqual(fresh.token,first.token);return true;});
 const saved=await mutatePlan(db,{...body,dailyCapacityAck:fresh.token},actor);assert.equal(saved.revision,2);assert.equal(saved.audit.dailyCapacityOverride.by,actor.login);assert.equal(saved.audit.dailyCapacityOverride.warnings[0].over,4);
}));

test('In transit carryover reduces daily capacity, appears in weekly card and invalidates stale overload approval',async()=>dbRun(async({db})=>{
 const {newDailyCapacity}=await import('../lib/capacity.mjs');const c=newDailyCapacity(week,'A',100);Object.assign(c,{status:'Đã xác nhận',reviewStatus:'approved',syncedAt:'yes',khsxAcceptedAt:'yes',availableHours:480});c.input.workers=10;c.input.dailySchedule.forEach(d=>d.breaks=[]);
 const put=async(entity,key,payload)=>db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?) ON CONFLICT(entity,record_key) DO UPDATE SET payload=excluded.payload').bind(entity,key,JSON.stringify(payload),'TEST','now').run();
 await put('capacity',week,{schemaVersion:1,week,rows:[c]});await put('labor_hours','OLD',{sku:'OLD',laborHour:2});
 const old={id:'old',planRowId:'old-plan',planId:'previous-plan',week:'2026-08-31',sku:'OLD',name:'Old order',line:'A',planStart:'2026-08-31',planEnd:week,lsxCode:'OLD-LSX',lsxQty:100,completedQty:70};await put('in_transit','old',old);
 await put('production_plan','2026-08-31',{week:'2026-08-31',rows:[{id:'old-plan',planId:'previous-plan',week:'2026-08-31',sku:'OLD',line:'A',start:'2026-08-31',end:week,plan:100,laborHour:2,status:'ĐÃ CHUYỂN'}]});
 await put('production_plan',week,{schemaVersion:2,week,revision:1,rows:[{id:'new',sku:'NEW',week,line:'A',plan:30,laborHour:1,type:'TUẦN CHÍNH',priority:'THƯỜNG',status:'DỰ KIẾN',start:'',end:''}]});
 const state=await getPlan(db,week),capacity=state.capacity.find(c=>c.line==='A');assert.equal(capacity.previousBacklogHours,60);assert.equal(capacity.backlogRows[0].lsxCode,'OLD-LSX');
 const body={action:'save',week,revision:1,ids:['new'],edits:{new:{start:week,end:week}}};let warning;
 await assert.rejects(()=>mutatePlan(db,body,actor),e=>{warning=JSON.parse(e.details[0].reason);assert.equal(warning.warnings[0].over,10);assert.equal(warning.backlog[0].remaining,30);return true;});
 await put('in_transit','old',{...old,completedQty:60});let latest;
 await assert.rejects(()=>mutatePlan(db,{...body,dailyCapacityAck:warning.token},actor),e=>{latest=JSON.parse(e.details[0].reason);assert.notEqual(latest.token,warning.token);assert.equal(latest.warnings.find(w=>w.id==='new').over,30);return true;});
 assert.equal((await getPlan(db,week)).revision,1);const saved=await mutatePlan(db,{...body,dailyCapacityAck:latest.token},actor);assert.equal(saved.revision,2);
}));


test('split persists independent plan rows, protects permissions/revisions and survives Engine refresh and transfers',()=>dbRun(async({db})=>{
 await seed(db);
 const calendar={schemaVersion:1,week,rows:['A','B','C'].map(line=>{const row=newDailyCapacity(week,line,100);row.input.workers=10;return {...row,status:'Đã xác nhận',reviewStatus:'approved',version:1,syncedAt:'fixture',khsxAcceptedAt:'fixture',availableHours:calculateCapacity(row.input,week).availableHours};})};
 await db.prepare("UPDATE app_records SET payload=? WHERE entity='capacity' AND record_key=?").bind(JSON.stringify(calendar),week).run();
 await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('labor_hours','TEST-ONE',JSON.stringify({sku:'TEST-ONE',laborHour:0.1}),actor.login,'fixture').run();
 const editor={...actor,grants:['Kế hoạch sản xuất / Production_plan / Sửa']};
 await mutatePlan(db,request('receive',0,['one'],{sourceKey:'test-source'}),actor);
 const original=(await getPlan(db,week)).rows[0],id=original.id;
 const snapshot=async()=>(await db.prepare('SELECT * FROM app_records ORDER BY entity,record_key').all()).results;
 for(const [who,ids,status] of [[actor,[id],403],[editor,[],422],[editor,[id,id],422]]){const before=await snapshot();await assert.rejects(()=>mutatePlan(db,request('split',1,ids),who),e=>e.status===status);assert.deepEqual(await snapshot(),before);}
 const simultaneous=await Promise.allSettled([mutatePlan(db,request('split',1,[id]),editor),mutatePlan(db,request('split',1,[id]),editor)]);assert.equal(simultaneous.filter(r=>r.status==='fulfilled').length,1);assert.equal(simultaneous.find(r=>r.status==='rejected').reason.status,409);
 let state=await getPlan(db,week),child=state.rows.find(r=>r.id!==id);
 assert.deepEqual(state.warnings,[]);assert.equal(state.rows.length,2);assert.equal(state.rows.find(r=>r.id===id).plan,100);assert.equal(child.plan,null);assert.equal(child.suggested,null);assert.equal(child.planId,original.planId);assert.equal(child.planGroupId,id);
 const snapshotAfterSplit=await snapshot();await assert.rejects(()=>mutatePlan(db,request('split',1,[id]),editor),e=>e.status===409);assert.deepEqual(await snapshot(),snapshotAfterSplit);
 // Saving Line/dates while quantity is still blank is a valid draft, never zero or a subtraction.
 await mutatePlan(db,request('save',2,[child.id],{edits:{[child.id]:{line:'B',start:week,end:week}}}),actor);
 await mutatePlan(db,request('save',3,[id,child.id],{edits:{[id]:{plan:20,start:week,end:week},[child.id]:{plan:30}}}),actor);
 state=await getPlan(db,week);assert.equal(state.rows.reduce((n,r)=>n+r.plan,0),50);assert.equal(state.rows.find(r=>r.id===id).suggested,100);
 await mutatePlan(db,request('save',4,[child.id],{edits:{[child.id]:{plan:150}}}),actor);
 state=await getPlan(db,week);assert.equal(state.rows.reduce((n,r)=>n+r.plan,0),170);assert.equal(state.rows.find(r=>r.id===child.id).planId,original.planId);
 assert.equal(summary(state.rows,state.capacity,week).find(r=>r.line==='A').required,2);assert.equal(summary(state.rows,state.capacity,week).find(r=>r.line==='B').required,15);
 await mutatePlan(db,request('receive',5,['one'],{sourceKey:'test-source'}),actor);state=await getPlan(db,week);
 assert.equal(state.rows.length,2);assert.equal(state.rows.find(r=>r.id===id).plan,20);assert.equal(state.rows.find(r=>r.id===child.id).plan,150);assert.equal(state.rows.find(r=>r.id===child.id).line,'B');assert.equal(state.rows.find(r=>r.id===child.id).suggested,null);
 await mutatePlan(db,request('close',6,[id,child.id]),actor);
 const closedBefore=await snapshot();await assert.rejects(()=>mutatePlan(db,request('split',7,[id]),editor),e=>e.status===409);assert.deepEqual(await snapshot(),closedBefore);
 await mutatePlan(db,request('transfer',7,[id]),actor);
 state=await getPlan(db,week);const loads=remainingPlanWithTransitSummary(state.rows,state.capacity,week);assert.equal(loads.reduce((n,row)=>n+row.totalRequired,0),17,'transferred root plus pending sibling each count exactly once');
 // A sibling transfer must not block this distinct row's reopen/close.
 await mutatePlan(db,request('reopen',8,[child.id]),actor);await mutatePlan(db,request('close',9,[child.id]),actor);
 await mutatePlan(db,request('transfer',10,[child.id]),actor);
 state=await getPlan(db,week);assert.equal(state.rows.length,2);assert.ok(state.rows.every(r=>r.status==='ĐÃ CHUYỂN'));assert.deepEqual(state.warnings,[]);
 let transit=(await getTransit(db)).rows;assert.equal(transit.length,2);assert.equal(new Set(transit.map(r=>r.id)).size,2);assert.equal(new Set(transit.map(r=>r.planRowId)).size,2);assert.equal(new Set(transit.map(r=>r.planId)).size,1);
 for(const row of transit){const qty=row.planRowId===id?20:150;await mutateTransit(db,{action:'draft-lsx',id:row.id,expectedRevision:row.revision,changes:{lsxCode:`SPLIT-${row.planRowId===id?'A':'B'}`,lsxQty:qty,lsxOpenedAt:week}},actor);}
 transit=(await getTransit(db)).rows;assert.equal(transit.find(r=>r.planRowId===id).lsxQty,20);assert.equal(transit.find(r=>r.planRowId===child.id).lsxQty,150);
 const beforeOver=await snapshot(),row=transit.find(r=>r.planRowId===child.id);
 await assert.rejects(()=>mutateTransit(db,{action:'draft-lsx',id:row.id,expectedRevision:row.revision,changes:{lsxQty:151}},actor),e=>e.message==='lsxExceedsPlan');assert.deepEqual(await snapshot(),beforeOver);
 const transferredBefore=await snapshot();await assert.rejects(()=>mutatePlan(db,request('split',11,[id]),editor),e=>e.status===409);assert.deepEqual(await snapshot(),transferredBefore);
 // Additional LSX share only their own split row's budget, not the sibling's.
 const base=(await getTransit(db)).rows.find(r=>r.planRowId===child.id);
 await mutateTransit(db,{action:'draft-lsx',id:base.id,expectedRevision:base.revision,changes:{lsxQty:100}},actor);
 const extra=(await mutateTransit(db,{action:'add-lsx',id:base.id,planStart:week,planEnd:week,line:'B',priority:'THƯỜNG',sequence:2},actor)).row;
 let latest=(await getTransit(db)).rows.find(r=>r.id===extra.id);
 await mutateTransit(db,{action:'draft-lsx',id:extra.id,expectedRevision:latest.revision,changes:{lsxCode:'SPLIT-B-EXTRA',lsxQty:50,lsxOpenedAt:week}},actor);
 latest=(await getTransit(db)).rows.find(r=>r.id===extra.id);const beforeAdditional=await snapshot();
 await assert.rejects(()=>mutateTransit(db,{action:'draft-lsx',id:extra.id,expectedRevision:latest.revision,changes:{lsxQty:51}},actor),e=>e.message==='lsxExceedsPlan');assert.deepEqual(await snapshot(),beforeAdditional);
 const rootOrder=(await getTransit(db)).rows.find(r=>r.planRowId===id);latest=(await getTransit(db)).rows.find(r=>r.id===extra.id);
 await mutateTransit(db,{action:'cancel',id:extra.id,expectedRevision:latest.revision,reason:'Synthetic cancellation'},actor);const afterCancel=(await getTransit(db)).rows;assert.equal(afterCancel.find(r=>r.id===extra.id).status,'HỦY');assert.deepEqual(afterCancel.find(r=>r.id===rootOrder.id),rootOrder,'cancelling child LSX must preserve the sibling order');

}));
