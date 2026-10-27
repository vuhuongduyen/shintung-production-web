import { confirmationStatus, usageStatus } from "../../lib/sku-state.mjs";
import { randomUUID } from "node:crypto";
import { PlanError } from "./production-plan.mjs";
export const SKU_CONFIRM = "Dữ liệu cơ bản / SKU Master / Xác nhận";
export async function skuCapability(db, session) {
  if (!session?.login) return false;
  const adminRole = (role) =>
    ["ADMIN", "SUPER_ADMIN", "SUPER ADMIN"].includes(
      String(role || "")
        .trim()
        .toUpperCase()
        .replaceAll("-", "_"),
    );
  // A session is issued only for an active account. Super Admin is the
  // top-level role and must not depend on an optional personal permission row.
  if (session.role === "site-owner" || adminRole(session.role)) return true;
  const { results } = await db
    .prepare(
      "SELECT entity,payload FROM app_records WHERE entity IN ('users','permissions','department_permissions')",
    )
    .all();
  const rows = results.map((r) => ({
    entity: r.entity,
    p: JSON.parse(r.payload),
  }));
  const users = rows.filter(
    (r) =>
      r.entity === "users" &&
      r.p.login === (session.permissionLogin || session.login),
  );
  if (users.some((r) => r.p._deleted || r.p.active === false)) return false;
  const user = users.find((r) => !r.p._deleted && r.p.active === true)?.p;
  const grants = rows.filter(
    (r) =>
      r.entity === "permissions" &&
      r.p.login === (session.permissionLogin || session.login),
  );
  const personal = grants.find((r) => !r.p._deleted)?.p;
  if (personal?.active === false) return false;
  const departmentGrant = rows.find(
    (r) =>
      r.entity === "department_permissions" &&
      !r.p._deleted &&
      r.p.active === true &&
      r.p.department === user?.department,
  )?.p;
  const permissionSource =
    personal && personal.permissionMode !== "DEPARTMENT"
      ? personal
      : departmentGrant;
  if (permissionSource)
    return String(permissionSource.permissions || "")
      .split(" · ")
      .includes(SKU_CONFIRM);
  return session.role === "local-owner";
}
export async function requestSku(db, body, session) {
  if (!session?.login) throw new PlanError("Đăng nhập TEST để lưu SKU", 401);
  const key = String(body.key || "")
      .trim()
      .toUpperCase(),
    proposed = body.payload;
  if (!key || !proposed || proposed.code !== key || !proposed.name)
    throw new PlanError("SKU không hợp lệ");
  const record = await db
    .prepare(
      "SELECT payload,updated_by,updated_at FROM app_records WHERE entity='sku' AND record_key=?",
    )
    .bind(key)
    .first();
  const old = record ? JSON.parse(record.payload) : null;
  if(old?.cancelled || body.currentData?.cancelled)throw new PlanError("SKU đã Hủy; không được sửa để tự áp dụng lại.",409);
  if (body.operation === "create" && (old || body.currentData))
    throw new PlanError(
      `SKU ${key} đã tồn tại trong SKU Master, không thể thêm mới.`,
      409,
    );
  if (old && (!Number.isInteger(body.expectedRevision) || body.expectedRevision !== Number(old.revision || 0)))
    throw new PlanError("SKU đã được người khác sửa. Giữ nội dung đang nhập và đối chiếu bản mới trước khi lưu lại.", 409);
  const now = new Date().toISOString();
  const current =
    old?.currentData ||
    (confirmationStatus(old) !== "Chờ xác nhận" ? old : null) ||
    body.currentData ||
    null;
  const payload = {
    ...proposed,
    status: "Chờ xác nhận",
    confirmation_status: "Chờ xác nhận",
    usage_status: "Chưa sử dụng",
    confirmation_source: null,
    confirmed_by: null,
    confirmed_at: null,
    requestType: current ? "Thay đổi" : "Thêm mới",
    currentData: current,
    source:
      old?.source ||
      (session.role === "site-owner" || session.userId
        ? "SKU Master Site"
        : "SKU Master local"),
    createdBy: old?.createdBy || record?.updated_by || session.login,
    createdAt: old?.createdAt || record?.updated_at || now,
    confirmedBy: null,
    confirmedAt: null,
    revision: (old?.revision || 0) + 1,
    version: old?.version || 0,
  };
  const saved=JSON.stringify(payload);
  const writeCurrent=record
    ?db.prepare("UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity='sku' AND record_key=? AND payload=?").bind(saved,session.login,now,key,record.payload)
    :db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) VALUES('sku',?,?,?,?) ON CONFLICT(entity,record_key) DO NOTHING").bind(key,saved,session.login,now);
  const history={sku:key,version:payload.version,changedAt:now,changedBy:session.login,action:"request",before:old,data:payload};
  const result=await db.batch([
    writeCurrent,
    db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'sku_history',?,?,?,? WHERE changes()=1")
      .bind(randomUUID(),JSON.stringify(history),session.login,now),
  ]);
  if(result[0].meta.changes!==1)throw new PlanError("SKU vừa được người khác sửa. Tải lại và đối chiếu.",409);
  return { ok: true, payload };
}
export async function confirmSkus(db, body, session) {
  if (!(await skuCapability(db, session)))
    throw new PlanError("Bạn không có quyền xác nhận SKU", 403);
  if (
    !Array.isArray(body.items) ||
    !body.items.length ||
    body.items.length > 3000 ||
    new Set(body.items.map((x) => x.key)).size !== body.items.length
  )
    throw new PlanError("Danh sách SKU không hợp lệ");
  const now = new Date().toISOString(),
    histories = [],
    payloads = [],
    originals = [];
  for (const item of body.items) {
    const record = await db
      .prepare(
        "SELECT payload,updated_at FROM app_records WHERE entity='sku' AND record_key=?",
      )
      .bind(item.key)
      .first();
    const old = record && JSON.parse(record.payload);
    if (
      !old ||
      old._deleted ||
      confirmationStatus(old) !== "Chờ xác nhận" ||
      record.updated_at !== item.updatedAt
    )
      throw new PlanError(
        "SKU đã thay đổi. Tải lại danh sách trước khi xác nhận.",
        409,
      );
    const payload = {
      ...old,
      status: "Đã xác nhận",
      confirmation_status: "Đã xác nhận",
      usage_status: "Đang sử dụng",
      confirmation_source: "USER_CONFIRMATION",
      confirmed_by: session.login,
      confirmed_at: now,
      confirmedBy: session.login,
      confirmedAt: now,
      version: (old.version || 0) + 1,
      revision: (old.revision || 0) + 1,
    };
    originals.push([item.key,record.payload]);
    const history={
      sku:item.key,version:payload.version,action:"confirm",source:"SKU Master / Thanh chức năng",
      statusBefore:confirmationStatus(old),statusAfter:payload.confirmation_status,
      usageBefore:usageStatus(old),usageAfter:payload.usage_status,
      changedAt:now,changedBy:session.login,before:old,data:payload,
    };
    histories.push(history);
    payloads.push(payload);
  }
  const guardKey=randomUUID();
  const predicate=originals.map(()=>'(record_key=? AND payload=?)').join(' OR ');
  const guard=db.prepare(`INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'sku_confirm_guard',?,?,?,? WHERE (SELECT count(*) FROM app_records WHERE entity='sku' AND (${predicate}))=?`)
    .bind(guardKey,'{}',session.login,now,...originals.flat(),originals.length);
  // Bind the same guard key on every conditional update within this D1 batch.
  const guarded=originals.flatMap(([key,raw],index)=>[
    db.prepare("UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity='sku' AND record_key=? AND payload=? AND EXISTS(SELECT 1 FROM app_records WHERE entity='sku_confirm_guard' AND record_key=?)")
      .bind(JSON.stringify(payloads[index]),session.login,now,key,raw,guardKey),
    db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'sku_history',?,?,?,? WHERE changes()=1")
      .bind(randomUUID(),JSON.stringify(histories[index]),session.login,now),
  ]);
  const result=await db.batch([guard,...guarded,db.prepare("DELETE FROM app_records WHERE entity='sku_confirm_guard' AND record_key=?").bind(guardKey)]);
  if(result[0].meta.changes!==1||result.slice(1,-1).some((entry,index)=>index%2===0&&entry.meta.changes!==1))
    throw new PlanError('Danh sách SKU vừa thay đổi. Tải lại và đối chiếu trước khi xác nhận.',409);
  return { ok: true, count: payloads.length, payloads };
}
