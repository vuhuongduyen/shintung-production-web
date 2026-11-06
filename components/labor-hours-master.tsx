"use client";
import {notifyInvalidAction} from '../lib/action-feedback';
import {FeedbackActionButton} from './action-feedback';
import {ManualPagination} from './onspa-ui/ManualPagination';
import {PageTitle} from './onspa-ui/PageTitle';
import {DataTable} from './onspa-ui/DataTable';
import {DataCell} from './onspa-ui/DataCell';
import { apiFetch as fetch } from "../lib/data-sync";
import { useDataRefresh } from "../lib/data-sync";
import { StandardToolbar, toolbar } from "./standard-toolbar/StandardToolbar";
import { UiLabel } from "./standard-toolbar/UiLabel";
import { useEffect, useMemo, useState } from "react";
import { usableSku } from "../lib/sku-state.mjs";
import { invalidateLaborPlanCache } from "./production-plan";

import {useMasterCancellation} from "./basic-master-cancel";
import {isMasterCancelled,newestMasterFirst} from "../lib/basic-master.mjs";
import LaborHoursImport from './labor-hours-import';

type MasterSku = {
  code: string;
  name: string;
  specification: string;
  group: string;
  line: string;
  status: string;
};
type LaborRecord = {
  cancelled?:boolean;
  retainedLaborHour?:number;
  status?:string;
  sku: string;
  laborHour: number;
  note: string;
  source: string;
  version: number;
  configuredAt?: string;
  updatedAt?: string;
  updatedBy?: string;
};
type LaborHistory = {
  id: string;
  sku: string;
  version: number;
  oldLaborHour: number | null;
  newLaborHour: number;
  oldNote: string;
  newNote: string;
  reason: string;
  actor: string;
  at: string;
  source: string;
};
type ApiRecord<T> = {
  key: string;
  payload: T;
  updatedBy?: string;
  updatedAt?: string;
};

const norm = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Ho_Chi_Minh",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});
const formatTime = (value?: string) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : timeFormatter.format(d).replace(",", "");
};
const formatDate = (value?: string) => formatTime(value).split(" ")[0];
const formatHour = (value: number) => Number(value || 0).toFixed(3);
const PAGE_SIZE = 25;
let laborRecordsCache: LaborRecord[] | null = null;
let laborRecordsRequest: Promise<LaborRecord[]> | null = null;

async function fetchLaborRecords(force = false) {
  if (laborRecordsCache && !force) return laborRecordsCache;
  if (laborRecordsRequest) return laborRecordsRequest;
  laborRecordsRequest = fetch("/api/records?entity=labor_hours", {
    cache: "no-store",
  })
    .then(async (response) => {
      if (!response.ok) throw Error();
      const data = await response.json();
      laborRecordsCache = data.records.map((r: ApiRecord<LaborRecord>) => ({
        ...r.payload,
        updatedBy: r.payload.updatedBy || r.updatedBy,
        updatedAt: r.payload.updatedAt || r.updatedAt,
      }));
      return laborRecordsCache!;
    })
    .finally(() => {
      laborRecordsRequest = null;
    });
  return laborRecordsRequest;
}

export const preloadLaborHours = () => fetchLaborRecords();

export default function LaborHoursMaster({
  masterSkus,
  operator,
  language,
  onListReset,
}: {
  masterSkus: MasterSku[];
  operator: string;
  language: "vi" | "zh" | "en";
  onListReset: () => void;
}) {
  const dataRevision = useDataRefresh(['labor_hours']);
  const [records, setRecords] = useState<LaborRecord[]>(
      () => laborRecordsCache || [],
    ),
    [history, setHistory] = useState<LaborHistory[]>([]),
    [selected, setSelected] = useState(""),
    [panel, setPanel] = useState<
      "create" | "edit" | "search" | "history" | "detail" | null
    >(null),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(!laborRecordsCache),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [importOpen,setImportOpen] = useState(false);
  const [query, setQuery] = useState(""),
    [searchField, setSearchField] = useState<
      "sku" | "name" | "specification" | "group" | "line" | "createDate"
    >("sku"),
    [formSku, setFormSku] = useState(""),
    [hour, setHour] = useState("0.000"),
    [effectiveFrom,setEffectiveFrom]=useState(""),
    [note, setNote] = useState(""),
    [reason, setReason] = useState(""),
    [source, setSource] = useState<"PDF" | "Nhập trực tiếp">("Nhập trực tiếp"),
    [dirty, setDirty] = useState(false),
    [discardIntent, setDiscardIntent] = useState<"close" | "list" | null>(null),
    [detail, setDetail] = useState<LaborHistory | null>(null);
  const cancellation=useMasterCancellation(()=>{setSelected("");setNotice("Đã Hủy Giờ công. Dữ liệu được giữ lại và ngừng áp dụng.");invalidateLaborPlanCache();});
  const masterMap = useMemo(
    () => new Map(masterSkus.map((s) => [s.code.toUpperCase(), s])),
    [masterSkus],
  );
  const selectedRecord = records.find((r) => r.sku === selected),
    selectedMaster = masterMap.get(formSku.toUpperCase());
  const message = (vi: string, zh: string) => (language === "zh" ? zh : vi);
  const validateFormSku = (skuValue: string) => {
    const sku = skuValue.trim().toUpperCase(),
      master = masterMap.get(sku);
    if (!master)
      return message(
        "SKU không tồn tại trong SKU Master. Không thể thêm Giờ công.",
        "SKU 不存在於 SKU Master，無法新增工時。",
      );
    if (!usableSku(master))
      return message(
        `SKU ${sku} chưa được xác nhận hoặc không ở trạng thái Đang sử dụng.`,
        `SKU ${sku} 尚未確認或未在使用中。`,
      );
    if (panel === "create" && records.some((r) => r.sku === sku))
      return message(
        `SKU ${sku} đã có Giờ công/SP, không thể thêm mới. Vui lòng chọn dòng và dùng chức năng Sửa.`,
        `SKU ${sku} 已有每件工時，不能重複新增。請選取該列後使用「編輯」。`,
      );
    return "";
  };
  const load = async (force = false) => {
    setLoading(!records.length);
    try {
      setRecords(await fetchLaborRecords(force));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    let active = true;
    fetchLaborRecords(dataRevision > 0)
      .then((data) => {
        if (active) {
          setRecords(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setLoading(false);
          setError("Không thể tải dữ liệu Giờ công.");
        }
      });
    return () => {
      active = false;
    };
  }, [dataRevision]);
  const rows = useMemo(
    () =>
      records
        .filter((r) => masterMap.has(r.sku))
        .filter((r) => {
          const master = masterMap.get(r.sku)!;
          const target = searchField === "sku" ? r.sku : searchField === "createDate" ? "" : master[searchField];
          return searchField === "createDate" || !query || norm(target).includes(norm(query));
        })
        .sort(
          (a, b) =>
            newestMasterFirst(a,b) || a.sku.localeCompare(b.sku),
        ),
    [records, masterMap, query, searchField],
  );
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE)),
    safePage = Math.min(page, pages),
    visibleRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  useEffect(() => {
    setPage(1);
  }, [query, searchField]);
  const finishCloseForm = () => {
    setPanel(null);
    setDirty(false);
    setDiscardIntent(null);
    setError("");
  };
  const closeForm = () => {
    if (dirty) {
      setDiscardIntent("close");
      return;
    }
    finishCloseForm();
  };
  const finishReturnToList = () => {
    setPanel(null);
    setSelected("");
    setQuery("");
    setSearchField("sku");
    setDirty(false);
    setDiscardIntent(null);
    setError("");
    setDetail(null);
    onListReset();
  };
  const returnToList = () => {
    if ((panel === "create" || panel === "edit") && dirty) {
      setDiscardIntent("list");
      return;
    }
    finishReturnToList();
  };
  const confirmDiscard = () => {
    if (discardIntent === "list") finishReturnToList();
    else if (discardIntent === "close") finishCloseForm();
  };
  const openForm = (mode: "create" | "edit") => {
    if (mode === "edit" && !selectedRecord) {
      setError("Hãy chọn đúng một dòng để sửa.");
      return;
    }
    setPanel(mode);
    setEffectiveFrom(new Date(Date.now()+25200000).toISOString().slice(0,10));
    setFormSku(mode === "edit" ? selectedRecord!.sku : "");
    setHour(mode === "edit" ? formatHour(selectedRecord!.laborHour) : "0.000");
    setNote(mode === "edit" ? selectedRecord!.note || "" : "");
    setReason("");
    setSource(
      mode === "edit"
        ? selectedRecord!.source === "PDF"
          ? "PDF"
          : "Nhập trực tiếp"
        : "Nhập trực tiếp",
    );
    setDirty(false);
    setDiscardIntent(null);
    setError("");
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const sku = formSku.trim().toUpperCase(),
      value = Number(hour),
      skuError = validateFormSku(sku);
    if (skuError) {
      setError(skuError);
      return;
    }
    if (!Number.isFinite(value) || value < 0) {
      setError(
        message("Giờ công/SP phải là số không âm.", "每件工時必須為非負數。"),
      );
      return;
    }
    if (panel === "edit" && !reason.trim()) {
      setError(message("Vui lòng nhập lý do thay đổi.", "請輸入變更原因。"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/labor-hours", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: panel,
          sku,
          laborHour: value,
          effectiveFrom,
          expectedVersion: panel === "edit" ? selectedRecord?.version : 0,
          note,
          reason,
          source,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw Error(
          data.error ||
            message("Không thể lưu Giờ công/SP.", "無法儲存每件工時。"),
        );
      await load(true);
      invalidateLaborPlanCache();
      setPanel(null);
      setSelected(sku);
      setDirty(false);
      setNotice(
        message(
          `Đã lưu ${sku}: ${formatHour(value)} giờ/sản phẩm.`,
          `已儲存 ${sku}：${formatHour(value)} 小時/件。`,
        ),
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : message("Không thể lưu Giờ công/SP.", "無法儲存每件工時。"),
      );
    } finally {
      setBusy(false);
    }
  };
  const openHistory = async () => {
    if (!selected) {
      setError("Hãy chọn đúng một dòng để xem lịch sử.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/records?entity=labor_hours_history&sku=${encodeURIComponent(selected)}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw Error();
      const data = await response.json();
      setHistory(data.records.map((r: ApiRecord<LaborHistory>) => r.payload));
      setPanel("history");
    } catch {
      setError("Không thể tải lịch sử Giờ công.");
    } finally {
      setBusy(false);
    }
  };
  if(importOpen)return <main className="workspace labor-hours-workspace"><LaborHoursImport masterSkus={masterSkus} onClose={()=>setImportOpen(false)} onSaved={async()=>{await load(true);invalidateLaborPlanCache();}}/></main>;
  return (
    <main className="workspace labor-hours-workspace">
      <div className="safety-rules-title">
        <PageTitle variant="menu-root" title="Labor Hours / 工時">Giờ công</PageTitle>
      </div>
      {cancellation.dialog}
      <StandardToolbar name="LaborHoursMaster" items={[toolbar.group([toolbar.group([toolbar.action({"onClick": () => openForm("create")},<>＋ Thêm mới</>, true, "action"),
toolbar.action({disabled:busy,onClick:()=>setImportOpen(true)},"Cập nhật Giờ công",true,"action"),
toolbar.action({"disabled": !selected || isMasterCancelled(selectedRecord),"onClick": () => openForm("edit")},<>✎ Sửa
            </>, true, "action"),
toolbar.action({disabled:!selectedRecord||isMasterCancelled(selectedRecord)||cancellation.busy, disabledExplanation: cancellation.busy ? "Đang xử lý. Vui lòng chờ hoàn tất rồi thử lại." : !selectedRecord ? "Chỉ chọn một dòng phù hợp để thực hiện thao tác." : "Bản ghi này đã hủy.",onClick:()=>selectedRecord&&cancellation.open({entity:"labor_hours",key:selectedRecord.sku,label:"Giờ công",version:selectedRecord.version})},"Hủy",true,"action"),
toolbar.action({"onClick": () => setPanel(panel === "search" ? null : "search")},<>⌕ Tra cứu
            </>, true, "lookup"),
toolbar.action({"disabled": !selected || busy,"onClick": openHistory},<>◷ Lịch sử
            </>, true, "action"),
panel !== "history" && toolbar.action({"onClick": returnToList},<>← Quay lại danh sách
            </>, true, "back")]),
panel === "search" && (
            toolbar.group([toolbar.field(<><span>TRA THEO</span></>,[toolbar.select({"value": searchField,"onChange": (e) => {
                    setSearchField(e.target.value as typeof searchField);
                    setQuery("");
                  }},<><option value="sku">SKU</option><option value="name">Tên sản phẩm</option><option value="specification">Quy cách</option><option value="group">Nhóm sản phẩm</option><option value="line">Line/Công đoạn</option><option value="createDate">Create - date</option></>)]),
toolbar.field(<><span>NỘI DUNG TRA</span></>,[(searchField==='createDate' ? toolbar.input({value:'Thêm/sửa gần nhất',readOnly:true}) : ['group','line'].includes(searchField) ? toolbar.select({value:query,onChange:e=>setQuery(e.target.value)},<><option value="">Tất cả</option>{Array.from(new Set(masterSkus.map(s=>searchField==='group'?s.group:s.line))).filter(Boolean).sort().map(value=><option key={value} value={value}>{value}</option>)}</>) : toolbar.input({"value": query,"onChange": (e) => setQuery(e.target.value),"placeholder": "Nhập nội dung cần tra"}))]),
toolbar.group([toolbar.action({"onClick": () => setQuery("")},<>Xóa lọc</>, true, "clear"),
toolbar.action({"onClick": () => undefined},<>Tìm kiếm
                </>, true, "search")])])
          )])]} />
      {(notice || (error && panel !== "create" && panel !== "edit")) && (
        <div
          className={`save-notice master-save-notice ${error ? "leadtime-error" : ""}`}
        >
          <span>{error || notice}</span>
          <FeedbackActionButton
            onClick={() => {
              setError("");
              setNotice("");
            }}
          >
            Đóng
          </FeedbackActionButton>
        </div>
      )}
      <section className="data-card labor-hours-card master-standard-card">
        <div className="result-bar">
          <span>
            {loading
              ? "Đang tải dữ liệu…"
              : "Nhấp một lần để chọn; nhấp đúp để mở chi tiết"}
          </span>
        </div>
        <DataTable className="table-wrap">
          <table data-no-pagination="true">
            <thead>
              <tr>
                <th>NHÓM SẢN PHẨM</th>
                <th>SKU</th>
                <th>TÊN SẢN PHẨM</th>
                <th>QUY CÁCH</th>
                <th>LINE/CÔNG ĐOẠN</th>
                <th>GIỜ CÔNG/SP</th>
                <th>GHI CHÚ</th>
                <th>NGƯỜI CẬP NHẬT</th>
                <th>THỜI GIAN CẬP NHẬT</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r) => {
                const m = masterMap.get(r.sku)!;
                return (
                  <tr
                    key={r.sku}
                    className={selected === r.sku ? "selected" : ""}
                    onClick={() => {
                      setSelected(r.sku);
                      setError("");
                    }}
                    onDoubleClick={() => {
                      setSelected(r.sku);
                      setPanel("detail");
                    }}
                  >
                    <DataCell kind="code">
                      <span className="tag">{m.group}</span>
                    </DataCell>
                    <DataCell kind="code">
                      <FeedbackActionButton
                        className="sku-link"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected(r.sku);
                          setError("");
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setSelected(r.sku);
                          setPanel("detail");
                        }}
                      >
                        {r.sku}
                      </FeedbackActionButton>
                    </DataCell>
                    <DataCell className="product-name">{m.name}</DataCell>
                    <DataCell>{m.specification}</DataCell>
                    <DataCell kind="code">{m.line}</DataCell>
                    <DataCell kind="number" className="number">
                      <b>{formatHour(r.retainedLaborHour ?? r.laborHour)}</b>{isMasterCancelled(r)&&<span className="tag">Đã hủy</span>}
                    </DataCell>
                    <DataCell>{r.note || "—"}</DataCell>
                    <DataCell>{r.updatedBy || "PDF_IMPORT"}</DataCell>
                    <DataCell>{formatTime(r.updatedAt || r.configuredAt)}</DataCell>
                  </tr>
                );
              })}
              {!loading && !visibleRows.length && (
                <tr data-no-data="true">
                  <DataCell colSpan={9}>Không có dữ liệu phù hợp.</DataCell>
                </tr>
              )}
            </tbody>
          </table>
        </DataTable>
        <ManualPagination total={rows.length} page={safePage} pageSize={PAGE_SIZE} onPageChange={setPage}/>
      </section>
      {(panel === "create" || panel === "edit") && (
        <>
          <FeedbackActionButton className="overlay" aria-label="Đóng" onClick={closeForm} />
          <section
            className="labor-hours-modal"
            role="dialog"
            aria-modal="true"
          >
            <header>
              <div>
                <p>GIỜ CÔNG TIÊU CHUẨN</p>
                <h2>{panel === "create" ? "Thêm mới" : "Sửa"} Giờ công/SP</h2>
              </div>
              <FeedbackActionButton onClick={closeForm}>×</FeedbackActionButton>
            </header>
            <form onInvalid={notifyInvalidAction}
              onSubmit={save}
              onChangeCapture={() => {
                setDirty(true);
                setDiscardIntent(null);
              }}
            >
              <div className="leadtime-form-grid">
                <fieldset>
                  <legend>Thông tin sản phẩm</legend>
                  <label><span>Ngày hiệu lực *</span><input required type="date" value={effectiveFrom} onChange={e=>setEffectiveFrom(e.target.value)}/></label><p>Chỉ nhập ngày có căn cứ áp dụng. Phiếu sản lượng đã ghi giữ nguyên định mức đã lưu; không tự hồi tố lịch sử thiếu.</p>
                  <label>
                    <span>SKU *</span>
                    <input
                      list="labor-sku-options"
                      value={formSku}
                      readOnly={panel === "edit"}
                      onChange={(e) => {
                        setFormSku(e.target.value.toUpperCase());
                        setError("");
                      }}
                      onBlur={() => {
                        if (formSku.trim()) setError(validateFormSku(formSku));
                      }}
                      placeholder="Chỉ nhập mã SKU"
                      required
                    />
                  </label>
                  <datalist id="labor-sku-options">
                    {masterSkus
                      .filter(
                        (s) =>
                          usableSku(s) &&
                          (!records.some((r) => r.sku === s.code) ||
                            s.code === formSku),
                      )
                      .map((s) => (
                        <option key={s.code} value={s.code}>
                          {s.name} · {s.specification}
                        </option>
                      ))}
                  </datalist>
                  <div className="leadtime-readonly-grid">
                    <label>
                      <span>Tên sản phẩm</span>
                      <input readOnly value={selectedMaster?.name || ""} />
                    </label>
                    <label>
                      <span>Quy cách</span>
                      <input
                        readOnly
                        value={selectedMaster?.specification || ""}
                      />
                    </label>
                    <label>
                      <span>Nhóm sản phẩm</span>
                      <input readOnly value={selectedMaster?.group || ""} />
                    </label>
                    <label>
                      <span>Line/Công đoạn</span>
                      <input readOnly value={selectedMaster?.line || ""} />
                    </label>
                  </div>
                </fieldset>
                <fieldset>
                  <legend>Thông tin giờ công</legend>
                  <label>
                    <span>Giờ công/SP *</span>
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      value={hour}
                      onChange={(e) => setHour(e.target.value)}
                      required
                    />
                  </label>
                  <label>
                    <span>Đơn vị</span>
                    <input readOnly value="giờ/sản phẩm" />
                  </label>
                  <label>
                    <span>Ghi chú</span>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </label>
                  {panel === "edit" && (
                    <label>
                      <span>Lý do thay đổi *</span>
                      <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        required
                      />
                    </label>
                  )}
                  <label>
                    <span>Nguồn dữ liệu</span>
                    <select
                      value={source}
                      onChange={(e) =>
                        setSource(e.target.value as typeof source)
                      }
                    >
                      <option>Nhập trực tiếp</option>
                      <option>PDF</option>
                    </select>
                  </label>
                  <label>
                    <span>Ngày thiết lập</span>
                    <input
                      readOnly
                      value={formatDate(
                        selectedRecord?.configuredAt ||
                          new Date().toISOString(),
                      )}
                    />
                  </label>
                  <label>
                    <span>Người cập nhật</span>
                    <input readOnly value={operator} />
                  </label>
                  <label>
                    <span>Thời gian cập nhật</span>
                    <input
                      readOnly
                      value={formatTime(new Date().toISOString())}
                    />
                  </label>
                </fieldset>
              </div>
              {error && (
                <div
                  className="leadtime-form-alert error"
                  role="alert"
                  aria-live="assertive"
                >
                  {error}
                </div>
              )}
              {discardIntent && (
                <div
                  className="form-discard-confirm"
                  role="alertdialog"
                  aria-live="assertive"
                >
                  <span>
                    {message(
                      "Dữ liệu chưa lưu sẽ bị mất. Bạn có muốn thoát không?",
                      "尚未儲存的資料將會遺失。確定要離開嗎？",
                    )}
                  </span>
                  <div className="form-discard-actions">
                    <FeedbackActionButton
                      type="button"
                      onClick={() => setDiscardIntent(null)}
                    >
                      {message("Không", "否")}
                    </FeedbackActionButton>
                    <FeedbackActionButton
                      type="button"
                      className="confirm-discard"
                      onClick={confirmDiscard}
                    >
                      {message("Có", "是")}
                    </FeedbackActionButton>
                  </div>
                </div>
              )}
              <div className="function-actions">
                <FeedbackActionButton
                  type="button"
                  className="ghost-button"
                  onClick={closeForm}
                >
                  Hủy
                </FeedbackActionButton>
                <FeedbackActionButton className="primary-button" disabled={busy} disabledExplanation={"Đang xử lý. Vui lòng chờ hoàn tất rồi thử lại."}>
                  {busy ? "Đang lưu…" : "Lưu"}
                </FeedbackActionButton>
              </div>
            </form>
          </section>
        </>
      )}
      {panel === "history" && (
        <>
          <FeedbackActionButton
            className="overlay"
            aria-label="Đóng lịch sử"
            onClick={() => setPanel(null)}
          />
          <aside className="detail-panel labor-history-panel">
            <div className="detail-header">
              <div>
                <p>LỊCH SỬ GIỜ CÔNG</p>
                <h2>{selected}</h2>
                <span>{masterMap.get(selected)?.name}</span>
              </div>
              <FeedbackActionButton onClick={() => setPanel(null)}>×</FeedbackActionButton>
            </div>
            <div className="detail-scroll">
              <FeedbackActionButton className="outline-button" onClick={returnToList}>
                <UiLabel>Quay lại</UiLabel>
              </FeedbackActionButton>
              <DataTable className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>PHIÊN BẢN</th>
                      <th>NHÓM SẢN PHẨM</th>
                      <th>TÊN SẢN PHẨM</th>
                      <th>GIỜ CŨ</th>
                      <th>GIỜ MỚI</th>
                      <th>LÝ DO</th>
                      <th>NGƯỜI THAY ĐỔI</th>
                      <th>THỜI GIAN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.id} onClick={() => setDetail(h)}>
                        <DataCell kind="code">V{h.version}</DataCell>
                        <DataCell kind="code">{masterMap.get(h.sku)?.group || "—"}</DataCell>
                        <DataCell>{masterMap.get(h.sku)?.name || "—"}</DataCell>
                        <DataCell>
                          {h.oldLaborHour === null
                            ? "—"
                            : formatHour(h.oldLaborHour)}
                        </DataCell>
                        <DataCell>{formatHour(h.newLaborHour)}</DataCell>
                        <DataCell>{h.reason}</DataCell>
                        <DataCell>{h.actor}</DataCell>
                        <DataCell>{formatTime(h.at)}</DataCell>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DataTable>
              {detail && (
                <section className="labor-history-detail">
                  <h3>Chi tiết trước và sau</h3>
                  <dl>
                    <div>
                      <dt>SKU</dt>
                      <dd>{detail.sku}</dd>
                    </div>
                    <div>
                      <dt>Nhóm sản phẩm</dt>
                      <dd>{masterMap.get(detail.sku)?.group || "—"}</dd>
                    </div>
                    <div>
                      <dt>Tên sản phẩm</dt>
                      <dd>{masterMap.get(detail.sku)?.name || "—"}</dd>
                    </div>
                    <div>
                      <dt>Nguồn</dt>
                      <dd>{detail.source}</dd>
                    </div>
                    <div>
                      <dt>Giờ công cũ</dt>
                      <dd>
                        {detail.oldLaborHour === null
                          ? "—"
                          : formatHour(detail.oldLaborHour)}
                      </dd>
                    </div>
                    <div>
                      <dt>Giờ công mới</dt>
                      <dd>{formatHour(detail.newLaborHour)}</dd>
                    </div>
                    <div>
                      <dt>Ghi chú cũ</dt>
                      <dd>{detail.oldNote || "—"}</dd>
                    </div>
                    <div>
                      <dt>Ghi chú mới</dt>
                      <dd>{detail.newNote || "—"}</dd>
                    </div>
                  </dl>
                </section>
              )}
            </div>
          </aside>
        </>
      )}
      {panel === "detail" && selectedRecord && (
        <>
          <FeedbackActionButton
            className="overlay"
            aria-label="Đóng chi tiết"
            onClick={() => setPanel(null)}
          />
          <aside
            className="detail-panel labor-detail-panel"
            onDoubleClick={() => setPanel(null)}
          >
            <div className="detail-header">
              <div>
                <p>CHI TIẾT GIỜ CÔNG</p>
                <h2>{selected}</h2>
                <span>{masterMap.get(selected)?.name}</span>
              </div>
              <FeedbackActionButton onClick={() => setPanel(null)}>×</FeedbackActionButton>
            </div>
            <div className="detail-scroll">
              <section>
                <h3>Thông tin đang áp dụng</h3>
                <dl>
                  <div>
                    <dt>Nhóm sản phẩm</dt>
                    <dd>{masterMap.get(selected)?.group}</dd>
                  </div>
                  <div>
                    <dt>Quy cách</dt>
                    <dd>{masterMap.get(selected)?.specification}</dd>
                  </div>
                  <div>
                    <dt>Line/Công đoạn</dt>
                    <dd>{masterMap.get(selected)?.line}</dd>
                  </div>
                  <div>
                    <dt>Giờ công/SP</dt>
                    <dd>{formatHour(selectedRecord.retainedLaborHour ?? selectedRecord.laborHour)} giờ/sản phẩm</dd>
                  </div>
                  <div>
                    <dt>Ghi chú</dt>
                    <dd>{selectedRecord.note || "—"}</dd>
                  </div>
                  <div>
                    <dt>Nguồn</dt>
                    <dd>{selectedRecord.source}</dd>
                  </div>
                </dl>
              </section>
            </div>
          </aside>
        </>
      )}
    </main>
  );
}
