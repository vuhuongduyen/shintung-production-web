import {isDailyOutput} from './production-report-model.mjs';
import {vnMoment} from "./production-attendance.mjs";
import {
  dateISO,
  monday,
  normalized,
  numberOrNull,
  text,
} from "./production-plan.mjs";

// Accept report instants while keeping planning dates calendar-only.
export function transitActualDate(value) {
  const day = dateISO(value);
  if (day) return day;
  const instant = text(value);
  return /^\d{4}-\d{2}-\d{2}T/.test(instant) && Number.isFinite(Date.parse(instant)) ? vnMoment(instant).date : '';
}

export const orderStatuses = ["CHƯA MỞ LSX", "ĐÃ MỞ LSX", "HỦY"];
export const syncStatuses = [
  "CHƯA ĐỒNG BỘ",
  "ĐÃ ĐỒNG BỘ",
  "CÓ THAY ĐỔI",
  "LỖI ĐỒNG BỘ",
];

export const transitReportTypes = [
  "all",
  "completed-late",
  "unfinished-week",
  "overdue",
  "not-opened",
  "sync-issues",
  "cancelled",
];

export function visibleTransitRow(row, hideCompleted = false, hideCancelled = false) {
  if (hideCancelled && row.status === "HỦY") return false;
  if (hideCompleted && row.status !== "HỦY" &&
      ["HT SỚM", "HT ĐÚNG TIẾN ĐỘ", "HT TRỄ TIẾN ĐỘ"].includes(row.progressStatus)) return false;
  return true;
}

export function transitReportRows(rows = [], type = "all", week = "", today) {
  const reportWeek = week ? monday(week) : "";
  const currentDate = dateISO(today || new Date());
  return rows.filter((row) => {
    if (reportWeek && monday(row.week) !== reportWeek) return false;
    if (type === "completed-late")
      return row.progressStatus === "HT TRỄ TIẾN ĐỘ";
    if (type === "unfinished-week")
      return (
        row.status === "ĐÃ MỞ LSX" &&
        !dateISO(row.actualCompletedAt) &&
        (numberOrNull(row.completedQty) || 0) < (numberOrNull(row.lsxQty) || 0)
      );
    if (type === "overdue")
      return (
        row.status === "ĐÃ MỞ LSX" &&
        !dateISO(row.actualCompletedAt) &&
        dateISO(row.planEnd) &&
        dateISO(row.planEnd) < currentDate
      );
    if (type === "not-opened") return row.status === "CHƯA MỞ LSX";
    if (type === "sync-issues") return row.syncStatus !== "ĐÃ ĐỒNG BỘ";
    if (type === "cancelled") return row.status === "HỦY";
    return true;
  });
}

export function orderStatus(row) {
  if (text(row.cancelReason)) return "HỦY";
  return text(row.lsxCode) || dateISO(row.lsxOpenedAt)
    ? "ĐÃ MỞ LSX"
    : "CHƯA MỞ LSX";
}

export function progressStatus(row) {
  if (orderStatus(row) !== "ĐÃ MỞ LSX") return "";
  const productionState = normalized(row.productionState);
  if (dateISO(row.actualCompletedAt)) {
    if (dateISO(row.planEnd) && dateISO(row.actualCompletedAt) < dateISO(row.planEnd)) return "HT SỚM";
    return !dateISO(row.planEnd) || dateISO(row.actualCompletedAt) === dateISO(row.planEnd) ? "HT ĐÚNG TIẾN ĐỘ" : "HT TRỄ TIẾN ĐỘ";
  }
  if (productionState.includes("SU CO")) return "TẠM DỪNG SỰ CỐ";
  if ((numberOrNull(row.pendingReportQty) || 0) > 0)
    return (numberOrNull(row.completedQty) || 0) + row.pendingReportQty >= (numberOrNull(row.lsxQty) || Infinity)
      ? "CHỜ XÁC NHẬN HOÀN THÀNH" : "BÁO CÔNG CHỜ XÁC NHẬN";
  if (productionState.includes("TAM NGUNG")) return "ĐANG TẠM NGƯNG";
  if (dateISO(row.actualStartedAt) || (numberOrNull(row.completedQty) || 0) > 0)
    return "ĐANG SẢN XUẤT";
  return "CHƯA SẢN XUẤT";
}

export function normalizeTransit(raw = {}) {
  const row = raw && typeof raw === "object" ? raw : {};
  const columns = Array.isArray(row.columns) ? row.columns : [];
  const result = {
    ...row,
    id: text(row.id || row.orderId || row.planRowId),
    planRowId: text(row.planRowId),
    planId: text(row.planId || columns[0]),
    isAdditionalLsx: row.isAdditionalLsx === true,
    planningNote: text(row.planningNote),
    week: monday(row.week || row.planStart || row.start),
    group: text(row.group || columns[8]),
    sku: text(row.sku || columns[1]).toUpperCase(),
    name: text(row.name || columns[2]),
    spec: text(row.spec || columns[3]),
    unit: text(row.unit || row.uom),
    line: text(row.line || columns[4]).replace(/^Line\s*/i, ""),
    source: text(row.source || columns[9] || "Kế hoạch tuần"),
    priority: row.importBlankPriority ? text(row.priority) : text(row.priority || columns[10] || "THƯỜNG"),
    sequence: numberOrNull(row.sequence ?? columns[11]),
    planQty: numberOrNull(row.planQty ?? row.plan ?? columns[13]),
    planStart: dateISO(row.planStart || row.start || columns[6]),
    planEnd: dateISO(row.planEnd || row.end || columns[7]),
    lsxCode: text(row.lsxCode || columns[5]),
    lsxQty: numberOrNull(row.lsxQty ?? columns[14]),
    lsxOpenedAt: dateISO(row.lsxOpenedAt || columns[15]),
    cancelReason: text(row.cancelReason),
    completedQty: numberOrNull(row.completedQty ?? columns[17]) || 0,
    actualStartedAt: transitActualDate(row.actualStartedAt),
    actualCompletedAt: transitActualDate(row.actualCompletedAt),
    delayReason: text(row.delayReason),
    productionState: text(row.productionState),
    syncStatus:
      syncStatuses.find(
        (v) => normalized(v) === normalized(row.syncStatus || columns[29]),
      ) || "CHƯA ĐỒNG BỘ",
    syncError: text(row.syncError),
    planningUpdateCount:
      numberOrNull(row.planningUpdateCount ?? columns[27]) || 0,
    planningUpdatedAt: text(row.planningUpdatedAt),
    planningUpdatedBy: text(row.planningUpdatedBy || row.updatedBy),
    productionReceiveCount:
      numberOrNull(row.productionReceiveCount ?? columns[36]) || 0,
    productionReceivedAt: text(row.productionReceivedAt),
    createdAt: text(row.createdAt || columns[31]),
    createdBy: text(row.createdBy || columns[32]),
    updatedAt: text(row.updatedAt),
    updatedBy: text(row.updatedBy),
  };
  result.status = orderStatus(result);
  if (
    result.syncStatus === "ĐÃ ĐỒNG BỘ" &&
    (!result.lsxCode || !(result.lsxQty > 0) || !result.lsxOpenedAt)
  )
    result.syncStatus = "CHƯA ĐỒNG BỘ";
  if (result.syncStatus === "CHƯA ĐỒNG BỘ")
    result.planningUpdateCount = 0;
  result.inTransitQty =
    result.status === "HỦY"
      ? 0
      : result.lsxQty && result.lsxQty > 0
        ? Math.max(result.lsxQty - result.completedQty, 0)
        : null;
  result.progress =
    result.lsxQty && result.lsxQty > 0
      ? Math.min(Math.max(result.completedQty / result.lsxQty, 0), 1)
      : null;
  result.delayDays =
    result.planEnd && result.actualCompletedAt
      ? Math.max(
          (Date.parse(result.actualCompletedAt) - Date.parse(result.planEnd)) /
            86400000,
          0,
        )
      : null;
  result.actualLeadtime =
    result.lsxOpenedAt && result.actualCompletedAt
      ? Math.max(
          (Date.parse(result.actualCompletedAt) -
            Date.parse(result.lsxOpenedAt)) /
            86400000,
          0,
        )
      : null;
  result.progressStatus = progressStatus(result);
  return result;
}

export function mergeProduction(row, reports = [], events = []) {
  const matches = reports.map((report) =>
    report?.payload && typeof report.payload === "object"
      ? report.payload
      : report,
  ).filter((p) => {
    if (p.voided || p.cancelled) return false;
    // A stable source ID wins; a shared Plan ID must never merge two LSX.
    if (p.transitId) return p.transitId === row.id;
    const code = text(p.lsxCode || p.orderCode || p.mo);
    if (code) return normalized(code) === normalized(row.lsxCode);
    return !row.planGroupId&&Boolean(row.planId && normalized(p.planId) === normalized(row.planId));
  });
  const timeline = events.filter(e => !e.voided && (e.sourceId === row.id || e.destinationId === row.id))
    .sort((a,b) => Date.parse(a.effectiveAt)-Date.parse(b.effectiveAt) || text(a.recordedAt).localeCompare(text(b.recordedAt)));
  if (!matches.length && !timeline.length) return row;
  const sorted = [...matches].sort((a, b) =>
    text(b.updatedAt || b.eventAt || b.reportedAt).localeCompare(
      text(a.updatedAt || a.eventAt || a.reportedAt),
    ),
  );
  const approvedDetailed = matches.filter(
    (item) =>
      item.kind === "completion" &&
      normalized(item.reviewStatus) === normalized("Đã xác nhận"),
  );
  const detailedCompletedQty = approvedDetailed.reduce(
    (sum, item) =>
      sum +
      (numberOrNull(item.approvedQuantity ?? item.reportedQuantity) || 0),
    0,
  );
  const pendingReportQty = matches.filter(item => item.kind === 'completion' && ['Chờ kiểm tra','Lịch sử chờ đối chiếu'].includes(item.reviewStatus))
    .reduce((sum,item) => sum + (numberOrNull(item.reportedQuantity) || 0),0);
  const latestLegacy = sorted.find(
    (item) =>
      item.kind !== "completion" &&
      numberOrNull(item.completedQty ?? item.quantityCompleted) !== null,
  );
  const latestState = sorted.find((item) => item.kind !== "completion" && text(item.productionState || item.status));
  let operationalState = latestState?.productionState ?? latestState?.status ?? row.productionState;
  let stationStart = "";
  for (const event of timeline) {
    const entered = event.stageReporting&&["start","extra"].includes(event.stageAction)&&event.sourceId===row.id || event.kind === "start" && event.sourceId === row.id || event.kind === "transfer" && event.destinationId === row.id && !event.destinationIncludedInStart;
    if (entered) stationStart ||= event.effectiveAt;
    if (entered || event.kind === "resume" && event.sourceId === row.id) operationalState = "Đang sản xuất";
    if (event.sourceId === row.id && event.kind === "pause") operationalState = "Tạm ngưng";
    if (event.sourceId === row.id && event.kind === "incident" && event.stopWork) operationalState = "Tạm ngưng sự cố";
  }
  const stageStates=new Map();for(const event of timeline){if(event.stageReporting&&event.stageAfter)stageStates.set(event.stageName,event.stageAfter);if(event.kind==='stage-incident')for(const [k,v] of stageStates)if(event.stages?.includes(k.replace(/^[ABC]-/,'')))stageStates.set(k,{...v,status:'paused'});}
  if(stageStates.size)operationalState=[...stageStates.values()].some(s=>s.status==='running')?'Đang sản xuất':'Tạm ngưng';
  const actualStarts = matches
    .map((item) => text(isDailyOutput(item)?item.productionDate:item.actualStartedAt || item.startDate || item.startedAt))
    .filter(Boolean)
    .sort();
  const actualCompletions = approvedDetailed
    .map((item) => text(isDailyOutput(item)?item.productionDate:item.completedAt || item.actualCompletedAt))
    .filter(Boolean)
    .sort();
  const dailyReports=matches.filter(isDailyOutput),legacyApproved=approvedDetailed.filter(r=>!isDailyOutput(r));
  const carriedBaseline=dailyReports.reduce((n,r)=>Math.max(n,numberOrNull(r.legacyCompletedBaseline)||0),0);
  const legacyDetailedQty=legacyApproved.reduce((n,r)=>n+(numberOrNull(r.approvedQuantity??r.reportedQuantity)||0),0);
  const dailyApprovedQty=approvedDetailed.filter(isDailyOutput).reduce((n,r)=>n+(numberOrNull(r.approvedQuantity??r.reportedQuantity)||0),0);
  const completedQty = dailyReports.length
    ? dailyApprovedQty+Math.max(carriedBaseline,legacyApproved.length?legacyDetailedQty:latestLegacy?numberOrNull(latestLegacy.completedQty??latestLegacy.quantityCompleted)||0:0)
    : approvedDetailed.length
    ? detailedCompletedQty
    : latestLegacy
      ? numberOrNull(latestLegacy.completedQty ?? latestLegacy.quantityCompleted)
      : row.completedQty;
  return normalizeTransit({
    ...row,
    completedQty,
    pendingReportQty,
    actualStartedAt: transitActualDate(stationStart || actualStarts[0] || row.actualStartedAt),
    actualCompletedAt:
      completedQty >= (numberOrNull(row.lsxQty) || Infinity)
        ? (actualCompletions.at(-1)?.includes("T")?vnMoment(actualCompletions.at(-1)).date:actualCompletions.at(-1)) || row.actualCompletedAt
        : "",
    delayReason:
      sorted.find((item) => text(item.delayReason))?.delayReason || row.delayReason,
    productionState:
      completedQty >= (numberOrNull(row.lsxQty) || Infinity) ? "Hoàn thành sản xuất" : operationalState,
    productionReceiveCount:
      approvedDetailed.length || (latestLegacy ? matches.length : 0),
    productionReceivedAt:
      sorted[0]?.correctedAt || sorted[0]?.updatedAt || sorted[0]?.eventAt || sorted[0]?.receivedAt || sorted[0]?.reportedAt || row.productionReceivedAt,
  });
}
