import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { root, openDatabase, migrate } from "../scripts/local/database.mjs";
import { getTransit, mutateTransit as saveTransit } from "../scripts/local/in-transit.mjs";
import { mergeProduction, normalizeTransit, transitReportRows, visibleTransitRow } from "../lib/in-transit.mjs";
import { weekNumber } from "../lib/production-plan.mjs";

test("In Transit hide options only filter the selected terminal states", () => {
  const active = { status: "ĐÃ MỞ LSX", progressStatus: "ĐANG SẢN XUẤT" };
  const completed = { status: "ĐÃ MỞ LSX", progressStatus: "HT TRỄ TIẾN ĐỘ" };
  const cancelled = { status: "HỦY", progressStatus: "" };
  assert.deepEqual([active, completed, cancelled].filter(row => visibleTransitRow(row, true, false)), [active, cancelled]);
  assert.deepEqual([active, completed, cancelled].filter(row => visibleTransitRow(row, false, true)), [active, completed]);
  assert.deepEqual([active, completed, cancelled].filter(row => visibleTransitRow(row, true, true)), [active]);
  assert.equal(weekNumber("2026-09-14"), 38);
  assert.equal(weekNumber("2026-09-28"), 40);
  assert.equal(weekNumber("2021-01-01"), 53);
});

const actor = { login: "planner@test" };
const catalog = [
  {
    key: "SKU-1",
    payload: {
      code: "SKU-1",
      name: "Product",
      group: "MASTER",
      specification: "10mm",
      unit: "CÁI",
      line: "A",
      confirmation_status: "Đã xác nhận",
      usage_status: "Đang sử dụng",
    },
  },
];
async function withDb(fn) {
  mkdirSync(resolve(root, ".local-data/tests"), { recursive: true });
  const c = await openDatabase(
    mkdtempSync(resolve(root, ".local-data/tests/transit-")),
  );
  try {
    await migrate(c.db);
    await fn(c.db);
  } finally {
    await c.close();
  }
}
async function mutateTransit(db, body, actor, catalog) {
  const row = body.id && (await getTransit(db, {}, catalog)).rows.find((item) => item.id === body.id);
  return saveTransit(db, { ...body, expectedRevision: row?.revision ?? null }, actor, catalog);
}

test("In Transit calculations follow LSX and completion rules", () => {
  const row = normalizeTransit({
    lsxCode: "LSX-1",
    lsxOpenedAt: "2026-09-05",
    lsxQty: 100,
    completedQty: 40,
    planEnd: "2026-09-10",
    actualCompletedAt: "",
  });
  assert.equal(row.status, "ĐÃ MỞ LSX");
  assert.equal(row.inTransitQty, 60);
  assert.equal(row.progress, 0.4);
  assert.equal(row.progressStatus, "ĐANG SẢN XUẤT");
  assert.equal(
    normalizeTransit({ ...row, cancelReason: "Stop" }).inTransitQty,
    0,
  );
  assert.equal(
    normalizeTransit({ ...row, actualCompletedAt: "2026-09-12", planEnd: "" })
      .progressStatus,
    "HT ĐÚNG TIẾN ĐỘ",
  );
  assert.equal(
    normalizeTransit({ syncStatus: "ĐÃ ĐỒNG BỘ" }).syncStatus,
    "CHƯA ĐỒNG BỘ",
  );
  assert.equal(
    normalizeTransit({
      syncStatus: "CHƯA ĐỒNG BỘ",
      planningUpdateCount: 4,
    }).planningUpdateCount,
    0,
  );
});

test("daily approved production reports aggregate without counting pending rows", () => {
  const row = normalizeTransit({
    id: "order-1",
    planId: "PLAN-1",
    lsxCode: "LSX-1",
    lsxQty: 1000,
  });
  const merged = mergeProduction(row, [
    { id: "BC-1", kind: "completion", lsxCode: "LSX-1", reportedQuantity: 300, approvedQuantity: 300, reviewStatus: "Đã xác nhận", completedAt: "2026-09-19T16:00:00", updatedAt: "2026-09-19T16:10:00" },
    { id: "BC-2", kind: "completion", lsxCode: "LSX-1", reportedQuantity: 400, approvedQuantity: 400, reviewStatus: "Đã xác nhận", completedAt: "2026-09-20T16:00:00", updatedAt: "2026-09-20T16:10:00" },
    { id: "BC-3", kind: "completion", lsxCode: "LSX-1", reportedQuantity: 300, reviewStatus: "Chờ kiểm tra", updatedAt: "2026-09-21T16:10:00" },
  ]);
  assert.equal(merged.completedQty, 700);
  assert.equal(merged.inTransitQty, 300);
  assert.equal(merged.actualCompletedAt, "");
  assert.equal(merged.productionReceiveCount, 2);
});

test("In Transit reports separate late, unfinished and operational exceptions", () => {
  const rows = [
    normalizeTransit({
      id: "late-done",
      week: "2026-09-14",
      lsxCode: "LSX-1",
      lsxQty: 100,
      lsxOpenedAt: "2026-09-14",
      completedQty: 100,
      planEnd: "2026-09-16",
      actualCompletedAt: "2026-09-17",
      syncStatus: "ĐÃ ĐỒNG BỘ",
    }),
    normalizeTransit({
      id: "unfinished",
      week: "2026-09-14",
      lsxCode: "LSX-2",
      lsxQty: 100,
      lsxOpenedAt: "2026-09-14",
      completedQty: 60,
      planEnd: "2026-09-17",
      syncStatus: "ĐÃ ĐỒNG BỘ",
    }),
    normalizeTransit({
      id: "not-opened",
      week: "2026-09-14",
      planEnd: "2026-09-19",
      syncStatus: "CHƯA ĐỒNG BỘ",
    }),
    normalizeTransit({
      id: "other-week",
      week: "2026-09-07",
      lsxCode: "LSX-3",
      lsxQty: 50,
      completedQty: 0,
      planEnd: "2026-09-10",
    }),
  ];
  assert.deepEqual(
    transitReportRows(rows, "completed-late", "2026-09-14").map((x) => x.id),
    ["late-done"],
  );
  assert.deepEqual(
    transitReportRows(rows, "unfinished-week", "2026-09-14").map((x) => x.id),
    ["unfinished"],
  );
  assert.deepEqual(
    transitReportRows(rows, "overdue", "2026-09-14", "2026-09-18").map(
      (x) => x.id,
    ),
    ["unfinished"],
  );
  assert.deepEqual(
    transitReportRows(rows, "not-opened", "2026-09-14").map((x) => x.id),
    ["not-opened"],
  );
  assert.equal(transitReportRows(rows, "sync-issues", "2026-09-14").length, 1);
});

test("additional LSX creates a blank editable row under the same Plan ID", () =>
  withDb(async (db) => {
    const base = {
      id: "plan:1",
      planRowId: "1",
      planId: "P-1",
      week: "2026-09-07",
      sku: "SKU-1",
      planQty: 100,
      planStart: "2026-09-07",
      planEnd: "2026-09-11",
      source: "Kế hoạch tuần",
      syncStatus: "CHƯA ĐỒNG BỘ",
    };
    await db
      .prepare("INSERT INTO app_records VALUES(?,?,?,?,?)")
      .bind("in_transit", "plan:1", JSON.stringify(base), "seed", "2026-09-01")
      .run();
    const saved = await mutateTransit(
      db,
      {
        action: "add-lsx",
        id: "plan:1",
        planStart: "2026-09-08",
        planEnd: "2026-09-12",
        line: "B",
        priority: "GẤP",
        sequence: 3,
      },
      actor,
      catalog,
    );
    assert.equal(saved.row.planId, "P-1");
    assert.equal(saved.row.lsxCode, "");
    assert.equal(saved.row.lsxQty, null);
    assert.equal(saved.row.lsxOpenedAt, "");
    assert.equal(saved.row.isAdditionalLsx, true);
    assert.equal(saved.row.planStart, "2026-09-08");
    assert.equal(saved.row.planEnd, "2026-09-12");
    assert.equal(saved.row.line, "B");
    assert.equal(saved.row.priority, "GẤP");
    assert.equal(saved.row.sequence, 3);
    assert.equal(saved.row.planningUpdateCount, 0);
    const state = await getTransit(db, {}, catalog);
    assert.equal(state.rows.length, 2);
    assert.equal(state.rows[0].id, "plan:1");
    assert.equal(state.rows[1].id, saved.row.id);
    assert.equal(state.rows[1].line, "B");
    assert.equal(state.history.length, 1);
    assert.equal(state.rows[0].group, "MASTER");
    assert.equal(state.rows[0].spec, "10mm");
  }));

test("initial LSX fields save inline with mutation history, then edits require a reason after sync", () =>
  withDb(async (db) => {
    const base = {
      id: "plan:inline",
      planId: "P-INLINE",
      week: "2026-09-07",
      sku: "SKU-1",
      planQty: 100,
      planStart: "2026-09-07",
      planEnd: "2026-09-11",
      syncStatus: "CHƯA ĐỒNG BỘ",
    };
    await db
      .prepare("INSERT INTO app_records VALUES(?,?,?,?,?)")
      .bind("in_transit", base.id, JSON.stringify(base), "seed", "2026-09-01")
      .run();
    await assert.rejects(
      () => mutateTransit(db, { action: "sync", id: base.id }, actor, catalog),
      (error) => error.message === "lsxFieldsRequired",
    );
    for (const changes of [
      { lsxCode: "LSX-INLINE" },
      { lsxQty: 80 },
      { lsxOpenedAt: "2026-09-08" },
    ])
      await mutateTransit(
        db,
        { action: "draft-lsx", id: base.id, changes },
        actor,
        catalog,
      );
    let state = await getTransit(db, {}, catalog);
    assert.equal(state.rows[0].lsxCode, "LSX-INLINE");
    assert.equal(state.rows[0].lsxQty, 80);
    assert.equal(state.rows[0].lsxOpenedAt, "2026-09-08");
    assert.equal(state.history.length, 3);
    await assert.rejects(
      () =>
        mutateTransit(
          db,
          {
            action: "update",
            id: base.id,
            changes: { priority: "GẤP" },
            reason: "x",
          },
          actor,
          catalog,
        ),
      (error) => error.message === "editAfterSyncOnly",
    );
    await mutateTransit(db, { action: "sync", id: base.id }, actor, catalog);
    state = await getTransit(db, {}, catalog);
    assert.equal(state.rows[0].planningUpdateCount, 1);
    await assert.rejects(
      () =>
        mutateTransit(
          db,
          { action: "draft-lsx", id: base.id, changes: { lsxQty: 90 } },
          actor,
          catalog,
        ),
      (error) => error.message === "draftLockedAfterSync",
    );
    await assert.rejects(
      () =>
        mutateTransit(
          db,
          {
            action: "update",
            id: base.id,
            changes: { priority: "GẤP" },
            reason: "",
          },
          actor,
          catalog,
        ),
      (error) => error.message === "editReasonRequired",
    );
    await mutateTransit(
      db,
      {
        action: "update",
        id: base.id,
        changes: { priority: "GẤP" },
        reason: "Điều chỉnh ưu tiên",
      },
      actor,
      catalog,
    );
    state = await getTransit(db, {}, catalog);
    assert.equal(state.rows[0].priority, "GẤP");
    assert.equal(state.rows[0].planningUpdateCount, 1);
    const unchanged = await mutateTransit(
      db,
      {
        action: "update",
        id: base.id,
        changes: { priority: "GẤP" },
        reason: "Không đổi dữ liệu",
      },
      actor,
      catalog,
    );
    assert.equal(unchanged.unchanged, true);
    const resynced = await mutateTransit(
      db,
      { action: "sync", id: base.id },
      actor,
      catalog,
    );
    assert.equal(resynced.row.planningUpdateCount, 2);
    const duplicateSync = await mutateTransit(
      db,
      { action: "sync", id: base.id },
      actor,
      catalog,
    );
    assert.equal(duplicateSync.unchanged, true);
    assert.equal(duplicateSync.row.planningUpdateCount, 2);
    assert.equal(state.history.length, 5);
    assert.equal(state.history[0].action, "update");
    assert.equal(state.history[0].reason, "Điều chỉnh ưu tiên");
  }));

test("cancel keeps the row and changes only its business status", () =>
  withDb(async (db) => {
    const base = {
      id: "plan:cancel",
      planId: "P-CANCEL",
      week: "2026-09-07",
      sku: "SKU-1",
      planQty: 100,
      planStart: "2026-09-07",
      planEnd: "2026-09-11",
      lsxCode: "LSX-CANCEL",
      lsxQty: 100,
      lsxOpenedAt: "2026-09-07",
      syncStatus: "ĐÃ ĐỒNG BỘ",
    };
    await db
      .prepare("INSERT INTO app_records VALUES(?,?,?,?,?)")
      .bind("in_transit", base.id, JSON.stringify(base), "seed", "2026-09-01")
      .run();
    await assert.rejects(
      () =>
        mutateTransit(
          db,
          { action: "cancel", id: base.id, reason: "" },
          actor,
          catalog,
        ),
      (error) => error.message === "cancelReasonRequired",
    );
    const cancelled = await mutateTransit(
      db,
      { action: "cancel", id: base.id, reason: "Dừng kế hoạch" },
      actor,
      catalog,
    );
    assert.equal(cancelled.row.status, "HỦY");
    assert.equal(cancelled.row.cancelReason, "Dừng kế hoạch");
    assert.equal(cancelled.row.syncStatus, "CÓ THAY ĐỔI");
    const state = await getTransit(db, {}, catalog);
    assert.equal(state.rows.length, 1);
    assert.equal(state.rows[0].status, "HỦY");
    assert.equal(state.history[0].action, "cancel");
  }));

test("delete hides the row but retains its data and audit trail", () =>
  withDb(async (db) => {
    const base = {
      id: "plan:delete",
      planId: "P-DELETE",
      week: "2026-09-07",
      sku: "SKU-1",
      planQty: 100,
      planStart: "2026-09-07",
      planEnd: "2026-09-11",
      syncStatus: "CHƯA ĐỒNG BỘ",
    };
    await db
      .prepare("INSERT INTO app_records VALUES(?,?,?,?,?)")
      .bind("in_transit", base.id, JSON.stringify(base), "seed", "2026-09-01")
      .run();
    await assert.rejects(
      () =>
        mutateTransit(
          db,
          { action: "delete", id: base.id, reason: "" },
          actor,
          catalog,
        ),
      (error) => error.message === "deleteReasonRequired",
    );
    const deleted = await mutateTransit(
      db,
      { action: "delete", id: base.id, reason: "Dữ liệu thử nghiệm" },
      actor,
      catalog,
    );
    assert.equal(deleted.row._deleted, true);
    assert.equal(deleted.row.deleteReason, "Dữ liệu thử nghiệm");
    assert.equal(deleted.history.action, "delete");
    assert.equal(deleted.history.actor, actor.login);
    const state = await getTransit(db, {}, catalog);
    assert.equal(state.rows.length, 0);
    assert.equal(state.history[0].action, "delete");
    const stored = await db
      .prepare(
        "SELECT payload FROM app_records WHERE entity=? AND record_key=?",
      )
      .bind("in_transit", base.id)
      .first();
    assert.equal(JSON.parse(stored.payload).planId, base.planId);
  }));

test("two editors cannot overwrite the same In Transit row or add a false audit", () =>
  withDb(async (db) => {
    const base = { id: "plan:race", planId: "P-RACE", week: "2026-09-07", sku: "SKU-1", planQty: 100,
      planStart: "2026-09-07", planEnd: "2026-09-11", syncStatus: "CHƯA ĐỒNG BỘ" };
    await db.prepare("INSERT INTO app_records VALUES(?,?,?,?,?)")
      .bind("in_transit", base.id, JSON.stringify(base), "seed", "2026-09-01").run();
    const revision = (await getTransit(db, {}, catalog)).rows[0].revision;
    const first = { action: "draft-lsx", id: base.id, expectedRevision: revision,
      changes: { lsxCode: "LSX-1" } };
    await saveTransit(db, first, actor, catalog);
    await assert.rejects(() => saveTransit(db, { ...first, changes: { lsxCode: "LSX-2" } }, actor, catalog),
      (error) => error.status === 409);
    const state = await getTransit(db, {}, catalog);
    assert.equal(state.rows[0].lsxCode, "LSX-1");
    assert.equal(state.history.length, 1);
  }));

test("unplanned order captures initial planning fields without an edit", () =>
  withDb(async (db) => {
    await assert.rejects(
      () =>
        mutateTransit(
          db,
          { action: "add-unplanned", sku: "BAD", quantity: 10 },
          actor,
          catalog,
        ),
      (e) => e.message === "invalidSku",
    );
    const result = await mutateTransit(
      db,
      {
        action: "add-unplanned",
        sku: "SKU-1",
        quantity: 10,
        planStart: "2026-09-20",
        planEnd: "2026-09-22",
        line: "B",
        priority: "GẤP",
        sequence: 4,
      },
      actor,
      catalog,
    );
    assert.match(result.row.planId, /^\d{8}-SKU-1-B$/);
    assert.equal(result.row.source, "Phát sinh đột xuất");
    assert.equal(result.row.status, "CHƯA MỞ LSX");
    assert.equal(result.row.planQty, 10);
    assert.equal(result.row.lsxQty, null);
    assert.equal(result.row.line, "B");
    assert.equal(result.row.priority, "GẤP");
    assert.equal(result.row.sequence, 4);
    assert.equal(result.row.spec, "10mm");
    assert.equal(result.row.planStart, "2026-09-20");
    assert.equal(result.row.planEnd, "2026-09-22");
    assert.equal(result.row.planningUpdateCount, 0);
    const duplicate = await mutateTransit(
      db,
      {
        action: "add-unplanned",
        sku: "SKU-1",
        quantity: 5,
        planStart: "2026-09-20",
        planEnd: "2026-09-23",
        line: "B",
        priority: "THƯỜNG",
        sequence: 5,
      },
      actor,
      catalog,
    );
    assert.match(duplicate.row.planId, /^\d{8}-SKU-1-B-02$/);
  }));

test('SX states sync before approval, approval cannot overwrite a newer stop, and corrections replay automatically', () => {
  const row=normalizeTransit({id:'A',planId:'P',lsxCode:'LSX-A',lsxQty:100,lsxOpenedAt:'2026-10-01',planEnd:'2026-10-02'});
  const events=[
    {id:'start',sourceId:'A',kind:'start',effectiveAt:'2026-10-01T01:00:00Z'},
    {id:'stop',sourceId:'A',kind:'incident',stopWork:true,effectiveAt:'2026-10-01T03:00:00Z'},
  ];
  const pending={id:'R',transitId:'A',kind:'completion',reportedQuantity:100,startedAt:events[0].effectiveAt,completedAt:'2026-10-02T03:00:00Z',reviewStatus:'Chờ kiểm tra'};
  let merged=mergeProduction(row,[pending],events);
  assert.equal(merged.progressStatus,'TẠM DỪNG SỰ CỐ');
  assert.equal(merged.actualStartedAt,'2026-10-01');
  assert.equal(merged.completedQty,0);assert.equal(merged.actualCompletedAt,'');
  const approved={...pending,approvedQuantity:40,reviewStatus:'Đã xác nhận',productionState:'Đang sản xuất',updatedAt:'2026-10-03T00:00:00Z'};
  merged=mergeProduction(row,[approved],events);
  assert.equal(merged.progressStatus,'TẠM DỪNG SỰ CỐ');assert.equal(merged.completedQty,40);
  merged=mergeProduction(row,[{...approved,approvedQuantity:100}],events);
  assert.equal(merged.progressStatus,'HT ĐÚNG TIẾN ĐỘ');assert.equal(merged.actualCompletedAt,'2026-10-02');
  merged=mergeProduction(row,[{...approved,approvedQuantity:30}], [...events,{sourceId:'A',kind:'resume',effectiveAt:'2026-10-01T04:00:00Z'}]);
  assert.equal(merged.completedQty,30);assert.equal(merged.actualCompletedAt,'');assert.equal(merged.progressStatus,'ĐANG SẢN XUẤT');
  assert.equal(mergeProduction(row,[],[events[0],{...events[1],kind:'pause'}]).progressStatus,'ĐANG TẠM NGƯNG');
  assert.equal(mergeProduction(row,[],[{sourceId:'B',destinationId:'A',kind:'transfer',effectiveAt:events[0].effectiveAt}]).progressStatus,'ĐANG SẢN XUẤT');
});

test('production links do not mix different LSX sharing a Plan ID',()=>{
 const row=normalizeTransit({id:'A',planId:'P',lsxCode:'LSX-A',lsxQty:100});
 const base={planId:'P',kind:'completion',reportedQuantity:100,reviewStatus:'Đã xác nhận'};
 const merged=mergeProduction(row,[{...base,transitId:'B',lsxCode:'LSX-A'},{...base,lsxCode:'LSX-B'}]);
 assert.equal(merged.completedQty,0);
});

test('admin acknowledges historical sync without altering imported quantity; normal planning remains guarded',()=>withDb(async db=>{
 const row={id:'history-sync',planId:'H-SYNC',sku:'SKU-1',line:'A',week:'2026-10-05',planQty:2000,lsxQty:4000,lsxCode:'510-TEST',lsxOpenedAt:'2026-10-06',historicalImport:true,syncStatus:'CHƯA ĐỒNG BỘ'};
 await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('in_transit',row.id,JSON.stringify(row),'fixture','fixture').run();
 await assert.rejects(()=>mutateTransit(db,{action:'sync',id:row.id},actor,catalog),/lsxExceedsPlan/);
 const result=await mutateTransit(db,{action:'sync',id:row.id},{login:'admin',isAdmin:true},catalog);
 assert.equal(result.row.syncStatus,'ĐÃ ĐỒNG BỘ');assert.equal(result.row.planQty,2000);assert.equal(result.row.lsxQty,4000);
 const normal={...row,id:'normal-sync',planId:'N-SYNC',lsxCode:'510-NORMAL',historicalImport:false};
 await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('in_transit',normal.id,JSON.stringify(normal),'fixture','fixture').run();
 await assert.rejects(()=>mutateTransit(db,{action:'sync',id:normal.id},{login:'admin',isAdmin:true},catalog),/lsxExceedsPlan/);
}));

test('bulk sync keeps valid rows, isolates stale/missing rows and does not duplicate audit on retry',async()=>withDb(async db=>{
 for(const id of ['bulk-a','bulk-b','bulk-stale']){
   const payload=normalizeTransit({id,planId:id,sku:'SKU-1',week:'2026-10-05',line:'A',planQty:100,lsxQty:100,lsxCode:id,lsxOpenedAt:'2026-10-05',planStart:'2026-10-05',planEnd:'2026-10-09',syncStatus:'CHƯA ĐỒNG BỘ'});
   await db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) VALUES('in_transit',?,?,?,?)").bind(id,JSON.stringify(payload),actor.login,new Date().toISOString()).run();
 }
 const before=await getTransit(db,{},catalog);
 const rows=before.rows.map(r=>({id:r.id,expectedRevision:r.id==='bulk-stale'?'outdated':r.revision}));rows.push({id:'missing',expectedRevision:null});
 const result=await saveTransit(db,{action:'sync-many',rows},actor,catalog);
 assert.equal(result.results.filter(r=>r.ok).length,2);assert.equal(result.results.filter(r=>!r.ok).length,2);
 const after=await getTransit(db,{},catalog);assert.equal(after.history.length,2);
 const retry=after.rows.filter(r=>r.syncStatus==='ĐÃ ĐỒNG BỘ').map(r=>({id:r.id,expectedRevision:r.revision}));
 await saveTransit(db,{action:'sync-many',rows:retry},actor,catalog);assert.equal((await getTransit(db,{},catalog)).history.length,2);
 await assert.rejects(()=>saveTransit(db,{action:'sync-many',rows:retry},null,catalog),/loginRequired/);
}));

 test('stage report timestamps update transit start without counting intermediate output', () => {
 const row=normalizeTransit({id:'stage-order',lsxCode:'510-26101405',lsxQty:2000,planEnd:'2026-10-20'});
 const merged=mergeProduction(row,[{id:'cut',transitId:row.id,kind:'completion',stageCode:'CUT',reviewStatus:'Đã xác nhận',reportedQuantity:0,approvedQuantity:0,stageQuantity:2000,startedAt:'2026-10-20T02:03:33Z',completedAt:'2026-10-20T04:00:00Z'}]);
 assert.equal(merged.actualStartedAt,'2026-10-20');
 assert.equal(merged.progressStatus,'ĐANG SẢN XUẤT');
 assert.equal(merged.completedQty,0);
 assert.equal(merged.actualCompletedAt,'');
 });

test('planning note is optional, independent per LSX, persists after synchronization and records audit',async()=>withDb(async db=>{
 const created=await mutateTransit(db,{action:'add-unplanned',sku:'SKU-1',quantity:100,planStart:'2026-10-26',planEnd:'2026-10-30',line:'A',priority:'THƯỜNG',sequence:1,planningNote:'Ưu tiên khách hàng'},actor,catalog);
 assert.equal(created.row.planningNote,'Ưu tiên khách hàng');
 const extra=await mutateTransit(db,{action:'add-lsx',id:created.row.id,planStart:'2026-10-26',planEnd:'2026-10-30',line:'A',priority:'THƯỜNG',sequence:2},actor,catalog);
 assert.equal(extra.row.planningNote,'');
 await mutateTransit(db,{action:'draft-lsx',id:created.row.id,changes:{lsxCode:'NOTE-01',lsxQty:100,lsxOpenedAt:'2026-10-26'}},actor,catalog);
 await mutateTransit(db,{action:'sync',id:created.row.id},actor,catalog);
 const changed=await mutateTransit(db,{action:'update-note',id:created.row.id,planningNote:'Giao trước 15h\nĐóng riêng'},actor,catalog);
 assert.equal(changed.row.syncStatus,'ĐÃ ĐỒNG BỘ');assert.equal(changed.row.lsxQty,100);
 const persisted=(await getTransit(db,{},catalog)).rows.find(r=>r.id===created.row.id);
 assert.equal(persisted.planningNote,'Giao trước 15h\nĐóng riêng');
 assert.ok(changed.history.changes.some(c=>JSON.stringify(c).includes('planningNote')));
 const cleared=await mutateTransit(db,{action:'update-note',id:created.row.id,planningNote:''},actor,catalog);assert.equal(cleared.row.planningNote,'');
 await assert.rejects(()=>mutateTransit(db,{action:'update-note',id:created.row.id,planningNote:'a'.repeat(2001)},actor,catalog));
}));
