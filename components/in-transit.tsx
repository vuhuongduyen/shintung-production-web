"use client";
import QuantityProgress from './quantity-progress';
import ProductionStatusLegend from './production-status-legend';
import {ACTION_FEEDBACK_CLEAR_EVENT,ACTION_FEEDBACK_DURATION,notifyInvalidAction} from '../lib/action-feedback';
import {FeedbackActionButton} from './action-feedback';
import {ManualPagination} from './onspa-ui/ManualPagination';
import {DataCell} from './onspa-ui/DataCell';
import {inTransitCellKind, type InTransitDisplayField} from './onspa-ui/in-transit-semantics';
import TransitHistoryImport from "./transit-history-import";
import { apiFetch as fetch } from "../lib/data-sync";
import { useDataRefresh, announceDataChange, clientSessionGeneration, ClientSessionReadCancelled, subscribeClientReadInvalidation, WorkspaceActivityContext } from "../lib/data-sync";
import { StandardToolbar, toolbar } from "./standard-toolbar/StandardToolbar";
import { Fragment, FormEvent, useEffect, useMemo, useState, useRef, useContext } from "react";
import { displayDate, monday, weekEnd, weekNumber, normalized } from "../lib/production-plan.mjs";
import { inTransitEditBlockReason } from "../lib/in-transit-edit-feedback.mjs";
import {completedWeeks,visibilityWeek,transitReadyToArchive,matchesVisibility} from '../lib/week-visibility.mjs';
import { visibleTransitRow } from "../lib/in-transit.mjs";

import {productionProgressDisplay} from "../lib/production-progress-display.mjs";

type Row = { id: string; [key: string]: any };
type Audit = { id: string; [key: string]: any };
const empty = { rows: [] as Row[], history: [] as Audit[] };
let transitCache: typeof empty | null = null;
let transitGeneration = 0;
let transitStale = true;
export function invalidateInTransitCache() {
  transitGeneration++;
  transitStale = true;
  transitCache = null;
  transitRequest = null;
}
let catalogCache: any[] | null = null;
let transitRequest: Promise<typeof empty> | null = null;
let catalogRequest: Promise<any[]> | null = null;
subscribeClientReadInvalidation(reason => {
  if (reason !== 'session') {
    // Keep the last successful table visible, but never treat pre-write
    // quantities (or their pending request) as current when reopening the tab.
    transitGeneration++;
    transitStale = true;
    transitRequest = null;
    return;
  }
  invalidateInTransitCache();
  catalogCache = null;
  catalogRequest = null;
});

async function fetchTransitData(force = false): Promise<typeof empty> {
  const browser = typeof window !== 'undefined';
  const session = clientSessionGeneration();
  if (browser && transitRequest) return transitRequest;
  if (browser && !force && !transitStale && transitCache) return transitCache;
  const generation = transitGeneration;
  const request: Promise<typeof empty> = fetch("/api/in-transit", { cache: force ? "reload" : "no-store" })
    .then(async (response) => {
      const result = await response.json();
      if (session !== clientSessionGeneration()) throw new ClientSessionReadCancelled();
      if (!response.ok) throw Error(result.error);
      return result as typeof empty;
    })
    .then(result => {
      if (session !== clientSessionGeneration()) throw new ClientSessionReadCancelled();
      if (browser && generation !== transitGeneration) return fetchTransitData();
      if (browser) { transitCache = result; transitStale = false; }
      return result;
    }, error => {
      if (session !== clientSessionGeneration()) throw new ClientSessionReadCancelled();
      if (browser && generation !== transitGeneration) return fetchTransitData();
      throw error;
    })
    .finally(() => {
      if (transitRequest === request) transitRequest = null;
    });
  if (browser) transitRequest = request;
  return request;
}

async function fetchTransitCatalog(force = false) {
  const browser = typeof window !== 'undefined';
  const session = clientSessionGeneration();
  if (browser && !force && catalogCache) return catalogCache;
  if (browser && !force && catalogRequest) return catalogRequest;
  const request = fetch("/api/records?entity=sku", { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) throw Error("Không tải được SKU Master");
      const skus = await response.json();
      if (session !== clientSessionGeneration()) throw new ClientSessionReadCancelled();
      const result = (skus.records || []).map((x: any) => {
        const item = x.payload || x;
        return {
          ...item,
          code: item.code || x.key,
          name: item.name || item.productName || "",
          spec:
            item.specification ||
            item.spec ||
            item.quyCach ||
            item.quy_cach ||
            "",
          unit: item.unit || item.uom || item.unitOfMeasure || "",
          line: item.line || item.productionLine || "",
        };
      });
      if (browser) catalogCache = result;
      return result;
    })
    .finally(() => {
      if (catalogRequest === request) catalogRequest = null;
    });
  if (browser) catalogRequest = request;
  return request;
}

export async function prefetchInTransit() {
  await Promise.all([fetchTransitData(), fetchTransitCatalog()]);
}
const fmt = (v: any) =>
  v === null || v === undefined || v === ""
    ? "—"
    : typeof v === "number"
      ? v.toLocaleString("vi-VN")
      : String(v);
const dt = (v: any) =>
  v
    ? new Date(v)
        .toLocaleString("en-GB", {
          timeZone: "Asia/Ho_Chi_Minh",
          hourCycle: 'h23',
        })
        .replace(",", "")
    : "—";
const badge = (v: string) =>
  `it-badge it-${normalized(v).toLowerCase().replaceAll(" ", "-")}`;
const businessLabel = (v: any) => {
  const progress = productionProgressDisplay(v);
  if (progress) return progress.label;
  const labels: Record<string, string> = {
    "HT DUNG TIEN DO": "Hoàn thành",
    "CHUA MO LSX": "Chưa mở LSX",
    "DA MO LSX": "Đã mở LSX",
    "HUY": "Hủy",
    "CHUA SAN XUAT": "Chưa SX",
    "DANG SAN XUAT": "Đang SX",
    "DANG TAM NGUNG": "Đang tạm ngưng",
    "TAM DUNG SU CO": "Tạm dừng sự cố",
    "HT SOM": "HT sớm",
    "HT TRE TIEN DO": "HT trễ",
    "CHUA DONG BO": "Chưa đồng bộ",
    "DA DONG BO": "Đã đồng bộ",
    "CO THAY DOI": "Có thay đổi",
    "LOI DONG BO": "Lỗi đồng bộ",
    THUONG: "Thường",
    GAP: "Gấp",
    "THUONG - GOI DAU": "Thường - gối đầu",
    "KE HOACH TUAN": "Kế hoạch tuần",
    "PHAT SINH DOT XUAT": "Phát sinh đột xuất",
    "DEMAND EVENT": "Demand Event",
  };
  return labels[normalized(v)] || fmt(v);
};
const completeLsx = (row: Row) =>
  Boolean(
    String(row.lsxCode || "").trim() &&
    Number(row.lsxQty) > 0 &&
    String(row.lsxOpenedAt || "").trim(),
  );
const auditFieldLabels: Record<string, [string, string]> = {
  line: ["Line", "產線"],
  planStart: ["Ngày bắt đầu kế hoạch", "計畫開始日"],
  planEnd: ["Ngày dự kiến hoàn thành", "預計完成日"],
  priority: ["Ưu tiên KHSX", "計畫優先級"],
  sequence: ["Thứ tự sản xuất", "生產順序"],
  lsxCode: ["Mã LSX", "工單號"],
  lsxQty: ["Số lượng LSX", "工單數量"],
  lsxOpenedAt: ["Ngày mở LSX", "工單開立日"],
  cancelReason: ["Lý do hủy", "取消原因"],
  status: ["Trạng thái LSX", "工單狀態"],
  syncStatus: ["Trạng thái đồng bộ", "同步狀態"],
  planningUpdateCount: ["Số lần cập nhật KHSX", "計畫更新次數"],
  planningUpdatedAt: ["Thời gian cập nhật KHSX", "計畫更新時間"],
  planningUpdatedBy: ["Người cập nhật KHSX", "計畫更新人"],
};
const emptyFilters = {
  week: "",
  group: "",
  query: "",
  line: "",
  source: "",
  priority: "",
  orderStatus: "",
  progressStatus: "",
  syncStatus: "",
  from: "",
  to: "",
};

type Visibility = Record<string, { completed: boolean; cancelled: boolean }>;
export function InTransit({ language = "vi", operator = "" }: { language?: "vi" | "zh" | "en"; operator?: string }) {
  const preferenceKey = `onspa-in-transit-visibility-v2:${operator}`;
  const [visibilityMode,setVisibilityMode]=useState('active');
  const [visibility, setVisibility] = useState<Visibility>({});
  useEffect(() => { try { const saved=JSON.parse(localStorage.getItem(preferenceKey)||"{}"); if(saved && typeof saved==='object' && !Array.isArray(saved))setVisibility(saved); } catch {} }, [preferenceKey]);
  const saveVisibility = (next: Visibility) => {
    try { localStorage.setItem(preferenceKey, JSON.stringify(next)); } catch { setError(t("Không lưu được lựa chọn ẩn trên trình duyệt này.", "無法儲存顯示設定。")); return; }
    setVisibility(next); setSelected([]); setPage(1); setShowHideRows(false);
  };
  const dataRevision = useDataRefresh(['in_transit', 'production_report', 'production_event', 'production_history_import', 'leadtime_versions', 'sku']);
  const t = (vi: string, zh: string) => (language === "zh" ? zh : vi);
  const friendlyError = (code: string) => {
    const messages: Record<string, [string, string]> = {
      loginRequired: [
        "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
        "登入已逾時，請重新登入。",
      ],
      invalidAction: ["Thao tác không hợp lệ.", "操作無效。"],
      invalidSelection: [
        "Dòng đã chọn không hợp lệ hoặc đã bị hủy.",
        "所選資料無效或已取消。",
      ],
      invalidLsxQty: ["Số lượng LSX phải lớn hơn 0.", "工單數量必須大於 0。"],
      invalidPlanQty: [
        "Số lượng kế hoạch phải lớn hơn 0.",
        "計畫數量必須大於 0。",
      ],
      invalidSku: [
        "SKU không tồn tại, chưa xác nhận hoặc đã ngưng sử dụng.",
        "SKU 不存在、尚未確認或已停用。",
      ],
      dateOrder: [
        "Ngày hoàn thành không được nhỏ hơn ngày bắt đầu.",
        "完成日期不得早於開始日期。",
      ],
      reasonRequired: [
        "Vui lòng nhập lý do phát sinh.",
        "請輸入臨時新增原因。",
      ],
      cancelReasonRequired: ["Vui lòng nhập lý do hủy.", "請輸入取消原因。"],
      editReasonRequired: [
        "Vui lòng nhập lý do chỉnh sửa.",
        "請輸入修改原因。",
      ],
      editAfterSyncOnly: [
        "Dòng chưa chuyển sang Sản xuất. Vui lòng nhập trực tiếp thông tin LSX trên bảng.",
        "此資料尚未轉入生產，請直接在表格中輸入工單資訊。",
      ],
      draftLockedAfterSync: [
        "Dòng đã chuyển sang Sản xuất. Vui lòng dùng nút Chỉnh sửa.",
        "此資料已轉入生產，請使用編輯按鈕。",
      ],
      deleteReasonRequired: [
        "Vui lòng nhập lý do xóa dòng dữ liệu.",
        "請輸入刪除資料的原因。",
      ],
      duplicateLsx: [
        "Mã LSX đã tồn tại. Vui lòng nhập mã khác.",
        "工單號已存在，請輸入其他工單號。",
      ],
      missingRow: [
        "Không tìm thấy dòng dữ liệu. Vui lòng tải lại danh sách.",
        "找不到資料，請重新載入清單。",
      ],
      invalidEdit: [
        "Có trường dữ liệu không được phép chỉnh sửa.",
        "包含不允許編輯的欄位。",
      ],
      lsxFieldsRequired: [
        "Khi mở LSX phải nhập đủ mã LSX, số lượng LSX và ngày LSX.",
        "開立工單時，必須填寫工單號、數量及日期。",
      ],
      initialFieldsRequired: [
        "Vui lòng nhập đủ ngày bắt đầu, ngày hoàn thành, Line, ưu tiên và thứ tự sản xuất.",
        "請完整填寫開始日、完成日、產線、優先級及生產順序。",
      ],
      alreadyCancelled: ["Dòng này đã ở trạng thái HỦY.", "此資料已取消。"],
    };
    return messages[code]
      ? t(...messages[code])
      : code ||
          t(
            "Không thể lưu dữ liệu. Vui lòng thử lại.",
            "無法儲存資料，請重試。",
          );
  };
  const session = useRef(clientSessionGeneration()).current;
  const [data, setData] = useState(()=>(typeof window !== 'undefined' && transitCache) || empty),
    [catalog, setCatalog] = useState<any[]>(()=>(typeof window !== 'undefined' && catalogCache) || []),
    [selected, setSelected] = useState<string[]>([]),
    [page, setPage] = useState(1),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [highlightedId, setHighlightedId] = useState("");
  const [showSearch, setShowSearch] = useState(false),
    [showHistory, setShowHistory] = useState(false),
    [showHideRows, setShowHideRows] = useState(false),
    [visibilityDraft, setVisibilityDraft] = useState<Visibility>({}),
    [detail, setDetail] = useState<Row | null>(null),
    [dialog, setDialog] = useState<
      "" | "unplanned" | "add-lsx" | "edit" | "cancel" | "delete"
    >("");
  const [historyImport,setHistoryImport]=useState(false);
  const [filters, setFilters] = useState(emptyFilters);
  const [searchMode, setSearchMode] =
    useState<keyof typeof emptyFilters>("query");
  const [form, setForm] = useState<Record<string, any>>({}),
    [skuQuery, setSkuQuery] = useState("");
  const [inlineDrafts, setInlineDrafts] = useState<
    Record<string, { lsxCode: string; lsxQty: string; lsxOpenedAt: string }>
  >({});
  async function load(force = false) {
    if (session !== clientSessionGeneration()) return;
    if (transitCache) setData(transitCache);
    if (catalogCache) setCatalog(catalogCache);
    if (!force && !transitStale && transitCache && catalogCache)
      return;
    setBusy(!transitCache);
    setError("");
    try {
      const nextCatalogRequest = fetchTransitCatalog(force).catch(() => null);
      void nextCatalogRequest.then((nextCatalog) => {
        if (!nextCatalog || session !== clientSessionGeneration()) return;
        setCatalog(nextCatalog);
      });
      const result = await fetchTransitData(force);
      if (session !== clientSessionGeneration()) return;
      setData(result);
      return result as typeof empty;
    } catch (e) {
      setError(friendlyError(e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }
  const feedbackActive = useContext(WorkspaceActivityContext);
  const feedbackTrigger = useRef<HTMLElement | null>(null);
  const [editExplanation, setEditExplanation] = useState("");
  const feedbackError = editExplanation || error;
  const dismissFeedback = () => {
    if (document.activeElement?.closest('.it-feedback')) feedbackTrigger.current?.focus();
    feedbackTrigger.current = null;
    setEditExplanation("");
    setError(""); setNotice("");
  };
  const explainBlockedEdit = (reason: string, trigger: HTMLElement) => {
    feedbackTrigger.current = trigger;
    setEditExplanation(reason);
  };
  useEffect(() => {
    setEditExplanation(""); feedbackTrigger.current = null;
  }, [error, notice]);
  useEffect(() => { if (feedbackActive) void load(true); }, [feedbackActive]);
  const loadedRevision = useRef(-1);
  useEffect(() => {
    if (busy || loadedRevision.current === dataRevision) return;
    loadedRevision.current = dataRevision;
    void load(dataRevision > 0);
  }, [dataRevision, busy]);
  useEffect(() => {
    if (!feedbackError && !notice) return;
    if(!feedbackActive){setEditExplanation("");setError("");setNotice("");return;}
    const clear=()=>{feedbackTrigger.current=null;setEditExplanation("");setError("");setNotice("");};
    window.addEventListener(ACTION_FEEDBACK_CLEAR_EVENT,clear);
    const timer = window.setTimeout(dismissFeedback, ACTION_FEEDBACK_DURATION);
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); dismissFeedback(); }
    };
    window.addEventListener('keydown', escape, true);
    return () => { window.clearTimeout(timer); window.removeEventListener('keydown', escape, true);window.removeEventListener(ACTION_FEEDBACK_CLEAR_EVENT,clear); };
  }, [error, notice, editExplanation,feedbackActive]);
  const archivedWeeks=useMemo(()=>completedWeeks(data.rows,transitReadyToArchive),[data.rows]);
  const hiddenRow=(r:Row)=>r.status==='HỦY'||archivedWeeks.has(visibilityWeek(r))||!visibleTransitRow(r,visibility[visibilityWeek(r)]?.completed===false,visibility[visibilityWeek(r)]?.cancelled===false);
  const filtered = useMemo(
    () =>
      data.rows.filter(
        (r) =>
          matchesVisibility(visibilityMode,hiddenRow(r)) &&
          (!filters.week || monday(r.week) === monday(filters.week)) &&
          (!filters.group || r.group === filters.group) &&
          (!filters.line || r.line === filters.line) &&
          (!filters.source || r.source === filters.source) &&
          (!filters.priority || r.priority === filters.priority) &&
          (!filters.orderStatus || r.status === filters.orderStatus) &&
          (!filters.progressStatus ||
            r.progressStatus === filters.progressStatus) &&
          (!filters.syncStatus || r.syncStatus === filters.syncStatus) &&
          (!filters.from || r.planEnd >= filters.from) &&
          (!filters.to || r.planEnd <= filters.to) &&
          (!filters.query ||
            normalized(
              `${r.sku} ${r.name} ${r.spec} ${r.planId} ${r.lsxCode}`,
            ).includes(normalized(filters.query))),
      ).sort((a, b) => visibilityMode === 'all'
        ? (monday(b.week) || "").localeCompare(monday(a.week) || "")
        : (monday(a.week) || "9999").localeCompare(monday(b.week) || "9999")),
    [data.rows, filters, visibility, visibilityMode, archivedWeeks],
  );
  useEffect(() => {
    if (!highlightedId) return;
    const index = filtered.findIndex((row) => row.id === highlightedId);
    if (index >= 0) setPage(Math.floor(index / 20) + 1);
    const scrollTimer = window.setTimeout(() => {
      document
        .querySelector(".it-table tr.it-row-new")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
    const clearTimer = window.setTimeout(() => setHighlightedId(""), 10_000);
    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearTimer);
    };
  }, [highlightedId, filtered]);
  const pages = Math.max(1, Math.ceil(filtered.length / 20)),
    visible = filtered.slice(
      (Math.min(page, pages) - 1) * 20,
      Math.min(page, pages) * 20,
    ),
    picked = data.rows.filter((r) => selected.includes(r.id)),
    one = picked.length === 1 ? picked[0] : null,
    selectedHistory = one
      ? data.history.filter((item) => item.recordId === one.id)
      : [];
  const editBlockReason = inTransitEditBlockReason(picked.length, one?.syncStatus, busy, language);
  // Selection, refresh and processing completion invalidate only the diagnosis.
  useEffect(() => {
    setEditExplanation(""); feedbackTrigger.current = null;
  }, [selected, editBlockReason]);
  const groups = [...new Set(data.rows.map((r) => r.group).filter(Boolean))],
    lines = [...new Set(data.rows.map((r) => r.line).filter(Boolean))];
  const weeks = [...new Set(data.rows.map(r=>monday(r.week)||"unassigned"))].sort();
  const weekLabel = (week:string) => week === "unassigned" ? t("Chưa xác định tuần", "未指定週次") : `${t("Tuần", "週")} ${weekNumber(week)}: ${displayDate(week)} – ${displayDate(weekEnd(week))}`;
  const eligible = filtered.filter(r=>completeLsx(r) && r.status!=="HỦY");
  const selectAllRef=useRef<HTMLInputElement>(null);
  const selectedEligible=eligible.filter(r=>selected.includes(r.id)).length;
  useEffect(()=>{if(selectAllRef.current)selectAllRef.current.indeterminate=selectedEligible>0&&selectedEligible<eligible.length;},[selectedEligible,eligible.length]);
  const syncLock=useRef(false);
  async function syncSelected() {
    if(syncLock.current || busy)return;
    const rows=picked.filter(r=>completeLsx(r)&&r.status!=="HỦY");
    if(!rows.length)return;
    syncLock.current=true;setBusy(true);setError("");setNotice("");
    const failed: string[]=[];const succeeded:string[]=[];
    try {for(let offset=0;offset<rows.length;offset+=100){const batch=rows.slice(offset,offset+100);
      try {const response=await globalThis.fetch('/api/in-transit',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'sync-many',rows:batch.map(row=>({id:row.id,expectedRevision:row.revision??null}))})});
        const result=await response.json();if(!response.ok)throw Error(result.error||'Không đồng bộ được');
        for(const row of batch){const outcome=result.results?.find((item:any)=>item.id===row.id);if(outcome?.ok)succeeded.push(row.id);else failed.push(`${row.lsxCode||row.planId}: ${friendlyError(outcome?.error||'Không có kết quả đồng bộ')}`);}
      }catch(e){failed.push(...batch.map(row=>`${row.lsxCode||row.planId}: ${e instanceof Error?e.message:String(e)}`));}
    }
      if(succeeded.length)announceDataChange('in_transit');
      await load(true);setSelected(current=>current.filter(id=>!succeeded.includes(id)));
      const summary=t(`Đã đồng bộ ${succeeded.length}/${rows.length} dòng.`,`已同步 ${succeeded.length}/${rows.length} 筆。`);
      if(failed.length)setError(`${summary} ${failed.join(' · ')}`);else setNotice(summary);
    } finally {syncLock.current=false;setBusy(false);}
  }
  const historyRows = selectedHistory;
  const actionLabel = (action: string) =>
    ({
      "add-lsx": t("Tạo thêm LSX", "新增生產工單"),
      "add-unplanned": t("Thêm lệnh phát sinh", "新增臨時生產工單"),
      update: t("Chỉnh sửa", "編輯"),
      cancel: t("Hủy", "取消"),
      delete: t("Xóa", "刪除"),
      sync: t("Đồng bộ", "同步"),
    })[action] || action;
  const fieldLabel = (field: string) =>
    auditFieldLabels[field] ? t(...auditFieldLabels[field]) : field;
  const historySummary = (entry: Audit, side: "before" | "after"): string[] => {
    const changes = entry.changes || [];
    if (entry.action === "update")
      return changes
        .filter((change: any) => auditFieldLabels[change.field])
        .map(
          (change: any) => `${fieldLabel(change.field)}: ${fmt(change[side])}`,
        );
    if (["add-lsx", "add-unplanned"].includes(entry.action))
      return side === "before"
        ? []
        : [
            `Plan ID: ${fmt(entry.planId)}`,
            entry.lsxCode ? `Mã LSX: ${fmt(entry.lsxCode)}` : "",
          ].filter(Boolean);
    if (entry.action === "delete")
      return side === "before"
        ? [`Plan ID: ${fmt(entry.planId)}`]
        : [t("Đã xóa khỏi danh sách", "已從清單刪除")];
    const fieldsByAction: Record<string, string[]> = {
      cancel: ["status", "cancelReason"],
      sync: ["syncStatus"],
    };
    const relevant = changes.filter((change: any) =>
      (fieldsByAction[entry.action] || []).includes(change.field),
    );
    return relevant.map(
      (change: any) => `${fieldLabel(change.field)}: ${fmt(change[side])}`,
    );
  };
  const skuMatches = useMemo(
    () =>
      catalog
        .filter(
          (s) =>
            !s._deleted &&
            ["Đã xác nhận", "ĐÃ XÁC NHẬN"].includes(
              s.confirmation_status || s.confirmationStatus || s.status,
            ) &&
            normalized(s.usage_status || s.usageStatus || "Đang sử dụng") ===
              "DANG SU DUNG" &&
            normalized(s.code).includes(normalized(skuQuery)),
        )
        .slice(0, 20),
    [catalog, skuQuery],
  );
  const reset = () => {
    setFilters(emptyFilters);
    setSelected([]);
    setDetail(null);
    setShowHistory(false);
    setDialog("");
    setPage(1);
  };
  const setSearchValue = (value: string) => {
    setFilters({ ...emptyFilters, [searchMode]: value });
    setSelected([]);
    setPage(1);
  };
  function open(kind: typeof dialog) {
    setEditExplanation(""); feedbackTrigger.current = null;
    setError("");
    setNotice("");
    setForm(
      (kind === "edit" || kind === "add-lsx") && one
        ? {
            line: one.line,
            planStart: one.planStart,
            planEnd: one.planEnd,
            priority: one.priority,
            sequence: one.sequence ?? "",
            lsxCode: one.lsxCode,
            lsxQty: one.lsxQty ?? "",
            lsxOpenedAt: one.lsxOpenedAt,
            planningNote: kind === "edit" ? one.planningNote || "" : "",
            reason: "",
          }
        : kind === "cancel" || kind === "delete"
          ? { reason: "" }
          : {
              quantity: "",
              planStart: "",
              planEnd: "",
              line: "A",
              priority: "THƯỜNG",
              sequence: "",
            },
    );
    setSkuQuery("");
    setDialog(kind);
  }
  async function submit(action: string, payload: Record<string, any>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/in-transit", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action, ...payload,
            expectedRevision: data.rows.find((row: Row) => row.id === payload.id)?.revision ?? null }),
        }),
        result = await response.json();
      if (!response.ok) {
        const d = result.details?.[0];
        throw Error(
          result.error === "lsxExceedsPlan" && d
            ? `Plan ID ${d.planId}: Tổng số lượng LSX ${fmt(d.lsxQty)}, số lượng kế hoạch ${fmt(d.remaining)}.`
            : result.error,
        );
      }
      if (!["draft-lsx","update-note"].includes(action)) setDialog("");
      const successMessages: Record<string, [string, string]> = {
        "add-unplanned": [
          "Đã tạo lệnh phát sinh thành công.",
          "已成功建立臨時生產工單。",
        ],
        "add-lsx": [
          "Đã tạo thêm dòng LSX thành công.",
          "已成功新增工單資料列。",
        ],
        "draft-lsx": [
          "Đã lưu thông tin LSX trên dòng.",
          "已儲存此列的工單資訊。",
        ],
        "update-note": ["Đã lưu ghi chú.", "備註已儲存。"],
        update: ["Đã cập nhật dữ liệu thành công.", "資料更新成功。"],
        cancel: [
          "Đã hủy dòng dữ liệu thành công. Dữ liệu vẫn được lưu trong hệ thống.",
          "資料已成功取消，並仍保留在系統中。",
        ],
        delete: ["Đã xóa dòng dữ liệu khỏi danh sách.", "資料已從清單刪除。"],
        sync: ["Đã đồng bộ dữ liệu thành công.", "資料同步成功。"],
      };
      setNotice(
        t(
          ...(successMessages[action] || [
            "Thao tác đã hoàn thành thành công.",
            "操作成功完成。",
          ]),
        ),
      );
      if (action === "delete") {
        setSelected([]);
        setDetail(null);
        setShowHistory(false);
      }
      await load(true);
      if (["add-unplanned", "add-lsx"].includes(action) && result.row?.id) {
        setFilters(emptyFilters);
        setSelected([result.row.id]);
        setHighlightedId(result.row.id);
      }
      return result;
    } catch (e) {
      const code = e instanceof Error ? e.message : String(e);
      setError(friendlyError(code));
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function createAdditionalLsx() {
    if (!one) {
      setError(
        t(
          "Vui lòng nhấp chọn một dòng kế hoạch để tạo thêm LSX.",
          "請點選一筆計畫以新增生產工單。",
        ),
      );
      return;
    }
    open("add-lsx");
  }
  function inlineDraft(row: Row) {
    return (
      inlineDrafts[row.id] || {
        lsxCode: String(row.lsxCode || ""),
        lsxQty: row.lsxQty === null ? "" : String(row.lsxQty || ""),
        lsxOpenedAt: String(row.lsxOpenedAt || ""),
      }
    );
  }
  function updateInlineDraft(row: Row, field: string, value: string) {
    setInlineDrafts((current) => ({
      ...current,
      [row.id]: { ...inlineDraft(row), ...current[row.id], [field]: value },
    }));
  }
  async function saveInlineDraft(row: Row, field: string, value: string) {
    const draft = { ...inlineDraft(row), [field]: value };
    setInlineDrafts((current) => ({ ...current, [row.id]: draft }));
    if (!draft.lsxCode.trim() || !draft.lsxQty || !draft.lsxOpenedAt) return;
    const unchanged =
      draft.lsxCode === String(row.lsxCode || "") &&
      draft.lsxQty === String(row.lsxQty ?? "") &&
      draft.lsxOpenedAt === String(row.lsxOpenedAt || "");
    if (unchanged) return;
    const result = await submit("draft-lsx", {
      id: row.id,
      changes: draft,
    });
    if (result)
      setInlineDrafts((current) => {
        const next = { ...current };
        delete next[row.id];
        return next;
      });
  }
  function onFormSubmit(e: FormEvent) {
    e.preventDefault();
    if (dialog === "edit") {
      const { reason, ...changes } = form;
      void submit("update", { id: one!.id, changes, reason });
    } else if (dialog === "add-lsx")
      void submit("add-lsx", {
        id: one!.id,
        planStart: form.planStart,
        planEnd: form.planEnd,
        line: form.line,
        priority: form.priority,
        sequence: form.sequence,
        planningNote: form.planningNote || "",
      });
    else if (dialog === "cancel")
      void submit("cancel", { id: one!.id, reason: form.reason });
    else if (dialog === "delete")
      void submit("delete", { id: one!.id, reason: form.reason });
    else if (dialog === "unplanned")
      void submit("add-unplanned", {
        sku: form.sku,
        quantity: form.quantity,
        planStart: form.planStart,
        planEnd: form.planEnd,
        line: form.line,
        priority: form.priority,
        sequence: form.sequence,
        planningNote: form.planningNote || "",
      });
  }
  function exportExcel(
    rows: Row[] = filtered,
    filename = "In-Transit",
    sheetName = "In Transit",
  ) {
    setError("");
    setNotice("");
    try {
      const cols = [
        "group",
        "sku",
        "name",
        "line",
        "lsxCode",
        "planQty",
        "lsxQty",
        "completedQty",
        "pendingReportQty",
        "inTransitQty",
        "progress",
        "planEnd",
        "status",
        "progressStatus",
        "syncStatus",
        "planningNote",
        "planId",
      ];
      const escape = (s: any) =>
        String(s ?? "")
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;");
      const xml = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="${escape(sheetName)}"><Table>${[cols, ...rows.map((r) => cols.map((c) => ["status", "progressStatus", "syncStatus"].includes(c) ? businessLabel(r[c]) : r[c]))].map((row) => `<Row>${row.map((v) => `<Cell><Data ss:Type="String">${escape(v)}</Data></Cell>`).join("")}</Row>`).join("")}</Table></Worksheet></Workbook>`;
      const u = URL.createObjectURL(
          new Blob([xml], { type: "application/vnd.ms-excel" }),
        ),
        a = document.createElement("a");
      a.href = u;
      a.download = `${filename}.xml`;
      a.click();
      URL.revokeObjectURL(u);
      setNotice(t("Đã xuất dữ liệu thành công.", "資料匯出成功。"));
    } catch {
      setError(
        t(
          "Không thể xuất dữ liệu. Vui lòng thử lại.",
          "無法匯出資料，請重試。",
        ),
      );
    }
  }
  const fields = (row: Row): [string, [string, unknown, InTransitDisplayField][]][] =>
    [
      [
        t("Thông tin bổ sung", "補充資訊"),
        [
          [t("Đơn vị tính", "單位"), row.unit, "unit"],
          [t("Lý do hủy", "取消原因"), row.cancelReason, "cancelReason"],
          [t("Mã dòng kế hoạch", "計畫資料列代碼"), row.planRowId, "planRowId"],
        ],
      ],
      [
        t("Theo dõi sản xuất thực tế", "實際生產追蹤"),
        [
          [
            t("Ngày bắt đầu thực tế", "實際開始日"),
            displayDate(row.actualStartedAt),
            "actualStartedAt",
          ],
          [
            t("Ngày hoàn thành thực tế", "實際完成日"),
            displayDate(row.actualCompletedAt),
            "actualCompletedAt",
          ],
          [t("Lý do trễ", "延遲原因"), row.delayReason, "delayReason"],
        ],
      ],
      [
        t("Leadtime", "前置時間"),
        [
          [t("Leadtime chuẩn", "標準前置時間"), row.standardLeadtime, "standardLeadtime"],
          [t("Leadtime thực tế", "實際前置時間"), row.actualLeadtime, "actualLeadtime"],
          [t("Chênh lệch Leadtime", "前置時間差異"), row.leadtimeVariance, "leadtimeVariance"],
          [t("Số ngày trễ", "延遲天數"), row.delayDays, "delayDays"],
        ],
      ],
      [
        t("Đồng bộ và cập nhật", "同步與更新"),
        [
          [t("Số lần cập nhật KHSX", "計畫更新次數"), row.planningUpdateCount, "planningUpdateCount"],
          [t("Ngày cập nhật KHSX", "計畫更新時間"), dt(row.planningUpdatedAt), "planningUpdatedAt"],
          [t("Người cập nhật KHSX", "計畫更新人"), row.planningUpdatedBy, "planningUpdatedBy"],
          [t("Số lần nhận từ SX", "接收生產次數"), row.productionReceiveCount, "productionReceiveCount"],
          [t("Nhận từ SX gần nhất", "最近接收生產時間"), dt(row.productionReceivedAt), "productionReceivedAt"],
          [t("Lỗi đồng bộ", "同步錯誤"), row.syncError, "syncError"],
        ],
      ],
    ];
  const initialPlanningFields = (
    <div className="it-form-grid it-initial-planning-fields">
      <label>
        {t("Ngày dự kiến bắt đầu", "預計開始日")} *
        <input
          required
          type="date"
          value={form.planStart || ""}
          onChange={(e) => setForm({ ...form, planStart: e.target.value })}
        />
      </label>
      <label>
        {t("Ngày dự kiến hoàn thành", "預計完成日")} *
        <input
          required
          type="date"
          min={form.planStart || undefined}
          value={form.planEnd || ""}
          onChange={(e) => setForm({ ...form, planEnd: e.target.value })}
        />
      </label>
      <label>
        Line *
        <select
          required
          value={form.line || ""}
          onChange={(e) => setForm({ ...form, line: e.target.value })}
        >
          {[...new Set([form.line, "A", "B", "C"].filter(Boolean))].map(
            (line) => (
              <option key={line} value={line}>
                {line}
              </option>
            ),
          )}
        </select>
      </label>
      <label>
        {t("Ưu tiên KHSX", "計畫優先級")} *
        <select
          required
          value={form.priority || ""}
          onChange={(e) => setForm({ ...form, priority: e.target.value })}
        >
          {["GẤP", "THƯỜNG", "THƯỜNG - GỐI ĐẦU"].map((priority) => (
            <option key={priority} value={priority}>
              {businessLabel(priority)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("Thứ tự sản xuất", "生產順序")} *
        <input
          required
          type="number"
          min="1"
          step="1"
          value={form.sequence || ""}
          onChange={(e) => setForm({ ...form, sequence: e.target.value })}
        />
      </label>
    </div>
  );
  return (
    <main data-report-auto-preview="false"
      className="workspace pp-workspace it-workspace"
      data-own-language="true"
    >
      {historyImport&&<TransitHistoryImport rows={data.rows} history={data.history} close={()=>setHistoryImport(false)} saved={(week,message)=>{setHistoryImport(false);setFilters({...emptyFilters,week});setPage(1);setNotice(message);invalidateInTransitCache();void load(true);}}/>}
      <StandardToolbar name="InTransit" items={[toolbar.group([toolbar.group([toolbar.action({"onClick": () => open("unplanned")},<>＋ {t("Thêm lệnh PS", "新增臨時生產工單")}</>, true, "action"),
toolbar.action({"disabled": busy,"onClick": () => void createAdditionalLsx()},<>＋ {t("Tạo thêm LSX", "新增生產工單")}</>, true, "action"),
toolbar.action({disabled: !one || one.syncStatus === "CHƯA ĐỒNG BỘ" || busy,
  disabledExplanation: editBlockReason,
  onDisabledAttempt: explainBlockedEdit,
  onClick: () => { if (one && one.syncStatus !== "CHƯA ĐỒNG BỘ" && !busy) open("edit"); }},<>✎ {t("Chỉnh sửa", "編輯")}</>, true, "action"),
toolbar.action({"disabled": !one || one.status === "HỦY" || busy,"onClick": () => open("cancel")},<>⊘ {t("Hủy", "取消")}</>, true, "action"),
toolbar.action({"disabled": !one || busy,"onClick": () => open("delete")},<>⌫ {t("Xóa", "刪除")}</>, true, "action"),
toolbar.action({"onClick": () => setShowSearch((v) => !v)},<>⌕ {t("Tra cứu", "搜尋")}</>, true, "lookup"),
toolbar.field('',[toolbar.select({'aria-label':t('Hiển thị','顯示'),value:visibilityMode,onChange:e=>{setVisibilityMode(e.target.value);setSelected([]);setPage(1);}},<><option value="active">{t('Đang xử lý','處理中')}</option><option value="hidden">{t('Đã ẩn','已隱藏')}</option><option value="all">{t('Tất cả','全部')}</option></>)]),
toolbar.action({"onClick": () => { setVisibilityDraft(structuredClone(visibility)); setShowHideRows(true); },"aria-expanded": showHideRows},<>{t("Ẩn / Hiện theo tuần", "依週隱藏 / 顯示")}{Object.values(visibility).some(v=>v.completed===false||v.cancelled===false) ? " ✓" : ""}</>, true, "action"),
toolbar.action({disabled: busy || !picked.some(row=>completeLsx(row)&&row.status!=="HỦY"), disabledExplanation: busy ? "Đang xử lý. Vui lòng chờ hoàn tất rồi thử lại." : "Chọn ít nhất một LSX đầy đủ và chưa hủy để đồng bộ.", onClick:()=>void syncSelected()},<>↻ {t("Đồng bộ", "同步")} ({picked.filter(row=>completeLsx(row)&&row.status!=="HỦY").length})</>,true,"action"),
toolbar.action({"disabled": !one,"onClick": () => setShowHistory(true)},<>◷ {t("Nhật ký", "變更紀錄")}</>, true, "action"),
]),
showSearch && (
            toolbar.group([toolbar.field(<><span>{t("TRA THEO", "搜尋欄位")}</span></>,[toolbar.select({"value": searchMode,"onChange": (e) => {
                    setSearchMode(e.target.value as keyof typeof emptyFilters);
                    setFilters(emptyFilters);
                  }},<><option value="query">SKU / Tên / Plan ID / LSX</option><option value="week">{t("Tuần kế hoạch", "計畫週次")}</option><option value="group">{t("Nhóm sản phẩm", "產品組")}</option><option value="line">Line</option><option value="source">{t("Nguồn lệnh", "工單來源")}</option><option value="priority">
                    {t("Ưu tiên KHSX", "計畫優先級")}
                  </option><option value="orderStatus">
                    {t("Trạng thái LSX", "工單狀態")}
                  </option><option value="progressStatus">
                    {t("Trạng thái tiến độ", "進度狀態")}
                  </option><option value="syncStatus">
                    {t("Trạng thái đồng bộ", "同步狀態")}
                  </option><option value="from">
                    {t("Hoàn thành từ ngày", "完成日起")}
                  </option><option value="to">
                    {t("Hoàn thành đến ngày", "完成日至")}
                  </option></>)]),
toolbar.field(<><span>{t("NỘI DUNG TRA", "搜尋內容")}</span></>,[searchMode === "week" ||
                searchMode === "from" ||
                searchMode === "to" ? (
                  toolbar.input({"type": "date","value": filters[searchMode],"onChange": (e) => setSearchValue(e.target.value)})
                ) : searchMode === "group" ||
                  searchMode === "line" ||
                  searchMode === "source" ||
                  searchMode === "priority" ||
                  searchMode === "orderStatus" ||
                  searchMode === "progressStatus" ||
                  searchMode === "syncStatus" ? (
                  toolbar.select({"value": filters[searchMode],"onChange": (e) => setSearchValue(e.target.value)},<><option value="">{t("Tất cả", "全部")}</option>{(searchMode === "group"
                      ? groups
                      : searchMode === "line"
                        ? lines
                        : searchMode === "source"
                          ? [
                              "Kế hoạch tuần",
                              "Demand Event",
                              "Phát sinh đột xuất",
                            ]
                          : searchMode === "priority"
                            ? ["GẤP", "THƯỜNG", "THƯỜNG - GỐI ĐẦU"]
                            : searchMode === "orderStatus"
                              ? ["CHƯA MỞ LSX", "ĐÃ MỞ LSX", "HỦY"]
                              : searchMode === "progressStatus"
                                ? [
                                    "CHƯA SẢN XUẤT",
                                    "ĐANG SẢN XUẤT",
                                    "ĐANG TẠM NGƯNG",
                                    "TẠM DỪNG SỰ CỐ",
                                    "HT SỚM",
                                    "HT ĐÚNG TIẾN ĐỘ",
                                    "HT TRỄ TIẾN ĐỘ",
                                  ]
                                : [
                                    "CHƯA ĐỒNG BỘ",
                                    "ĐÃ ĐỒNG BỘ",
                                    "CÓ THAY ĐỔI",
                                    "LỖI ĐỒNG BỘ",
                                  ]
                    ).map((x) => (
                      <option key={x} value={x}>
                        {searchMode === "source" || searchMode === "priority" || searchMode === "progressStatus" || searchMode === "orderStatus" || searchMode === "syncStatus"
                          ? businessLabel(x)
                          : x}
                      </option>
                    ))}</>)
                ) : (
                  toolbar.input({"value": filters.query,"onChange": (e) => setSearchValue(e.target.value),"placeholder": t("Nhập nội dung cần tra", "輸入搜尋內容")})
                )]),
toolbar.group([toolbar.action({"onClick": () => setFilters(emptyFilters)},<>{t("Xóa lọc", "清除")}</>, true, "clear"),
toolbar.action({"onClick": () => undefined},<>{t("Tìm kiếm", "搜尋")}</>, true, "search"),
toolbar.action({"onClick": () => { reset(); setShowSearch(false); }},<>{t("Quay lại", "返回")}</>, true, "back")])])
          )])]} />
      {showHideRows && (
        <div className="page-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowHideRows(false); }}>
          <section className="it-modal it-hide-rows" role="dialog" aria-modal="true" aria-labelledby="it-hide-title">
            <header><h2 id="it-hide-title">{t("Chọn dòng cần hiển thị", "選擇顯示的資料列")}</h2><FeedbackActionButton type="button" aria-label={t("Đóng", "關閉")} onClick={() => setShowHideRows(false)}>×</FeedbackActionButton></header>
            <div className="it-hide-options" style={{maxHeight:'60vh',overflow:'auto'}}>
              <p>{t("Bỏ tích để ẩn lệnh của tuần tương ứng. Lựa chọn được giữ trên trình duyệt này cho tài khoản của bạn đến khi bật lại.","取消勾選可隱藏該週資料；此瀏覽器將保留您帳號的設定。")}</p>
              <table><thead><tr><th>{t("Tuần kế hoạch","計畫週")}</th><th>{t("Hiện đã hoàn thành","顯示已完成")}</th><th>{t("Hiện đã hủy","顯示已取消")}</th></tr></thead><tbody>
                {weeks.map(week=><tr key={week}><DataCell>{weekLabel(week)}</DataCell>{(['completed','cancelled'] as const).map(kind=><DataCell key={kind}><input type="checkbox" aria-label={`${kind==='completed'?t('Hiện đã hoàn thành','顯示已完成'):t('Hiện đã hủy','顯示已取消')} · ${weekLabel(week)}`} checked={visibilityDraft[week]?.[kind]!==false} onChange={e=>setVisibilityDraft(current=>({...current,[week]:{completed:current[week]?.completed!==false,cancelled:current[week]?.cancelled!==false,[kind]:e.target.checked}}))}/></DataCell>)}</tr>)}
              </tbody></table>
            </div>
            <footer>
              <FeedbackActionButton type="button" onClick={()=>setVisibilityDraft(current=>({...current,...Object.fromEntries([...archivedWeeks].map(week=>[week,{completed:false,cancelled:false}]))}))}>{t('Chọn tất cả tuần đủ điều kiện','選取所有符合條件的週')}</FeedbackActionButton>
              <FeedbackActionButton type="button" onClick={() => {saveVisibility({});setVisibilityMode('all');}}>{t("Hiện tất cả", "顯示全部")}</FeedbackActionButton>
              <FeedbackActionButton type="button" className="primary" onClick={() => saveVisibility(visibilityDraft)}>{t("Áp dụng", "套用")}</FeedbackActionButton>
            </footer>
          </section>
        </div>
      )}
      {(feedbackError || notice) && (
        <div
          className={`it-feedback-overlay${editExplanation ? " it-feedback-explanation" : ""}`}
          onMouseDown={dismissFeedback}
        >
          <div
            className={`it-feedback ${feedbackError ? "error" : "success"}`}
            role={feedbackError ? "alert" : "status"}
            aria-live="assertive"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <span className="it-feedback-icon">{feedbackError ? "!" : "✓"}</span>
            <div>
              <b>
                {feedbackError
                  ? t("THAO TÁC KHÔNG THÀNH CÔNG", "操作失敗")
                  : t("THAO TÁC THÀNH CÔNG", "操作成功")}
              </b>
              <p>{feedbackError || notice}</p>
            </div>
            <FeedbackActionButton
              type="button"
              aria-label={t("Đóng thông báo", "關閉通知")}
              onClick={dismissFeedback}
            >
              ×
            </FeedbackActionButton>
          </div>
        </div>
      )}
      <section className="data-card it-card">
        <div className="it-table">
          <table data-no-pagination="true" data-report-source={JSON.stringify({title:t('In transit','在途'),headers:['Nhóm sản phẩm','SKU','Tên sản phẩm','Quy cách','Line','Nguồn lệnh','Ưu tiên KHSX','Thứ tự SX','SL kế hoạch','Ngày bắt đầu KH','Ngày dự kiến HT','Mã LSX','SL LSX','Ngày mở LSX','SL hoàn thành đã duyệt','SL chờ xác nhận','SL đang đi','Tiến độ','Trạng thái LSX','Trạng thái tiến độ','Đồng bộ','Ghi chú','Plan ID'],rows:filtered.map(r=>[r.group,r.sku,r.name,r.spec,r.line,businessLabel(r.source),businessLabel(r.priority),r.sequence,r.isAdditionalLsx?'':r.planQty,displayDate(r.planStart),displayDate(r.planEnd),r.lsxCode,r.lsxQty,displayDate(r.lsxOpenedAt),r.completedQty,r.pendingReportQty||0,r.inTransitQty,r.progress,businessLabel(r.status),businessLabel(r.progressStatus),businessLabel(r.syncStatus),r.planningNote,r.planId])})}>
            <thead>
              <tr>
                {[
                  "",
                  t("Nhóm sản phẩm", "產品組"),
                  "SKU",
                  t("Tên sản phẩm", "產品名稱"),
                  t("Quy cách", "規格"),
                  "Line",
                  t("Nguồn lệnh", "工單來源"),
                  t("Ưu tiên KHSX", "計畫優先級"),
                  t("Thứ tự SX", "生產順序"),
                  t("SL kế hoạch", "計畫數量"),
                  t("Ngày bắt đầu KH", "計畫開始日"),
                  t("Ngày dự kiến HT", "預計完成日"),
                  t("Mã LSX", "工單號"),
                  t("SL LSX", "工單數量"),
                  t("Ngày mở LSX", "工單開立日"),
                  t("SL hoàn thành SX", "生產完成數量"),
                  t("SL đang đi", "在製數量"),
                  t("Tiến độ", "進度"),
                  t("Trạng thái LSX", "工單狀態"),
                  t("Trạng thái tiến độ", "進度狀態"),
                  t("Đồng bộ", "同步"),
                  t("Ghi chú", "備註"),
                  "Plan ID",
                ].map((h, i) => (
                  <th key={i} className={i===3?"it-product-name":i===19?"it-progress-cell":i===21?"it-plan-id":undefined}>{i===0?<input ref={selectAllRef} type="checkbox" aria-label={t("Chọn tất cả dòng đủ điều kiện trong kết quả tra cứu", "選取所有符合條件的資料")} disabled={busy||!eligible.length} checked={eligible.length>0&&selectedEligible===eligible.length} onChange={e=>setSelected(e.target.checked?eligible.map(r=>r.id):[])} />:i===19?<>{h} <ProductionStatusLegend/></>:h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((r, index) => (
                <Fragment key={r.id}>
                  {(index === 0 || monday(visible[index - 1].week) !== monday(r.week)) && (
                    <tr className="it-week-divider">
                      <th colSpan={23}>
                        <span>
                          {language === "en" ? "PLAN WEEK" : t("TUẦN KẾ HOẠCH", "計畫週")}{weekNumber(r.week) !== null ? ` ${weekNumber(r.week)}` : ""}:
                          {" "}{monday(r.week)
                            ? `${displayDate(monday(r.week))} – ${displayDate(weekEnd(r.week))}`
                            : language === "en" ? "Unassigned" : t("Chưa xác định", "尚未指定")}
                        </span>
                      </th>
                    </tr>
                  )}
                <tr
                  className={`${selected.includes(r.id) ? "selected " : ""}${highlightedId === r.id ? "it-row-new " : ""}${r.progressStatus === "TẠM DỪNG SỰ CỐ" ? "incident" : ""}`}
                  onClick={() => setSelected([r.id])}
                  onDoubleClick={() => setDetail(r)}
                >
                  <DataCell>
                    <input
                      type="checkbox"
                      aria-label={`Select ${r.planId} ${r.lsxCode || r.id}`}
                      disabled={busy}
                      checked={selected.includes(r.id)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        setSelected(current=>e.target.checked ? [...new Set([...current,r.id])] : current.filter(id=>id!==r.id))
                      }
                    />
                  </DataCell>
                  <DataCell kind="code">{fmt(r.group)}</DataCell>
                  <DataCell kind="code">
                    <b>{fmt(r.sku)}</b>
                  </DataCell>
                  <DataCell kind="text" className="it-product-name">{fmt(r.name)}</DataCell>
                  <DataCell kind="text">{fmt(r.spec)}</DataCell>
                  <DataCell kind="code" className="center">{fmt(r.line)}</DataCell>
                  <DataCell className="it-compact-meta">{businessLabel(r.source)}</DataCell>
                  <DataCell className="center">{businessLabel(r.priority)}</DataCell>
                  <DataCell kind="number" className="num">{fmt(r.sequence)}</DataCell>
                  <DataCell kind="number" className="num">
                    {r.isAdditionalLsx ? "—" : fmt(r.planQty)}
                  </DataCell>
                  <DataCell kind="date" className="center">{displayDate(r.planStart)}</DataCell>
                  <DataCell kind="date" className="center">{displayDate(r.planEnd)}</DataCell>
                  <DataCell kind="code">
                    {r.syncStatus === "CHƯA ĐỒNG BỘ" ? (
                      <input
                        className="it-inline-input code"
                        aria-label={`${t("Mã LSX", "工單號")} ${r.planId}`}
                        value={inlineDraft(r).lsxCode}
                        disabled={busy}
                        onFocus={() => setSelected([r.id])}
                        onClick={(event) => event.stopPropagation()}
                        onDoubleClick={(event) => event.stopPropagation()}
                        onChange={(event) =>
                          updateInlineDraft(r, "lsxCode", event.target.value)
                        }
                        onBlur={(event) =>
                          void saveInlineDraft(r, "lsxCode", event.target.value)
                        }
                      />
                    ) : (
                      fmt(r.lsxCode)
                    )}
                  </DataCell>
                  <DataCell kind="number" className="num">
                    {r.syncStatus === "CHƯA ĐỒNG BỘ" ? (
                      <input
                        className="it-inline-input quantity"
                        type="number"
                        min="0.0001"
                        step="any"
                        aria-label={`${t("Số lượng LSX", "工單數量")} ${r.planId}`}
                        value={inlineDraft(r).lsxQty}
                        disabled={busy}
                        onFocus={() => setSelected([r.id])}
                        onClick={(event) => event.stopPropagation()}
                        onDoubleClick={(event) => event.stopPropagation()}
                        onChange={(event) =>
                          updateInlineDraft(r, "lsxQty", event.target.value)
                        }
                        onBlur={(event) =>
                          void saveInlineDraft(r, "lsxQty", event.target.value)
                        }
                      />
                    ) : (
                      fmt(r.lsxQty)
                    )}
                  </DataCell>
                  <DataCell kind="date" className="center">
                    {r.syncStatus === "CHƯA ĐỒNG BỘ" ? (
                      <input
                        className="it-inline-input date"
                        type="date"
                        aria-label={`${t("Ngày mở LSX", "工單開立日")} ${r.planId}`}
                        value={inlineDraft(r).lsxOpenedAt}
                        disabled={busy}
                        onFocus={() => setSelected([r.id])}
                        onClick={(event) => event.stopPropagation()}
                        onDoubleClick={(event) => event.stopPropagation()}
                        onChange={(event) =>
                          updateInlineDraft(
                            r,
                            "lsxOpenedAt",
                            event.target.value,
                          )
                        }
                        onBlur={(event) =>
                          void saveInlineDraft(
                            r,
                            "lsxOpenedAt",
                            event.target.value,
                          )
                        }
                      />
                    ) : (
                      displayDate(r.lsxOpenedAt)
                    )}
                  </DataCell>
                  <DataCell kind="number" className="num"><QuantityProgress value={Number(r.completedQty||0)+Number(r.pendingReportQty||0)} total={Number(r.lsxQty)} approved={Number(r.completedQty||0)} pending={Number(r.pendingReportQty||0)}/></DataCell>
                  <DataCell kind="number" className="num">{fmt(r.inTransitQty)}</DataCell>
                  <DataCell className="center">
                    {r.progress === null
                      ? "—"
                      : `${(r.progress * 100).toFixed(1)}%`}
                  </DataCell>
                  <DataCell className="center it-compact-meta">
                    <span className={badge(r.status)}>{businessLabel(r.status)}</span>
                  </DataCell>
                  <DataCell className="center it-compact-meta it-progress-cell">
                    <span className={`onspa-progress onspa-progress-${r.status!=="HỦY" && !r.actualCompletedAt && Number(r.inTransitQty)>0 && r.planEnd && r.planEnd<new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Ho_Chi_Minh"}) ? "overdue" : productionProgressDisplay(r.progressStatus)?.tone || "waiting"}`}>
                      {businessLabel(r.progressStatus)}
                    </span>
                  </DataCell>
                  <DataCell className="center it-compact-meta">
                    <span className={badge(r.syncStatus)}>
                      {businessLabel(r.syncStatus)}
                    </span>
                  </DataCell>
                  <DataCell className="order-planning-note"><textarea key={`${r.id}:${r.revision}`} aria-label={`${t("Ghi chú", "備註")} ${r.lsxCode || r.planId}`} defaultValue={r.planningNote || ""} maxLength={2000} rows={2} disabled={busy || r.status==="HỦY"} placeholder={t("Nhập ghi chú…", "輸入備註…")} onClick={e=>e.stopPropagation()} onDoubleClick={e=>e.stopPropagation()} onBlur={e=>{if(e.target.value.trim()!==String(r.planningNote||""))void submit("update-note",{id:r.id,planningNote:e.target.value});}}/></DataCell>
                  <DataCell kind="code" className="it-plan-id">{fmt(r.planId)}</DataCell>
                </tr>
                </Fragment>
              ))}
              {!visible.length && (
                <tr data-no-data="true">
                  <DataCell colSpan={23} className="pp-empty">
                    {busy
                      ? t("Đang tải dữ liệu…", "正在載入資料…")
                      : t("Chưa có dữ liệu phù hợp.", "沒有符合條件的資料。")}
                  </DataCell>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <ManualPagination total={filtered.length} page={Math.min(page,pages)} pageSize={20} onPageChange={setPage}/>
      </section>
      {detail && (
        <div className="page-overlay" onClick={() => setDetail(null)}>
          <aside
            className="it-drawer"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <header>
              <div>
                <h2>
                  {detail.sku} · {detail.name}
                </h2>
                <p>
                  {detail.planId} ·{" "}
                  {detail.lsxCode || t("Chưa mở LSX", "尚未開立工單")}
                </p>
              </div>
              <FeedbackActionButton onClick={() => setDetail(null)}>×</FeedbackActionButton>
            </header>
            <div className="it-drawer-scroll">
              {fields(detail).map(([title, items]) => (
                <section key={title}>
                  <h3>{title}</h3>
                  <table className="it-detail-table">
                    <tbody>
                      {items.map(([label, value, field]) => (
                        <tr key={label}>
                          <th>{label}</th>
                          <DataCell kind={inTransitCellKind(field)}>{fmt(value)}</DataCell>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              ))}
            </div>
          </aside>
        </div>
      )}
      {showHistory && one && (
        <div className="page-overlay" onClick={() => setShowHistory(false)}>
          <aside
            className="it-drawer it-history"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <header>
              <div>
                <h2>{t("Nhật ký thay đổi", "變更紀錄")}</h2>
                <p>
                  {one.planId} ·{" "}
                  {one.lsxCode || t("Chưa mở LSX", "尚未開立工單")}
                </p>
              </div>
              <FeedbackActionButton onClick={() => setShowHistory(false)}>×</FeedbackActionButton>
            </header>
            <div className="it-drawer-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{t("Thời gian", "時間")}</th>
                    <th>{t("Nội dung thay đổi", "變更內容")}</th>
                    <th>{t("Giá trị trước", "變更前")}</th>
                    <th>{t("Giá trị sau", "變更後")}</th>
                    <th>{t("Lý do", "原因")}</th>
                    <th>{t("Người thay đổi", "變更人")}</th>
                  </tr>
                </thead>
                <tbody>
                  {historyRows.map((entry) => (
                    <tr key={entry.id}>
                      <DataCell kind="date">{dt(entry.at)}</DataCell>
                      <DataCell>
                        <b>{actionLabel(entry.action)}</b>
                      </DataCell>
                      <DataCell>
                        <div className="it-history-values">
                          {historySummary(entry, "before").map((value) => (
                            <div key={value}>{value}</div>
                          ))}
                          {!historySummary(entry, "before").length && "—"}
                        </div>
                      </DataCell>
                      <DataCell>
                        <div className="it-history-values">
                          {historySummary(entry, "after").map((value) => (
                            <div key={value}>{value}</div>
                          ))}
                          {!historySummary(entry, "after").length && "—"}
                        </div>
                      </DataCell>
                      <DataCell kind="text">{fmt(entry.reason)}</DataCell>
                      <DataCell kind="text">{fmt(entry.actor)}</DataCell>
                    </tr>
                  ))}
                  {!historyRows.length && (
                    <tr data-no-data="true">
                      <DataCell className="pp-empty" colSpan={6}>
                        {t(
                          "Dòng này chưa có thay đổi nào được ghi nhận.",
                          "此資料尚無變更紀錄。",
                        )}
                      </DataCell>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </aside>
        </div>
      )}
      {dialog && (
        <div className="page-overlay">
          <form onInvalid={notifyInvalidAction}
            className="it-modal"
            onSubmit={onFormSubmit}
            onInvalidCapture={() =>
              setError(
                t(
                  "Vui lòng nhập đầy đủ các trường bắt buộc trước khi lưu.",
                  "儲存前請完整填寫必填欄位。",
                ),
              )
            }
          >
            <header>
              <h2>
                {dialog === "unplanned"
                  ? t("THÊM LỆNH PHÁT SINH", "新增臨時生產工單")
                  : dialog === "add-lsx"
                    ? t("TẠO THÊM LSX", "新增生產工單")
                  : dialog === "cancel"
                    ? t("HỦY DÒNG IN TRANSIT", "取消在途資料")
                    : dialog === "delete"
                      ? t("XÓA DÒNG IN TRANSIT", "刪除在途資料")
                      : t("CHỈNH SỬA IN TRANSIT", "編輯在途資料")}
              </h2>
              <FeedbackActionButton type="button" onClick={() => setDialog("")}>
                ×
              </FeedbackActionButton>
            </header>
            {dialog === "unplanned" && (
              <>
                <fieldset>
                  <legend>{t("Tra tìm sản phẩm", "搜尋產品")}</legend>
                  <label>
                    SKU *
                    <input
                      required
                      autoFocus
                      value={skuQuery}
                      onChange={(e) => {
                        setSkuQuery(e.target.value);
                        setForm({
                          quantity: form.quantity || "",
                          planStart: form.planStart || "",
                          planEnd: form.planEnd || "",
                          line: form.line || "A",
                          priority: form.priority || "THƯỜNG",
                          sequence: form.sequence || "",
                        });
                      }}
                    />
                  </label>
                  {skuQuery && !form.sku && (
                    <div className="it-sku-results">
                      {skuMatches.map((s) => (
                        <FeedbackActionButton
                          type="button"
                          key={s.code}
                          onClick={() => {
                            setForm({
                              ...form,
                              sku: s.code,
                              group: s.group,
                              name: s.name || s.productName,
                              spec: s.specification || s.spec,
                              unit: s.unit,
                              line: s.line,
                            });
                            setSkuQuery(s.code);
                          }}
                        >
                          <b>{s.code}</b>
                          <span>{s.name || s.productName || "—"}</span>
                          <span>{s.specification || s.spec || "—"}</span>
                        </FeedbackActionButton>
                      ))}
                    </div>
                  )}
                  <dl className="it-readonly">
                    {[
                      [t("Nhóm sản phẩm", "產品組"), form.group],
                      ["SKU", form.sku],
                      [t("Tên sản phẩm", "產品名稱"), form.name],
                      [t("Quy cách", "規格"), form.spec],
                      [t("Đơn vị tính", "單位"), form.unit],
                      ["Line", form.line],
                    ].map(([k, v]) => (
                      <div key={String(k)}>
                        <dt>{k}</dt>
                        <dd>{fmt(v)}</dd>
                      </div>
                    ))}
                  </dl>
                </fieldset>
                <fieldset>
                  <legend>
                    {t("Thông tin lệnh phát sinh", "臨時工單資訊")}
                  </legend>
                  <div className="it-form-grid">
                    <label>
                      {t("Số lượng kế hoạch", "計畫數量")} *
                      <input
                        required
                        type="number"
                        min="0.0001"
                        step="any"
                        value={form.quantity || ""}
                        onChange={(e) =>
                          setForm({ ...form, quantity: e.target.value })
                        }
                      />
                    </label>
                    {initialPlanningFields}
                    <dl className="it-readonly wide">
                      <div>
                        <dt>{t("Nguồn lệnh", "工單來源")}</dt>
                        <dd>{t("Phát sinh đột xuất", "臨時新增")}</dd>
                      </div>
                      <div>
                        <dt>Plan ID</dt>
                        <dd>
                          {t("Tự tạo theo ngày phát sinh", "依發生日自動建立")}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </fieldset>
              </>
            )}
            {dialog === "add-lsx" && one && (
              <fieldset>
                <legend>
                  {one.planId} · {one.sku} · {one.name}
                </legend>
                <p>
                  {t(
                    "Nhập thông tin kế hoạch ban đầu cho dòng LSX mới. Thao tác này không được tính là chỉnh sửa.",
                    "請輸入新工單列的初始計畫資訊，此操作不計入修改次數。",
                  )}
                </p>
                {initialPlanningFields}
              </fieldset>
            )}
            {["unplanned","add-lsx","edit"].includes(dialog)&&<label className="wide">{t("Ghi chú (không bắt buộc)", "備註（選填）")}<textarea maxLength={2000} rows={2} value={form.planningNote||""} onChange={e=>setForm({...form,planningNote:e.target.value})}/></label>}
            {dialog === "edit" && one && (
              <fieldset>
                <legend>
                  {one.planId} ·{" "}
                  {one.lsxCode || t("Chưa mở LSX", "尚未開立工單")}
                </legend>
                <div className="it-form-grid">
                  {[
                    [
                      "planStart",
                      t("Ngày bắt đầu kế hoạch", "計畫開始日"),
                      "date",
                    ],
                    [
                      "planEnd",
                      t("Ngày dự kiến hoàn thành", "預計完成日"),
                      "date",
                    ],
                    ["lsxQty", t("Số lượng LSX", "工單數量"), "number"],
                    ["lsxCode", t("Mã LSX", "工單號"), "text"],
                    ["lsxOpenedAt", t("Ngày mở LSX", "工單開立日"), "date"],
                  ].map(([k, l, type]) => (
                    <label key={k}>
                      {l}
                      <input
                        type={type}
                        step={type === "number" ? "any" : undefined}
                        value={form[k] || ""}
                        onChange={(e) =>
                          setForm({ ...form, [k]: e.target.value })
                        }
                      />
                    </label>
                  ))}
                  <label>
                    Line
                    <select
                      value={form.line || ""}
                      onChange={(e) =>
                        setForm({ ...form, line: e.target.value })
                      }
                    >
                      {["A", "B", "C"].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t("Ưu tiên KHSX", "計畫優先級")}
                    <select
                      value={form.priority || ""}
                      onChange={(e) =>
                        setForm({ ...form, priority: e.target.value })
                      }
                    >
                      {["GẤP", "THƯỜNG", "THƯỜNG - GỐI ĐẦU"].map((x) => (
                        <option key={x} value={x}>
                          {businessLabel(x)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t("Thứ tự sản xuất", "生產順序")}
                    <input
                      type="number"
                      min="1"
                      value={form.sequence || ""}
                      onChange={(e) =>
                        setForm({ ...form, sequence: e.target.value })
                      }
                    />
                  </label>
                </div>
                <label className="it-edit-reason">
                  {t("Lý do chỉnh sửa", "修改原因")} *
                  <textarea
                    required
                    value={form.reason || ""}
                    onChange={(e) =>
                      setForm({ ...form, reason: e.target.value })
                    }
                  />
                </label>
              </fieldset>
            )}
            {dialog === "cancel" && one && (
              <fieldset>
                <legend>
                  {one.planId} ·{" "}
                  {one.lsxCode || t("Chưa mở LSX", "尚未開立工單")}
                </legend>
                <p>
                  {t(
                    "Dòng dữ liệu vẫn được giữ lại và chỉ chuyển trạng thái sang HỦY.",
                    "資料將保留，僅將狀態改為取消。",
                  )}
                </p>
                <label>
                  {t("Lý do hủy", "取消原因")} *
                  <textarea
                    required
                    autoFocus
                    value={form.reason || ""}
                    onChange={(e) =>
                      setForm({ ...form, reason: e.target.value })
                    }
                  />
                </label>
              </fieldset>
            )}
            {dialog === "delete" && one && (
              <fieldset>
                <legend>
                  {one.planId} · {one.sku} ·{" "}
                  {one.lsxCode || t("Chưa mở LSX", "尚未開立工單")}
                </legend>
                <p>
                  {t(
                    "Dòng sẽ được xóa khỏi danh sách In Transit. Nhật ký thao tác vẫn được giữ lại để kiểm tra.",
                    "此資料將從在途清單刪除，但操作紀錄仍會保留以供查核。",
                  )}
                </p>
                <label>
                  {t("Lý do xóa", "刪除原因")} *
                  <textarea
                    required
                    autoFocus
                    value={form.reason || ""}
                    onChange={(e) =>
                      setForm({ ...form, reason: e.target.value })
                    }
                  />
                </label>
              </fieldset>
            )}
            <footer>
              <FeedbackActionButton type="button" onClick={() => setDialog("")}>
                {t("Hủy", "取消")}
              </FeedbackActionButton>
              <FeedbackActionButton className="primary" disabled={busy} disabledExplanation={"Đang xử lý. Vui lòng chờ hoàn tất rồi thử lại."} type="submit">
                {t("Lưu", "儲存")}
              </FeedbackActionButton>
            </footer>
          </form>
        </div>
      )}

    </main>
  );
}
