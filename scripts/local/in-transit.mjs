import {transitStandardLeadtime} from '../../lib/transit-leadtime.mjs';
import { randomUUID } from "node:crypto";
import {
  dateISO,
  monday,
  normalized,
  numberOrNull,
  planId as weeklyPlanId,
  lineOf,
  text,
} from "../../lib/production-plan.mjs";
import { mergeProduction, normalizeTransit } from "../../lib/in-transit.mjs";
import { usableSku } from "../../lib/sku-state.mjs";
import { PlanError } from "./production-plan.mjs";
import {recordRevision,conflictMessage} from '../../lib/record-revision.mjs';

const fail = (message, status = 400, details = []) => {
  throw new PlanError(message, status, details);
};
const parse = (r) => {
  try {
    return { ...r, rawPayload:r.payload, payload: JSON.parse(r.payload) };
  } catch {
    return { ...r, payload: null };
  }
};
const read = async (db, entity) =>
  (
    await db
      .prepare(
        "SELECT record_key,payload,updated_by,updated_at FROM app_records WHERE entity=? ORDER BY updated_at DESC,record_key",
      )
      .bind(entity)
      .all()
  ).results.map(parse);
const write = (db, entity, key, payload, actor, now) =>
  db
    .prepare(
      "INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(entity,record_key) DO UPDATE SET payload=excluded.payload,updated_by=excluded.updated_by,updated_at=excluded.updated_at",
    )
    .bind(entity, key, JSON.stringify(payload), actor, now);
const audit = (db, payload, actor, now) =>
  write(db, "in_transit_audit", payload.id, payload, actor, now);

const skuMasterValues = (master = {}) => ({
  group: text(master.group || master.productGroup || master.category),
  name: text(master.name || master.productName),
  spec: text(
    master.specification || master.spec || master.quyCach || master.quy_cach,
  ),
  unit: text(master.unit || master.uom || master.unitOfMeasure),
  line: text(master.line || master.productionLine),
});

function vietnamDateISO(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type) => parts.find((x) => x.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export async function getTransit(db, filters = {}, catalog = [], options = {}) {
  const [records, audits, reports, leadtimes, events, historyImports, leadVersions] = await Promise.all(
    ["in_transit", "in_transit_audit", "production_report", "leadtime", "production_event", "production_history_import", "leadtime_versions"].map(
      (e) => options.planningOnly && ['in_transit_audit','leadtime','leadtime_versions'].includes(e) ? Promise.resolve([]) : read(db, e),
    ),
  );
  const masters = new Map(
    catalog.map((r) => {
      const p = r?.payload && typeof r.payload === "object" ? r.payload : r;
      return [text(p?.code || r?.key).toUpperCase(), p];
    }),
  );
  const reportRows = reports.flatMap((r) =>
    Array.isArray(r.payload?.rows)
      ? r.payload.rows.map((x) => ({
          ...x,
          updatedAt: x.updatedAt || r.updated_at,
        }))
      : r.payload
        ? [{ ...r.payload, id: r.payload.id || r.record_key, updatedAt: r.payload.updatedAt || r.updated_at }]
        : [],
  );
  const productionEvents = events.map(e => e.payload).filter(Boolean);
  // Reviewed records replace their historical source; never double count or recalculate hours.
  const storedReportIds = new Set(reportRows.map(report => report.id));
  reportRows.push(...historyImports.filter(record => !record.payload?._deleted)
    .flatMap(record => record.payload?.reports || []).filter(report => !storedReportIds.has(report.id))
    // Pending history contributes a status only. Keep its timestamps/hours in the workflow source.
    .filter(report => ['Chờ kiểm tra','Lịch sử chờ đối chiếu'].includes(report.reviewStatus))
    .map(({id,transitId,kind,reviewStatus,reportedQuantity,voided,cancelled}) => ({id,transitId,kind,reviewStatus,reportedQuantity,voided,cancelled})));
  const rows = await Promise.all(records
    .filter((r) => r.payload && !r.payload._deleted)
    .map(async (r) => {
      const master = masters.get(text(r.payload.sku).toUpperCase());
      const masterValues = skuMasterValues(master);
      const merged = mergeProduction(
        normalizeTransit({ ...r.payload, id: r.payload.id || r.record_key }),
        reportRows,
        productionEvents,
      );
      return {...normalizeTransit({
        ...merged,
        group: masterValues.group || merged.group,
        name: masterValues.name || merged.name,
        spec: masterValues.spec || merged.spec,
        unit: masterValues.unit || merged.unit,
        line: merged.line || masterValues.line,
      }), revision:options.planningOnly ? undefined : await recordRevision(r.rawPayload),updatedBy:r.updated_by};
    }));
  const withLeadtime = rows
    .map((row) => {
      const standardLeadtime = options.planningOnly ? null : transitStandardLeadtime(row,
        leadtimes.flatMap(r=>Array.isArray(r.payload?.rows)?r.payload.rows:[{...r.payload,sku:r.payload?.sku||r.record_key}]),
        leadVersions.map(r=>r.payload).filter(Boolean));
      return {
        ...row,
        standardLeadtime,
        leadtimeVariance:
          row.actualLeadtime !== null && standardLeadtime !== null
            ? row.actualLeadtime - standardLeadtime
            : null,
      };
    })
    .sort(
      (a, b) => {
        if (a.planId === b.planId)
          return (
            Number(a.isAdditionalLsx) - Number(b.isAdditionalLsx) ||
            a.createdAt.localeCompare(b.createdAt)
          );
        return (
          a.week.localeCompare(b.week) ||
          a.line.localeCompare(b.line) ||
          (a.sequence ?? 999999) - (b.sequence ?? 999999) ||
          a.planId.localeCompare(b.planId, "vi", { numeric: true })
        );
      },
    );
  const history = audits
    .filter((r) => r.payload && !r.payload._deleted)
    .map((r) => r.payload)
    .sort((a, b) => text(b.at).localeCompare(text(a.at)));
  return { rows: withLeadtime, history };
}

function validateOpenFields(row, includeQuantity = false) {
  const any =
    text(row.lsxCode) ||
    dateISO(row.lsxOpenedAt) ||
    (includeQuantity && numberOrNull(row.lsxQty) > 0);
  if (
    any &&
    (!text(row.lsxCode) ||
      !dateISO(row.lsxOpenedAt) ||
      !(numberOrNull(row.lsxQty) > 0))
  )
    fail("lsxFieldsRequired", 422);
}
async function uniqueLsx(db, code, ignore = "") {
  if (!text(code)) return;
  const found = await db
    .prepare(
      "SELECT record_key FROM app_records WHERE entity='in_transit' AND record_key<>? AND upper(json_extract(payload,'$.lsxCode'))=upper(?) AND coalesce(json_extract(payload,'$._deleted'),0)<>1 LIMIT 1",
    )
    .bind(ignore, text(code))
    .first();
  if (found) fail("duplicateLsx", 409);
}
function validatePlanQuantity(row, all) {
  const total =
    all
      .filter(
        (item) =>
          item.planId === row.planId &&
          item.id !== row.id &&
          item.status !== "HỦY",
      )
      .reduce((sum, item) => sum + (item.lsxQty || 0), 0) +
    (row.status === "HỦY" ? 0 : row.lsxQty || 0);
  if (total > (row.planQty || 0))
    fail("lsxExceedsPlan", 422, [
      { planId: row.planId, lsxQty: total, remaining: row.planQty },
    ]);
}

export async function mutateTransit(db, body, actor, catalog = [], sharedState = null) {
  if (!actor?.login) fail("loginRequired", 401);
  if(body.action === 'sync-many') {
    if(!Array.isArray(body.rows)||!body.rows.length||body.rows.length>100||new Set(body.rows.map(r=>r.id)).size!==body.rows.length)fail('invalidSelection',422);
    const state=await getTransit(db,{},catalog),results=[];
    for(const selected of body.rows){
      try {const result=await mutateTransit(db,{action:'sync',id:selected.id,expectedRevision:selected.expectedRevision},actor,catalog,state);results.push({id:selected.id,ok:true,unchanged:!!result.unchanged});}
      catch(error){results.push({id:selected.id,ok:false,error:error.message||'Không đồng bộ được'});}
    }
    return {ok:true,results};
  }
  const action = text(body.action),
    now = new Date().toISOString();
  if (
    ![
      "add-lsx",
      "add-unplanned",
      "draft-lsx",
      "update-note",
      "update",
      "cancel",
      "delete",
      "sync",
    ].includes(action)
  )
    fail("invalidAction");
  const state = sharedState || await getTransit(db, {}, catalog),
    all = state.rows;
  let current = null,
    key = text(body.id),
    next;
  if (action === "add-lsx") {
    const source = all.find((r) => r.id === body.id);
    if (!source || source.status === "HỦY") fail("invalidSelection", 422);
    const planStart = dateISO(body.planStart),
      planEnd = dateISO(body.planEnd),
      line = lineOf(body.line),
      priority = text(body.priority),
      sequence = numberOrNull(body.sequence);
    if (!planStart || !planEnd || !line || !priority || !(sequence > 0))
      fail("initialFieldsRequired", 422);
    if (planEnd < planStart) fail("dateOrder", 422);
    key = `lsx:${source.planId}:${randomUUID()}`;
    next = normalizeTransit({
      ...source,
      id: key,
      isAdditionalLsx: true,
      planRowId: source.planRowId,
      planStart,
      planEnd,
      line,
      priority,
      sequence,
      planningNote: text(body.planningNote),
      lsxCode: "",
      lsxQty: null,
      lsxOpenedAt: "",
      cancelReason: "",
      completedQty: 0,
      actualStartedAt: "",
      actualCompletedAt: "",
      syncStatus: "CHƯA ĐỒNG BỘ",
      planningUpdateCount: 0,
      productionReceiveCount: 0,
      createdAt: now,
      createdBy: actor.login,
      updatedAt: now,
      updatedBy: actor.login,
    });
  } else if (action === "add-unplanned") {
    const sku = text(body.sku).toUpperCase(),
      master = catalog.find(
        (r) => text((r.payload || r).code || r.key).toUpperCase() === sku,
      ),
      mp = master?.payload || master,
      masterValues = skuMasterValues(mp);
    if (!usableSku(mp)) fail("invalidSku", 422);
    const planQty = numberOrNull(body.quantity ?? body.planQty);
    if (!(planQty > 0)) fail("invalidPlanQty", 422);
    const planStart = dateISO(body.planStart),
      planEnd = dateISO(body.planEnd),
      line = lineOf(body.line),
      priority = text(body.priority),
      sequence = numberOrNull(body.sequence);
    if (!planStart || !planEnd || !line || !priority || !(sequence > 0))
      fail("initialFieldsRequired", 422);
    if (planEnd < planStart) fail("dateOrder", 422);
    const occurrenceDate = vietnamDateISO(),
      basePlanId = weeklyPlanId(occurrenceDate, sku, line),
      usedPlanIds = new Set(all.map((r) => r.planId));
    let planId = basePlanId,
      duplicate = 2;
    while (usedPlanIds.has(planId))
      planId = `${basePlanId}-${String(duplicate++).padStart(2, "0")}`;
    key = `unplanned:${planId}`;
    next = normalizeTransit({
      id: key,
      planId,
      week: monday(planStart),
      group: masterValues.group,
      sku,
      name: masterValues.name,
      spec: masterValues.spec,
      unit: masterValues.unit,
      line,
      source: "Phát sinh đột xuất",
      priority,
      sequence,
      planQty,
      planStart,
      planEnd,
      lsxQty: null,
      planningNote: text(body.planningNote),
      lsxCode: "",
      lsxOpenedAt: "",
      syncStatus: "CHƯA ĐỒNG BỘ",
      planningUpdateCount: 0,
      productionReceiveCount: 0,
      createdAt: now,
      createdBy: actor.login,
      updatedAt: now,
      updatedBy: actor.login,
    });
  } else {
    current = all.find((r) => r.id === body.id);
    if (!current) fail("missingRow", 404);
    if(body.expectedRevision!==current.revision)fail(conflictMessage,409,[{id:current.id,sku:current.sku,updatedBy:current.updatedBy,updatedAt:current.updatedAt}]);
    if (action === "update-note") {
      const planningNote=text(body.planningNote);
      if(planningNote.length>2000) fail("Ghi chú tối đa 2000 ký tự",422);
      if(planningNote===text(current.planningNote))return {ok:true,row:current,unchanged:true};
      next=normalizeTransit({...current,planningNote,updatedAt:now,updatedBy:actor.login});
    } else if (action === "draft-lsx") {
      if (current.syncStatus !== "CHƯA ĐỒNG BỘ")
        fail("draftLockedAfterSync", 422);
      const allowed = ["lsxCode", "lsxQty", "lsxOpenedAt"];
      const changeKeys = Object.keys(body.changes || {});
      if (
        !changeKeys.length ||
        changeKeys.some((field) => !allowed.includes(field))
      )
        fail("invalidEdit", 422);
      if (
        Object.hasOwn(body.changes, "lsxQty") &&
        body.changes.lsxQty !== "" &&
        !(numberOrNull(body.changes.lsxQty) > 0)
      )
        fail("invalidLsxQty", 422);
      next = normalizeTransit({
        ...current,
        ...body.changes,
        updatedAt: now,
        updatedBy: actor.login,
      });
      if (allowed.every(field => next[field] === current[field]))
        return { ok: true, row: current, unchanged: true };
      await uniqueLsx(db, next.lsxCode, current.id);
      validatePlanQuantity(next, all);
    } else if (action === "delete") {
      if (!text(body.reason)) fail("deleteReasonRequired", 422);
      next = normalizeTransit({
        ...current,
        _deleted: true,
        deletedAt: now,
        deletedBy: actor.login,
        deleteReason: text(body.reason),
        updatedAt: now,
        updatedBy: actor.login,
      });
    } else if (action === "cancel") {
      if (current.status === "HỦY") fail("alreadyCancelled", 422);
      if (!text(body.reason)) fail("cancelReasonRequired", 422);
      next = normalizeTransit({
        ...current,
        cancelReason: text(body.reason),
        planningUpdatedAt: now,
        planningUpdatedBy: actor.login,
        updatedAt: now,
        updatedBy: actor.login,
        syncStatus:
          current.syncStatus === "ĐÃ ĐỒNG BỘ"
            ? "CÓ THAY ĐỔI"
            : current.syncStatus,
      });
    } else if (action === "sync") {
      if (
        !text(current.lsxCode) ||
        !(numberOrNull(current.lsxQty) > 0) ||
        !dateISO(current.lsxOpenedAt)
      )
        fail("lsxFieldsRequired", 422);
      // Admin may acknowledge an imported historical LSX without rewriting its original quantities.
      if (!(current.historicalImport === true && actor.isAdmin && !actor.line))
        validatePlanQuantity(current, all);
      if (current.syncStatus === "ĐÃ ĐỒNG BỘ" && !current.syncError)
        return { ok: true, row: current, unchanged: true };
      next = normalizeTransit({
        ...current,
        syncStatus: "ĐÃ ĐỒNG BỘ",
        syncError: "",
        planningUpdateCount: current.planningUpdateCount + 1,
        planningUpdatedAt: now,
        planningUpdatedBy: actor.login,
        updatedAt: now,
        updatedBy: actor.login,
      });
    } else {
      if (current.syncStatus === "CHƯA ĐỒNG BỘ") fail("editAfterSyncOnly", 422);
      if (!text(body.reason)) fail("editReasonRequired", 422);
      const allowed = [
        "planningNote",
        "line",
        "planStart",
        "planEnd",
        "priority",
        "sequence",
        "lsxCode",
        "lsxQty",
        "lsxOpenedAt",
      ];
      if (Object.keys(body.changes || {}).some((k) => !allowed.includes(k)))
        fail("invalidEdit", 422);
      const changedFields = Object.fromEntries(
        Object.entries(body.changes || {}).filter(([field, value]) => {
          const numeric = field === "lsxQty" || field === "sequence";
          const incoming = numeric ? numberOrNull(value) : text(value);
          const existing = numeric
            ? numberOrNull(current[field])
            : text(current[field]);
          return incoming !== existing;
        }),
      );
      if (!Object.keys(changedFields).length)
        return { ok: true, row: current, unchanged: true };
      next = normalizeTransit({
        ...current,
        ...changedFields,
        planningUpdatedAt: now,
        planningUpdatedBy: actor.login,
        updatedAt: now,
        updatedBy: actor.login,
        syncStatus:
          current.syncStatus === "ĐÃ ĐỒNG BỘ"
            ? "CÓ THAY ĐỔI"
            : current.syncStatus,
      });
      if (next.planEnd && next.planStart && next.planEnd < next.planStart)
        fail("dateOrder", 422);
      validateOpenFields(next, true);
      await uniqueLsx(db, next.lsxCode, current.id);
      validatePlanQuantity(next, all);
    }
  }
  if(text(next.planningNote).length>2000)fail("Ghi chú tối đa 2000 ký tự",422);
  const changes = [];
  for (const name of new Set([
    ...Object.keys(current || {}),
    ...Object.keys(next),
  ])) {
    if (
      JSON.stringify(current?.[name] ?? null) !==
      JSON.stringify(next[name] ?? null)
    )
      changes.push({
        field: name,
        before: current?.[name] ?? null,
        after: next[name] ?? null,
      });
  }
  const history = {
    id: randomUUID(),
    action,
    planId: next.planId,
    lsxCode: next.lsxCode,
    recordId: key,
    changes,
    actor: actor.login,
    actorId: actor.userId || actor.permissionLogin || actor.login,
    at: now,
    reason: text(body.reason || next.cancelReason),
  };
  const existing=current
    ?await db.prepare("SELECT payload FROM app_records WHERE entity='in_transit' AND record_key=?").bind(key).first()
    :null;
  if(current&&await recordRevision(existing?.payload)!==body.expectedRevision)fail(conflictMessage,409);
  const {revision: _readRevision, ...storedNext}=next;
  const payload=JSON.stringify(storedNext);
  const update=existing
    ?db.prepare("UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity='in_transit' AND record_key=? AND payload=?").bind(payload,actor.login,now,key,existing.payload)
    :db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) VALUES('in_transit',?,?,?,?) ON CONFLICT(entity,record_key) DO NOTHING").bind(key,payload,actor.login,now);
  const writes=[update];
  writes.push(db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'in_transit_audit',?,?,?,? WHERE changes()=1").bind(history.id,JSON.stringify(history),actor.login,now));
  const result=await db.batch(writes);
  if(result[0].meta.changes!==1)fail(conflictMessage,409);
  return { ok: true, row: next, history };
}
