import test, {mock} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {root, openDatabase, migrate, records} from '../scripts/local/database.mjs';
import {passwordRecord} from '../worker/password-auth.mjs';
import {siteApi} from '../worker/site-api.mjs';
import {fakePassword} from './fixtures/review-fixtures.mjs';

const workflow = '/api/production-workflow';
const review = '/api/production-report';
const week = '2026-09-21', firstDay = '2026-09-24', lastDay = '2026-09-25';
const at = (time, date = firstDay) => new Date(`${date}T${time}:00+07:00`).toISOString();
const qlsx = 'approval-qlsx-a@example.test';
const otherLine = 'approval-qlsx-b@example.test';
const operator = 'approval-operator@example.test';
const hr = 'approval-hr@example.test';
const viewGrant = 'Quản lý sản xuất / Xem';
const approveGrant = 'Quản lý sản xuất / Xác nhận';
const hrGrant = 'Quản lý sản xuất / Lịch SX thực tế / Ghi vắng mặt';

async function put(db, entity, key, payload) {
  await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)')
    .bind(entity, key, JSON.stringify(payload), 'synthetic-fixture', '2026-09-20').run();
}

async function withApi(run) {
  // Pin the fixture clock within its attendance period; never weaken runtime cutoffs.
  mock.timers.enable({apis:['Date'], now:new Date('2026-09-26T00:00:00Z')});
  mkdirSync(resolve(root, '.local-data/tests'), {recursive: true});
  const connection = await openDatabase(mkdtempSync(resolve(root, '.local-data/tests/approval-integration-')));
  try {
    await migrate(connection.db);
    const cookies = new Map();
    const call = async (path, body, login = qlsx) => {
      const response = await siteApi(new Request(`https://test.invalid${path}`, {
        method: body ? 'POST' : 'GET',
        headers: {
          ...(cookies.has(login) ? {Cookie: cookies.get(login)} : {}),
          ...(body ? {origin: 'https://test.invalid', 'content-type': 'application/json'} : {}),
        },
        ...(body ? {body: JSON.stringify(body)} : {}),
      }), {DB: connection.db, FILES: connection.bucket});
      return {status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')};
    };
    // These are isolated, synthetic password accounts with ordinary USER roles.
    // QLSX success must exercise grants and Line checks, not an Admin bypass.
    for (const [login, line, grants] of [
      [qlsx, 'A', [viewGrant, approveGrant, 'Quản lý sản xuất / Báo công sản xuất / Thêm']],
      [otherLine, 'B', [viewGrant, approveGrant]],
      [operator, 'A', [viewGrant, 'Quản lý sản xuất / Thêm']],
      [hr, 'A', [viewGrant, hrGrant]],
    ]) {
      const password = await passwordRecord(fakePassword);
      await put(connection.db, 'users', login, {login, email: login, role: 'USER', line, active: true});
      await put(connection.db, 'permissions', login, {login, active: true, permissions: grants.join(' · ')});
      await connection.db.prepare('INSERT INTO auth_accounts VALUES(?,?,?,?,1,?)')
        .bind(login, password.hash, password.salt, password.iterations, 'synthetic-fixture').run();
      const authenticated = await call('/api/auth/login', {login, password: fakePassword}, login);
      assert.equal(authenticated.status, 200, JSON.stringify(authenticated.body));
      cookies.set(login, authenticated.cookie.split(';')[0]);
    }
    await run({db: connection.db, call});
  } finally {
    await connection.close();
    mock.timers.reset();
  }
}

const makeOrder = (id, planEnd = lastDay, line = 'A') => ({
  id, planId: `PLAN-${id}`, week, sku: `SYNTHETIC-SKU-${id}`, line,
  lsxCode: `SYNTHETIC-LSX-${id}`, lsxQty: 200, lsxOpenedAt: week,
  planStart: firstDay, planEnd, syncStatus: 'ĐÃ ĐỒNG BỘ',
});

async function fixture(db, order) {
  const days = Array.from({length: 7}, (_, index) => {
    const date = new Date(`${week}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + index);
    return {date: date.toISOString().slice(0, 10), working: index < 6,
      hcStart: '08:00', hcEnd: '17:00', lunchStart: '12:00', lunchEnd: '13:00',
      breaks: [{start: '10:00', end: '10:10'}, {start: '15:00', end: '15:10'}], cleaning: [], ot: false, otStart: '17:30', otEnd: '21:00'};
  });
  await put(db, 'capacity', week, {schemaVersion: 1, week, rows: [{
    line: 'A', status: 'Đã xác nhận', reviewStatus: 'approved', version: 1,
    input: {workers: 1, dailySchedule: days,
      dailyRoster: days.map(day => ({date: day.date, hc: day.working ? ['APPROVAL-NV-A'] : [], ot: []})),
      dailyHcLeave: [], dailyOtLeave: []},
  }]});
  await put(db, 'employees', 'APPROVAL-NV-A', {id: 'APPROVAL-NV-A', name: 'Synthetic approval worker', line: 'A', active: true});
  await put(db, 'in_transit', order.id, order);
}

async function dataSnapshot(db) {
  // Cover every business/auth table and cursor. The website security audit intentionally records denied attempts.
  // These comparisons test stored data, not database file bytes or R2 contents.
  const tables = (await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name").all()).results;
  const contents = await db.batch(tables.map(({name}) => db.prepare(`SELECT * FROM "${name.replaceAll('"', '""')}"`)));
  return tables.map(({name}, index) => ({name, rows: contents[index].results.filter(row => !(name==='app_records' && row.entity==='website_action_audit')).map(row => JSON.stringify(row)).sort()}));
}

async function reviewWithoutWrites(db, call, body, login, status, error) {
  const before = await dataSnapshot(db);
  const response = await call(review, body, login);
  assert.equal(response.status, status, JSON.stringify(response.body));
  assert.match(response.body.error, error);
  assert.deepEqual(await dataSnapshot(db), before, `failed review (${status}) must not mutate stored data`);
}

async function success(call, path, body, login = qlsx) {
  const response = await call(path, body, login);
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return response.body;
}

async function payloads(db, entity) {
  return (await db.prepare('SELECT payload FROM app_records WHERE entity=? ORDER BY record_key').bind(entity).all())
    .results.map(row => JSON.parse(row.payload));
}

async function assertApprovalEffects(db, call, orderId, approvedQuantity, pendingQuantity, proposalCount) {
  const state = await success(call, workflow);
  const order = state.orders.find(item => item.id === orderId);
  const reports = state.reports.filter(item => item.transitId === orderId && item.kind === 'completion');
  const approved = reports.filter(item => item.reviewStatus === 'Đã xác nhận');
  const pending = reports.filter(item => item.reviewStatus === 'Chờ kiểm tra');
  assert.equal(order.completedQty, approvedQuantity);
  assert.equal(order.inTransitQty, 200 - approvedQuantity);
  assert.equal(approved.reduce((sum, report) => sum + report.approvedQuantity, 0), approvedQuantity);
  assert.equal(pending.reduce((sum, report) => sum + report.reportedQuantity, 0), pendingQuantity);
  const proposals = await payloads(db, 'warehouse_in');
  assert.equal(proposals.length, proposalCount);
  assert.equal(proposals.reduce((sum, proposal) => sum + proposal.proposedQuantity, 0), approvedQuantity);
  assert.deepEqual(proposals.map(proposal => proposal.reportId).sort(), approved.map(report => report.id).sort());
  for (const proposal of proposals) {
    const report = approved.find(item => item.id === proposal.reportId);
    assert.equal(proposal.id, `SX:${report.id}`);
    assert.equal(proposal.proposedQuantity, report.approvedQuantity);
    assert.equal(proposal.status, 'Chờ xác nhận');
    assert.equal(proposal.receivedQuantity, null);
    assert.equal(proposal.createdBy, qlsx);
    assert.equal(report.warehouseStatus, 'Chờ Kho xác nhận');
    assert.equal(report.reviewedBy, qlsx);
    assert.equal(report.reviewedById, qlsx);
  }
  const approvals = (await payloads(db, 'production_event')).filter(event => event.kind === 'report-approval');
  assert.equal(approvals.length, proposalCount, 'one approval event per accepted report');
  assert.deepEqual(approvals.map(event => event.reportId).sort(), approved.map(report => report.id).sort());
  return {state, order, reports};
}

test('normal Worker approval rejects unresolved attendance and unauthorized reviewers without writes, then validates late completion', () => withApi(async ({db, call}) => {
  const order = makeOrder('APPROVAL-A', firstDay);
  await fixture(db, order);
  const session = await success(call, '/api/site-session');
  assert.equal(session.user.isAdmin, false);
  assert.equal(session.user.line, 'A');
  assert.ok(session.user.grants.includes(approveGrant));
  await success(call, workflow, {action: 'start', orderId: order.id, employees: ['APPROVAL-NV-A'], count: 1, effectiveAt: at('08:00')});
  const arrival = await success(call, workflow, {action: 'line-absence', line: 'A', absenceType: 'Đi trễ',
    employees: ['APPROVAL-NV-A'], effectiveAt: at('08:00'), openArrival: true}, hr);
  assert.equal(arrival.event.approved, true);
  const first = await success(call, workflow, {action: 'complete', orderId: order.id, quantity: 100,
    effectiveAt: at('11:00'), productionDate: firstDay});
  const pending = await assertApprovalEffects(db, call, order.id, 0, 100, 0);
  assert.deepEqual(pending.reports[0].unresolvedAttendance.flatMap(item => item.employees), ['APPROVAL-NV-A']);
  const approve = {action: 'review', reportId: first.report.id, approve: true};
  await reviewWithoutWrites(db, call, approve, operator, 403, /Chỉ QLSX/);
  await reviewWithoutWrites(db, call, approve, otherLine, 403, /Line khác/);
  await reviewWithoutWrites(db, call, approve, qlsx, 409, /chưa có giờ vào thực tế.*APPROVAL-NV-A/);

  const corrected = await success(call, workflow, {action: 'attendance-correction', attendanceId: arrival.event.id, endsAt: at('09:00')}, hr);
  assert.equal(corrected.event.approved, true, 'ordinary HR arrival correction applies immediately');
  assert.equal(corrected.pendingHours, false);
  assert.equal(corrected.event.actor, hr);
  const afterCorrection = (await success(call, workflow)).reports.find(report => report.id === first.report.id);
  assert.deepEqual(afterCorrection.unresolvedAttendance, []);
  assert.deepEqual(afterCorrection.pendingAttendance, []);
  assert.equal(afterCorrection.hours.hc, 1.8333, '09:00–11:00 less the 10-minute morning break');
  assert.equal(afterCorrection.hours.ot, 0);
  assert.equal(afterCorrection.reportedQuantity, 100);
  const accepted = await success(call, review, approve);
  assert.equal(accepted.payload.approvedQuantity, 100);
  assert.equal(accepted.payload.hours.hc, 1.8333);
  assert.equal(accepted.payload.confirmationBasis.by, qlsx);
  await assertApprovalEffects(db, call, order.id, 100, 0, 1);
  await reviewWithoutWrites(db, call, approve, qlsx, 409, /đã được xử lý/);

  const last = await success(call, workflow, {action: 'complete', orderId: order.id, quantity: 100,
    effectiveAt: at('11:00', lastDay), productionDate: lastDay});
  await assertApprovalEffects(db, call, order.id, 100, 100, 1);
  const finish = {action: 'review', reportId: last.report.id, approve: true};
  await reviewWithoutWrites(db, call, finish, qlsx, 422, /Lý do trễ/);
  const delayReason = 'Synthetic late completion verification';
  const completed = await success(call, review, {...finish, delayReason});
  assert.equal(completed.payload.delayReason, delayReason);
  assert.equal(completed.payload.actualCompletedAt, at('11:00', lastDay));
  const final = await assertApprovalEffects(db, call, order.id, 200, 0, 2);
  assert.equal(final.order.actualCompletedAt, lastDay);
  assert.equal(final.order.delayReason, delayReason);
  assert.equal(final.order.productionState, 'Hoàn thành sản xuất');
  await reviewWithoutWrites(db, call, {...finish, delayReason}, qlsx, 409, /đã được xử lý/);
}));

test('normal Worker approval latest-first preserves multi-day quantities, final completion day and unrelated records', () => withApi(async ({db, call}) => {
  const order = makeOrder('APPROVAL-MULTI');
  await fixture(db, order);
  await put(db, 'in_transit', 'UNRELATED-ORDER', makeOrder('UNRELATED-ORDER', lastDay, 'B'));
  await put(db, 'employees', 'UNRELATED-NV-B', {id: 'UNRELATED-NV-B', name: 'Synthetic unrelated worker', line: 'B', active: true});
  await put(db, 'inventory', 'UNRELATED-STOCK', {sku: 'SYNTHETIC-UNRELATED', quantity: 47, note: 'Unrelated sentinel'});
  const sentinels = async () => (await records(db)).filter(row => row.record_key.startsWith('UNRELATED-'));
  const unrelatedBefore = await sentinels();
  assert.equal(unrelatedBefore.length, 3);
  await success(call, workflow, {action: 'start', orderId: order.id, employees: ['APPROVAL-NV-A'], count: 1, effectiveAt: at('08:00')});
  const first = await success(call, workflow, {action: 'complete', orderId: order.id, quantity: 80,
    effectiveAt: at('11:00'), productionDate: firstDay});
  const last = await success(call, workflow, {action: 'complete', orderId: order.id, quantity: 120,
    effectiveAt: at('11:00', lastDay), productionDate: lastDay});
  const outputPairs = reports => reports.filter(report => report.kind === 'completion' && report.transitId === order.id)
    .map(report => [report.id, report.productionDate, report.reportedQuantity]).sort((a, b) => a[1].localeCompare(b[1]));
  const originalPairs = [[first.report.id, firstDay, 80], [last.report.id, lastDay, 120]];
  const initial = await assertApprovalEffects(db, call, order.id, 0, 200, 0);
  assert.deepEqual(outputPairs(initial.reports), originalPairs);
  assert.equal(initial.order.actualCompletedAt, '');

  await success(call, review, {action: 'review', reportId: last.report.id, approve: true});
  const partial = await assertApprovalEffects(db, call, order.id, 120, 80, 1);
  assert.equal(partial.order.actualCompletedAt, '', 'latest report alone is not full order approval');
  assert.deepEqual(outputPairs(partial.reports), originalPairs);
  assert.deepEqual(await sentinels(), unrelatedBefore);

  const earliestReview = await success(call, review, {action: 'review', reportId: first.report.id, approve: true});
  assert.equal(earliestReview.payload.completedQty, 200);
  assert.equal(earliestReview.payload.actualCompletedAt, at('11:00', lastDay));
  const final = await assertApprovalEffects(db, call, order.id, 200, 0, 2);
  assert.equal(final.order.actualCompletedAt, lastDay, 'final day follows completion timestamps, not review order');
  assert.equal(final.order.productionState, 'Hoàn thành sản xuất');
  assert.deepEqual(outputPairs(final.reports), originalPairs);
  assert.deepEqual(outputPairs(await payloads(db, 'production_report')), originalPairs, 'stored production dates and quantities stay unchanged');
  assert.deepEqual(await sentinels(), unrelatedBefore, 'unrelated payloads and update metadata are unchanged');
}));
