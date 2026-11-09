import {preservedOrderMetadata} from '../../lib/production-legacy-preservation.mjs';
import {stageValidationPayload} from './production-stage-read.mjs';
import {readRecordPages} from './production-record-pages.mjs';
import {transitStandardLeadtime} from '../../lib/transit-leadtime.mjs';
import { randomUUID } from "node:crypto";
import {
  transitPlanAllocationKey,
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
const referenceSources=new WeakMap();
// The journal belongs to the authenticated account, never the mutable display email.
const creationOwner=actor=>text(actor?.userId||actor?.permissionLogin||actor?.login);
const scopeConflict='Lượt tạo LSX đã thay đổi hoặc còn kết quả chưa đối soát. Hãy kiểm tra lượt trước, không tạo lượt mới để thử lại.';
async function creationScope(db,actor,captured=undefined){
  if(!actor?.login)fail('loginRequired',401);
  const key=await recordRevision(['additional-lsx-scope',creationOwner(actor)]),row=captured===undefined?await db.prepare("SELECT payload FROM app_records WHERE entity='in_transit_creation_scope' AND record_key=?").bind(key).first():captured===null?null:{payload:captured};
  if(!row)return {key,raw:null,value:null,revision:null,pending:null,receiptRaw:null};
  let value;try{value=JSON.parse(row.payload);}catch{fail(scopeConflict,409);}
  if(!value||typeof value!=='object'||Array.isArray(value)||value.owner!==creationOwner(actor)||typeof value.actor!=='string'||typeof value.version!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value.version)||!Object.hasOwn(value,'pending'))fail(scopeConflict,409);
  const revision=await recordRevision(row.payload);
  if(value.pending===null)return {key,raw:row.payload,value,revision,pending:null,receiptRaw:null};
  const p=value.pending;if(!p||typeof p.attemptKey!=='string'||! /^[a-f0-9]{64}$/.test(p.attemptKey)||typeof p.rowId!=='string'||typeof p.requestIdempotency!=='string'||await recordRevision([creationOwner(actor),p.requestIdempotency])!==p.attemptKey)fail(scopeConflict,409);
  const receipt=await db.prepare("SELECT payload FROM app_records WHERE entity='in_transit_creation_attempt' AND record_key=?").bind(p.attemptKey).first();
  let saved;try{saved=JSON.parse(receipt?.payload);}catch{fail(scopeConflict,409);}
  if(saved?.key!==p.attemptKey||saved.owner!==creationOwner(actor)||saved.actor!==value.actor||saved.fingerprint!==p.fingerprint||saved.result?.row?.id!==p.rowId||saved.result.row.id!==`lsx:${saved.result.row.planId}:${p.attemptKey}`||saved.result?.creationScopeRevision!==revision)fail(scopeConflict,409);
  return {key,raw:row.payload,value,revision,receiptRaw:receipt.payload,pending:{rowId:p.rowId,requestIdempotency:p.requestIdempotency,planId:saved.result.row.planId,sku:saved.result.row.sku,line:saved.result.row.line,createdAt:saved.result.row.createdAt}};
}
export async function readAdditionalCreationScope(db,actor){const s=await creationScope(db,actor);return {revision:s.revision,pending:s.pending};}
export async function acknowledgeAdditionalCreation(db,body,actor){
  if(typeof body.expectedCreationRevision!=='string'||! /^[a-f0-9]{64}$/.test(body.expectedCreationRevision)||typeof body.id!=='string')fail('invalidSelection',422);
  const s=await creationScope(db,actor),ackKey=`${s.key}:${body.expectedCreationRevision}`;
  const already=async()=>{const row=await db.prepare("SELECT payload FROM app_records WHERE entity='in_transit_creation_ack' AND record_key=?").bind(ackKey).first();let value;try{value=JSON.parse(row?.payload);}catch{}return value?.owner===creationOwner(actor)&&value.rowId===body.id&&value.revision===body.expectedCreationRevision;};
  if(s.revision!==body.expectedCreationRevision||s.pending?.rowId!==body.id){if(await already())return {ok:true,replayed:true};fail(scopeConflict,409);}
  const now=new Date().toISOString(),payload=JSON.stringify({...s.value,pending:null}),proof=JSON.stringify({owner:creationOwner(actor),actor:actor.login,rowId:body.id,revision:s.revision,at:now});
  const results=await db.batch([
    db.prepare("UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity='in_transit_creation_scope' AND record_key=? AND payload=? AND EXISTS(SELECT 1 FROM app_records WHERE entity='in_transit_creation_attempt' AND record_key=? AND payload=?) AND NOT EXISTS(SELECT 1 FROM app_records WHERE entity='in_transit_creation_ack' AND record_key=?)").bind(payload,actor.login,now,s.key,s.raw,s.value.pending.attemptKey,s.receiptRaw,ackKey),
    db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'in_transit_creation_ack',?,?,?,? WHERE changes()=1").bind(ackKey,proof,actor.login,now),
  ]);
  if(results[0].meta.changes!==1){if(await already())return {ok:true,replayed:true};fail(scopeConflict,409);}
  return {ok:true};
}
async function readAdditionalAttempt(db,attempt,captured=undefined){
  const saved=captured===undefined?await db.prepare("SELECT payload FROM app_records WHERE entity='in_transit_creation_attempt' AND record_key=?").bind(attempt.key).first():captured===null?null:{payload:captured};
  if(!saved)return null;
  let value;try{value=JSON.parse(saved.payload);}catch{fail(conflictMessage,409);}
  if(!value||typeof value!=='object'||Array.isArray(value)||(value.owner?value.owner!==attempt.owner:value.actor!==attempt.actor)||value.key!==attempt.key||value.fingerprint!==attempt.fingerprint||typeof value.result?.row?.id!=='string'||value.result.row.id!==`lsx:${value.result.row.planId}:${attempt.key}`||value.result.history?.recordId!==value.result.row.id||value.result.history?.actor!==value.actor||value.result.history?.action!=='add-lsx'||value.result.ok!==true)fail(conflictMessage,409);
  return {...value.result,replayed:true};
}
const parse = (r) => {
  try {
    return { ...r, rawPayload:r.payload, payload: JSON.parse(r.payload) };
  } catch {
    return { ...r, payload: null };
  }
};
const read = async (db, entity, stageValidation=false) => (await readRecordPages(db,{where:'entity=?',args:[entity],payloadExpression:stageValidation?stageValidationPayload(entity):'payload'})).sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at))||a.record_key.localeCompare(b.record_key)).map(parse);
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
  // Internal creation path: planning references need no report/event projection.
  const referenceOnly=Object.hasOwn(options,'referenceId');
  if(referenceOnly&&(!text(options.referenceId)||typeof options.referenceId!=='string'))fail('invalidSelection',422);
  const [records, audits, reports, leadtimes, events, historyImports, leadVersions] = await Promise.all(
    ["in_transit", "in_transit_audit", "production_report", "leadtime", "production_event", "production_history_import", "leadtime_versions"].map(
      async(e) => {
        if(referenceOnly){
          if(e!=='in_transit')return [];
          const row=await db.prepare("SELECT entity,record_key,payload,updated_by,updated_at,(SELECT payload FROM app_records WHERE entity='production_reporting_policy' AND record_key='global') AS reference_policy,(SELECT payload FROM app_records WHERE entity='production_reporting_activation' AND record_key='global') AS reference_activation FROM app_records WHERE entity='in_transit' AND record_key=?").bind(options.referenceId).first();
          return row?[parse(row)]:[];
        }
        if(options.includeHistory===false&&e==='in_transit_audit'||options.planningOnly&&['in_transit_audit','leadtime','leadtime_versions'].includes(e))return [];
        return read(db,e,options.stageValidation);
      },
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
  const preserved=new Map((options.preservedOrders||[]).map(b=>[b.orderId,b]));
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
        group: preservedOrderMetadata(r.payload,preserved.get(merged.id))?.group ?? (masterValues.group || merged.group),
        name: preservedOrderMetadata(r.payload,preserved.get(merged.id))?.name ?? (masterValues.name || merged.name ),
        spec: preservedOrderMetadata(r.payload,preserved.get(merged.id))?.spec ?? (masterValues.spec || merged.spec ),
        unit: preservedOrderMetadata(r.payload,preserved.get(merged.id))?.unit ?? (masterValues.unit || merged.unit ),
        line: preservedOrderMetadata(r.payload,preserved.get(merged.id))?.line ?? (merged.line || masterValues.line ),
      }), revision:options.planningOnly||referenceOnly ? undefined : await recordRevision(r.rawPayload),updatedBy:r.updated_by};
    }));
  const withLeadtime = rows
    .map((row) => {
      const frozenLead=preservedOrderMetadata(row,preserved.get(row.id));
      const standardLeadtime = options.planningOnly||referenceOnly ? null : Object.hasOwn(frozenLead||{},'standardLeadtime') ? frozenLead.standardLeadtime : transitStandardLeadtime(row,
        leadtimes.flatMap(r=>Array.isArray(r.payload?.rows)?r.payload.rows:[{...r.payload,sku:r.payload?.sku||r.record_key}]),
        leadVersions.map(r=>r.payload).filter(Boolean),options.leadtimeAt,{observedAtCapture:db.observedSourceSnapshot===true});
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
  const result={rows:withLeadtime,history};
  if(referenceOnly&&records[0]?.rawPayload){
    const row=records[0];let policy;try{policy=JSON.parse(row.reference_policy);}catch{policy=null;}
    const historyProtected=Boolean(row.reference_activation)||policy?.mode==='daily-finished-v1'&&policy.approved===true&&dateISO(policy.effectiveFrom)===policy.effectiveFrom&&policy.effectiveFrom<=vietnamDateISO();
    referenceSources.set(result,{key:row.record_key,payload:row.rawPayload,policy:row.reference_policy??null,activation:row.reference_activation??null,historyProtected});
  }
  return result;
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
          transitPlanAllocationKey(item) === transitPlanAllocationKey(row) &&
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
  let creationAttempt=null,capturedScope;
  if(action==='add-lsx'&&Object.hasOwn(body,'requestIdempotency')){
    if(typeof body.requestIdempotency!=='string'||!/^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(body.requestIdempotency))fail('invalidSelection',422);
    creationAttempt={actor:actor.login,owner:creationOwner(actor),key:await recordRevision(JSON.stringify([Object.hasOwn(body,'expectedCreationRevision')?creationOwner(actor):actor.login,body.requestIdempotency])),fingerprint:await recordRevision(JSON.stringify([body.id,body.planStart,body.planEnd,body.line,body.priority,body.sequence,body.planningNote||'']))};
    let capturedAttempt;
    if(Object.hasOwn(body,'expectedCreationRevision')){
      const ownerKey=await recordRevision(['additional-lsx-scope',creationOwner(actor)]),captured=await db.prepare("SELECT (SELECT payload FROM app_records WHERE entity='in_transit_creation_attempt' AND record_key=?) AS attempt,(SELECT payload FROM app_records WHERE entity='in_transit_creation_scope' AND record_key=?) AS creation_scope").bind(creationAttempt.key,ownerKey).first();
      if(!captured||!Object.hasOwn(captured,'attempt')||!Object.hasOwn(captured,'creation_scope'))fail(scopeConflict,409);
      capturedAttempt=captured.attempt;capturedScope=captured.creation_scope;
    }
    const replay=await readAdditionalAttempt(db,creationAttempt,capturedAttempt);if(replay)return replay;
  }
  let creationState=null;
  if(action==='add-lsx'&&Object.hasOwn(body,'expectedCreationRevision')){
    if(!creationAttempt||body.expectedCreationRevision!==null&&typeof body.expectedCreationRevision!=='string')fail('invalidSelection',422);
    creationState=await creationScope(db,actor,capturedScope);
    if(creationState.revision!==body.expectedCreationRevision||creationState.pending)fail(scopeConflict,409);
  }
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
  const state = action==='add-lsx' ? await getTransit(db,{},catalog,{referenceId:body.id}) : sharedState || await getTransit(db, {}, catalog),
    all = state.rows;
  const sourceReference=action==='add-lsx'?referenceSources.get(state):null;
  let current = null,
    key = text(body.id),
    next;
  if (action === "add-lsx") {
    const source = all.find((r) => r.id === body.id);
    if (!source || source.status === "HỦY" || !sourceReference) fail("invalidSelection", 422);
    const planStart = dateISO(body.planStart),
      planEnd = dateISO(body.planEnd),
      line = lineOf(body.line),
      priority = text(body.priority),
      sequence = numberOrNull(body.sequence);
    if (!planStart || !planEnd || !line || !priority || !(sequence > 0))
      fail("initialFieldsRequired", 422);
    if (planEnd < planStart) fail("dateOrder", 422);
    key = `lsx:${source.planId}:${creationAttempt?.key||randomUUID()}`;
    next = normalizeTransit({
      // A new LSX shares the planning reference, not the source LSX's output,
      // CSV aliases, receipt state or historical-import privileges.
      ...Object.fromEntries(['planRowId','planGroupId','groupPlanId','planId','week','sku','name','spec','unit','group','source','sourceIds','planQty','plan','laborHour','planLaborBasis','planLeadtimeBasis'].filter(field=>Object.hasOwn(source,field)).map(field=>[field,source[field]])),
      ...(sourceReference.historyProtected?{planLaborBasis:source.planLaborBasis&&typeof source.planLaborBasis==='object'?source.planLaborBasis:{status:'missing',reason:'missing-source-plan-confirmation',segments:[]},planLeadtimeBasis:source.planLeadtimeBasis??null}:{}),
      columns: [],
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
      pendingReportQty: 0,
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
  // Source, retry proof and the per-account cursor advance atomically. A late
  // request remains stale after ACK; clearing the pending flag never resets it.
  const scopePayload=creationState?JSON.stringify({owner:creationOwner(actor),actor:actor.login,version:randomUUID(),pending:{attemptKey:creationAttempt.key,rowId:key,fingerprint:creationAttempt.fingerprint,requestIdempotency:body.requestIdempotency}}):null;
  const response={ok:true,row:next,history,...(creationState?{creationScopeRevision:await recordRevision(scopePayload)}:{})};
  const update=existing
    ?db.prepare("UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity='in_transit' AND record_key=? AND payload=?").bind(payload,actor.login,now,key,existing.payload)
    :sourceReference
      ?db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'in_transit',?,?,?,? WHERE EXISTS(SELECT 1 FROM app_records WHERE entity='in_transit' AND record_key=? AND payload=?) AND (SELECT payload FROM app_records WHERE entity='production_reporting_policy' AND record_key='global') IS ? AND (SELECT payload FROM app_records WHERE entity='production_reporting_activation' AND record_key='global') IS ? AND (? IS NULL OR NOT EXISTS(SELECT 1 FROM app_records WHERE entity='in_transit_creation_attempt' AND record_key=?)) AND (? IS NULL OR ((? IS NULL AND NOT EXISTS(SELECT 1 FROM app_records WHERE entity='in_transit_creation_scope' AND record_key=?)) OR EXISTS(SELECT 1 FROM app_records WHERE entity='in_transit_creation_scope' AND record_key=? AND payload=?))) ON CONFLICT(entity,record_key) DO NOTHING").bind(key,payload,actor.login,now,sourceReference.key,sourceReference.payload,sourceReference.policy,sourceReference.activation,creationAttempt?.key??null,creationAttempt?.key??null,creationState?.key??null,creationState?.raw??null,creationState?.key??null,creationState?.key??null,creationState?.raw??null)
      :db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) VALUES('in_transit',?,?,?,?) ON CONFLICT(entity,record_key) DO NOTHING").bind(key,payload,actor.login,now);
  const writes=[update];
  writes.push(db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'in_transit_audit',?,?,?,? WHERE changes()=1").bind(history.id,JSON.stringify(history),actor.login,now));
  if(creationAttempt)writes.push(db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'in_transit_creation_attempt',?,?,?,? WHERE changes()=1").bind(creationAttempt.key,JSON.stringify({...creationAttempt,result:response}),actor.login,now));
  if(creationState)writes.push(db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'in_transit_creation_scope',?,?,?,? WHERE changes()=1 ON CONFLICT(entity,record_key) DO UPDATE SET payload=excluded.payload,updated_by=excluded.updated_by,updated_at=excluded.updated_at WHERE app_records.payload=?").bind(creationState.key,scopePayload,actor.login,now,creationState.raw));
  const result=await db.batch(writes);
  if(result[0].meta.changes!==1){if(creationAttempt){const replay=await readAdditionalAttempt(db,creationAttempt);if(replay)return replay;}fail(conflictMessage,409);}
  return response;
}
