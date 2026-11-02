"use client";
import {requestPlanWithCapacityConfirmation} from '../lib/plan-capacity-confirmation.mjs';
import ProductionPlanRules from './production-plan-rules';
import {remainingPlanWithTransitSummary} from '../lib/plan-transit-backlog.mjs';
import {PlanTransitBacklogDetail,type TransitBacklogRow} from './plan-transit-backlog';
import PlanDailyLoadWarning, {type DailyLoadWarning} from "./plan-daily-load-warning";
import CapacityDayDetail from "./capacity-day-detail";
import {FeedbackActionButton} from './action-feedback';
import {actionFeedbackVersion, isCancelledAction, mutationFailureMessage, notifyActionFailure} from '../lib/action-feedback';
import {ManualPagination} from './onspa-ui/ManualPagination';
import {DataCell} from './onspa-ui/DataCell';
import {productionDisplayTime} from '../lib/production-display-time.mjs';
import {planningHours} from '../lib/planning-display.mjs';
import { apiFetch as fetch } from "../lib/data-sync";
import { useDataRefresh, WorkspaceActivityContext, clientSessionGeneration, ClientSessionReadCancelled, subscribeClientReadInvalidation } from "../lib/data-sync";
import { invalidateInTransitCache } from "./in-transit";
import PlanningFeedback from "./planning-feedback";
import CapacityConfirmPanel from "./capacity-confirm-panel";
import { StandardToolbar, toolbar } from "./standard-toolbar/StandardToolbar";
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { monday, weekEnd, weekNumber, displayDate, normalizeRow, rowWarnings, remainingPlanSummary, sortedRows, normalized, rebasePlanEdits, plannedLaborHours } from '../lib/production-plan.mjs';
type Row = ReturnType<typeof normalizeRow> & {
    _deleted?: boolean;
    planRowId?: string;
    [key: string]: any;
};
type Snapshot = {
    key: string;
    generatedAt: string;
    rows: Row[];
};
type Audit = {
    id: string;
    action: string;
    at: string;
    actor: string;
    reason: string;
    before: Row[];
    after: Row[];
    dailyCapacityOverride?: {by:string;at:string;warnings:DailyLoadWarning["warnings"]};
};
type State = {
    revision: number;
    rows: Row[];
    sources: Snapshot[];
    capacity: Record<string, unknown>[];
    transit: Row[];
    audit: Audit[];
    warnings: string[];
    canReopen: boolean;
};
const empty: State = { revision: 0, rows: [], sources: [], capacity: [], transit: [], audit: [], warnings: [], canReopen: false };
const planStateCache = new Map<string, State>();
const planRequestCache = new Map<string, Promise<State>>();
let latestPlanWeek = '';
const planCacheGeneration = new Map<string, number>();
subscribeClientReadInvalidation(reason => {
    if (reason !== 'session') return;
    planStateCache.clear();
    planRequestCache.clear();
    planCacheGeneration.clear();
    latestPlanWeek = '';
});
export function refreshTransferredPlan(week: string, data?: State) {
    if (typeof window === 'undefined') return;
    const key = monday(week);
    planCacheGeneration.set(key, (planCacheGeneration.get(key) || 0) + 1);
    planRequestCache.delete(key);
    planStateCache.delete(key);
    if (data) planStateCache.set(key, data);
    latestPlanWeek = key;
}
export function invalidateLaborPlanCache() {
    for (const key of planStateCache.keys()) {
        planCacheGeneration.set(key, (planCacheGeneration.get(key) || 0) + 1);
    }
    planStateCache.clear();
    planRequestCache.clear();
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('onspa-labor-hours-changed'));
}

async function fetchProductionPlan(week: string, refresh = false): Promise<State> {
    const browser = typeof window !== 'undefined';
    const session = clientSessionGeneration();
    const normalizedWeek = monday(week);
    if (!normalizedWeek)
        throw new Error('invalidWeek');
    if (browser && !refresh && planStateCache.has(normalizedWeek))
        return planStateCache.get(normalizedWeek)!;
    if (browser && !refresh && planRequestCache.has(normalizedWeek))
        return planRequestCache.get(normalizedWeek)!;
    const generation = planCacheGeneration.get(normalizedWeek) || 0;
    const request = fetch(`/api/production-plan?week=${normalizedWeek}`, { cache: "no-store" })
        .then(async response => {
        const data = await response.json();
        if (session !== clientSessionGeneration()) throw new ClientSessionReadCancelled();
        if (!response.ok)
            throw new Error(data.error);
        if (browser && (planCacheGeneration.get(normalizedWeek) || 0) === generation) planStateCache.set(normalizedWeek, data);
        if (browser) latestPlanWeek = normalizedWeek;
        return data;
    })
        .finally(() => { if (planRequestCache.get(normalizedWeek) === request) planRequestCache.delete(normalizedWeek); });
    if (browser) planRequestCache.set(normalizedWeek, request);
    return request;
}

export async function prefetchProductionPlan(initialWeek = '') {
    const session = clientSessionGeneration();
    let targetWeek = monday(initialWeek);
    if (!targetWeek) {
        const response = await fetch('/api/records?entity=production_engine');
        if (!response.ok)
            return;
        const data = await response.json();
        if (session !== clientSessionGeneration()) throw new ClientSessionReadCancelled();
        targetWeek = monday(data.records?.find((record: { payload?: { week?: string } }) => monday(record.payload?.week || ''))?.payload?.week || '');
    }
    if (targetWeek)
        await fetchProductionPlan(targetWeek);
}
const messages: Record<string, [
    string,
    string
]> = {
    permissionDenied: ['Tài khoản không có quyền thao tác. Liên hệ quản trị để kiểm tra quyền.', '帳號沒有操作權限，請聯絡管理員。'], requestFailed: ['Yêu cầu chưa hoàn tất. Kiểm tra kết nối và tải lại dữ liệu trước khi thử lại.', '請求未完成，請檢查連線並重新載入。'],
    skuMissing: ['Không có mã trong SKU master. Bổ sung và xác nhận SKU, rồi cập nhật Engine.', 'SKU 主檔不存在，請新增並確認後更新 Engine。'],
    skuCancelled: ['SKU đã hủy. Kiểm tra SKU master và chọn mã đang sử dụng.', 'SKU 已取消，請選用有效料號。'],
    skuInactive: ['SKU chưa sử dụng hoặc ngừng sử dụng. Kiểm tra trạng thái sử dụng tại SKU master.', 'SKU 尚未使用或已停用，請檢查主檔。'],
    skuPending: ['SKU chờ xác nhận; hãy xác nhận rồi cập nhật Engine.', 'SKU 尚未確認。'],
    deletedConflict: ['SKU có dấu xóa mềm; cần đối chiếu trước khi nhận lại.', 'SKU 已標記刪除，重新接收前請先核對。'],
    invalidWeek: ['Hãy chọn tuần hợp lệ.', '請選擇有效週次。'], conflict: ['Dữ liệu đã thay đổi. Hãy tải lại trước khi sửa tiếp.', '資料已變更，請重新載入。'], legacyConflict: ['Dữ liệu cũ có khóa/tuần trùng hoặc thiếu. Cần đối chiếu trước khi sửa.', '舊資料的鍵或週次重複／缺漏，請先核對。'], invalidLegacy: ['Có dữ liệu cũ không đọc được.', '有無法讀取的舊資料。'],
    missingEngine: ['Tuần này chưa có dữ liệu từ Production Engine. Hãy quay lại Production Engine và bấm “Cập nhật dữ liệu tuần”.', '本週尚無 Production Engine 資料，請返回 Production Engine 並按「更新週資料」。'], invalidSelection: ['Hãy chọn các dòng hợp lệ.', '請選取有效資料列。'], batchRejected: ['Không lưu dòng nào: lựa chọn có dòng không hợp lệ.', '未儲存任何資料列：選取項目含無效資料。'], invalidEngineRow: ['Thiếu SKU/SL đề xuất hoặc ưu tiên Không bổ sung.', '缺少 SKU／建議數量或不需補貨。'],
    missingRow: ['Không tìm thấy dòng.', '找不到資料列。'], locked: ['Dòng đã chốt, cần mở chốt trước.', '此列已確認，請先解除確認。'], invalidEdit: ['Giá trị chỉnh sửa không hợp lệ.', '編輯值無效。'], invalidSequence: ['Thứ tự phải là số nguyên lớn hơn 0.', '順序必須為正整數。'], dateOrder: ['Ngày hoàn thành phải từ ngày bắt đầu trở đi.', '完成日期不得早於開始日期。'], cannotClose: ['Không thể chốt: dòng chưa đủ dữ liệu hoặc sai trạng thái.', '無法確認：資料不完整或狀態不符。'], cannotTransfer: ['Chỉ chuyển dòng đã chốt và đủ dữ liệu.', '僅可轉入資料完整且已確認的列。'], reasonRequired: ['Bắt buộc nhập lý do mở chốt.', '解除確認必須填寫原因。'], reopenForbidden: ['Tài khoản không có quyền mở chốt.', '帳號沒有解除確認的權限。'], invalidStatus: ['Trạng thái không phù hợp.', '狀態不符。'], loginRequired: ['Phiên đăng nhập không hợp lệ. Hãy đăng nhập lại để lưu.', '請登入 TEST 帳號以儲存。'],
    missingSku: ['Thiếu SKU', '缺少 SKU'], missingQty: ['SL kế hoạch phải > 0', '計畫數量必須大於 0'], missingLine: ['Thiếu Line A/B/C', '缺少產線 A/B/C'], missingStart: ['Thiếu ngày sản xuất', '缺少生產日期'], missingEnd: ['Thiếu ngày hoàn thành', '缺少完成日期'], missingWeek: ['Thiếu tuần', '缺少週次'], missingLabor: ['Thiếu GIO_CONG theo SKU', '缺少 SKU 工時資料'],
    'DỰ KIẾN': ['Dự kiến', '預計'], 'ĐÃ CHỐT': ['Đã chốt', '已確認'], 'ĐÃ CHUYỂN': ['Đã chuyển In Transit', '已轉入在途'], 'TẠM HOÃN': ['Tạm hoãn', '暫停'], 'HỦY': ['Hủy', '取消'], 'TUẦN CHÍNH': ['Tuần chính', '主週'], 'GỐI ĐẦU': ['Gối đầu', '銜接計畫'], 'GẤP': ['Gấp', '緊急'], 'THƯỜNG': ['Thường', '一般'], 'THƯỜNG - GỐI ĐẦU': ['Thường - Gối đầu', '一般－銜接'],
    capacityUnconfirmed: ['Chưa xác nhận Capacity cho tuần/Line này. SX cần xác nhận trước khi chốt kế hoạch.', '本週產線產能尚未確認，請先確認產能。'],
    capacityChanged: ['Capacity vừa thay đổi. Kiểm tra lại trước khi chốt.', '產能已變更，請重新檢查。'],
    alreadyTransferred: ['Đơn đã chuyển In transit, không được mở chốt. Hãy xử lý hủy tại In transit.', '訂單已轉入在途，不可解除確認。請至在途處理取消。'],
    receive: ['Nhận / đồng bộ Engine', '接收／同步 Engine'], save: ['Lưu chỉnh sửa', '儲存編輯'], close: ['Chốt kế hoạch', '確認計畫'], reopen: ['Mở chốt', '解除確認'], transfer: ['Chuyển In Transit', '轉入在途'],
};
export function formatPlanningFailure(result: {error?:string;details?:Array<{id?:string;sku?:string;reason?:string}>}, rows: Array<{id:string;sku?:string;name?:string}> = [], language='vi', status?:number) {
 const translate=(code:string)=>messages[code]?.[language==='zh'?1:0] || code;
 const fallback=status===401?'loginRequired':status===403?'permissionDenied':status===409?'conflict':'requestFailed';
 const code=result.error || fallback;
 const advice=language==='zh'?'請依以上原因修正所選資料後重試；若資料已變更，請先重新載入。':'Hãy xử lý các dòng được nêu ở trên rồi thử lại. Nếu dữ liệu đã thay đổi, hãy tải lại trước khi chuyển.';
 const details=(Array.isArray(result.details)?result.details:[]).map(item=>{
  const row=rows.find(r=>r.id===item.id);
  const label=item.sku || row?.sku || item.id || 'Dòng dữ liệu';
  return `${label}${row?.name ? ' · '+row.name : ''}: ${String(item.reason || code).split(',').map(c=>translate(c.trim())).join('; ')}`;
 });
 return [translate(code),...details,...(details.length?[advice]:[])].join('\n');
}
export function ProductionPlan({ language = 'vi', initialWeek = '', tracking = false }: {
    language?: 'vi' | 'zh' | 'en';
    initialWeek?: string;
    tracking?: boolean;
}) {
    const workspaceActive=useContext(WorkspaceActivityContext);
    const dataRevision = useDataRefresh(['production_plan', 'capacity', 'labor_hours', 'sku']);
 const [toolbarSearchOpen,setToolbarSearchOpen]=useState(false);
 const [toolbarSearchField,setToolbarSearchField]=useState('query');

    const t = (vi: string, zh: string) => language === 'zh' ? zh : vi;
    const formatHours=(value:number|null|undefined)=>planningHours(value,language);
    const msg = (key: string) => messages[key]?.[language === 'zh' ? 1 : 0] || key;
    const session = useRef(clientSessionGeneration()).current;
    const initialPlanWeek = monday(initialWeek) || (typeof window !== 'undefined' ? latestPlanWeek : '');
    const initialState = typeof window !== 'undefined' && initialPlanWeek ? planStateCache.get(initialPlanWeek) : undefined;
    const [week, setWeek] = useState(initialPlanWeek), [state, setState] = useState<State>(initialState || empty), [rows, setRows] = useState<Row[]>(initialState?.rows || []), [selected, setSelected] = useState<string[]>([]), [edits, setEdits] = useState<Record<string, Record<string, unknown>>>({});
    const [weekReady, setWeekReady] = useState(!!initialPlanWeek);
    const pendingRef = useRef<Record<string, Record<string, unknown>>>({});
    const originalRef = useRef<Record<string, Record<string, unknown>>>({});
    const serverRowsRef = useRef<Row[]>(initialState?.rows || []);
    const revisionRef = useRef(initialState?.revision || 0);
    const savePromise = useRef<Promise<boolean> | null>(null);
    const actionPending = useRef(false);
    const [saveState, setSaveState] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'failed'>('idle');
    const [saveAttempt, setSaveAttempt] = useState(0);
    const [dailyWarning,setDailyWarning]=useState<DailyLoadWarning|null>(null);
    const [dailyCheckNote,setDailyCheckNote]=useState('');
    const dailyDecision=useRef<((yes:boolean)=>void)|null>(null);
    const decideDaily=(yes:boolean)=>{const resolve=dailyDecision.current;dailyDecision.current=null;setDailyWarning(null);resolve?.(yes);};
    useEffect(()=>()=>{dailyDecision.current?.(false);dailyDecision.current=null;},[]);
    function requestDailyDecision(value:DailyLoadWarning):Promise<boolean>{return new Promise(resolve=>{dailyDecision.current=resolve;setDailyWarning(value);});}

    const [query, setQuery] = useState(''), [line, setLine] = useState(''), [type, setType] = useState(''), [status, setStatus] = useState('active'), [page, setPage] = useState(1), [busy, setBusy] = useState(false), [loaded, setLoaded] = useState(!!initialState), [error, setError] = useState(''), [notice, setNotice] = useState('');
    const [sourceKey, setSourceKey] = useState(''), [sourceIds, setSourceIds] = useState<string[]>([]), [detail, setDetail] = useState<Row | null>(null);
    const [capacityDayLine,setCapacityDayLine]=useState<string | null>(null);
    const [showCapacity, setShowCapacity] = useState(true);
    const [rulesOpen,setRulesOpen]=useState(false);
    const [backlogLine,setBacklogLine]=useState<string|null>(null);
    const [capacityRequests,setCapacityRequests]=useState<any[]>([]),[canReviewCapacity,setCanReviewCapacity]=useState(false),[capacityConfirmOpen,setCapacityConfirmOpen]=useState(false);
    const capacityRequestGeneration = useRef(0);
    const capacityRequestsActive = useRef(false);
    const capacityRequestControllers = useRef(new Set<AbortController>());
    async function refreshCapacityRequests(explicitAttempt = false): Promise<boolean> {
        // Polling must not supersede the review the user is waiting to open.
        if (!explicitAttempt && capacityRequestControllers.current.size) return false;
        const ticket = ++capacityRequestGeneration.current;
        const feedbackBefore = actionFeedbackVersion();
        const controller = explicitAttempt ? new AbortController() : null;
        if (controller) capacityRequestControllers.current.add(controller);
        const current = () => capacityRequestsActive.current && ticket === capacityRequestGeneration.current && session === clientSessionGeneration();
        try {
            // Explicit review must revalidate, rather than opening a cached request list.
            const response = await fetch('/api/capacity?requests=1', {cache: explicitAttempt ? 'reload' : 'no-store', ...(controller ? {signal: controller.signal} : {})});
            if (!current()) return false;
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    setCanReviewCapacity(false); setCapacityRequests([]); setCapacityConfirmOpen(false);
                }
                if (explicitAttempt && actionFeedbackVersion() === feedbackBefore) notifyActionFailure(mutationFailureMessage(response.status));
                return false;
            }
            const data = await response.json();
            if (!current()) return false;
            if (!Array.isArray(data.requests)) throw new Error('Invalid capacity request list');
            setCapacityRequests(data.requests); setCanReviewCapacity(true);
            return true;
        } catch (error) {
            // Background polling and obsolete sessions must not interrupt the user.
            if (explicitAttempt && current() && !isCancelledAction(error) && actionFeedbackVersion() === feedbackBefore) {
                notifyActionFailure(language === 'en' ? 'Unable to load Capacity requests. Check your connection and try again.' : t('Không tải được yêu cầu Capacity. Kiểm tra kết nối và thử lại.', '無法載入產能申請，請檢查連線後重試。'));
            }
            return false;
        } finally {
            if (controller) capacityRequestControllers.current.delete(controller);
        }
    }
    useEffect(() => {
        if (tracking || !workspaceActive) return;
        capacityRequestsActive.current = true;
        const refresh = () => { void refreshCapacityRequests(); };
        refresh();
        const timer = window.setInterval(refresh, 15000);
        const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('onspa-capacity') : null;
        if (channel) channel.onmessage = refresh;
        window.addEventListener('focus', refresh);
        return () => {
            capacityRequestsActive.current = false; capacityRequestGeneration.current++;
            for (const controller of capacityRequestControllers.current) controller.abort();
            capacityRequestControllers.current.clear();
            clearInterval(timer); channel?.close(); window.removeEventListener('focus', refresh);
        };
    }, [tracking, workspaceActive]);
    const generation = useRef(0);
    async function load(w = week, refresh = false, keepVisible = false) { const ticket = ++generation.current; if (!keepVisible)
        setLoaded(false); const data = await fetchProductionPlan(w, refresh); if (ticket !== generation.current || session !== clientSessionGeneration())
        return; revisionRef.current = data.revision; serverRowsRef.current=data.rows; pendingRef.current = {}; originalRef.current = {}; setSaveState('idle'); setState(data); setRows(data.rows); setEdits({}); setSelected([]); setSourceKey(data.sources[0]?.key || ''); setSourceIds([]); setLoaded(true); }
    useEffect(() => { const cached = planStateCache.get(week); setSelected([]); pendingRef.current={}; originalRef.current={}; setEdits({}); setSaveState('idle'); setPage(1); setError(''); setNotice(''); setSourceIds([]); setDetail(null); if (cached) {
        revisionRef.current=cached.revision;
        serverRowsRef.current=cached.rows;
        setState(cached); setRows(cached.rows); setSourceKey(cached.sources[0]?.key || ''); setLoaded(true);
    }
    else {
        revisionRef.current=0; serverRowsRef.current=[]; setRows([]); setState(empty); setLoaded(false);
    }
    if (week)
        void load(week, true, !!cached).catch(e => setError(e.message)); return () => { generation.current++; }; }, [week]);
    useEffect(() => {
        if (!week || !workspaceActive) return;
        const refresh = () => {
            if (!Object.keys(pendingRef.current).length && !savePromise.current)
                void load(week, true, true).catch(e => setError(e.message));
        };
        if (dataRevision) refresh();
        window.addEventListener('onspa-labor-hours-changed', refresh);
        window.addEventListener('focus', refresh);
        return () => { window.removeEventListener('onspa-labor-hours-changed', refresh); window.removeEventListener('focus', refresh); };
    }, [week, dataRevision, workspaceActive]);
    useEffect(() => {
        if (!week || !workspaceActive) return;
        let active = true;
        const refresh = async () => {
            try {
                const response = await fetch(`/api/production-plan?week=${week}&capacityOnly=1`, {cache:'no-store'});
                if (!response.ok) return;
                const fresh = await response.json();
                if (active) setState(current => ({...current, capacity:fresh.capacity}));
            } catch { /* Existing data stays visible during a temporary network outage. */ }
        };
        void refresh();
        const timer = window.setInterval(refresh, 15000);
        const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('onspa-capacity'):null;
        if(channel)channel.onmessage=()=>void refresh();
        window.addEventListener('onspa-capacity-changed', refresh);
        window.addEventListener('focus', refresh);
        return () => { active=false; channel?.close(); clearInterval(timer); window.removeEventListener('onspa-capacity-changed',refresh); window.removeEventListener('focus',refresh); };
    }, [week,workspaceActive]);
    const dirty = Object.keys(edits).length > 0;
    useEffect(() => {
        const warn = (event: BeforeUnloadEvent) => { if (Object.keys(pendingRef.current).length) { event.preventDefault(); event.returnValue = ''; } };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, []);
    useEffect(() => {
        const supplied = monday(initialWeek);
        if (supplied) {
            if (!dirty && supplied !== week)
                setWeek(supplied);
            setWeekReady(true);
            return;
        }
        if (latestPlanWeek) {
            if (!dirty && latestPlanWeek !== week)
                setWeek(latestPlanWeek);
            setWeekReady(true);
            return;
        }
        let active = true;
        fetch('/api/records?entity=production_engine', { cache: 'no-store' })
            .then(async response => response.ok ? response.json() : Promise.reject(new Error(t('Không tải được tuần Engine gần nhất.', '無法載入最新 Engine 週次。'))))
            .then(data => {
            if (!active)
                return;
            const latest = monday(data.records?.find((record: { payload?: { week?: string } }) => monday(record.payload?.week || ''))?.payload?.week || '');
            if (latest)
                setWeek(latest);
        })
            .catch(e => active && setError(e instanceof Error ? e.message : String(e)))
            .finally(() => active && setWeekReady(true));
        return () => { active = false; };
    }, [initialWeek]);
    const filtered = useMemo(() => sortedRows(rows.filter(r => !r._deleted && (!line || r.line === line) && (!type || r.type === type) && (status === 'all' || (status === 'active' ? r.status !== 'ĐÃ CHUYỂN' : r.status === status)) && normalized(`${r.group} ${r.sku} ${r.name} ${r.spec}`).includes(normalized(query)))), [rows, line, type, status, query]);
    const loads = useMemo(() => remainingPlanWithTransitSummary(rows, state.capacity, week, Object.keys(pendingRef.current)).filter(s => !line || s.line === line), [rows, filtered, state.capacity, week, line]);
    const pages = Math.max(1, Math.ceil(filtered.length / 20)), visible = filtered.slice((Math.min(page, pages) - 1) * 20, Math.min(page, pages) * 20);
    const picked = filtered.filter(r => r.status !== 'ĐÃ CHUYỂN' && selected.includes(r.id));
    const displayedDetail = detail ? (tracking ? state.transit : rows).find(r => r.id === detail.id && r.sku === detail.sku) || detail : null;
    const toggle = (id: string) => setSelected(v => v.includes(id) ? v.filter(x => x !== id) : [...v, id]);
    const edit = (row: Row, key: string, value: unknown) => { setRows(v => v.map(r => r.id === row.id ? normalizeRow({ ...r, [key]: value }, week) : r)); if (!Object.prototype.hasOwnProperty.call(originalRef.current[row.id] || {},key)) { const stored=serverRowsRef.current.find(r=>r.id===row.id); originalRef.current={...originalRef.current,[row.id]:{...originalRef.current[row.id],[key]:stored?.[key]}}; } const next={...pendingRef.current,[row.id]:{...pendingRef.current[row.id],[key]:value}}; pendingRef.current=next; setEdits(next); setSaveState('pending'); setSaveAttempt(n=>n+1); };
    async function saveNow(): Promise<boolean> {
        if (savePromise.current) {
            if (!await savePromise.current) return false;
            return saveNow();
        }
        if (!Object.keys(pendingRef.current).length) return true;
        const task = (async () => {
            setSaveState('saving');
            try {
                let result: any;
                let snapshot: Record<string, Record<string, unknown>>;
                for (let attempt=0; attempt<2; attempt++) {
                    snapshot=pendingRef.current;
                    const checked=await requestPlanWithCapacityConfirmation({
                        body:{action:'save',week,revision:revisionRef.current,ids:Object.keys(snapshot),edits:snapshot},
                        send:(body:unknown)=>fetch('/api/production-plan',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),
                        decide:requestDailyDecision,isCurrent:()=>session===clientSessionGeneration()
                    });
                    if(checked.cancelled){setSaveState('pending');return false;}
                    const {response}=checked;result=checked.result;

                    if (response.ok) break;
                    if (result.error!=='conflict' || attempt===1) { setSaveState('failed'); setError(formatPlanningFailure(result, rows, language, response.status)); return false; }
                    // Cached week data or another editor may have advanced the revision.
                    // Refresh only on this conflict, retaining each locally edited cell.
                    const latest=await fetchProductionPlan(week,true);
                    const rebased=rebasePlanEdits(pendingRef.current,originalRef.current,latest.rows) as {edits:Record<string,Record<string,unknown>>;conflicts:string[]};
                    if (rebased.conflicts.length) {
                        setSaveState('failed');
                        setError(t('Dòng đã được người khác sửa hoặc chốt. Chỉnh sửa của bạn vẫn ở trên màn hình; đối chiếu trước khi tải lại: ', '資料列已被他人編輯或確認，您的變更仍留在畫面上：')+rebased.conflicts.map(id=>rows.find(row=>row.id===id)?.sku || id).join(', '));
                        return false;
                    }
                    revisionRef.current=latest.revision;
                    serverRowsRef.current=latest.rows;
                    pendingRef.current=rebased.edits;
                    originalRef.current=Object.fromEntries(Object.entries(rebased.edits).map(([id,fields])=>[id,Object.fromEntries(Object.keys(fields).map(key=>[key,latest.rows.find(row=>row.id===id)?.[key]]))]));
                    setEdits(rebased.edits);
                    setState(latest);
                    setRows(latest.rows.map(row=>normalizeRow({...row,...rebased.edits[row.id]},week)));
                    if (!Object.keys(rebased.edits).length) { setError(''); setSaveState('saved'); return true; }
                }
                const unchecked=result.dailyCapacityCheck?.notChecked||[];
                setDailyCheckNote(unchecked.length?t('Chưa kiểm tra đủ tải theo ngày vì thiếu lịch đã xác nhận hoặc giờ công: ','缺少已確認日程或工時，尚無法完整檢查每日負荷：')+unchecked.map((r:any)=>r.sku).join(', '):'');
                revisionRef.current=result.revision;
                const updates=new Map<string,Row>((result.rows || []).map((row:Row)=>[row.id,row]));
                serverRowsRef.current=serverRowsRef.current.map(row=>updates.get(row.id)||row);
                const remaining=Object.fromEntries(Object.entries(pendingRef.current).map(([id, fields])=>{
                    const notSaved=Object.fromEntries(Object.entries(fields).filter(([key,value])=>!Object.prototype.hasOwnProperty.call(snapshot[id] || {},key) || snapshot[id][key] !== value));
                    return [id,notSaved];
                }).filter(([, fields])=>Object.keys(fields).length)) as Record<string,Record<string,unknown>>;
                pendingRef.current=remaining;
                originalRef.current=Object.fromEntries(Object.entries(remaining).map(([id,fields])=>[id,Object.fromEntries(Object.keys(fields).map(key=>[key,updates.get(id)?.[key] ?? originalRef.current[id]?.[key]]))]));
                setEdits(remaining);
                setRows(current=>current.map(row=>updates.has(row.id)?normalizeRow({...updates.get(row.id)!, ...remaining[row.id]},week):row));
                setState(current=>{if(session !== clientSessionGeneration())return current;const next={...current,revision:result.revision,rows:current.rows.map(row=>updates.get(row.id)||row),audit:result.audit?[result.audit,...current.audit]:current.audit};planStateCache.set(week,next);return next;});
                setError(''); setSaveState(Object.keys(remaining).length?'pending':'saved');
                return true;
            } catch { setSaveState('failed'); setError(t('Chưa lưu được chỉnh sửa. Kiểm tra kết nối rồi bấm Thử lưu lại.', '變更尚未儲存，請檢查連線後重試。')); return false; }
        })();
        savePromise.current=task;
        try { return await task; } finally { if(savePromise.current===task) savePromise.current=null; }
    }
    useEffect(()=>{
        if(!saveAttempt || !Object.keys(pendingRef.current).length) return;
        const timer=window.setTimeout(()=>{void saveNow();},650);
        return ()=>clearTimeout(timer);
    },[saveAttempt,week]);
    const source = state.sources.find(s => s.key === sourceKey), eligible = source?.rows.filter(r => !r.skuPending && r.sku && normalized(r.priority) !== 'KHONG BO SUNG' && Number(r.suggested) > 0) || [];
    async function action(name: string, targetIds?: string[], overrideEdits?: Record<string, Record<string, unknown>>) {
        if (busy || actionPending.current) return;
        const actionIds = targetIds || picked.map(row => row.id);
        if (!actionIds.length) { setNotice(''); setError(t('Không có đơn phù hợp để thực hiện thao tác.', '沒有符合條件的訂單可供操作。')); return; }
        const canTransferSelection = () => actionIds.every(id => serverRowsRef.current.some(row => row.id === id && row.status === 'ĐÃ CHỐT'));
        if (name === 'transfer' && !canTransferSelection()) { setNotice(''); setError(msg('cannotTransfer')); return; }
        // State updates are asynchronous; latch immediately against repeat callbacks.
        actionPending.current = true;
        setBusy(true);
        setError('');
        setNotice('');
        let committed=false;
        try {
            if (!await saveNow()) return;
            if (name === 'transfer' && !canTransferSelection()) { setError(msg('cannotTransfer')); return; }
            const checked=await requestPlanWithCapacityConfirmation({
                body:{action:name,week,revision:revisionRef.current,ids:name==='receive'?sourceIds:actionIds,sourceKey,edits:overrideEdits||pendingRef.current},
                send:(body:unknown)=>fetch('/api/production-plan',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),
                decide:requestDailyDecision,isCurrent:()=>session===clientSessionGeneration()
            });
            if(checked.cancelled)return;
            const {response,result}=checked;
            if (!response.ok) {
                setError(formatPlanningFailure(result, name==='receive' ? source?.rows || [] : rows, language, response.status));
                return;
            }
            committed = true;
            revisionRef.current=result.revision;
            if (Array.isArray(result.rows)) { const updates=new Map<string,Row>(result.rows.map((row:Row)=>[row.id,row])); serverRowsRef.current=serverRowsRef.current.map(row=>updates.get(row.id)||row); }
            if (name === 'transfer') invalidateInTransitCache();
            setSelected([]);
            if (['save', 'close', 'reopen'].includes(name) && Array.isArray(result.rows)) {
                const updates = new Map<string, Row>(result.rows.map((row: Row) => [row.id, row]));
                setRows(current => current.map(row => updates.get(row.id) || row));
                setEdits(current => Object.fromEntries(Object.entries(current).filter(([id]) => !actionIds.includes(id))));
                setState(current => {
                    if (session !== clientSessionGeneration()) return current;
                    const next = { ...current, revision: result.revision, rows: current.rows.map(row => updates.get(row.id) || row), audit: result.audit ? [result.audit, ...current.audit] : current.audit };
                    planStateCache.set(week, next);
                    return next;
                });
            } else {
                await load(week, true, true);
            }
            setNotice(`${msg(name)}: ${t('thành công', '成功')}. ${t('Thêm mới', '新增')}: ${result.added ?? 0} · ${t('Đã tồn tại', '已存在')}: ${result.existing ?? 0} · ${t('Cập nhật', '更新')}: ${result.updated ?? 0}.`);
        }
        catch (e) {
            setError(committed ? t('Máy chủ đã nhận thao tác nhưng chưa tải lại được kết quả. Hãy tải lại dữ liệu để đối chiếu trước khi chuyển lại.', '伺服器已接受操作，但無法重新載入結果。請先重新載入確認，再決定是否重試。') : t('Chưa xác nhận được kết quả do lỗi kết nối hoặc phản hồi không hợp lệ. Kiểm tra kết nối và tải lại dữ liệu để đối chiếu trước khi thử lại.', '因連線或回應錯誤，無法確認結果。請先檢查連線並重新載入資料。'));
        }
        finally {
            actionPending.current = false;
            setBusy(false);
        }
    }
    const showError = messages[error] ? msg(error) : error;
    const locked = !!dailyWarning || busy || !loaded || !!state.warnings.length;
    async function reloadPlan() {
        if (dirty && !await saveNow()) return;
        setBusy(true); setError(''); setNotice('');
        try { await load(week, true, true); setNotice(t('Đã tải lại kế hoạch đã lưu của tuần đang chọn.', '已重新載入所選週次的已儲存計畫。')); }
        catch (e) { setError(t('Không tải lại được dữ liệu: ', '無法重新載入資料：') + (e instanceof Error ? msg(e.message) : String(e))); }
        finally { setBusy(false); }
    }
    const selectable = visible.filter(r => !['TẠM HOÃN', 'HỦY', 'ĐÃ CHUYỂN'].includes(r.status));
    const closable = picked.filter(r => r.status === 'DỰ KIẾN');
    const reopenText = (vi:string,zh:string,en:string) => language === 'en' ? en : t(vi,zh);
    const reopenBlock = locked ? reopenText('Đang xử lý hoặc chưa tải xong dữ liệu.', '正在處理或資料尚未載入。', 'Processing or loading data.') : !picked.length ? reopenText('Chọn dòng đã chốt để mở chốt.', '請選取已確認的計畫以解除確認。', 'Select a confirmed plan to reopen.') : picked.some(r => r.status === 'ĐÃ CHUYỂN' || r.transferredAt) ? reopenText('Lệnh đã chuyển In Transit không được mở chốt tại đây.', '已轉入在途的工單不能在此解除確認。', 'Transferred orders cannot be reopened here.') : picked.some(r => r.status !== 'ĐÃ CHỐT') ? reopenText('Chỉ mở chốt các dòng đang ở trạng thái Đã chốt.', '只能解除已確認的計畫。', 'Only confirmed plans can be reopened.') : !state.canReopen ? reopenText('Cần quyền Hủy xác nhận để mở chốt kế hoạch.', '需要取消確認權限才能解除計畫確認。', 'Unconfirm permission is required to reopen a plan.') : '';
    function exportExcel() { const escape = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); const fields = ['week', 'group', 'sku', 'name', 'spec', 'line', 'enginePriority', 'suggested', 'plan', 'laborHour', 'laborTotal', 'start', 'end', 'priority', 'sequence', 'status', 'type', 'planId', 'sourceIds', 'source', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy']; const data = [fields, ...filtered.map(r => fields.map(k => { const v = k === 'laborTotal' ? plannedLaborHours(r) : r[k]; return Array.isArray(v) ? v.join('; ') : v; }))]; const xml = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Production Plan"><Table>${data.map(row => `<Row>${row.map(v => `<Cell><Data ss:Type="String">${escape(v)}</Data></Cell>`).join('')}</Row>`).join('')}</Table></Worksheet></Workbook>`; const url = URL.createObjectURL(new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = `Production-Plan-${week}.xml`; a.click(); URL.revokeObjectURL(url); setError(''); setNotice(t('Đã tạo file Excel và gửi yêu cầu tải xuống trình duyệt.', '已產生 Excel 檔案並送出瀏覽器下載要求。')); }
    return <main className="workspace pp-workspace" data-own-language="true">
  <StandardToolbar name="ProductionPlan" permissionFeedback items={[...[toolbar.field(<></>,[t('Tuần kế hoạch', '計畫週次'),
toolbar.input({"aria-label": "Plan week","type": "date","disabled": busy,"value": week,"onChange": e => { const next=monday(e.target.value); if(next===week)return; if(dirty){void saveNow().then(ok=>{if(ok)setWeek(next);});}else setWeek(next); }})]),
toolbar.note(<strong>{displayDate(week)} – {displayDate(weekEnd(week))}</strong>),
toolbar.action({"disabled": busy || !week,"onClick": () => void reloadPlan()},<>{t('Tải lại dữ liệu', '重新載入')}</>, true, "action"),
!tracking && toolbar.action({"aria-expanded": showCapacity,"onClick": ()=>setShowCapacity(!showCapacity)},<>{t('Xem Capacity theo Line', '查看產線產能')}</>, true, "action"),
!tracking&&canReviewCapacity&&toolbar.action({onClick:async()=>{if(await refreshCapacityRequests(true))setCapacityConfirmOpen(true);}},<>Confirm {capacityRequests.length>0&&<b className="pp-confirm-count">{capacityRequests.length}</b>}</>,true,'action')], ...(!tracking ? [(toolbarSearchOpen && toolbarSearchField==='query' && toolbar.field('NỘI DUNG TRA',[toolbar.input({"aria-label": "Search plan","placeholder": t('Tìm SKU, tên, quy cách', '搜尋 SKU、名稱、規格'),"value": query,"onChange": e => { setQuery(e.target.value); setPage(1); setSelected([]); }})])),
(toolbarSearchOpen && toolbarSearchField==='line' && toolbar.field('NỘI DUNG TRA',[toolbar.select({"aria-label": "Filter line","value": line,"onChange": e => { setLine(e.target.value); setSelected([]); setPage(1); }},<><option value="">{t('Tất cả Line', '所有產線')}</option>{['A', 'B', 'C'].map(l => <option key={l}>{l}</option>)}</>)])),
(toolbarSearchOpen && toolbarSearchField==='type' && toolbar.field('NỘI DUNG TRA',[toolbar.select({"aria-label": "Filter type","value": type,"onChange": e => { setType(e.target.value); setSelected([]); setPage(1); }},<><option value="">{t('Tuần chính + Gối đầu', '主週＋銜接')}</option>{['TUẦN CHÍNH', 'GỐI ĐẦU'].map(v => <option key={v} value={v}>{msg(v)}</option>)}</>)])),
(toolbarSearchOpen && toolbarSearchField==='status' && toolbar.field('NỘI DUNG TRA',[toolbar.select({"aria-label": "Filter status","value": status,"onChange": e => { setStatus(e.target.value); setSelected([]); setPage(1); }},<><option value="active">{language === 'en' ? 'Not transferred to In Transit' : t('Chưa chuyển In Transit', '未轉入在途')}</option><option value="all">{t('Tất cả trạng thái', '所有狀態')}</option>{['DỰ KIẾN', 'ĐÃ CHỐT', 'ĐÃ CHUYỂN', 'TẠM HOÃN', 'HỦY'].map(v => <option key={v} value={v}>{msg(v)}</option>)}</>)])),
toolbar.action({"disabled": !filtered.length,"onClick": () => { try { exportExcel(); } catch (e) { setNotice(''); setError(t('Không xuất được Excel: ', '無法匯出 Excel：') + String(e)); } }},<>{t('Xuất Excel (.xml)', '匯出 Excel (.xml)')}</>, true, "action")] : []), ...(!tracking ? [
toolbar.action({"disabled": locked || !closable.length,"onClick": () => void action('close', closable.map(r => r.id))},<>{t('Chốt kế hoạch', '確認計畫')}</>, true, "action"),
toolbar.action({"disabled": !!reopenBlock,"title": reopenBlock || undefined,"onClick": () => void action('reopen')},<>{t('Mở chốt', '解除確認')}</>, true, "action"),
toolbar.action({"disabled": locked || dirty || !picked.length || picked.some(r => r.status !== 'ĐÃ CHỐT'),"onClick": () => void action('transfer')},<>{t('Chuyển sang In Transit', '轉入在途')}</>, true, "action")] : []), !tracking && toolbar.action({onClick:()=>setToolbarSearchOpen(true)},'Tra cứu',true,'lookup'), toolbarSearchOpen && toolbar.group([
    toolbar.field('TRA THEO',[toolbar.select({value:toolbarSearchField,onChange:e=>setToolbarSearchField(e.target.value)},<><option value="query">SKU / Tên sản phẩm / Quy cách</option><option value="line">Line</option><option value="type">Loại kế hoạch</option><option value="status">Trạng thái</option></>)]),
    toolbar.action({onClick:()=>{setQuery('');setLine('');setType('');setStatus('active');setPage(1);setSelected([])}},'Xóa lọc',true,'clear'),toolbar.action({onClick:()=>{setQuery('');setLine('');setType('');setStatus('active');setPage(1);setSelected([]);setToolbarSearchOpen(false)}},'Quay lại',true,'back')]), !tracking&&toolbar.action({onClick:()=>setRulesOpen(true)},'Quy tắc',true,'action')]} />
  {rulesOpen&&<ProductionPlanRules language={language} onClose={()=>setRulesOpen(false)}/>}
  {dailyWarning&&<PlanDailyLoadWarning value={dailyWarning} language={language} onDecision={decideDaily}/>}
  {dailyCheckNote&&<div className="pp-alert" role="status">{dailyCheckNote}</div>}
  {backlogLine&&<PlanTransitBacklogDetail rows={(state.capacity.find(c=>c.line===backlogLine)?.backlogRows||[]) as TransitBacklogRow[]} language={language} line={backlogLine} onClose={()=>setBacklogLine(null)}/>}
  {capacityDayLine&&<CapacityDayDetail week={week} line={capacityDayLine} language={language} onClose={()=>setCapacityDayLine(null)}/>}
  {capacityConfirmOpen&&<CapacityConfirmPanel requests={capacityRequests} language={language} onClose={()=>setCapacityConfirmOpen(false)} onComplete={async()=>{await refreshCapacityRequests();window.dispatchEvent(new Event('onspa-capacity-changed'));setNotice(t('Đã ghi nhận quyết định Capacity.','已記錄產能審核結果。'));}}/>}
  {!tracking && saveState!=='idle' && <div className="pp-alert" role="status" aria-live="polite">{saveState==='pending'?t('Chờ tự lưu chỉnh sửa…','等待自動儲存變更…'):saveState==='saving'?t('Đang tự lưu chỉnh sửa…','正在自動儲存變更…'):saveState==='saved'?t('Đã tự lưu chỉnh sửa.','變更已自動儲存。'): <>{t('Chỉnh sửa chưa được lưu.','變更尚未儲存。')} <FeedbackActionButton type="button" onClick={()=>void saveNow()}>{t('Thử lưu lại','重試儲存')}</FeedbackActionButton></>}</div>}
  {busy && <div className="pp-alert" role="status" aria-live="polite">{t('Đang xử lý, vui lòng chờ…', '處理中，請稍候…')}</div>}
  {error && <PlanningFeedback kind="error" message={showError} onClose={()=>setError('')} />}{notice && <PlanningFeedback kind="success" message={notice} onClose={()=>setNotice('')} />}{state.warnings.map(w => <div className="pp-alert error" key={w}>{msg(w)}</div>)}
  {!weekReady ? null : !week ? <div className="data-card pp-empty">{t('Chưa có tuần Engine đã cập nhật.', '尚無已更新的 Engine 週次。')}</div> : tracking ? <section className="data-card"><div className="pp-alert">{t('Đã nhận dữ liệu kế hoạch. Chức năng mở LSX và tính số lượng đang đi của phần 04 chưa có trong 3 file cung cấp.', '已接收計畫資料。提供的三個檔案不含 04 開立工單及在途數量計算功能。')}</div><div className="pp-table"><table data-no-pagination="true"><thead><tr>{['Plan ID', t('Nhóm SP', '產品組'), 'SKU', t('Tên sản phẩm', '產品名稱'), 'Line', t('SL kế hoạch', '計畫數量'), t('Bắt đầu', '開始'), t('Ngày hoàn thành', '完成日期'), t('Trạng thái LSX', '工單狀態'), t('Chi tiết', '詳細')].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{state.transit.map((r, i) => <tr key={r.planRowId || r.id || i}><DataCell kind="code">{r.planId}</DataCell><DataCell kind="code">{r.group || '—'}</DataCell><DataCell kind="code">{r.sku}</DataCell><DataCell>{r.name}</DataCell><DataCell kind="code">{r.line}</DataCell><DataCell kind="number">{r.plan}</DataCell><DataCell kind="date">{displayDate(r.start)}</DataCell><DataCell kind="date">{displayDate(r.end)}</DataCell><DataCell>{t('Chưa mở LSX', '尚未開立工單')}: {r.status}</DataCell><DataCell><FeedbackActionButton onClick={() => setDetail(r)}>{t('Xem chi tiết', '查看詳細')}</FeedbackActionButton></DataCell></tr>)}{!state.transit.length && <tr data-no-data="true"><DataCell colSpan={10}>{t('Chưa có dữ liệu In Transit cho tuần đã chọn', '所選週次尚無在途資料')}</DataCell></tr>}</tbody></table></div></section> : <>
  {rows.some(r => ['ĐÃ CHỐT','ĐÃ CHUYỂN'].includes(r.status) && r.capacityBasis && state.capacity.some(c => c.line === r.line && c.week === week && (c.status !== 'Đã xác nhận' || c.version !== r.capacityBasis.version))) && <div className="pp-alert">{t('Capacity đã thay đổi/đang điều chỉnh. Kế hoạch đã chốt giữ nguyên căn cứ cũ:', '產能已變更／調整中，已確認計畫保留原依據：')} {rows.filter(r=>['ĐÃ CHỐT','ĐÃ CHUYỂN'].includes(r.status)&&r.capacityBasis).map(r=>{const current=state.capacity.find(c=>c.line===r.line&&c.week===week);return <span key={r.id}>{r.sku} · Line {r.line}: V{r.capacityBasis.version} ({r.capacityBasis.availableHours.toFixed(2)}h) → V{current?.version??'—'} ({current?.status==='Đã xác nhận'?Number(current.availableHours).toFixed(2):'Chờ xác nhận'}h), Δ {current?.status==='Đã xác nhận'?(Number(current.availableHours)-r.capacityBasis.availableHours).toFixed(2):'—'}h; </span>;})}</div>}
  {rows.some(r=>!state.capacity.some(c=>c.line===r.line&&c.week===week&&c.status==='Đã xác nhận'))&&<div className="pp-alert">{t('Capacity chưa được KHSX đồng ý hoặc đang chờ điều chỉnh. Cần cập nhật giờ khả dụng và được KHSX đồng ý lại trước khi chốt kế hoạch mới.','產能尚未經生產計畫同意或正在等待調整；更新可用工時並重新同意前不能確認新計畫。')}</div>}
  {showCapacity && <section className="pp-loads">{loads.map(s => <article key={s.line} className={`data-card pp-load-card ${s.warning}`}><div className="pp-load-head"><h3>Line {s.line} · {displayDate(s.week)}–{displayDate(weekEnd(s.week))} · V{s.version ?? "—"}</h3><b>{language === 'en' ? 'Week load' : t('Tải tuần', '本週負載')} · {s.ratio === null ? '—' : Number.isFinite(s.ratio) ? `${(s.ratio * 100).toFixed(1)}%` : t('Vượt tải', '超載')}</b></div><dl><div><dt title={language === 'en' ? 'Only schedules finishing within this week are included; rows with missing data are omitted' : t('Chỉ cộng lịch có ngày hoàn thành trong tuần đang xem; bỏ qua dòng thiếu dữ liệu', '清單中尚未轉入在途訂單的計畫數量 × 每件工時總和；不含取消或暫停訂單')}>{language === 'en' ? 'Pro plan hours this week' : t('Giờ Pro plan trong tuần', '本週計畫工時')}</dt><dd>{formatHours(s.required)}</dd></div><div><dt>{language==='en'?'Unfinished hours from previous weeks':t('Giờ tuần cũ chưa hoàn thành','前週未完成工時')}</dt><dd>{formatHours(s.previousBacklogHours)}</dd></div><div><dt>{language==='en'?'In transit hours this week':t('Giờ tồn In transit trong tuần','本週在途工時')}</dt><dd>{formatHours(s.backlogHours)} {s.backlogRows.length>0&&<button type="button" className="pp-backlog-open" onClick={()=>setBacklogLine(s.line)}>{t('Xem lệnh tồn','查看未完成工單')} ({s.backlogRows.length}) ▾</button>}</dd></div><div><dt>{language==='en'?'Hours to schedule this week':t('Tổng giờ cần xếp trong tuần','本週待排工時')}</dt><dd>{formatHours(s.totalRequired)}</dd></div><div><dt>{language === 'en' ? 'Week capacity' : t('Khả dụng tuần', '本週可用')}</dt><dd><button type="button" disabled={!state.capacity.some(c=>c.line===s.line&&c.week===week&&c.canViewDaily)} onClick={()=>setCapacityDayLine(s.line)} title={state.capacity.some(c=>c.line===s.line&&c.week===week&&c.canViewDaily)?t("Xem giờ làm việc từng ngày và người vắng mặt", "查看每日工時與缺勤人員"):t("Chờ QLSX đồng bộ và KHSX xác nhận", "等待生產同步及計畫確認")} style={{color:"#14604d",background:"#edf7f2",border:"1px solid #86b9a4",borderRadius:6,padding:"2px 10px",cursor:"pointer",font:"inherit",fontWeight:700}}>{formatHours(s.available)} <span aria-hidden="true">▾</span></button></dd></div><div><dt>{language === 'en' ? 'Week balance' : t('Dư / thiếu tuần', '本週剩餘／不足')}</dt><dd>{formatHours(s.difference)}</dd></div></dl>{state.capacity.some(c=>c.line===s.line&&c.retainedApproval)&&<small>{t('Đang điều chỉnh · dùng Capacity đã duyệt gần nhất','調整中 · 使用最近核准產能')}</small>}{s.partial&&<small>{language==='en'?'Provisional total · excludes rows with missing data':t('Tạm tính · chưa bao gồm các dòng thiếu dữ liệu','暫計 · 不含資料不完整的項目')}</small>}{s.available === null && <small>{s.status==='Chờ điều chỉnh'?t('Chờ điều chỉnh · cập nhật giờ khả dụng rồi KHSX đồng ý lại','等待調整 · 更新可用工時並重新審核'):s.status==='Chờ đồng bộ'?t('Chờ đồng bộ sang KHSX','等待同步至生產計畫'):s.status==='Chờ KHSX đồng ý'?t('Chờ KHSX đồng ý giờ khả dụng','等待生產計畫同意可用工時'):t('Chưa xác nhận Capacity', '產能尚未確認')}</small>}{s.allocationMissing>0&&<small>{t('Chưa đủ ngày hoặc lịch khả dụng để phân bổ giờ','缺少日期或可用產能，無法分配工時')} ({s.allocationMissing})</small>}{(s.missingLabor+s.backlogMissing) > 0 && <small>{msg('missingLabor')} ({s.missingLabor+s.backlogMissing})</small>}</article>)}</section>}
  
  
  <section className="data-card"><div className="pp-table"><table className="pp-plan-grid" data-no-pagination="true" data-report-source={JSON.stringify({title:t('Kế hoạch sản xuất','生產計畫'),compactHeader:true,subtitle:`${t('TUẦN KẾ HOẠCH','計畫週次')} ${weekNumber(week)}: ${displayDate(week)} – ${displayDate(weekEnd(week))}`,headers:['Nhóm SP','SKU','Tên sản phẩm','Quy cách','SL đề xuất','SL kế hoạch','Giờ công','Line','Ngày sản xuất','Ngày hoàn thành','Loại kế hoạch','Ưu tiên','Thứ tự'],rows:filtered.map(r=>[r.group,r.sku,r.name,r.spec,r.suggested,r.plan,plannedLaborHours(r),r.line,displayDate(r.start),displayDate(r.end),msg(r.type),msg(r.priority),r.sequence])})}><colgroup>{[34,100,150,300,110,100,110,100,64,132,132,112,154,60,112,110].map((width,i,columns)=><col key={i} style={{width:`${width/columns.reduce((sum,n)=>sum+n,0)*100}%`}}/>)}</colgroup><thead><tr><th><input aria-label="Select page" type="checkbox" disabled={locked} checked={selectable.length > 0 && selectable.every(r => selected.includes(r.id))} onChange={e => setSelected(v => e.target.checked ? [...new Set([...v, ...selectable.map(r => r.id)])] : v.filter(id => !visible.some(r => r.id === id)))}/></th>{[t('Nhóm SP', '產品組'), 'SKU', t('Tên SP', '產品名稱'), t('Quy cách', '規格'), t('SL đề xuất', '建議數量'), t('SL kế hoạch', '計畫數量'), t('Giờ công', '工時'), 'Line', t('Ngày SX', '生產日期'), t('Ngày hoàn thành', '完成日期'), t('Loại kế hoạch', '計畫類型'), t('Ưu tiên', '優先級'), t('Thứ tự', '順序'), t('Trạng thái', '狀態'), t('Cảnh báo / Chi tiết', '警告／詳細')].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{visible.map(r => { const disabled = locked || ['ĐÃ CHỐT', 'ĐÃ CHUYỂN'].includes(r.status); return <tr key={r.id} className={r.status === 'HỦY' ? 'pp-cancelled' : r.priority === 'GẤP' ? 'pp-urgent' : ''}><DataCell><input aria-label={`Select ${r.sku}`} disabled={locked || r.status === 'ĐÃ CHUYỂN'} type="checkbox" checked={selected.includes(r.id)} onChange={() => toggle(r.id)}/></DataCell><DataCell kind="code">{r.group || '—'}</DataCell><DataCell kind="code" className="pp-sku-cell">{r.sku || '—'}</DataCell><DataCell className="pp-name-cell">{r.name || '—'}</DataCell><DataCell>{r.spec || '—'}</DataCell><DataCell kind="number">{r.suggested ?? '—'}</DataCell><DataCell><input aria-label={`Quantity ${r.sku}`} disabled={disabled} type="number" min="0" value={r.plan ?? ''} onChange={e => edit(r, 'plan', e.target.value)}/></DataCell><DataCell kind="number" className="pp-labor-total" title={t('SL kế hoạch × Giờ công/SP', '計畫數量 × 每件工時')}>{formatHours(plannedLaborHours(r))}</DataCell><DataCell><select aria-label={`Line ${r.sku}`} disabled={disabled} value={r.line} onChange={e => edit(r, 'line', e.target.value)}><option value="">—</option>{['A', 'B', 'C'].map(v => <option key={v}>{v}</option>)}</select></DataCell>{['start', 'end'].map(k => <DataCell key={k}><input aria-label={`${k} ${r.sku}`} type="date" disabled={disabled} value={r[k] || ''} onChange={e => edit(r, k, e.target.value)}/></DataCell>)}<DataCell><select aria-label={`Type ${r.sku}`} disabled={disabled} value={r.type} onChange={e => edit(r, 'type', e.target.value)}>{['TUẦN CHÍNH', 'GỐI ĐẦU'].map(v => <option key={v} value={v}>{msg(v)}</option>)}</select></DataCell><DataCell><select aria-label={`Priority ${r.sku}`} disabled={disabled || r.type === 'GỐI ĐẦU'} value={r.priority} onChange={e => edit(r, 'priority', e.target.value)}>{['GẤP', 'THƯỜNG', 'THƯỜNG - GỐI ĐẦU'].map(v => <option key={v} value={v}>{msg(v)}</option>)}</select></DataCell><DataCell><input aria-label={`Sequence ${r.sku}`} type="number" min="1" disabled={disabled} value={r.sequence ?? ''} onChange={e => edit(r, 'sequence', e.target.value)}/></DataCell><DataCell>{disabled ? msg(r.status) : <select aria-label={`Status ${r.sku}`} value={r.status} onChange={e => { const next = e.target.value; if (['DỰ KIẾN', 'TẠM HOÃN', 'HỦY'].includes(next)) edit(r, 'status', next); }}>{['DỰ KIẾN', 'TẠM HOÃN', 'HỦY'].map(v => <option key={v} value={v}>{msg(v)}</option>)}</select>}</DataCell><DataCell>{rowWarnings(r).length>0&&<details className="pp-row-warnings" name="production-plan-warnings"><summary aria-label={`${t('Cảnh báo', '警告')}: ${r.sku}`}>{t('Cảnh báo', '警告')} ({rowWarnings(r).length})</summary>{rowWarnings(r).map(w=><small key={w}>{msg(w)}</small>)}</details>}<FeedbackActionButton onClick={() => setDetail(r)}>{t('Chi tiết', '詳細')}</FeedbackActionButton></DataCell></tr>; })}{!visible.length && <tr data-no-data="true"><DataCell colSpan={16} className="pp-empty">{loaded ? t('Chưa có dữ liệu Production Plan cho tuần đã chọn', '所選週次尚無生產計畫資料') : t('Đang tải dữ liệu…', '正在載入資料…')}</DataCell></tr>}</tbody></table></div><ManualPagination total={filtered.length} page={Math.min(page,pages)} pageSize={20} onPageChange={setPage}/></section>
  <details className="data-card pp-history"><summary>{t('Lịch sử thao tác', '操作歷程')} ({state.audit.length})</summary>{state.audit.map(a => <details key={a.id}><summary>{new Date(a.at).toLocaleString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hourCycle: 'h23' }).replace(',', '')} · {msg(a.action)} · {a.actor} · {a.reason}</summary>{a.dailyCapacityOverride&&<div role="note" style={{padding:12,background:'#fff0c4',color:'#8b321a'}}><strong>{t('Đã đồng ý xếp vượt giờ khả dụng', '已確認超出可用工時')}</strong>{a.dailyCapacityOverride.warnings.map(w=><p key={w.id}>{w.sku} · {w.line} · {w.date} · +{w.over.toLocaleString()} {t('giờ','小時')}</p>)}</div>}<h4>{t('Trước thay đổi', '變更前')}</h4><pre>{JSON.stringify(a.before, null, 2)}</pre><h4>{t('Sau thay đổi', '變更後')}</h4><pre>{JSON.stringify(a.after, null, 2)}</pre></details>)}</details>
  </>}{displayedDetail && <div className="pp-detail" role="dialog" aria-modal="true" aria-label={t('Chi tiết kế hoạch', '計畫詳細')}><header><div><h2>{displayedDetail.sku} · {displayedDetail.name || '—'}</h2><p>{t('Thông tin kế hoạch và dữ liệu nguồn', '計畫資訊與來源資料')}</p></div><FeedbackActionButton onClick={() => setDetail(null)}>{t('Đóng', '關閉')}</FeedbackActionButton></header><section><h3>{t('Thông tin sản phẩm', '產品資訊')}</h3><dl className="pp-detail-grid">{[[t('Nhóm SP', '產品組'), displayedDetail.group], ['SKU', displayedDetail.sku], [t('Tên sản phẩm', '產品名稱'), displayedDetail.name], [t('Quy cách', '規格'), displayedDetail.spec], ['Line', displayedDetail.line]].map(([label, value]) => <div key={String(label)}><dt>{label}</dt><dd>{value || '—'}</dd></div>)}</dl></section><section><h3>{t('Kế hoạch sản xuất', '生產計畫')}</h3><dl className="pp-detail-grid">{[[t('Tuần kế hoạch', '計畫週次'), `${displayDate(displayedDetail.week)} – ${displayDate(weekEnd(displayedDetail.week))}`], [t('SL đề xuất', '建議數量'), displayedDetail.suggested], [t('SL kế hoạch', '計畫數量'), displayedDetail.plan], [t('Giờ công/SP', '每件工時'), formatHours(displayedDetail.laborHour)], [t('Giờ công', '工時'), formatHours(plannedLaborHours(displayedDetail))], [t('Ngày sản xuất', '生產日期'), displayDate(displayedDetail.start)], [t('Ngày hoàn thành', '完成日期'), displayDate(displayedDetail.end)], [t('Loại kế hoạch', '計畫類型'), msg(displayedDetail.type)], [t('Ưu tiên', '優先級'), msg(displayedDetail.priority)], [t('Thứ tự', '順序'), displayedDetail.sequence], [t('Trạng thái', '狀態'), msg(displayedDetail.status)], ['Plan ID', displayedDetail.planId]].map(([label, value]) => <div key={String(label)}><dt>{label}</dt><dd>{value ?? '—'}</dd></div>)}</dl></section><section><h3>{t('Nguồn và cập nhật', '來源與更新')}</h3><dl className="pp-detail-grid">{[[t('Nguồn', '來源'), displayedDetail.source], [t('Mã nguồn', '來源編號'), Array.isArray(displayedDetail.sourceIds) ? displayedDetail.sourceIds.join(', ') : displayedDetail.sourceIds], [t('Người tạo', '建立者'), displayedDetail.createdBy], [t('Thời gian tạo (GMT+7)', '建立時間 (GMT+7)'), productionDisplayTime(displayedDetail.createdAt)], [t('Người cập nhật', '更新者'), displayedDetail.updatedBy], [t('Thời gian cập nhật (GMT+7)', '更新時間 (GMT+7)'), productionDisplayTime(displayedDetail.updatedAt)]].map(([label, value]) => <div key={String(label)}><dt>{label}</dt><dd>{value || '—'}</dd></div>)}</dl></section></div>}
 </main>;
}
