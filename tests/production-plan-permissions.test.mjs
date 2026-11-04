import test from 'node:test';
import {assertRejectedRequestAudit,assertSnapshotWithReceipts} from './helpers/rejected-request-audit.mjs';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {root, openDatabase, migrate, records} from '../scripts/local/database.mjs';
import {canPlanAction} from '../lib/production-plan-permissions.mjs';
import {siteApi, sitePrincipal} from '../worker/site-api.mjs';
import {passwordRecord} from '../worker/password-auth.mjs';

const menu = 'Kế hoạch sản xuất / Production_plan';
const grant = action => `${menu} / ${action}`;
const week = '2026-10-12', login = 'TEST-plan-permissions', at = '2026-10-16T00:00:00.000Z';
const url = 'https://test.invalid';
const actor = grants => ({login, grants});

test('Production Plan matches exact menu and action, including the existing legacy reopen alias', () => {
    for (const action of ['Hủy xác nhận', 'Mở lại']) {
        for (const label of [menu, 'Kế hoạch sản xuất / Production Plan']) {
            const principal = actor([`${label} / ${action}`]);
            assert.equal(canPlanAction(principal, 'reopen'), true);
            assert.equal(canPlanAction(principal, 'close'), false);
            assert.equal(canPlanAction(principal, 'save'), false);
        }
    }
    const formatted = actor(['  KẾ HOẠCH SẢN XUẤT / Production_plan / Hủy   xác nhận  '.normalize('NFD')]);
    assert.equal(canPlanAction(formatted, 'reopen'), true);
    for (const permission of [
        grant('Xem'), grant('Sửa'), grant('Xác nhận'), grant('Hủy'), grant('Hủy xác nhận khác'),
        'Kế hoạch sản xuất / In_transit / Hủy xác nhận',
        'Quản lý sản xuất / Production_plan / Hủy xác nhận',
        'Kế hoạch sản xuất / Production_plan_extra / Hủy xác nhận',
        'Kế hoạch sản xuất / Production_plan / Extra / Hủy xác nhận',
    ]) assert.equal(canPlanAction(actor([permission]), 'reopen'), false, permission);
    assert.equal(canPlanAction(actor([grant('Xác nhận')]), 'close'), true);
    assert.equal(canPlanAction(actor([grant('Sửa')]), 'save'), true);
    assert.equal(canPlanAction(actor([grant('Hủy xác nhận')]), 'close'), false);
    assert.equal(canPlanAction(actor([grant('Sửa')]), 'close'), false);
    assert.equal(canPlanAction(actor([grant('Xác nhận')]), 'save'), false);
    assert.equal(canPlanAction(null, 'reopen'), false);
    for (const action of ['save', 'close', 'reopen']) {
        assert.equal(canPlanAction({login, isAdmin: true}, action), true);
        assert.equal(canPlanAction({login, isAdmin: true, authMode: 'quick_line'}, action), false);
    }
});

async function fixture(t, {role = 'USER', status = 'ĐÃ CHỐT', priority = 'THƯỜNG', login = 'TEST-plan-permissions'} = {}) {
    const base = resolve(root, '.local-data/tests');
    mkdirSync(base, {recursive: true});
    const c = await openDatabase(mkdtempSync(resolve(base, 'plan-permissions-')));
    t.after(() => c.close());
    await migrate(c.db);
    const put = (entity, key, payload) => c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?) ON CONFLICT(entity,record_key) DO UPDATE SET payload=excluded.payload,updated_by=excluded.updated_by,updated_at=excluded.updated_at').bind(entity, key, JSON.stringify(payload), 'TEST-fixture', at).run();
    await put('users', login, {login, name: login, role, active: true, department: 'TEST-KHSX'});
    const password = await passwordRecord('1234');
    await c.db.prepare('INSERT INTO auth_accounts VALUES(?,?,?,?,1,?)').bind(login, password.hash, password.salt, password.iterations, at).run();
    const env = {DB: c.db, FILES: c.bucket};
    const authenticated = await siteApi(new Request(`${url}/api/auth/login`, {
        method: 'POST', headers: {origin: url, 'content-type': 'application/json'}, body: JSON.stringify({login, password: '1234'}),
    }), env);
    assert.equal(authenticated.status, 200);
    const cookie = authenticated.headers.get('set-cookie').split(';')[0];
    await put('production_plan', week, {schemaVersion: 2, week, revision: 0, rows: [{
        id: 'one', week, sku: 'TEST-PLAN-SKU', name: 'TEST plan', line: 'A', plan: 100,
        start: week, end: '2026-10-18', priority, type: 'TUẦN CHÍNH', status,
    }]});
    await put('capacity', week, {schemaVersion: 1, week, rows: [{week, line: 'A', status: 'Đã xác nhận', reviewStatus: 'approved', version: 1, availableHours: 1000}]});
    const setGrants = async (permissions, options = {}) => put('permissions', login, {login, active: true, permissions: permissions.join(' · '), ...options});
    const principal = () => sitePrincipal(new Request(`${url}/api/production-plan`, {headers: {cookie}}), env);
    const read = () => siteApi(new Request(`${url}/api/production-plan?week=${week}`, {headers: {cookie}}), env);
    const validatedReceipts=[];
    const mutate = async (action, revision = 0, extra = {}, headers = {}) => {
        const body={action, week, revision, ids: ['one'], ...extra};
        const before=await records(c.db);
        const response=await siteApi(new Request(`${url}/api/production-plan`, {
            method:'POST',headers:{cookie,origin:url,'content-type':'application/json',...headers},body:JSON.stringify(body),
        }),env);
        if(response.status>=400){
            const row=await assertRejectedRequestAudit({before,after:await records(c.db),response,actorId:headers.cookie&&headers.cookie!==cookie?'LINE_A':login,route:'/api/production-plan',body,receipt:login!=='vthduyen'&&headers.cookie!==''&&(!headers.origin||headers.origin===url)});
            if(row)validatedReceipts.push(row);
        }
        return response;
    };
    const unchanged=async before=>assertSnapshotWithReceipts(before,await records(c.db),validatedReceipts);
    return {...c, env, cookie, put, setGrants, principal, read, mutate,unchanged};
}

test('real site principal and plan read expose canonical, inherited and legacy reopen permissions without writing', async t => {
    const f = await fixture(t);
    for (const [permission, allowed] of [
        [grant('Hủy xác nhận'), true],
        ['Kế hoạch sản xuất / Production Plan / Mở lại', true],
        [grant('Sửa'), false], [grant('Xác nhận'), false], [grant('Xem'), false],
        ['Kế hoạch sản xuất / In_transit / Hủy xác nhận', false],
        ['Quản lý sản xuất / Production_plan / Hủy xác nhận', false],
    ]) {
        await f.setGrants([grant('Xem'), permission]);
        const before = await records(f.db);
        assert.equal((await f.principal()).canReopenPlan, allowed, permission);
        const response = await f.read();
        assert.equal(response.status, 200);
        assert.equal((await response.json()).canReopen, allowed, permission);
        assert.deepEqual(await records(f.db),before,'GET permissions must not write any record or receipt');
    }
    await f.put('department_permissions', 'TEST-KHSX', {active: true, permissions: [grant('Xem'), grant('Hủy xác nhận')].join(' · ')});
    await f.setGrants([], {permissionMode: 'DEPARTMENT'});
    assert.equal((await f.principal()).canReopenPlan, true);
    await f.setGrants([grant('Hủy xác nhận')], {active: false});
    assert.equal((await f.principal()).canReopenPlan, false, 'inactive personal permissions must not fall back to the department');
});

test('API reopen denies view/edit/confirm and wrong-menu grants with only a denied receipt and no business changes, then accepts Hủy xác nhận', async t => {
    const f = await fixture(t);
    for (const permission of [grant('Xem'), grant('Sửa'), grant('Xác nhận'), 'Kế hoạch sản xuất / In_transit / Hủy xác nhận', 'Quản lý sản xuất / Production_plan / Hủy xác nhận']) {
        await f.setGrants([grant('Xem'), permission]);
        const before = await records(f.db);
        const response = await f.mutate('reopen', 0, {reason: 'TEST reopen'});
        assert.equal(response.status, 403, permission);
        await f.unchanged(before);
    }
    await f.setGrants([grant('Xem'), grant('Hủy xác nhận')]);
    const response = await f.mutate('reopen', 0, {reason: 'TEST reopen'});
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.revision, 1);
    assert.equal(result.rows[0].status, 'DỰ KIẾN');
    assert.equal(result.rows[0].reopenReason, 'TEST reopen');
    assert.equal(result.audit.action, 'reopen');
    assert.equal(result.audit.actor, login);
    assert.equal((await f.db.prepare("SELECT count(*) AS n FROM app_records WHERE entity='production_plan_audit'").first()).n, 1);
});

test('API keeps legacy reopen working and does not require an unrelated edit grant', async t => {
    const f = await fixture(t);
    await f.setGrants(['Kế hoạch sản xuất / Production Plan / Mở lại']);
    const response = await f.mutate('reopen', 0, {reason: 'TEST legacy'});
    assert.equal(response.status, 200);
    assert.equal((await response.json()).rows[0].status, 'DỰ KIẾN');
});

test('API separates Xác nhận, Hủy xác nhận and Sửa, and requires Sửa for edits sent with close', async t => {
    const f = await fixture(t, {status: 'DỰ KIẾN'});
    for (const permission of [grant('Hủy xác nhận'), grant('Sửa'), grant('Xem'), 'Kế hoạch sản xuất / In_transit / Xác nhận', 'Quản lý sản xuất / Production_plan / Xác nhận']) {
        await f.setGrants([permission]);
        const before = await records(f.db);
        assert.equal((await f.mutate('close')).status, 403, permission);
        await f.unchanged(before);
    }
    for (const permission of [grant('Xác nhận'), grant('Hủy xác nhận'), grant('Xem')]) {
        await f.setGrants([permission]);
        const before = await records(f.db);
        assert.equal((await f.mutate('save', 0, {edits: {one: {plan: 90}}})).status, 403, permission);
        await f.unchanged(before);
    }
    await f.setGrants([grant('Xác nhận')]);
    const before = await records(f.db);
    assert.equal((await f.mutate('close', 0, {edits: {one: {plan: 90}}, canEditPlan: true})).status, 403);
    await f.unchanged(before);
    const closed = await f.mutate('close');
    assert.equal(closed.status, 200);
    const result = await closed.json();
    assert.equal(result.rows[0].status, 'ĐÃ CHỐT');
    assert.equal(result.rows[0].plan, 100);
    assert.equal(result.audit.action, 'close');
});

test('Xác nhận-only closes unchanged edit envelopes without Sửa, using normalized authoritative values', async t => {
    for (const [name, edits] of [
        ['empty envelope', {}],
        ['empty row edit', {one: {}}],
        ['same numeric value', {one: {plan: 100}}],
        ['equivalent normalized fields', {one: {plan: '100', line: 'Line A', sequence: '', start: week, end: '2026-10-18'}}],
        ['same status and labels', {one: {status: 'DỰ KIẾN', type: 'TUẦN CHÍNH', priority: 'THƯỜNG'}}],
    ]) await t.test(name, async child => {
        const f = await fixture(child, {status: 'DỰ KIẾN'});
        await f.setGrants([grant('Xác nhận')]);
        const invalidBefore = await records(f.db);
        const invalid = await f.mutate('close', 0, {edits: {one: {sku: 'TEST-PLAN-SKU'}}});
        assert.equal(invalid.status, 400, 'unchanged values must not expand the editable field allowlist');
        assert.equal((await invalid.json()).error, 'invalidEdit');
        await f.unchanged(invalidBefore);
        const response = await f.mutate('close', 0, {edits});
        assert.equal(response.status, 200);
        const result = await response.json();
        assert.equal(result.revision, 1);
        assert.equal(result.rows[0].status, 'ĐÃ CHỐT');
        assert.equal(result.rows[0].plan, 100);
        assert.equal(result.rows[0].line, 'A');
        assert.equal(result.rows[0].sequence, null);
        assert.equal(result.audit.before[0].plan, result.audit.after[0].plan);
    });
});

test('API allows Sửa to edit and requires Xác nhận as well when closing edited values', async t => {
    const f = await fixture(t, {status: 'DỰ KIẾN'});
    await f.setGrants([grant('Sửa')]);
    const saved = await f.mutate('save', 0, {edits: {one: {plan: 90}}});
    assert.equal(saved.status, 200);
    assert.equal((await saved.json()).rows[0].plan, 90);
    await f.setGrants([grant('Sửa'), grant('Xác nhận')]);
    const closed = await f.mutate('close', 1, {edits: {one: {plan: 80}}});
    assert.equal(closed.status, 200);
    const result = await closed.json();
    assert.equal(result.rows[0].plan, 80);
    assert.equal(result.rows[0].status, 'ĐÃ CHỐT');
});

test('Admin retains reopen capability but the transferred-row guard still applies to Admin and Hủy xác nhận', async t => {
    for (const role of ['USER', 'ADMIN']) await t.test(role, async child => {
        const f = await fixture(child, {role, status: 'ĐÃ CHUYỂN'});
        await f.setGrants(role === 'USER' ? [grant('Hủy xác nhận')] : []);
        assert.equal((await f.principal()).canReopenPlan, true);
        const before = await records(f.db);
        const response = await f.mutate('reopen', 0, {reason: 'TEST transferred'});
        assert.equal(response.status, 409);
        assert.equal((await response.json()).error, 'alreadyTransferred');
        await f.unchanged(before);
    });
});

test('API preserves authentication, same-origin and quick-Line restrictions', async t => {
    const f = await fixture(t);
    await f.setGrants([grant('Hủy xác nhận')]);
    const before = await records(f.db);
    assert.equal((await f.mutate('reopen', 0, {}, {cookie: ''})).status, 401);
    assert.equal((await f.mutate('reopen', 0, {}, {origin: 'https://other.invalid'})).status, 403);
    await f.unchanged(before);
    await f.put('users', 'LINE_A', {login: 'LINE_A', name: 'Line A', role: 'ADMIN', active: true, authMode: 'quick_line', line: 'A'});
    await f.put('permissions', 'LINE_A', {login: 'LINE_A', active: true, permissions: grant('Hủy xác nhận')});
    await f.db.prepare('INSERT INTO auth_accounts VALUES(?,?,?,?,1,?)').bind('LINE_A', 'QUICK_LINE', 'unused', 100000, at).run();
    const lineLogin = await siteApi(new Request(`${url}/api/auth/line-login`, {method: 'POST', headers: {origin: url, 'content-type': 'application/json'}, body: JSON.stringify({line: 'A'})}), f.env);
    assert.equal(lineLogin.status, 200);
    const cookie = lineLogin.headers.get('set-cookie').split(';')[0];
    const principal = await sitePrincipal(new Request(`${url}/api/production-plan`, {headers: {cookie}}), f.env);
    assert.equal(principal.canReopenPlan, false);
    assert.equal(principal.isAdmin, false);
    const lineBefore = await records(f.db);
    assert.equal((await f.mutate('reopen', 0, {}, {cookie})).status, 403);
    const read = await siteApi(new Request(`${url}/api/production-plan?week=${week}`, {headers: {cookie}}), f.env);
    assert.equal(read.status, 403);
    await f.unchanged(lineBefore);
});

test('close checks normalization-induced priority changes even when submitted row edits are empty',async t=>{
 for(const canEdit of [false,true])await t.test(canEdit?'edit and confirm':'confirm only',async child=>{
  const f=await fixture(child,{status:'DỰ KIẾN',priority:'THƯỜNG - GỐI ĐẦU'});
  await f.setGrants([grant('Xác nhận'),...(canEdit?[grant('Sửa')]:[])]);
  const before=await records(f.db);
  const response=await f.mutate('close',0,{edits:{one:{}}});
  assert.equal(response.status,canEdit?200:403);
  if(canEdit){const result=await response.json();assert.equal(result.rows[0].status,'ĐÃ CHỐT');assert.equal(result.rows[0].priority,'THƯỜNG');}
  else await f.unchanged(before);
 });
});

// Audit exemption is not a business-authorization exemption.
test('authenticated vthduyen alias remains denied without a receipt or business mutation',async t=>{
 const f=await fixture(t,{login:'vthduyen'});
 await f.setGrants([grant('Xem')]);
 const before=await records(f.db);
 const response=await f.mutate('reopen',0,{reason:'TEST exempt alias denied'});
 assert.equal(response.status,403);
 assert.equal(response.headers.get('X-ONSPA-Action-ID'),null);
 assert.deepEqual(await records(f.db),before);
});

test('Tách đơn uses the existing exact Sửa permission, never Xem/Thêm/Xác nhận or sibling menu rights',async t=>{
 const f=await fixture(t,{status:'DỰ KIẾN'});
 for(const permission of ['Xem','Thêm','Xác nhận','Hủy xác nhận']){
  await f.setGrants([grant(permission)]);const before=await records(f.db);const response=await f.mutate('split');assert.equal(response.status,403,permission);await f.unchanged(before);
 }
 await f.setGrants(['Kế hoạch sản xuất / In_transit / Sửa']);let before=await records(f.db);assert.equal((await f.mutate('split')).status,403);await f.unchanged(before);
 await f.setGrants([grant('Sửa')]);const response=await f.mutate('split');assert.equal(response.status,200);const plans=(await records(f.db)).filter(r=>r.entity==='production_plan');assert.equal(JSON.parse(plans[0].payload).rows.length,2);
 before=await records(f.db);assert.equal((await f.mutate('split')).status,409);await f.unchanged(before);
});

test('authenticated Admin retains Tách đơn under the existing Admin rule without adding grants',async t=>{
 const f=await fixture(t,{status:'DỰ KIẾN',role:'ADMIN'});await f.setGrants([]);assert.equal((await f.mutate('split')).status,200);
});
