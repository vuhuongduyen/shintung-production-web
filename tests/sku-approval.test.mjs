import {engineSourceRevisions} from '../lib/engine-effective-basis.mjs';
import { saveEngine } from "../scripts/local/engine.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  openDatabase,
  migrate,
  records,
  root,
} from "../scripts/local/database.mjs";
import {
  requestSku,
  confirmSkus,
  skuCapability,
  SKU_CONFIRM,
} from "../scripts/local/sku-approval.mjs";
test("SKU confirmation enforces grants/deletion, single+batch, stale selection, audit and persistence", async () => {
  mkdirSync(resolve(root, ".local-data/tests"), { recursive: true });
  const path = mkdtempSync(resolve(root, ".local-data/tests/sku-"));
  let c = await openDatabase(path);
  const actor = { login: "fixture-owner", role: "local-owner" };
  try {
    await migrate(c.db);
    for (const code of ["TEST-A", "TEST-B", "TEST-C"])
      await requestSku(
        c.db,
        { key: code, payload: { code, name: code, line: "" } },
        actor,
      );
    await assert.rejects(
      () =>
        requestSku(
          c.db,
          {
            key: "TEST-A",
            operation: "create",
            payload: { code: "TEST-A", name: "Duplicate", line: "" },
          },
          actor,
        ),
      /đã tồn tại/,
    );
    const selection = async () =>
      (await records(c.db))
        .filter((r) => r.entity === "sku")
        .map((r) => ({ key: r.record_key, updatedAt: r.updated_at }));
    const initial = await selection();
    await assert.rejects(
      () => confirmSkus(c.db, { items: initial }, { login: "reader" }),
      /quyền/,
    );
    await confirmSkus(c.db, { items: [initial[0]] }, actor);
    await assert.rejects(
      () => confirmSkus(c.db, { items: initial }, actor),
      /thay đổi/,
    );
    await confirmSkus(c.db, { items: initial.slice(1) }, actor);
    assert.equal(
      (await records(c.db)).filter((r) => r.entity === "sku_history").length,
      6,
    );
    const confirmed = (await records(c.db))
      .filter((r) => r.entity === "sku")
      .map((r) => JSON.parse(r.payload));
    assert.ok(
      confirmed.every(
        (p) =>
          p.status === "Đã xác nhận" &&
          p.confirmation_status === "Đã xác nhận" &&
          p.usage_status === "Đang sử dụng" &&
          p.confirmedBy === actor.login &&
          p.confirmedAt &&
          p.version === 1,
      ),
    );
    await requestSku(
      c.db,
      { key: "TEST-A", expectedRevision: confirmed[0].revision, payload: { ...confirmed[0], name: "Changed" } },
      actor,
    );
    const pending = JSON.parse(
      (await records(c.db)).find(
        (r) => r.entity === "sku" && r.record_key === "TEST-A",
      ).payload,
    );
    assert.equal(pending.currentData.name, "TEST-A");
    assert.equal(pending.requestType, "Thay đổi");
    assert.equal(pending.confirmation_status, "Chờ xác nhận");
    assert.equal(pending.usage_status, "Chưa sử dụng");
    const historyBeforeConflict=(await c.db.prepare("SELECT count(*) AS n FROM app_records WHERE entity='sku_history'").first()).n;
    await assert.rejects(
      () => requestSku(c.db,{key:'TEST-A',expectedRevision:confirmed[0].revision,payload:{...confirmed[0],name:'Stale edit'}},actor),
      (error) => error.status===409,
    );
    assert.equal((await c.db.prepare("SELECT count(*) AS n FROM app_records WHERE entity='sku_history'").first()).n,historyBeforeConflict);
    const put = async (entity, p) =>
      c.db
        .prepare("INSERT INTO app_records VALUES(?,?,?,?,?)")
        .bind(
          entity,
          "permission-test",
          JSON.stringify(p),
          "fixture",
          new Date().toISOString(),
        )
        .run();
    await put("permissions", {
      login: actor.login,
      active: true,
      permissions: "Xem",
    });
    assert.equal(await skuCapability(c.db, actor), false);
    await c.db
      .prepare("UPDATE app_records SET payload=? WHERE entity='permissions'")
      .bind(
        JSON.stringify({
          login: actor.login,
          active: true,
          permissions: SKU_CONFIRM,
        }),
      )
      .run();
    assert.equal(await skuCapability(c.db, actor), true);
    const departmentUser = {
      login: "department-user",
      department: "KHSX",
      role: "USER",
      active: true,
    };
    await c.db
      .prepare("INSERT INTO app_records VALUES(?,?,?,?,?)")
      .bind(
        "users",
        "department-user",
        JSON.stringify(departmentUser),
        "fixture",
        new Date().toISOString(),
      )
      .run();
    await c.db
      .prepare("INSERT INTO app_records VALUES(?,?,?,?,?)")
      .bind(
        "department_permissions",
        "KHSX",
        JSON.stringify({
          department: "KHSX",
          active: true,
          permissions: SKU_CONFIRM,
        }),
        "fixture",
        new Date().toISOString(),
      )
      .run();
    await c.db
      .prepare("INSERT INTO app_records VALUES(?,?,?,?,?)")
      .bind(
        "permissions",
        "department-user",
        JSON.stringify({
          login: "department-user",
          permissionMode: "DEPARTMENT",
          active: true,
          permissions: "",
        }),
        "fixture",
        new Date().toISOString(),
      )
      .run();
    assert.equal(
      await skuCapability(c.db, { login: "department-user", role: "USER" }),
      true,
      "department permission is inherited",
    );
    await c.db
      .prepare(
        "UPDATE app_records SET payload=? WHERE entity='permissions' AND record_key='department-user'",
      )
      .bind(
        JSON.stringify({
          login: "department-user",
          permissionMode: "CUSTOM",
          active: true,
          permissions: "Dữ liệu cơ bản / SKU Master / Xem",
        }),
      )
      .run();
    assert.equal(
      await skuCapability(c.db, { login: "department-user", role: "USER" }),
      false,
      "custom permission overrides department confirmation",
    );
    await put("users", { login: actor.login, _deleted: true });
    assert.equal(await skuCapability(c.db, actor), false);
    const engine = await saveEngine(
      c.db,
      {
        sourceRevisions:await engineSourceRevisions(c.db),
        payload: {
          week: "2026-09-14",
          rows: [],
          metrics: [],
          generatedBy: "spoofed",
        },
      },
      actor,
    );
    assert.equal(engine.payload.generatedBy, actor.login);
    await assert.rejects(
      () => saveEngine(c.db, { payload: engine.payload }, null),
      /Đăng nhập/,
    );
    await c.close();
    c = await openDatabase(path);
    await migrate(c.db);
    assert.equal(
      (await records(c.db)).filter((r) => r.record_key === engine.key).length,
      2,
    );
    assert.equal(
      (await records(c.db)).filter(
        (r) =>
          r.entity === "sku" && JSON.parse(r.payload).status === "Đã xác nhận",
      ).length,
      2,
    );
  } finally {
    await c.close();
  }
});

test("concurrent SKU confirmations commit one whole batch and one history per SKU", async () => {
  mkdirSync(resolve(root, '.local-data/tests'), {recursive:true});
  const c=await openDatabase(mkdtempSync(resolve(root,'.local-data/tests/sku-race-')));
  const actor={login:'fixture-owner',role:'local-owner'};
  try {
    await migrate(c.db);
    for(const code of ['RACE-A','RACE-B'])await requestSku(c.db,{key:code,payload:{code,name:code}},actor);
    const items=(await records(c.db)).filter(row=>row.entity==='sku').map(row=>({key:row.record_key,updatedAt:row.updated_at}));
    const result=await Promise.allSettled([confirmSkus(c.db,{items},actor),confirmSkus(c.db,{items},actor)]);
    assert.equal(result.filter(entry=>entry.status==='fulfilled').length,1);
    assert.equal(result.filter(entry=>entry.status==='rejected').length,1);
    assert.equal((await records(c.db)).filter(row=>row.entity==='sku_history').length,4);
    assert.equal((await records(c.db)).filter(row=>row.entity==='sku_confirm_guard').length,0);
  } finally {await c.close();}
});

test("Super Admin can confirm SKU without a personal permission row", async () => {
  mkdirSync(resolve(root, ".local-data/tests"), { recursive: true });
  const path = mkdtempSync(resolve(root, ".local-data/tests/sku-admin-"));
  const c = await openDatabase(path);
  try {
    await migrate(c.db);
    const setupAdmin = { login: "SETUP_ADMIN", role: "SUPER_ADMIN", isSetupAdmin: true };
    assert.equal(await skuCapability(c.db, setupAdmin), true);
    await requestSku(c.db, { key: "ADMIN-SKU", payload: { code: "ADMIN-SKU", name: "Admin SKU", line: "A" } }, { login: "requester", role: "local-owner" });
    const pending = (await records(c.db)).find((row) => row.entity === "sku" && row.record_key === "ADMIN-SKU");
    const result = await confirmSkus(c.db, { items: [{ key: "ADMIN-SKU", updatedAt: pending.updated_at }] }, setupAdmin);
    assert.equal(result.count, 1);
    assert.equal(result.payloads[0].confirmedBy, "SETUP_ADMIN");
  } finally {
    c.close();
  }
});
