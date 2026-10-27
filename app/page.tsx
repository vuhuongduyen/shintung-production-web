"use client";
import {SkuTransfer} from '../components/sku-transfer';
import {hasMenuPermission} from '../lib/menu-action-access.mjs';
import {DepartmentChangeRequests,useChangeRequests,requestDepartment,requestWorkspace,canReplyDepartments} from "../components/department-change-requests";
import {WarehouseReceipts} from '../components/warehouse-receipts';
import {deferredScreen} from "../components/onspa-ui/deferred-screen";
import { FeedbackActionButton } from "../components/action-feedback";
import { notifyActionFailure, clearActionFeedback, actionFeedbackScope } from "../lib/action-feedback";
import actionFeedbackStyles from "../components/action-feedback.module.css";
import {vietnamDate,inventoryDisplayTime} from "../lib/vietnam-calendar.mjs";
const WebsiteTestLog = deferredScreen(async () => {const module=await import("../components/website-test-log");return {default:module.WebsiteTestLog};});
import {MenuHeadingContext} from '../components/onspa-ui/MenuHeadingContext';
import {ManualPagination} from '../components/onspa-ui/ManualPagination';
import {dataStatusReadState} from '../lib/data-status-read-state.mjs';
import {UiLabel} from "../components/standard-toolbar/UiLabel";
import {PageTitle} from '../components/onspa-ui/PageTitle';
import {DataTable} from '../components/onspa-ui/DataTable';
import {DataCell} from '../components/onspa-ui/DataCell';
import SkuStock from "../components/sku-stock";
import SkuListImport from "../components/sku-list-import";
import {clearProductionSnapshot} from "../lib/production-workflow-cache";
import WorkspacePinnedHeader from "../components/workspace-pinned-header";
import WorkspaceInteractions,{ApprovalNavigationContext,useApprovalNavigation} from "../components/workspace-interactions";
import {paginationModel,paginationPages,paginationLabels,paginationSummary,isPaginationPlaceholder} from '../lib/pagination-presentation.mjs';
import {paginationMutation} from "../lib/table-pagination.mjs";
import { apiFetch as fetch } from "../lib/data-sync";
import { useDataRefresh, WorkspaceActivityContext, clearClientReads, clientSessionGeneration, ClientSessionReadCancelled, isClientSessionReadCancelled, subscribeClientReadInvalidation } from "../lib/data-sync";
import {createBackgroundRefresh} from "../lib/client-background-refresh.mjs";
import {clientAuthorizationKey} from "../lib/client-authorization-context.mjs";
import {FeedbackLauncher,FeedbackInbox} from "../components/user-feedback";
const UserPermissionSetup = deferredScreen(() => import("../components/user-permission-setup"));
const PermissionHistoryReview = deferredScreen(() => import("../components/permission-history-review"));
import {quickLinePermissions,withBusinessViews} from "../lib/user-permission-profiles.mjs";
import {canPlanAction} from "../lib/production-plan-permissions.mjs";
import { StandardToolbar, ToolbarPermissions, ExportPermissionContext, toolbar as toolbarConfig } from "../components/standard-toolbar/StandardToolbar";
import { registerToolbarTerms, toolbarLocale, subscribeToolbarLocale, translateToolbar } from "../components/standard-toolbar/translations";
import { LOCAL_TEST } from "../lib/runtime";
import { recordFetch, linkedRecordFetch, knownRecordRevision, acceptRecordRevision } from "../lib/record-fetch";
import {enginePriorityTone} from '../lib/planning-display.mjs';
import EngineReason from "../components/engine-reason";
import {isDataExportAction,hasExactExportGrant} from "../lib/permission-feedback";
import ExistingPermissionGrants from "../components/existing-permission-grants";
import TableReports from "../components/table-reports";
import PlanningReports, { PlanningReportMenu } from "../components/planning-reports";
import WorkspaceTabs from "../components/workspace-tabs";
import {openWorkspace,closeWorkspace,isWorkspaceGroup} from "../lib/workspace-tabs.mjs";
import {reportTypes, label as planningReportLabel} from "../lib/planning-reports.mjs";
import PlanningFeedback from "../components/planning-feedback";
const WeeklyCapacity = deferredScreen(() => import("../components/weekly-capacity"));
const EmployeeDirectory = deferredScreen(() => import("../components/employee-directory"));
import { demandWeekLabel, demandMatchesWeek } from '../lib/demand-week.mjs';
import {pendingDemand, engineDemandMatches, engineInputRows} from '../lib/engine-demand.mjs';
import { engineTransitBySku } from '../lib/engine-transit.mjs';
import { formatPlanningFailure, refreshTransferredPlan } from "../components/production-plan";
import RecordFiles, {type StoredFile} from "../components/record-files";
import BomBulkForm from "../components/bom-bulk-form";
import BomHierarchy from "../components/bom-hierarchy";
import BomReconciliation from "../components/bom-reconciliation";
import BomCodeSuggestions from "../components/bom-code-suggestions";
import { bomLineActive } from "../lib/bom-rules.mjs";
import { BomChangeSkus } from "../components/bom-change-skus";
import { canBomAction } from "../lib/bom-permissions.mjs";
import { normalizeBomWaste } from "../lib/bom-waste.mjs";
import { bomMetadataResolver, bomClassifications } from "../lib/bom-metadata.mjs";
import { bomSourceResolver, bomSourceLabel, projectBomSources, syncBomSources, syncBomCatalogSources } from "../lib/bom-source.mjs";
const StorageHandover = deferredScreen(() => import("../components/storage-handover"));
import {
  useSkuApproval,
  SkuDataStatus,
  SkuResultCount,
  approvalTime,
  type ApprovalItem,
} from "../components/sku-approval";
import {skuRecordSnapshot} from "../lib/sku-display-resource";

import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  createContext,
  useContext,
} from "react";
import {
  confirmationStatus,
  usageStatus,
  usableSku,
  skuMatchesStatus,
} from "../lib/sku-state.mjs";
import { DemandHistoryImport } from "../components/demand-history-import";
import { DemandEventDialog } from "../components/demand-event-dialog";
import {
  ProductionPlan,
  prefetchProductionPlan,
} from "../components/production-plan";
import { InTransit, prefetchInTransit } from "../components/in-transit";
import LaborHoursMaster, {
  preloadLaborHours,
} from "../components/labor-hours-master";
const ProductionManagement = deferredScreen(() => import("../components/production-management"));
const ProductionAllocationWorkspace = deferredScreen(() => import("../components/production-allocation-workspace"));
import bomData from "./bom-data.json";
import skuExtraData from "./sku-extra-data.json";
import skuProcessData from "./sku-process-data.json";
import skuTpData from "./sku-tp-data.json";
import baseForecastData from "./base-forecast-data.json";
import demandEventData from "./demand-event-data.json";
import leadtimeData from "./leadtime-data.json";
import inventoryErpData from "./inventory-erp-data.json";
import { strFromU8, unzipSync } from "fflate";

import { defaultSafetyGroups as basicDefaultSafetyGroups, defaultSafetyRuleSet as basicDefaultSafetyRuleSet } from "../lib/basic-master-defaults.mjs";

import { useMasterCancellation } from "../components/basic-master-cancel";
import { newestMasterFirst, isMasterCancelled, canCancelMaster } from "../lib/basic-master.mjs";

type Language = "vi" | "zh" | "en";
type SkuSearchMode =
  "sku" | "name" | "specification" | "group" | "line" | "status" | "createDate";
type LeadTimeSearchField =
  | "sku"
  | "name"
  | "specification"
  | "group"
  | "line"
  | "leadTime"
  | "leadTimeSafety"
  | "forecastDays"
  | "situationDays"
  | "totalSafetyDays"
  | "createDate";

const formatDateTimeDisplay = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value || "";
  return `${part("day")}/${part("month")}/${part("year")} ${part("hour")}:${part("minute")}:${part("second")}`;
};

const normalizeSearchText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("vi");

const compareGroupThenSku = (
  a: { group: string; code?: string; sku?: string },
  b: { group: string; code?: string; sku?: string },
) =>
  a.group.localeCompare(b.group, "vi", {
    numeric: true,
    sensitivity: "base",
  }) ||
  (a.code || a.sku || "").localeCompare(b.code || b.sku || "", "vi", {
    numeric: true,
    sensitivity: "base",
  });

const zhTerms: Record<string, string> = {
  "Theo dõi lệnh sản xuất":"生產工單追蹤", "Hủy báo công":"取消生產報工", "Điều chỉnh báo công":"調整生產報工", "Báo công":"生產報工", "Thời gian":"時間", "Nhân lực":"人力", "Điều chỉnh":"調整", "Hạng mục":"項目", "Xem tác động":"查看影響", "Xác nhận hủy":"確認取消", "Lưu điều chỉnh":"儲存調整", "Lý do hủy / điều chỉnh":"取消／調整原因",

  "Tháng áp dụng SX": "生產適用月份",
  "Chọn PDF Kinh doanh": "選擇業務 PDF",
  "Chờ bổ sung": "待補充",
  "Chi tiết dữ liệu đầu vào": "輸入資料詳情",

  "Quản trị hệ thống": "系統管理",
  "Dữ liệu cơ bản": "基礎資料",
  "Quản lý kho": "倉庫管理",
  "Cấu trúc thành phẩm": "產品結構",
  "Kế hoạch sản xuất": "生產計畫",
  "Quản lý sản xuất": "生產管理",
  "Hệ thống báo công": "生產管理",
  "MENU CHỨC NĂNG": "功能選單",
  "Quản lý người dùng": "使用者管理",
  "Thiết lập bộ phận": "部門設定",
  "Phân quyền": "權限管理",
  "Phân quyền theo bộ phận": "依部門設定權限",
  "Kế thừa quyền bộ phận": "繼承部門權限",
  "Tùy chỉnh quyền cá nhân": "自訂個人權限",
  "Nhật ký thao tác": "操作日誌",
  "Quản lý phiên bản": "版本管理",
  "Tình trạng dữ liệu": "資料狀態",
  "Sao lưu và khôi phục": "備份與還原",
  "Giám sát chỉ đọc; không cho phép sửa dữ liệu gốc tại màn hình này.":
    "唯讀監控；此畫面不允許修改原始資料。",
  "Xuất báo cáo lỗi": "匯出錯誤報告",
  "Đang kiểm tra...": "檢查中...",
  "KẾT NỐI CƠ SỞ DỮ LIỆU": "資料庫連線",
  "Đang kiểm tra": "檢查中",
  "D1 đang kết nối": "D1 已連線",
  "Mất kết nối": "連線中斷",
  "Kiểm tra thông qua API phía máy chủ": "透過伺服器 API 檢查",
  "MÔI TRƯỜNG HIỆN TẠI": "目前環境",
  "Website đang trong giai đoạn điều chỉnh": "網站目前處於調整階段",
  "KIỂM TRA GẦN NHẤT": "最近檢查時間",
  "Không phát hiện lỗi đọc API": "未發現 API 讀取錯誤",
  "SAO LƯU D1 GẦN NHẤT": "最近 D1 備份",
  "Chưa thiết lập": "尚未設定",
  "Chưa có bản sao D1 được kiểm chứng": "尚無經驗證的 D1 備份",
  "Số lượng bản ghi trên máy chủ": "伺服器資料筆數",
  "Số lượng bên dưới chỉ phản ánh dữ liệu đang có trong D1; dữ liệu JSON được báo riêng.":
    "以下數量僅反映 D1 中的資料；JSON 資料另行列示。",
  "PHÂN HỆ": "模組",
  NGUỒN: "來源",
  "SỐ BẢN GHI": "資料筆數",
  "Đã kiểm tra": "已檢查",
  "Không đọc được": "無法讀取",
  "Dữ liệu đóng gói cùng website": "隨網站封裝的資料",
  "Cảnh báo chất lượng dữ liệu": "資料品質警告",
  "SKU thiếu Line": "缺少產線的 SKU",
  "SKU thiếu Lead Time": "缺少交期的 SKU",
  "R2 lưu file": "R2 檔案儲存",
  "Chưa cấu hình": "尚未設定",
  "Kho thành phẩm": "成品倉庫",
  "Tổng quan": "總覽",
  "Tồn kho thành phẩm": "成品庫存",
  "Nhập kho": "入庫",
  "Xuất kho": "出庫",
  "Chuyển kho": "調撥",
  "Phiếu kho": "倉庫單據",
  "Kiểm kê": "盤點",
  "Báo cáo": "報表",
  "Dữ liệu lượng dùng BOM": "BOM用量資料",
  "Phiếu thay đổi BOM": "BOM變更單",
  "Báo công sản xuất": "生產報工",
  "Điều chỉnh nhân lực": "人力調整",
  "Bổ sung nhân lực": "增加人力",
  "Giảm nhân lực": "減少人力",
  "Khôi phục dữ liệu": "資料復原",
  "Capacity tuần": "週產能",
  "Nhập trạm dòng đang chọn": "選取行進站",
  "Tạm ngưng dòng đang chọn": "暫停選取行",
  "Tiếp tục dòng đang chọn": "繼續選取行",
  "Báo công dòng đang chọn": "選取行報工",
  "Báo sự cố dòng đang chọn": "選取行異常報告",
  "Điều chỉnh nhân lực báo công": "調整報工人力",
  "Điều chỉnh thời gian sản xuất": "調整生產時間",
  "Đăng xuất": "登出",
  "Đăng nhập": "登入",
  "Đăng nhập hệ thống": "系統登入",
  "Đăng nhập người dùng": "使用者登入",
  "Đăng nhập Admin": "管理員登入",
  "CHẾ ĐỘ THIẾT LẬP": "設定模式",
  "Nút Admin đang được phép tự động đăng nhập trên thiết bị này. Phải tắt chế độ này trước khi đưa website vào sử dụng chính thức.":
    "此裝置目前允許管理員自動登入。網站正式使用前必須關閉此模式。",
  "Tự động đăng nhập Admin: Đang bật": "管理員自動登入：已開啟",
  "Trước khi bàn giao hoặc sử dụng chính thức, phải đặt SETUP_ADMIN_AUTO_LOGIN=false.":
    "交付或正式使用前，必須設定 SETUP_ADMIN_AUTO_LOGIN=false。",
  "Tài khoản người dùng": "使用者帳號",
  "Tài khoản quản trị": "管理員帳號",
  "Chỉ tài khoản có vai trò ADMIN hoặc SUPER_ADMIN mới được truy cập.":
    "僅限具有 ADMIN 或 SUPER_ADMIN 角色的帳號存取。",
  "Tài khoản không có quyền quản trị. Vui lòng đăng nhập bằng quyền người dùng phù hợp.":
    "此帳號沒有管理權限，請使用適當權限的使用者帳號登入。",
  "Tài khoản hoặc email": "帳號或電子郵件",
  "Nhập tài khoản hoặc email": "輸入帳號或電子郵件",
  "Nhập tài khoản hoặc email và mật khẩu ONSPA của bạn.":
    "請輸入您的 ONSPA 帳號或電子郵件及密碼。",
  "Quản trị ONSPA": "ONSPA 管理員",
  "Tài khoản ONSPA": "ONSPA 使用者帳號",
  "Sử dụng tài khoản được cấp để vào hệ thống.": "使用已分配的帳號登入系統。",
  "ID đăng nhập": "登入ID",
  "Mật khẩu": "密碼",
  "Nhớ tôi trên thiết bị này": "在此裝置上記住我",
  "Không lưu ID hoặc mật khẩu trên màn hình đăng nhập.":
    "登入畫面不儲存帳號或密碼。",
  "Chọn nhanh Line tại hiện trường hoặc sử dụng tài khoản được cấp.":
    "現場可快速選擇產線，或使用已分配的帳號登入。",
  "ĐĂNG NHẬP NHANH TẠI HIỆN TRƯỜNG": "現場快速登入",
  "Vào Line A": "進入A線",
  "Vào Line B": "進入B線",
  "Chỉ báo công Line A": "僅限A線報工",
  "Chỉ báo công Line B": "僅限B線報工",
  "hoặc đăng nhập bằng tài khoản": "或使用帳號登入",
  "Thiết bị Line A": "A線裝置",
  "Thiết bị Line B": "B線裝置",
  "Đang thao tác": "目前操作",
  "NGHIỆP VỤ THEO LINE": "產線作業",
  "Danh mục sản phẩm chuẩn dùng chung cho KHSX, Sản xuất và Kho.":
    "供生產計畫、生產及倉庫共用的標準產品目錄。",
  "Dữ liệu dùng chung": "共用資料",
  "Thêm SKU": "新增SKU",
  "TÌM KIẾM": "搜尋",
  "NHÓM SẢN PHẨM": "產品組",
  "Tất cả nhóm": "全部產品組",
  "Tất cả Line": "全部產線",
  "Xóa bộ lọc": "清除篩選",
  "Tra cứu": "查詢",
  "Tra cứu SKU": "查詢SKU",
  "Nhập mã SKU, tên sản phẩm hoặc quy cách, sau đó bấm Tra cứu.":
    "輸入SKU編碼、產品名稱或規格，然後點擊查詢。",
  "SKU được tìm thấy": "個SKU已找到",
  "Bấm mã SKU để xem hồ sơ chi tiết →": "點擊SKU編碼查看詳情 →",
  "TÊN SẢN PHẨM": "產品名稱",
  "QUY CÁCH": "規格",
  LINE: "產線",
  "HỒ SƠ SKU": "SKU檔案",
  "Đang sử dụng": "使用中",
  "Chỉnh sửa": "編輯",
  "Thông tin cơ bản": "基本資訊",
  "Tên sản phẩm": "產品名稱",
  "Quy cách": "規格",
  "Nhóm sản phẩm": "產品組",
  "Đơn vị tính": "計量單位",
  "Nhập ĐVT từ PDF": "從 PDF 匯入計量單位",
  "Đang đọc PDF…": "正在讀取 PDF…",
  "KẾT QUẢ NHẬP ĐƠN VỊ TÍNH": "計量單位匯入結果",
  "Xuất cảnh báo Excel": "匯出 Excel 警告",
  "Tổng Mã thành phẩm": "成品編碼總數",
  "SKU khớp": "相符 SKU",
  "ĐVT cập nhật mới": "新增計量單位",
  "ĐVT thay đổi": "已變更計量單位",
  "ĐVT giữ nguyên": "未變更計量單位",
  "SKU không tồn tại": "SKU 不存在",
  "Không có Cấp 0": "找不到第 0 級",
  "Cấp 0 trống ĐVT": "第 0 級計量單位空白",
  "Nhiều dòng Cấp 0": "多筆第 0 級資料",
  "Xung đột ĐVT": "計量單位衝突",
  "Tồn kho theo kho": "按倉庫庫存",
  "Cập nhật": "更新",
  "Xem chi tiết": "查看詳情",
  "Thu gọn": "收起",
  "Tổng tồn": "總庫存",
  "Đang chuyển": "調撥中",
  "Tồn khả dụng": "可用庫存",
  "Thiết lập sản xuất": "生產設定",
  "Chế độ sản xuất": "生產模式",
  "Safety Days": "安全庫存天數",
  "Lead time": "交期",
  "Giờ công chuẩn": "標準工時",
  "Giờ công": "工時",
  "Giờ công/SP": "每件工時",
  "GIỜ CÔNG/SP": "每件工時",
  "Thông tin giờ công": "工時資訊",
  "Giờ công tiêu chuẩn": "標準工時",
  "LINE/CÔNG ĐOẠN": "產線/工序",
  "Line/Công đoạn": "產線/工序",
  "giờ/sản phẩm": "小時/產品",
  "LỊCH SỬ GIỜ CÔNG": "工時歷史",
  "CHI TIẾT GIỜ CÔNG": "工時詳情",
  "GIỜ CÔNG TIÊU CHUẨN": "標準工時",
  "GIỜ CŨ": "原工時",
  "GIỜ MỚI": "新工時",
  "Giờ công cũ": "原工時",
  "Giờ công mới": "新工時",
  "NGƯỜI THAY ĐỔI": "變更人",
  "Quy trình sản xuất": "生產流程",
  "công đoạn": "工序",
  Cắt: "裁切",
  "Lắp ráp": "組裝",
  "Bấm đầu": "壓接",
  "Đóng gói": "包裝",
  "Hoàn thiện": "完工",
  "Được sử dụng tại": "使用模組",
  "Xem lịch sử nhập xuất": "查看出入庫歷史",
  "Tra tồn tại thời điểm": "查詢歷史時點庫存",
  "Mở trong Quản lý kho": "在倉庫管理中開啟",
  "Số tồn chỉ đọc, không sửa trực tiếp trong SKU Master.":
    "庫存為唯讀，不能在SKU主資料中直接修改。",
  "Tổng tồn hiện tại": "目前總庫存",
  "Giá trị tồn kho": "庫存金額",
  "Nhập hôm nay": "今日入庫",
  "Xuất hôm nay": "今日出庫",
  "Phiếu chờ xác nhận": "待確認單據",
  "Tồn trên 90 ngày": "庫齡超過90天",
  "Cảnh báo cần xử lý": "待處理警示",
  "Giao dịch kho gần đây": "最近倉庫交易",
  "MÃ PHIẾU ERP": "ERP單號",
  "NGÀY GIỜ": "日期時間",
  "NGHIỆP VỤ": "作業類型",
  "KHO XUẤT": "出庫倉",
  "KHO NHẬN": "入庫倉",
  "SỐ MẶT HÀNG": "品項數",
  "TỔNG SỐ LƯỢNG": "總數量",
  "TRẠNG THÁI": "狀態",
  "NGƯỜI XÁC NHẬN": "確認人",
  "Tra cứu tồn kho theo thời điểm": "按時間點查詢庫存",
  "Tồn hiện tại": "目前庫存",
  "Tồn tại ngày": "指定日期庫存",
  "Làm mới": "重新整理",
  "Ngày cần tra": "查詢日期",
  "Chọn giờ cụ thể": "選擇特定時間",
  "Giờ cần tra": "查詢時間",
  "Mã hoặc tên SKU": "SKU編碼或名稱",
  Kho: "倉庫",
  "Vị trí": "儲位",
  "Số lô": "批號",
  "Đơn vị": "單位",
  "Tồn dưới mức an toàn": "低於安全庫存",
  "Xuất Excel": "匯出Excel",
  "Thời gian cập nhật": "更新時間",
  "Lịch sử biến động": "異動歷史",
  Trang: "頁",
  "Nhập từ Sản xuất báo công": "從生產報工入庫",
  "Tự nhập bằng phiếu ERP": "透過ERP單據匯入",
  "Sản xuất báo công": "生產報工",
  "Kho kiểm tra thực nhận": "倉庫核對實收",
  "Xác nhận nhập kho": "確認入庫",
  "Mã phiếu báo công": "報工單號",
  "Lệnh sản xuất": "生產工單",
  "Mã thành phẩm": "成品編碼",
  "Tên thành phẩm": "成品名稱",
  "Số lượng báo công": "報工數量",
  "Số lượng thực nhận": "實收數量",
  "Kho nhận": "入庫倉",
  "Vị trí nhận": "接收儲位",
  "Thời gian chuyển": "移交時間",
  "Người bàn giao": "交接人",
  "Chụp hoặc tải phiếu ERP": "拍照或上傳ERP單據",
  "Tải ảnh hoặc PDF": "上傳圖片或PDF",
  "AI đọc dữ liệu": "AI辨識資料",
  "Đối chiếu SKU Master": "核對SKU主資料",
  "Nhân viên kiểm tra": "員工覆核",
  "Xác nhận cập nhật kho": "確認更新庫存",
  "Khớp SKU Master": "符合SKU主資料",
  "Cần kiểm tra": "需要檢查",
  "Không tìm thấy / Không hợp lệ": "未找到/無效",
  "Hệ thống kiểm tra trùng mã phiếu ERP trước khi cập nhật tồn kho.":
    "系統在更新庫存前檢查ERP單號是否重複。",
  "Từ ngày": "開始日期",
  "Đến ngày": "結束日期",
  "Mã phiếu ERP": "ERP單號",
  "Loại nghiệp vụ": "作業類型",
  "Tất cả trạng thái": "全部狀態",
  "Tất cả nghiệp vụ": "全部作業",
  "Chuyển kho TP sang KD": "成品倉調撥至業務倉",
  "Thông tin đầu phiếu": "單據表頭資訊",
  "Loại phiếu": "單據類型",
  "Ngày chứng từ": "單據日期",
  "Ngày chuyển": "調撥日期",
  "Trạng thái ERP": "ERP狀態",
  "Bộ phận": "部門",
  "Xưởng chuyển xuất": "調出車間",
  "Ghi chú": "備註",
  "Số kiện": "件數",
  "Số lần in": "列印次數",
  "Thông tin điều xe": "車輛調度資訊",
  "Số lượng chuyển": "調撥數量",
  "Vị trí xuất": "出庫儲位",
  "Kho TP giảm": "成品倉減少",
  "Kho KD tăng": "業務倉增加",
  "Tổng tồn công ty": "公司總庫存",
  "Không thay đổi": "不變",
  "Hủy phiếu": "取消單據",
  "Chờ AI đọc": "等待AI辨識",
  "Chờ kiểm tra": "等待檢查",
  "Chờ xác nhận cập nhật": "等待確認更新",
  "Chờ kho nhận": "等待倉庫接收",
  "Đã cập nhật kho": "庫存已更新",
  "Có chênh lệch": "存在差異",
  "Có lỗi dữ liệu": "資料錯誤",
  "Đã hủy phiếu": "單據已取消",
  "Lịch sử giao dịch": "交易歷史",
  "Người thực hiện": "操作人",
  "Nguồn dữ liệu": "資料來源",
  "Tồn sau giao dịch": "交易後庫存",
  "Base Forecast": "基礎預測",
  "Demand Event": "需求事件",
  "Đề xuất sản xuất tuần · 05": "週生產建議 · 05",
  "Kế hoạch tuần · 06": "週生產計畫 · 06",
  "Theo dõi lệnh · 04": "工單追蹤 · 04",
  "Forecast Kinh doanh": "業務預測",
  "Thêm nhu cầu": "新增需求",
  "Chuyển hàng loạt sang 06": "批次轉入06",
  "Chốt kế hoạch": "確認計畫",
  "Mở lệnh sản xuất": "開立生產工單",
  "Thêm mới": "新增",
  "Xác nhận": "確認",
  Hủy: "取消",
  "Lưu lại": "儲存",
  "Sửa đổi": "修改",
  "Thêm người dùng": "新增使用者",
  "Danh sách người dùng": "使用者列表",
  "Tên đăng nhập": "登入名稱",
  "Họ và tên": "姓名",
  "Công ty lệ thuộc": "所屬公司",
  "Bộ phận lệ thuộc": "所屬部門",
  "Cho phép đăng nhập": "允許登入",
  "Hoạt động": "啟用",
  "Xóa người dùng": "刪除使用者",
  "Tài khoản mới": "新帳號",
  "CẬP NHẬT NGƯỜI DÙNG": "更新使用者",
  "THÊM NGƯỜI DÙNG": "新增使用者",
  "Quy tắc Safety Days": "安全天數規則",
  "Mỗi nhóm quy tắc có phiên bản, thời gian hiệu lực và quy trình xác nhận riêng.":
    "每個規則群組均有獨立版本、生效時間與確認流程。",
  "CHỨC NĂNG": "功能",
  "Thao tác dữ liệu": "資料操作",
  "Tạo thay đổi": "建立變更",
  "Sửa bản Nháp": "編輯草稿",
  "Xóa bản Nháp": "刪除草稿",
  "Xác nhận và áp dụng": "確認與套用",
  "Từ chối": "拒絕",
  "Thu hồi yêu cầu": "撤回申請",
  "Tra cứu và lịch sử": "查詢與歷史",
  "Xem lịch sử": "查看歷史",
  "Theo Lead Time": "依交期",
  "Theo độ chính xác dự báo": "依預測準確度",
  "Theo tình huống nhu cầu": "依需求情境",
  "Chưa áp dụng": "尚未套用",
  "NHÓM QUY TẮC": "規則群組",
  "PHIÊN BẢN ĐANG HIỂN THỊ": "目前顯示版本",
  "HIỆU LỰC": "生效期間",
  "MÃ QUY TẮC": "規則代碼",
  "PHIÊN BẢN": "版本",
  "NGÀY HIỆU LỰC": "生效日期",
  "NGÀY HẾT HIỆU LỰC": "失效日期",
  "LÝ DO": "原因",
  "NGƯỜI TẠO": "建立者",
  "NGƯỜI GỬI": "送出者",
  "Dữ liệu quy tắc": "規則資料",
  "LEAD TIME TỪ": "交期起",
  "LEAD TIME ĐẾN": "交期迄",
  "SỐ NGÀY AN TOÀN": "安全天數",
  "GHI CHÚ": "備註",
  "Không giới hạn": "無上限",
  "Ngày thiết lập": "設定日期",
  "NGÀY THIẾT LẬP": "設定日期",
  "LÝ DO THAY ĐỔI": "變更原因",
  "LÝ DO THAY ĐỔI *": "變更原因 *",
  "Quy tắc đang áp dụng được giữ nguyên; hệ thống tạo một bản Nháp mới.":
    "目前生效規則維持不變；系統將建立新的草稿版本。",
  "Dữ liệu chỉ được áp dụng sau khi gửi và xác nhận.":
    "資料送出並確認後才會套用。",
  "DỮ LIỆU HIỆN TẠI": "目前資料",
  "Nhập lý do thay đổi": "請輸入變更原因",
  "Nhập từ": "輸入起始值",
  "Nhập số ngày": "輸入天數",
  "Xóa dòng": "刪除列",
  "Hủy thao tác": "取消操作",
  "Lưu Nháp": "儲存草稿",
  "Gửi xác nhận": "送出確認",
  "Lịch sử thay đổi": "變更歷史",
  "LOẠI YÊU CẦU": "申請類型",
  "THỜI GIAN": "時間",
  "PRODUCTION ENGINE ĐÃ DÙNG": "PRODUCTION ENGINE 已使用",
  "Khởi tạo": "建立",
  "Chờ xác nhận": "等待確認",
  "Hết hiệu lực": "已失效",
  Nháp: "草稿",
  "Tạo mới": "新增",
  "Thay đổi": "變更",
  "Đóng tra cứu": "關閉查詢",
  "Tra dữ liệu": "查詢資料",
  "Hiển thị tất cả": "顯示全部",
  "TRA THEO": "查詢依據",
  "NỘI DUNG TRA": "查詢內容",
  "Mã quy tắc": "規則代碼",
  "Phiên bản": "版本",
  "Trạng thái": "狀態",
  "Người tạo": "建立者",
  "Người xác nhận": "確認者",
  "Chọn trạng thái": "選擇狀態",
  "Nhập nội dung cần tra...": "輸入查詢內容...",
  "Chọn một hạng mục rồi nhập nội dung cần tìm.":
    "選擇查詢項目後輸入搜尋內容。",
  "PHIÊN BẢN QUY TẮC": "規則版本",
  "TỔNG SAFETY DAYS": "安全天數合計",
  "TỒN KHO CHỐT": "結存庫存",
  "ĐANG ĐI": "在途量",
  "TUẦN KẾ HOẠCH": "計畫週",
  "CẦN BỔ SUNG?": "需要補充？",
  "SL CẦN BỔ SUNG": "需補充數量",
  "SL SAU MOQ": "MOQ 後數量",
  "ƯU TIÊN": "優先順序",
  "Chưa có": "尚無",
  Leadtime: "交期",
  交期: "交期",
  Sửa: "修改",
  "Hủy xác nhận": "取消確認",
  "Thông tin SKU": "SKU 資料",
  "Dữ liệu Lead Time": "交期資料",
  "Lưu nháp": "儲存草稿",
  "Lưu chờ xác nhận": "儲存待確認",
  "Thông tin đang áp dụng": "目前適用資料",
  "Ngày cộng dự báo": "預測追加天數",
  "Ngày cộng tình huống": "情境追加天數",
  "Safety theo Lead Time": "依交期安全天數",
  "Tổng Safety Days": "安全天數合計",
  "Ngày hiệu lực": "生效日期",
  "Ngày hết hiệu lực": "失效日期",
  "Người cập nhật": "更新人",
  "Thời gian xác nhận": "確認時間",
  "Lý do thay đổi": "變更原因",
  "Xác nhận áp dụng": "確認套用",
  "Không xác nhận": "不確認",
  "Ảnh hưởng dữ liệu": "資料影響",
  "Đi đến SKU Master": "前往 SKU Master",
  Đóng: "關閉",
  "Quay lại danh sách": "返回清單",
  "Quay lại bảng ban đầu": "返回原始表格",
  "Không thể thêm mới Lead Time vì SKU chưa tồn tại trong SKU Master.":
    "無法新增交期，因為該 SKU 不存在於 SKU Master。",
  "Đang áp dụng": "使用中",
  "Đã hủy xác nhận": "已取消確認",
  "Không hợp lệ": "無效",
  "Người dùng web": "網站使用者",
  "Truy cập bằng liên kết": "透過連結存取",
  "Hiệu lực": "生效",
  TỪ: "起",
  ĐẾN: "迄",
  "THAO TÁC": "操作",
  STT: "序號",
};

registerToolbarTerms(zhTerms);
const viTerms = Object.fromEntries(
  Object.entries(zhTerms).map(([vi, zh]) => [zh, vi]),
);

const uiTextOrigins = new WeakMap<Node, {source:string; rendered:string}>();
function applyLanguage(language: Language, root: HTMLElement) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = language === "zh" ? "zh-TW" : language;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    // Row values and user identity are business data, even when they equal a UI term.
    if (node.parentElement?.closest("[data-own-language], [data-business-value], td, input, textarea, script, style")) continue;
    const raw = node.nodeValue || "";
    const old = uiTextOrigins.get(node);
    const source = old && old.rendered === raw ? old.source : raw;
    const rendered = translateToolbar(source, language);
    uiTextOrigins.set(node, {source, rendered});
    if (rendered !== raw) node.nodeValue = rendered;
  }
  root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input[placeholder], textarea[placeholder]").forEach(el => {
    if (!el.closest("[data-own-language]")) el.placeholder = translateToolbar(el.placeholder, language);
  });
}

function LanguageSwitch({
  language,
  onChange,
}: {
  language: Language;
  onChange: (language: Language) => void;
}) {
  return (
    <div className="language-switch" aria-label="Ngôn ngữ / 語言">
      <FeedbackActionButton
        className={language === "vi" ? "active" : ""}
        onClick={() => onChange("vi")}
      >
        VI
      </FeedbackActionButton>
      <FeedbackActionButton
        className={language === "zh" ? "active" : ""}
        onClick={() => onChange("zh")}
      >
        繁體中文
      </FeedbackActionButton>
      <FeedbackActionButton className={language === "en" ? "active" : ""} onClick={() => onChange("en")}>EN</FeedbackActionButton>
    </div>
  );
}

function AutoTablePagination({ resetKey, scopeId, reportKey, exportEnabled }: { resetKey: string; scopeId: string; reportKey:string; exportEnabled:boolean }) {
  useEffect(() => {
    const root = document.getElementById(scopeId);
    if(!root)return;
    // Shared table viewport for every current and future menu, including its pager.
    const selector = ".app-shell .table-wrap, .app-shell .pp-table, .app-shell .it-table";
    let frame = 0;
    const observed = new Set<Element>();
    const observedPagers=new Set<Element>();
    const measure = () => {
      frame = 0;
      const currentPagers=new Set<Element>();
      root.querySelectorAll<HTMLElement>(selector).forEach((wrap) => {
        if (!wrap.getClientRects().length) return;
        const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
        const next = (wrap.closest("[data-pagination-owner]")?.querySelector(":scope > .onspa-manual-pagination") ?? wrap.nextElementSibling) as HTMLElement | null;
        const pagerHeight = next?.matches(".table-pagination, .pp-pagination, .it-pagination, .onspa-manual-pagination")
          ? next.getBoundingClientRect().height : 44;
        if(next?.matches(".table-pagination, .pp-pagination, .it-pagination, .onspa-manual-pagination")){currentPagers.add(next);if(!observedPagers.has(next)){observedPagers.add(next);resize.observe(next);}}
        const height = Math.max(160, Math.floor(viewportHeight - Math.max(0, wrap.getBoundingClientRect().top) - pagerHeight - 20));
        const value = `${height}px`;
        if (wrap.style.getPropertyValue("--onspa-table-height") !== value)
          wrap.style.setProperty("--onspa-table-height", value);
        const workspace = wrap.closest("main");
        if (workspace && !observed.has(workspace)) {
          observed.add(workspace);
          resize.observe(workspace);
        }
      });
      for(const pager of observedPagers)if(!currentPagers.has(pager)){resize.unobserve(pager);observedPagers.delete(pager);}
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    // A change to our own table height also resizes main. Only width changes
    // require remeasuring here; content and viewport changes have separate triggers.
    const widths = new WeakMap<Element, number>();
    const pagerHeights=new WeakMap<Element,number>();
    const resize = new ResizeObserver(entries => {
      let changed = false;
      for (const entry of entries) {
        if(observedPagers.has(entry.target)&&pagerHeights.get(entry.target)!==entry.contentRect.height){pagerHeights.set(entry.target,entry.contentRect.height);changed=true;}
        const width = entry.contentRect.width;
        if (widths.get(entry.target) !== width) {
          widths.set(entry.target, width);
          changed = true;
        }
      }
      if (changed) schedule();
    });
    const mutations = new MutationObserver(records => {
      // Pager text/buttons change on every click; they do not change the layout
      // above the table and must not feed back into viewport measurement.
      if (!root.hidden && records.some(record => !(record.target instanceof Element && record.target.closest("table,.table-pagination")))) schedule();
    });
    mutations.observe(root, { childList: true, subtree: true });
    window.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("resize", schedule);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutations.disconnect();
      window.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
    };
  }, [resetKey,scopeId]);
  useEffect(() => {
    const root = document.getElementById(scopeId);
    if(!root)return;
    const cleanups: Array<() => void> = [];
    const renderers=new Set<()=>void>();
    const tableRenderers=new WeakMap<HTMLTableElement,()=>void>();
    const unsubscribeLocale=subscribeToolbarLocale(()=>renderers.forEach(render=>render()));
    const setup = () => {
      root
        .querySelectorAll<HTMLElement>(".table-pagination")
        .forEach((pager) => {
          if (!pager.previousElementSibling?.classList.contains("table-wrap"))
            pager.remove();
        });
      root
        .querySelectorAll<HTMLTableElement>(".app-shell .table-wrap > table")
        .forEach((table) => {
          if (table.dataset.noPagination === "true") return;
          const body = table.tBodies[0];
          if (!body) return;
          // A no-data placeholder is presentation, not a data record.
          // Keep real expanded/grouped rows eligible for pagination.
          const allRows = Array.from(body.rows);
          const rows = allRows.filter(row => !isPaginationPlaceholder(row));
          const signature = rows
            .map((row) => row.textContent?.replace(/\s+/g, " ").trim() || "")
            .join("|");
          if (
            table.dataset.paginationReady === "true" &&
            table.dataset.paginationSignature === signature
          )
            return;
          const previousPage = Number(table.parentElement?.nextElementSibling?.getAttribute("data-page") || 1);
          if (table.dataset.paginationReady === "true") {
            const oldRender=tableRenderers.get(table);if(oldRender)renderers.delete(oldRender);
            const existingPager = table.parentElement?.nextElementSibling;
            if (existingPager?.classList.contains("table-pagination"))
              existingPager.remove();
            delete table.dataset.paginationReady;
          }
          table.dataset.paginationSignature = signature;
          const pageSize = Number(
            table.dataset.pageSize ||
              (table.closest(".planning-workspace") ? 20 : 10),
          );
          // Even a single page or an empty dataset keeps a functional footer.
          table.dataset.paginationReady = "true";
          const wrap = table.parentElement!;
          const old = wrap.nextElementSibling;
          if (old?.classList.contains("warehouse-pagination"))
            old.classList.add("legacy-pagination");
          const pager = document.createElement("div");
          pager.className = "table-pagination onspa-pagination";
          const info = document.createElement("span");
          info.className = "onspa-pagination-summary";
          const nav = document.createElement("div");
          nav.className = "onspa-pagination-pages";
          pager.append(info, nav);
          wrap.insertAdjacentElement("afterend", pager);
          const total = paginationModel(rows.length,1,pageSize).pages;
          let page = Math.max(1, Math.min(total, previousPage));
          const render = () => {
            const locale=toolbarLocale(),labels=paginationLabels(locale);
            const model=paginationModel(rows.length,page,pageSize);
            pager.dataset.page = String(page);
            const start = (page - 1) * pageSize;
            rows.forEach(
              (row, index) =>
                {
                  const hidden = index < start || index >= start + pageSize;
                  if (row.hidden !== hidden) row.hidden = hidden;
                },
            );
            info.textContent = paginationSummary(model,locale);
            nav.replaceChildren();
            nav.setAttribute("role", "navigation");
            nav.setAttribute("aria-label", labels.navigation);
            const addButton = (
              label: string,
              target: number,
              active = false,
              disabled = false,
            ) => {
              const button = document.createElement("button");
              button.type = "button";
              button.textContent = label;
              button.disabled = disabled;
              if (active) button.className = "active";
              button.setAttribute('aria-label', label === '‹' ? labels.previous : label === '›' ? labels.next : `${labels.page} ${label}`);
              const unavailableReason = rows.length === 0
                ? locale === "en" ? "There are no rows to paginate." : locale === "zh" ? "目前沒有可分頁的資料。" : "Chưa có dữ liệu để chuyển trang."
                : label === "‹"
                  ? locale === "en" ? "You are on the first page." : locale === "zh" ? "目前已是第一頁。" : "Bạn đang ở trang đầu tiên."
                  : locale === "en" ? "You are on the last page." : locale === "zh" ? "目前已是最後一頁。" : "Bạn đang ở trang cuối cùng.";
              button.onclick = () => {
                if (disabled) return;
                if (page === target) {
                  notifyActionFailure(locale === "en" ? "You are already on this page." : locale === "zh" ? "您已在此頁面。" : "Bạn đang ở trang này.", button);
                  return;
                }
                page = target;
                render();
                wrap.scrollTo({ top: 0, behavior: "instant" });
              };
              if (disabled) {
                // Keep the actual control disabled; only the local explanation target is interactive.
                const explanation = document.createElement("span");
                explanation.className = actionFeedbackStyles.explanation;
                explanation.setAttribute("role", "button");
                explanation.setAttribute("aria-disabled", "true");
                explanation.setAttribute("aria-label", button.getAttribute("aria-label") || label);
                explanation.tabIndex = 0;
                explanation.title = unavailableReason;
                button.tabIndex = -1;
                button.setAttribute("aria-hidden", "true");
                const explain = (event: MouseEvent | KeyboardEvent) => {
                  event.preventDefault(); event.stopPropagation();
                  notifyActionFailure(unavailableReason, explanation);
                };
                explanation.onclick = explain;
                explanation.onkeydown = event => { if (event.key === "Enter" || event.key === " ") explain(event); };
                explanation.append(button);
                nav.append(explanation);
              } else nav.append(button);
            };
            addButton("‹", Math.max(1, page - 1), false, page === 1);
            paginationPages(page,total).forEach(value=>{
              if(value==='ellipsis'){const dots=document.createElement('span');dots.className='pagination-ellipsis';dots.setAttribute('aria-hidden','true');dots.textContent='…';nav.append(dots);return;}
              addButton(String(value),value,value===page,rows.length===0);
              if(value===page)nav.lastElementChild?.setAttribute('aria-current','page');
            });
            addButton("›", Math.min(total, page + 1), false, page === total);
          };
          tableRenderers.set(table,render);
          renderers.add(render);
          render();
          cleanups.push(() => {
            renderers.delete(render);
            rows.forEach((row) => (row.hidden = false));
            delete table.dataset.paginationReady;
            delete table.dataset.paginationSignature;
            pager.remove();
            old?.classList.remove("legacy-pagination");
          });
        });
    };
    let frame = 0;
    let disposed = false;
    const scheduleSetup = () => {
      if (disposed || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!disposed) setup();
      });
    };
    scheduleSetup();
    const observer = new MutationObserver(records => {
      // Only changes to tables can invalidate row pagination. Ignore our own
      // pager mutations and unrelated menu/toolbar updates.
      if (records.some(record => paginationMutation(record))) scheduleSetup();
    });
    observer.observe(root, { subtree: true, childList: true });
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      unsubscribeLocale();
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [resetKey,scopeId]);
  return <TableReports scopeId={scopeId} resetKey={reportKey} enabled={exportEnabled}/>;
}

type Sku = ApprovalItem & {
  code: string;
  revision?: number;
  name: string;
  specification: string;
  group: string;
  line: string;
  moq: number;
  mode: string;
  safetyDays: number;
  leadTime: string;
  standardHours: string;
  unit: string;
  status: string;
  processes?: string[];
};

type SkuHistoryVersion = {
  id: string;
  sku: string;
  version: number;
  validFrom?: string;
  validTo?: string;
  changedAt: string;
  changedBy: string;
  data: Sku;
};

type LeadtimeRow = {
  cancelled?:boolean;
  retainedLeadTime?:number;
  sku: string;
  name: string;
  spec: string;
  group: string;
  line: string;
  ltProduction: number;
  ltQc: number;
  ltWarehouse: number;
  note: string;
  leadTime: number;
  moq: number;
  updatedBy?: string;
  updatedAt?: string;
  _deleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
};
type SafetyDayRow = {
  sku: string;
  name: string;
  spec: string;
  group: string;
  line: string;
  leadTime: number;
  safetyDays: number;
  note: string;
  _deleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
};
type SafetyRuleRange = {
  sku?: string;
  group?: string;
  from: number;
  to: number | null;
  days: number;
  status: "Đang áp dụng" | "Chưa áp dụng";
  note: string;
};
type ForecastAccuracyRule = {
  from: number | null;
  to: number | null;
  days: number;
  status: "Đang áp dụng" | "Chưa áp dụng";
  note: string;
};
type DemandSituationRule = {
  code: string;
  name: string;
  days: number;
  status: "Đang áp dụng" | "Chưa áp dụng";
  note: string;
};
type SafetyRuleSet = {
  id: string;
  code: string;
  name: string;
  version: string;
  effectiveFrom: string;
  effectiveTo: string;
  status:
    | "Nháp"
    | "Chờ xác nhận"
    | "Đã xác nhận"
    | "Đang áp dụng"
    | "Sắp có hiệu lực"
    | "Hết hiệu lực"
    | "Đã hủy xác nhận";
  leadTimeRules: SafetyRuleRange[];
  forecastRules: ForecastAccuracyRule[];
  situationRules: DemandSituationRule[];
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  confirmedBy?: string;
  confirmedAt?: string;
  changeReason: string;
  usedByPlans?: string[];
  _deleted?: boolean;
};
type SafetyRuleGroup = "leadtime" | "forecast" | "situation";
type SafetyGroupStatus =
  | "Nháp"
  | "Chờ xác nhận"
  | "Đã xác nhận – Chờ hiệu lực"
  | "Đang áp dụng"
  | "Hết hiệu lực"
  | "Đã hủy"
  | "Từ chối";
type SafetyGroupVersion = {
  id: string;
  group: SafetyRuleGroup;
  code: string;
  version: string;
  effectiveFrom: string;
  effectiveTo: string;
  status: SafetyGroupStatus;
  rows: Array<SafetyRuleRange | ForecastAccuracyRule | DemandSituationRule>;
  reason: string;
  note: string;
  createdBy: string;
  createdAt: string;
  submittedBy?: string;
  submittedAt?: string;
  confirmedBy?: string;
  confirmedAt?: string;
  updatedBy: string;
  updatedAt: string;
  usedByPlans?: string[];
  sourceId?: string;
  requestType?: "Tạo mới" | "Thay đổi" | "Ngừng áp dụng";
  _deleted?: boolean;
};
const leadtimeRows = leadtimeData as LeadtimeRow[];
const leadtimeBySku = new Map(
  leadtimeRows.map((row) => [row.sku.toUpperCase(), row]),
);
const safetyDaysBySku = new Map<string, SafetyDayRow>();
const browserId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const defaultSafetyRuleSet = basicDefaultSafetyRuleSet as SafetyRuleSet;
let safetyRuleSets: SafetyRuleSet[] = [];
const activeSafetyRuleFor = (weekStart: string, rules = safetyRuleSets) =>
  rules
    .filter(
      (rule) =>
        !rule._deleted &&
        ["Đã xác nhận", "Đang áp dụng", "Sắp có hiệu lực"].includes(
          rule.status,
        ) &&
        rule.effectiveFrom <= weekStart &&
        (!rule.effectiveTo || rule.effectiveTo >= weekStart),
    )
    .sort(
      (a, b) =>
        b.effectiveFrom.localeCompare(a.effectiveFrom) ||
        b.version.localeCompare(a.version),
    )[0];
const safetyBreakdown = (leadTime: number, rule?: SafetyRuleSet) => {
  if (!leadTime || leadTime < 1)
    return { leadTimeDays: 0, forecastDays: 0, situationDays: 0, total: 0 };
  const lead = rule?.leadTimeRules.find(
    (item) =>
      item.status === "Đang áp dụng" &&
      leadTime >= item.from &&
      (item.to === null || leadTime <= item.to),
  );
  const forecastDays = 0;
  const situationDays = 0;
  const leadTimeDays = lead?.days ?? 0;
  return {
    leadTimeDays,
    forecastDays,
    situationDays,
    total: leadTimeDays + forecastDays + situationDays,
  };
};
const safetyDaysForSku = (_sku: string, leadTime: number) =>
  safetyBreakdown(
    leadTime,
    activeSafetyRuleFor(vietnamDate()),
  ).total;
type InventoryErpRow = {
  sku: string;
  name: string;
  spec: string;
  unit: string;
  warehouse: "TP" | "KD";
  qty: number;
  snapshotAt: string;
};
const inventoryErpRows = inventoryErpData as InventoryErpRow[];
const erpStockBySku = new Map<string, number>();
inventoryErpRows.forEach((row) =>
  erpStockBySku.set(
    row.sku,
    (erpStockBySku.get(row.sku) || 0) + Number(row.qty || 0),
  ),
);

type InventorySnapshotItem = {
  sku: string;
  name: string;
  spec: string;
  unit: string;
  tpQty: number;
  kdQty: number;
  totalQty: number;
  sourceUpdatedAt: string;
};
type InventorySnapshot = {
  id: string;
  code: string;
  weekKey: string;
  weekStart: string;
  weekEnd: string;
  snapshotAt: string;
  skuCount: number;
  totalTp: number;
  totalKd: number;
  totalStock: number;
  createdBy: string;
  status:
    | "Đã chốt"
    | "Đã được Production_engine sử dụng"
    | "Đã mở chốt"
    | "Đã thay thế bằng phiên bản mới";
  reopenReason?: string;
  reopenedBy?: string;
  reopenedAt?: string;
  replacesSnapshotId?: string;
  replacedBySnapshotId?: string;
  usedByEngineAt?: string;
  sourceImportKey?: string;
  items: InventorySnapshotItem[];
};
type InventoryImportRecord = {
  key: string;
  weekKey: string;
  sourceFile: string;
  importedAt: string;
  importedBy: string;
  status?: string;
  snapshotId?: string;
  _deleted?: boolean;
  cancelledBy?: string;
  cancelledAt?: string;
  rows: InventoryErpRow[];
};
type InventoryImportChange = {
  sku: string;
  warehouse: string;
  kind: "Thêm mới" | "Không còn trong file" | "Thay đổi";
  field: string;
  before: string;
  after: string;
};
const compareInventoryImports = (
  current: InventoryImportRecord,
  previous?: InventoryImportRecord,
): InventoryImportChange[] => {
  if (!previous) return [];
  const keyOf = (row: InventoryErpRow) => `${normalizeSkuCode(row.sku)}|${row.warehouse}`;
  const before = new Map(previous.rows.map((row) => [keyOf(row), row]));
  const after = new Map(current.rows.map((row) => [keyOf(row), row]));
  const changes: InventoryImportChange[] = [];
  const fields: Array<[keyof InventoryErpRow, string]> = [
    ["name", "Tên sản phẩm"], ["spec", "Quy cách"], ["unit", "Đơn vị"], ["qty", "Tồn kho"],
  ];
  new Set([...before.keys(), ...after.keys()]).forEach((key) => {
    const oldRow = before.get(key);
    const newRow = after.get(key);
    const sample = newRow || oldRow!;
    if (!oldRow || !newRow) {
      changes.push({
        sku: sample.sku,
        warehouse: sample.warehouse,
        kind: oldRow ? "Không còn trong file" : "Thêm mới",
        field: "Dòng tồn kho",
        before: oldRow ? Number(oldRow.qty || 0).toLocaleString("vi-VN") : "—",
        after: newRow ? Number(newRow.qty || 0).toLocaleString("vi-VN") : "—",
      });
      return;
    }
    fields.forEach(([field, label]) => {
      if (String(oldRow[field] ?? "") === String(newRow[field] ?? "")) return;
      changes.push({
        sku: newRow.sku,
        warehouse: newRow.warehouse,
        kind: "Thay đổi",
        field: label,
        before: field === "qty" ? Number(oldRow.qty || 0).toLocaleString("vi-VN") : String(oldRow[field] || "—"),
        after: field === "qty" ? Number(newRow.qty || 0).toLocaleString("vi-VN") : String(newRow[field] || "—"),
      });
    });
  });
  return changes;
};
const weekKeyOf = (value: string) => {
  const d = mondayOf(new Date(`${value}T00:00:00`));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const snapshotStockMap = (snapshot?: InventorySnapshot) =>
  new Map((snapshot?.items || []).map((item) => [item.sku, item.totalQty]));
let inventorySnapshotsCache: InventorySnapshot[] | null = null;
let inventorySnapshotsPromise: Promise<InventorySnapshot[]> | null = null;
let inventoryImportsCache: InventoryImportRecord[] | null = null;
let inventoryImportsPromise: Promise<InventoryImportRecord[]> | null = null;
const assertCurrentClientSession = (session: number) => {
  if (session !== clientSessionGeneration()) throw new ClientSessionReadCancelled();
};
const loadInventoryImports = async (): Promise<InventoryImportRecord[]> => {
  const browser = typeof window !== "undefined";
  const session = clientSessionGeneration();
  if (browser && inventoryImportsCache) return inventoryImportsCache;
  if (browser && inventoryImportsPromise) return inventoryImportsPromise;
  const request = recordFetch("/api/records?entity=inventory", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Không thể tải dữ liệu tồn kho theo tuần.");
        const data = await response.json();
        assertCurrentClientSession(session);
        const allRecords: InventoryImportRecord[] = (data.records || [])
          .filter((record: { payload?: { rows?: InventoryErpRow[] } }) => Array.isArray(record.payload?.rows))
          .map((record: { key: string; payload: Omit<InventoryImportRecord, "key"> }) => ({ key: record.key, ...record.payload }))
          .sort((a: InventoryImportRecord, b: InventoryImportRecord) => String(b.importedAt || "").localeCompare(String(a.importedAt || "")));
        if (browser) inventoryImportsCache = allRecords;
        return allRecords;
      })
      .finally(() => { if (inventoryImportsPromise === request) inventoryImportsPromise = null; });
  if (browser) inventoryImportsPromise = request;
  return request;
};
const loadInventorySnapshots = async (): Promise<InventorySnapshot[]> => {
  const browser = typeof window !== "undefined";
  const session = clientSessionGeneration();
  if (browser && inventorySnapshotsCache) return inventorySnapshotsCache;
  if (browser && inventorySnapshotsPromise) return inventorySnapshotsPromise;
  const request = recordFetch(
      "/api/records?entity=inventory_snapshot",
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("Không thể tải lịch sử chốt tồn");
        const data = await response.json();
        assertCurrentClientSession(session);
        const snapshots: InventorySnapshot[] = data.records.map(
          (record: { payload: InventorySnapshot }) => record.payload,
        );
        if (browser) inventorySnapshotsCache = snapshots;
        return snapshots;
      })
      .finally(() => {
        if (inventorySnapshotsPromise === request) inventorySnapshotsPromise = null;
      });
  if (browser) inventorySnapshotsPromise = request;
  return request;
};
const saveInventorySnapshot = async (
  snapshot: InventorySnapshot,
  updatedBy: string,
) => {
  const session = clientSessionGeneration();
  const response = await recordFetch("/api/records", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      entity: "inventory_snapshot",
      key: snapshot.id,
      payload: snapshot,
      updatedBy,
    }),
  });
  if (!response.ok) throw new Error("Không thể lưu bản chốt tồn");
  assertCurrentClientSession(session);
  inventorySnapshotsCache = null;
};

const skuDetailOverrides: Record<string, Partial<Sku>> = {};

const originalSkus: Sku[] = (
  skuTpData as Array<{
    group: string;
    code: string;
    name: string;
    specification: string;
    line: string;
    unit: string;
    source: string;
    processes: string[];
  }>
).map((row) => {
  const lead = leadtimeBySku.get(row.code.toUpperCase());
  return {
    code: row.code,
    name: row.name,
    specification: row.specification || "—",
    group: row.group,
    line: row.line ? `Line ${row.line}` : "—",
    moq: 0,
    mode: "Tự sản xuất",
    safetyDays: 0,
    leadTime: "Chưa thiết lập",
    standardHours: "Chưa thiết lập",
    unit: row.unit || "—",
    status: "Đang sử dụng",
    processes: row.processes,
    ...skuDetailOverrides[row.code],
    ...(lead
      ? {
          moq: lead.moq,
          safetyDays: safetyDaysForSku(row.code, lead.leadTime),
          leadTime: `${lead.leadTime} ngày`,
        }
      : {}),
  };
});
const inHouseProcessingSkus = new Set<string>();
const btpAssemblySkus = new Set<string>();
const normalizeSkuGroup = (group: string, code: string) => {
  if (btpAssemblySkus.has(code.toUpperCase())) return "LẮP RÁP BTP";
  const normalized = group
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  if (normalized !== "GIA CONG") return group;
  return inHouseProcessingSkus.has(code.toUpperCase())
    ? "GIA CÔNG TRONG XƯỞNG"
    : "GIA CÔNG NGOÀI";
};
const importedSkus: Sku[] = (
  skuExtraData as Array<{
    group: string;
    code: string;
    name: string;
    specification: string;
    line: string;
    unit: string;
    source: string;
  }>
).map((row) => {
  const group = normalizeSkuGroup(row.group, row.code);
  const lead = leadtimeBySku.get(row.code.toUpperCase());
  const externalProcessing = group === "GIA CÔNG NGOÀI";
  return {
    code: row.code,
    name: row.name,
    specification: row.specification || "—",
    group,
    line: externalProcessing
      ? "—"
      : row.line
        ? /^Line /i.test(row.line)
          ? row.line
          : `Line ${row.line}`
        : "—",
    unit: row.unit || "—",
    moq: lead?.moq || 0,
    mode: row.source === "BTP" ? "Tự sản xuất" : row.source,
    safetyDays: safetyBreakdown(
      lead?.leadTime || 0,
      activeSafetyRuleFor(vietnamDate()),
    ).total,
    leadTime: lead?.leadTime ? `${lead.leadTime} ngày` : "Chưa thiết lập",
    standardHours: "Chưa thiết lập",
    status: "Đang sử dụng",
    processes: externalProcessing
      ? []
      : (
          skuProcessData as Record<
            string,
            { line: string; processes: string[] }
          >
        )[row.code]?.processes || [],
  };
});
const skus: Array<Sku> = Array.from(
  new Map(
    [...importedSkus, ...originalSkus].map((row) => [
      row.code.toUpperCase(),
      row,
    ]),
  ).values(),
);
const BusinessSkuContext = createContext<Sku[]>([]);
const BomSourceSkuContext = createContext<Sku[]>([]);
const purchasedSkuCodes = new Set(
  skus
    .filter((item) => item.mode === "Mua hàng")
    .map((item) => item.code.toUpperCase()),
);
const hasProductionProcess = (sku: Sku) =>
  sku.mode !== "Mua hàng" && sku.mode !== "Gia công";

type BomItem = {
  stt: string;
  code: string;
  name: string;
  spec: string;
  waste: string;
  qty: string;
  unit: string;
  source: "" | "Mua" | "Tự chế" | "Ủy thác";
  check?: "Khớp" | "Sai số làm tròn" | "Cần kiểm tra";
  denominator?: string;
  setup?: string;
  effective?: string;
  expiry?: string;
};

const finishedBom: BomItem[] = [];

const btpBom: Record<string, BomItem[]> = {};

function BomView() { return <p>Không có dữ liệu mẫu trong bản xuất source.</p>; }

type BomCatalogRecord = {
  sku: string;
  name: string;
  spec: string;
  unit: string;
  version: string;
  status: string;
  category: string;
  group?: string;
  itemType: string;
  setup?: string;
  changeDate?: string;
  modifiedDate?: string;
  confirmedDate?: string;
  confirmedBy?: string;
  changeDocument?: string;
  items: BomItem[];
};
const legacyBomCatalog: Omit<BomCatalogRecord, "category" | "itemType">[] = [];

const originalBomCatalog = (bomData as BomCatalogRecord[]).filter(
  (row) => !purchasedSkuCodes.has(row.sku.toUpperCase()),
);
const originalBomBySku = new Map<string,BomCatalogRecord>();
for(const row of originalBomCatalog)if(!originalBomBySku.has(row.sku))originalBomBySku.set(row.sku,row);
const getOriginalBomDate = (sku: string) => {
  const original = originalBomBySku.get(sku);
  const effectiveDates = (original?.items || [])
    .map((item) => item.effective)
    .filter((date): date is string => Boolean(date && date !== "—"));
  return original?.setup || effectiveDates[0] || "";
};
const normalizeBomIdentityDates = (record: BomCatalogRecord) => {
  const originalDate = getOriginalBomDate(record.sku);
  if (!originalDate) return record;
  return {
    ...record,
    setup: originalDate,
    confirmedDate: originalDate,
    confirmedBy: "SETUP_ADMIN",
  };
};
let bomCatalog: BomCatalogRecord[] = originalBomCatalog.map((row) => ({
  ...row,
  status: "Đã xác nhận",
  setup: getOriginalBomDate(row.sku),
  confirmedDate: getOriginalBomDate(row.sku),
  confirmedBy: "SETUP_ADMIN",
}));
const initialBomCatalog = structuredClone(bomCatalog);
const originalBomMasterOptions = Array.from(
  new Map(
    [
      ...skus.map((item) => ({
        code: item.code,
        name: item.name,
        spec: item.specification,
        unit: item.unit,
        source: (item.mode === "Gia công"
          ? "Ủy thác"
          : item.mode === "Mua hàng"
            ? "Mua"
            : "Tự chế") as "Mua" | "Tự chế" | "Ủy thác",
      })),
      ...bomCatalog.flatMap((b) => [
        {
          code: b.sku,
          name: b.name,
          spec: b.spec,
          unit: b.unit,
          source: "Tự chế" as const,
        },
        ...b.items.map((item) => ({
          code: item.code,
          name: item.name,
          spec: item.spec,
          unit: item.unit,
          source: item.source,
        })),
      ]),
    ]
      .filter((item) => item.code)
      .map((item) => [item.code, item]),
  ).values(),
);

function BomLookupView({ operator, canReconcile=false }: { operator: string; canReconcile?: boolean }) {
  const [reconcileOpen,setReconcileOpen]=useState(false);
  const skus = useContext(BusinessSkuContext);
  const sourceSkus = useContext(BomSourceSkuContext);
  const sourceFor = bomSourceResolver(sourceSkus);
  const resolveMetadata = useMemo(() => bomMetadataResolver(sourceSkus, originalBomCatalog), [sourceSkus]);
  const metadataFor = (bom: BomCatalogRecord): BomCatalogRecord => resolveMetadata(bom);
  const bomMasterOptions = [...originalBomMasterOptions, ...skus.filter(sku => !originalBomMasterOptions.some(item => item.code === sku.code)).map(sku => ({code:sku.code,name:sku.name,spec:sku.specification,unit:sku.unit,source:sourceFor(sku.code)}))].map(item => ({...item, source: sourceFor(item.code, item.source)}));
  const setupDateDisplay = new Date().toLocaleDateString("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
  });
  const [query, setQuery] = useState("");
  const [searchMode, setSearchMode] = useState<
    "parentSku" | "parentName" | "componentSku"
  >("parentSku");
  const [selected, setSelected] = useState<BomCatalogRecord | null>(null);
  const [hierarchyRoot, setHierarchyRoot] = useState<BomCatalogRecord | null>(null);
  const [mode, setMode] = useState<"view" | "edit" | "create">("view");
  const [confirmed, setConfirmed] = useState(true);
  const [notice, setNotice] = useState("");
  const [noticeIsError,setNoticeIsError]=useState(false);
  const [showMeta, setShowMeta] = useState(true);
  const [confirmedBy, setConfirmedBy] = useState("sample_user_15");
  const [suggestRow, setSuggestRow] = useState<number | null>(null);
  const [parentSuggestOpen, setParentSuggestOpen] = useState(false);
  const [parentSkuError, setParentSkuError] = useState("");
  const [editingBomSku, setEditingBomSku] = useState("");
  const [highlighted, setHighlighted] = useState<BomCatalogRecord | null>(null);
  const [statusFilter, setStatusFilter] = useState("Tất cả");
  const [searchOpen, setSearchOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  useApprovalNavigation(['bom'],()=>{setQuery('');setStatusFilter('Chờ xác nhận');setSelected(null);setMode('view');setHistoryOpen(false);setSearchOpen(true);setItemStatusFilter('Tất cả');});
  const [itemStatusFilter, setItemStatusFilter] = useState<
    "Đang sử dụng" | "Ngưng sử dụng" | "Tất cả"
  >("Đang sử dụng");
  const [changeHistory, setChangeHistory] = useState<BomChangeHistory[]>([]);
  const [pendingChangeSkus, setPendingChangeSkus] = useState<Set<string>>(
    new Set(),
  );
  useEffect(() => {
    recordFetch("/api/records?entity=bom_change")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) =>
        (() => {
          const saved = data.records.map(hydrateBomChangeRecord);
          setChangeHistory(saved);
          setPendingChangeSkus(
            new Set(
              saved
                .filter(
                  (record: BomChangeHistory) =>
                    record.status === "Nháp" ||
                    record.status === "Chờ xác nhận",
                )
                .flatMap((record: BomChangeHistory) => record.skus || [record.sku]),
            ),
          );
        })(),
      )
      .catch(() => {});
  }, []);
  const displayStatus = (record: BomCatalogRecord) =>
    pendingChangeSkus.has(record.sku)
      ? "Có thay đổi chờ xác nhận"
      : record.status;
  const filtered = bomCatalog.map(metadataFor)
    .filter((x) => skus.some((s) => s.code === x.sku))
    .filter((x) => {
      const keyword = query.trim().toLowerCase();
      const matchesStatus =
        statusFilter === "Tất cả" || displayStatus(x) === statusFilter;
      if (!matchesStatus) return false;
      if (searchMode === "parentSku")
        return x.sku.toLowerCase().startsWith(keyword);
      if (searchMode === "parentName")
        return x.name.toLowerCase().includes(keyword);
      return x.items.some((item) =>
        item.code.toLowerCase().startsWith(keyword),
      );
    })
    .sort(
      (a, b) =>
        a.category.localeCompare(b.category, "vi", { numeric: true }) ||
        a.sku.localeCompare(b.sku, "vi", { numeric: true }),
    );
  const openBom = (record: BomCatalogRecord) => {
    setSelected(metadataFor(record));
    setSearchOpen(false);
    setQuery("");
    setMode("view");
    const isConfirmed = record.status === "Đã xác nhận";
    setConfirmed(isConfirmed);
    setConfirmedBy(isConfirmed ? record.confirmedBy || "SETUP_ADMIN" : "");
    setNotice("");
    setShowMeta(true);
    setHistoryOpen(false);
    setItemStatusFilter("Đang sử dụng");
  };
  const openSearchedBom = () => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return;
    const exact =
      bomCatalog.find((row) => row.sku.toLowerCase() === keyword) ||
      bomCatalog.find((row) => row.name.toLowerCase() === keyword);
    const match = exact || filtered[0];
    if (match) openBom(match);
  };
  const createBom = () => {
    setEditingBomSku("");
    setParentSkuError("");
    setSelected({
      sku: "",
      name: "",
      spec: "",
      unit: "CÁI",
      version: "0001",
      status: "Chưa xác nhận",
      category: "THÀNH PHẨM",
      itemType: "Hàng tự chế",
      setup: setupDateDisplay,
      items: [
        {
          stt: "0010",
          code: "",
          name: "",
          spec: "",
          waste: "—",
          qty: "",
          denominator: "1",
          setup: setupDateDisplay,
          effective: "—",
          expiry: "—",
          unit: "CÁI",
          source: "",
        },
      ],
    });
    setMode("create");
    setNoticeIsError(false);
    setConfirmed(false);
    setConfirmedBy("");
    setNotice("");
    setShowMeta(false);
  };
  const cancelAction = () => {
    if (mode === "create") {
      setSelected(null);
      setMode("view");
    } else {
      setMode("view");
    }
    setNotice("");
  };
  const getParentSkuError = (value: string) => {
    const code = value.trim().toUpperCase();
    if (!code) return "Vui lòng nhập mã SKU.";
    const found = skus.find((item) => item.code.trim().toUpperCase() === code);
    if (!found)
      return `Không thể tạo BOM vì SKU ${code} chưa tồn tại trong SKU Master.`;
    const missing = [
      !found.name && "Tên sản phẩm",
      !found.group && "Nhóm sản phẩm",
    ].filter(Boolean);
    if (missing.length)
      return `Không thể tạo BOM vì SKU Master còn thiếu: ${missing.join(", ")}.`;
    const existingBom = bomCatalog.find(
      (item) => item.sku.trim().toUpperCase() === code,
    );
    if (existingBom && editingBomSku !== code)
      return existingBom.status === "Chờ xác nhận"
        ? `Không thể tạo lại BOM. SKU ${code} đã có BOM mới đang chờ xác nhận; vui lòng xác nhận hoặc hủy BOM trước đó.`
        : `Không thể thêm mới vì SKU ${code} đã có BOM.`;
    return "";
  };
  const validateParentSku = (value: string) =>
    setParentSkuError(getParentSkuError(value));
  const confirmBom = async () => {
    setNoticeIsError(true);
    if (selected?.items.some(item => normalizeBomWaste(item.waste) === null)) {
      setNotice("Hao hụt phải là tỷ lệ phần trăm không âm.");
      return;
    }
    const validationError = getParentSkuError(selected?.sku || "");
    if (validationError) {
      setParentSkuError(validationError);
      return;
    }
    if (!selected?.sku || !selected?.name) {
      setNotice(
        "Vui lòng nhập Mã SKU và Tên thành phẩm trước khi gửi xác nhận.",
      );
      return;
    }
    if (purchasedSkuCodes.has(selected.sku.toUpperCase())) {
      setNotice("SKU mua hàng không được phép thiết lập BOM.");
      return;
    }
    const saved = syncBomSources({ ...selected, items: selected.items.map(item => ({...item, waste: normalizeBomWaste(item.waste) || ""})), status: "Chờ xác nhận" }, sourceSkus);
    const response = await fetch("/api/bom", {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"save",key:saved.sku,payload:saved,createOnly:!editingBomSku,expectedRevision:knownRecordRevision("bom",saved.sku)??null})});
    if (!response.ok) {
      setNoticeIsError(true);const error=await response.json().catch(()=>null);setNotice(error?.error||"Không thể lưu BOM. Vui lòng thử lại.");
      return;
    }
    setNoticeIsError(false);const receipt=await response.json();acceptRecordRevision("bom",saved.sku,receipt.revision);Object.assign(saved,receipt.bom);
    bomCatalog = bomCatalog.some((item) => item.sku === saved.sku)
      ? bomCatalog.map((item) => (item.sku === saved.sku ? saved : item))
      : [...bomCatalog, saved];
    setSelected(saved);
    setConfirmed(false);
    setConfirmedBy("");
    setMode("view");
    setNotice(
      "BOM đã được gửi xác nhận. Dữ liệu chưa được áp dụng cho đến khi người có quyền xác nhận trên thanh công cụ.",
    );
  };
  const changeBomConfirmation = async (record: BomCatalogRecord, undo = false) => {
    try {
      const document=undo?changeHistory.find(item=>item.id===record.changeDocument&&item.status==='Đã xác nhận'):null;
      const response = await fetch(document?(document.bulk?'/api/bom-bulk':'/api/bom-change'):'/api/bom',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(document?{action:'undo',key:document.id,expectedRevision:knownRecordRevision('bom_change',document.id)??null}:{action:undo?'undo':'confirm',key:record.sku,expectedRevision:knownRecordRevision('bom',record.sku)??null})});
      const data=await response.json();if(!response.ok)throw new Error(data.error);
      if(document){
        acceptRecordRevision('bom_change',document.id,data.revision);
        for(const bom of data.boms||[])bomCatalog=bomCatalog.map(item=>item.sku===bom.sku?normalizeBomIdentityDates(bom):item);
        for(const [sku,revision] of Object.entries(data.bomRevisions||{}))acceptRecordRevision('bom',sku,revision as string|null);
        setChangeHistory(current=>current.map(item=>item.id===document.id?data.change:item));
        data.bom=data.boms.find((bom:BomCatalogRecord)=>bom.sku===record.sku);
      }else acceptRecordRevision('bom',record.sku,data.revision);
      bomCatalog=bomCatalog.map(item=>item.sku===record.sku?data.bom:item);
      setSelected(data.bom);setHighlighted(data.bom);setConfirmed(data.bom.status==='Đã xác nhận');
      setNoticeIsError(false);setNotice(undo?'Đã khôi phục BOM về bản trước xác nhận.':'Đã xác nhận BOM thành công.');
      window.dispatchEvent(new Event('onspa-approvals-changed'));
    } catch(error){setNoticeIsError(true);setNotice(error instanceof Error?error.message:'Không thể xử lý BOM.');}
  };
  const updateHead = (field: keyof BomCatalogRecord, value: string) =>
    setSelected((current) =>
      current ? { ...current, [field]: value } : current,
    );
  const updateItem = (index: number, field: keyof BomItem, value: string) =>
    setSelected((current) =>
      current
        ? {
            ...current,
            items: current.items.map((item, i) =>
              i === index ? { ...item, [field]: value } : item,
            ),
          }
        : current,
    );
  const addItem = () =>
    setSelected((current) =>
      current
        ? {
            ...current,
            items: [
              ...current.items,
              {
                stt: String((current.items.length + 1) * 10).padStart(4, "0"),
                code: "",
                name: "",
                spec: "",
                waste: "—",
                qty: "",
                denominator: "1",
                setup: setupDateDisplay,
                effective: "—",
                expiry: "—",
                unit: "CÁI",
                source: "",
              },
            ],
          }
        : current,
    );
  const removeItem = (index: number) =>
    setSelected((current) =>
      current
        ? { ...current, items: current.items.filter((_, i) => i !== index) }
        : current,
    );
  const selectParentSku = (value: string) => {
    const code = value.toUpperCase();
    setParentSkuError("");
    const found = skus.find((item) => item.code.toUpperCase() === code);
    setSelected((current) =>
      current
        ? {
            ...current,
            sku: code,
            ...(found
              ? {
                  name: found.name,
                  spec: found.specification,
                  unit: found.unit,
                  group: found.group,
                  category: originalBomCatalog.find(bom => bom.sku === code)?.category || current.category,
                  itemType: found.mode,
                }
              : {}),
          }
        : current,
    );
  };
  const selectMaterial = (index: number, value: string) => {
    const code = value.toUpperCase();
    const found = bomMasterOptions.find((item) => item.code === code);
    setSelected((current) =>
      current
        ? {
            ...current,
            items: current.items.map((item, i) =>
              i === index
                ? {
                    ...item,
                    code,
                    ...(found
                      ? {
                          name: found.name,
                          spec: found.spec,
                          unit: found.unit,
                          source: found.source,
                        }
                      : { name: "", spec: "", unit: "", source: "" }),
                  }
                : item,
            ),
          }
        : current,
    );
  };
  const moveToNextItem = (index: number) => {
    if (!selected) return;
    if (index === selected.items.length - 1) addItem();
    setTimeout(
      () =>
        document
          .querySelector<HTMLInputElement>(`.workspace-session:not([hidden]) [data-bom-code-row="${index + 1}"]`)
          ?.focus(),
      0,
    );
  };
  const toolbar = (detail = false) => {
    const actionRecord = selected || highlighted;
    const actionStatus = actionRecord ? displayStatus(actionRecord) : "";
    return (
      <StandardToolbar name="BomLookupView" items={[...[toolbarConfig.action({"onClick": createBom},<><span>＋</span>Thêm mới
        </>, true, "action"),
toolbarConfig.action({disabled:!actionRecord||mode!=="view", disabledExplanation: !actionRecord ? "Chọn một dòng trong bảng trước khi thực hiện thao tác." : "Lưu hoặc đóng biểu mẫu đang chỉnh sửa trước khi xem cha–con.",onClick:()=>{if(actionRecord)setHierarchyRoot(actionRecord);}},"Xem cha–con",true,"action"),
toolbarConfig.action({"disabled": !actionRecord || mode === "create", disabledExplanation: !actionRecord ? "Chọn một dòng trong bảng trước khi thực hiện thao tác." : "Hoàn tất tạo BOM trước khi thực hiện thao tác này.","onClick": () => {
            if (!actionRecord) return;
            setSelected(actionRecord);
            setSearchOpen(false);
            setConfirmed(actionRecord.status === "Đã xác nhận");
            setEditingBomSku(
              actionRecord.status === "Đã xác nhận" ? "" : actionRecord.sku,
            );
            setParentSkuError("");
            setMode(actionRecord.status === "Đã xác nhận" ? "edit" : "create");
          }},<><span>✎</span>Sửa
        </>, true, "action"),
toolbarConfig.action({"onClick": () => {
            setSelected(null);
            setHighlighted(null);
            setMode("view");
            setQuery("");
            setNotice("");
            setSearchOpen(true);
          }},<><span>⌕</span>Tra cứu
        </>, true, "lookup"),
searchOpen || detail ? (
          toolbarConfig.action({"onClick": () => {
              setSelected(null);
              setHighlighted(null);
              setMode("view");
              setQuery("");
              setNotice("");
              setSearchOpen(false);
            }},<><span>←</span>Trở lại danh sách BOM
          </>, true, "back")
        ) : null,
toolbarConfig.action({"disabled": !actionRecord ||
            actionRecord.status !== "Chờ xác nhận", disabledExplanation: !actionRecord ? "Chọn một dòng trong bảng trước khi thực hiện thao tác." : "BOM phải ở trạng thái Chờ xác nhận.",onClick:()=>actionRecord&&changeBomConfirmation(actionRecord)},<><span>✓</span>Xác nhận
        </>, true, "action"),
toolbarConfig.action({"disabled": !actionRecord || actionRecord.status !== "Đã xác nhận", disabledExplanation: !actionRecord ? "Chọn một dòng trong bảng trước khi thực hiện thao tác." : "BOM phải ở trạng thái Đã xác nhận để hủy xác nhận.",onClick:()=>actionRecord&&changeBomConfirmation(actionRecord,true)},<><span>↶</span>Hủy xác nhận
        </>, true, "action"),
toolbarConfig.action({"disabled": !actionRecord, disabledExplanation: "Chọn một dòng trong bảng trước khi thực hiện thao tác.","onClick": () => {
            if (!actionRecord) return;
            setSelected(actionRecord);
            setSearchOpen(false);
            setMode("view");
            setHistoryOpen(true);
            setItemStatusFilter("Tất cả");
          }},<><span>◷</span>Lịch sử
        </>, true, "action"),
detail && mode !== "create" ? (
          toolbarConfig.note(<span className="bom-readonly-rule">
            Chọn Sửa để lập Phiếu thay đổi BOM ngay tại đây
          </span>)
        ) : null], searchOpen && toolbarConfig.group([toolbarConfig.field(<><span>TRA THEO</span></>,[toolbarConfig.select({"value": searchMode,"onChange": (e) =>
              setSearchMode(
                e.target.value as "parentSku" | "parentName" | "componentSku",
              )},<><option value="parentSku">SKU thành phẩm / BTP</option><option value="parentName">Tên thành phẩm / BTP</option><option value="componentSku">SKU linh kiện trong BOM</option></>)]),
toolbarConfig.field(<><span>
            {searchMode === "parentSku"
              ? "SKU THÀNH PHẨM / BTP"
              : searchMode === "parentName"
                ? "TÊN THÀNH PHẨM / BTP"
                : "SKU LINH KIỆN"}
          </span></>,[toolbarConfig.group([toolbarConfig.note("⌕"),
toolbarConfig.input({"value": query,"onChange": (e) => setQuery(e.target.value),"onKeyDown": (e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  openSearchedBom();
                }
              },"placeholder": searchMode === "parentSku"
                  ? "Nhập SKU thành phẩm / BTP"
                  : searchMode === "parentName"
                    ? "Nhập tên thành phẩm / BTP"
                    : "Nhập SKU linh kiện"})])]),
toolbarConfig.field(<><span>TRẠNG THÁI BOM</span></>,[toolbarConfig.select({"value": statusFilter,"onChange": (e) => setStatusFilter(e.target.value)},<><option>Tất cả</option><option>Đã xác nhận</option><option>Chờ xác nhận</option><option>Nháp</option><option>Có thay đổi chờ xác nhận</option><option>Cần kiểm tra</option></>)]),
toolbarConfig.note(<span>
          {query.trim()
            ? `${filtered.length} BOM phù hợp`
            : `${bomCatalog.length} BOM`}
        </span>)]), searchOpen && toolbarConfig.action({onClick:()=>{setQuery('');setStatusFilter('Tất cả')}},'Xóa lọc', true, "clear")]} />
    );
  };
  const searchBar = (detail = false) => !detail || !query.trim() ? null : (
    <section
      className={`data-card bom-search-card${detail ? " in-detail" : ""}`}
    >
      
      {detail && query.trim() && (
        <DataTable className="table-wrap bom-search-results">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>TÊN SẢN PHẨM / BTP</th>
                <th>QUY CÁCH</th>
                <th>NHÓM SP</th>
                <th>PHÂN LOẠI</th>
                <th>ĐƠN VỊ</th>
                <th>LINH KIỆN KHỚP</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 20).map((row) => (
                <tr key={row.sku} onClick={() => openBom(row)}>
                  <DataCell kind="code">
                    <FeedbackActionButton type="button" className="sku-link"  >
                      {row.sku}
                    </FeedbackActionButton>
                  </DataCell>
                  <DataCell>{row.name}</DataCell>
                  <DataCell>{row.spec || "—"}</DataCell>
                  <DataCell kind="code">{row.group || "—"}</DataCell>
                  <DataCell>{row.category || "—"}</DataCell>
                  <DataCell kind="code">{row.unit}</DataCell>
                  <DataCell>
                    {searchMode === "componentSku"
                      ? row.items
                          .filter((item) =>
                            item.code
                              .toLowerCase()
                              .startsWith(query.trim().toLowerCase()),
                          )
                          .slice(0, 3)
                          .map((item) => item.code)
                          .join(", ") || "—"
                      : "—"}
                  </DataCell>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="bom-no-result">Không tìm thấy BOM phù hợp.</p>
          )}
        </DataTable>
      )}
    </section>
  );
  const selectedChanges = selected
    ? changeHistory
        .filter(
          (record) =>
            record.sku === selected.sku && record.status === "Đã xác nhận",
        )
        .sort((a, b) =>
          `${b.effective} ${b.id}`.localeCompare(`${a.effective} ${a.id}`),
        )
    : [];
  const latestChange = selectedChanges[0];
  const historicalItems: BomItem[] = selectedChanges.flatMap((record) =>
    record.lines
      .filter(
        (line) =>
          line.action === "Ngừng sử dụng" ||
          (line.action === "Thay đổi" && Boolean(line.newCode)),
      )
      .filter(
        (line) =>
          !selected?.items.some(
            (item) =>
              item.code === line.code &&
              !bomLineActive(item),
          ),
      )
      .map((line, index) => ({
        stt: `H${String(index + 1).padStart(3, "0")}`,
        code: line.code,
        name: line.name,
        spec: line.spec,
        waste: line.waste || "—",
        qty: line.oldQty,
        denominator: line.denominator || "1",
        setup: record.setup,
        effective: "—",
        expiry: record.effective,
        unit:
          bomMasterOptions.find((item) => item.code === line.code)?.unit || "—",
        source:
          originalBomMasterOptions.find((item) => item.code === line.code)?.source ||
          "",
      })),
  );
  const allSelectedItems = selected
    ? [...selected.items, ...historicalItems].filter(
        (item, index, items) =>
          items.findIndex(
            (candidate) =>
              candidate.code === item.code &&
              (candidate.expiry || "—") === (item.expiry || "—") &&
              (candidate.effective || "—") === (item.effective || "—"),
          ) === index,
      )
    : [];
  const visibleSelectedItems: BomItem[] = projectBomSources({items: (mode === "create" || mode === "edit") ? selected?.items || [] : allSelectedItems}, sourceSkus).items.filter((item: BomItem) => {
    const stopped = !bomLineActive(item);
    if (itemStatusFilter === "Tất cả") return true;
    return itemStatusFilter === "Ngưng sử dụng" ? stopped : !stopped;
  });
  if(reconcileOpen)return <BomReconciliation onBack={()=>setReconcileOpen(false)} onApplied={async()=>{const response=await recordFetch("/api/records?entity=bom");if(!response.ok)throw new Error("Không tải được BOM sau cập nhật.");const data=await response.json();for(const r of data.records)if(r.revision)acceptRecordRevision("bom",r.key,r.revision);const saved=new Map<string,BomCatalogRecord>(data.records.map((r:{key:string;payload:BomCatalogRecord})=>[r.key,normalizeBomIdentityDates(r.payload)]));bomCatalog=bomCatalog.map(b=>saved.get(b.sku)||b);setSelected(null);setHighlighted(null);setHierarchyRoot(null);}}/>;
  if(hierarchyRoot&&mode==="view")return <BomHierarchy key={hierarchyRoot.sku} root={bomCatalog.find(row=>row.sku===hierarchyRoot.sku)||hierarchyRoot} catalog={bomCatalog} masterSkus={sourceSkus} onBack={()=>{setHierarchyRoot(null);setSelected(null);setHighlighted(null);setSearchOpen(false);setQuery("");setNotice("");}} onOpenBom={record=>{setHierarchyRoot(null);openBom(record);}}/>;
  if (selected && !searchOpen && mode === "edit")
    return (
      <BomChangeContent
        initialSku={selected.sku}
        operator={operator}
        embedded
        onClose={(savedStatus) => {
          if (savedStatus)
            setPendingChangeSkus((current) =>
              new Set(current).add(selected.sku),
            );
          setMode("view");
          setSelected(null);
        }}
      />
    );
  if (selected && !searchOpen)
    return (
      <main key="bom-detail" className="workspace bom-workspace">
        {mode === "create" ? <StandardToolbar name={editingBomSku ? "BomLookupView" : "BomLookupCreate"} items={[
          toolbarConfig.action({onClick:confirmBom,disabled:Boolean(parentSkuError), disabledExplanation: parentSkuError || "Kiểm tra SKU thành phẩm trước khi lưu."},"Lưu",true,"action"),
          toolbarConfig.action({onClick:cancelAction},"Trở lại danh sách BOM",true,"back"),
        ]}/> : toolbar(true)}
        {mode !== "create" && searchOpen && searchBar(true)}
        <section className="bom-detail-information">
          {mode === "create" && (
            <section className="bom-detail-head">
              <div className="bom-code-entry bom-parent-entry">
                <span>SKU</span>
                {mode === "create" ? (
                  <>
                    <input
                      value={selected.sku}
                      onFocus={() => setParentSuggestOpen(true)}
                      onBlur={() =>
                        setTimeout(() => {
                          setParentSuggestOpen(false);
                          validateParentSku(selected.sku);
                        }, 150)
                      }
                      onChange={(e) => {
                        selectParentSku(e.target.value);
                        setParentSuggestOpen(true);
                      }}
                      placeholder="Nhập mã SKU"
                      autoComplete="off"
                    />
                    {parentSuggestOpen && selected.sku.trim() && (
                      <div className="bom-parent-suggestions">
                        {skus
                          .filter((item) =>
                            `${item.code} ${item.name}`
                              .toLowerCase()
                              .includes(selected.sku.trim().toLowerCase()),
                          )
                          .slice(0, 8)
                          .map((item) => (
                            <FeedbackActionButton
                              type="button"
                              key={item.code}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                selectParentSku(item.code);
                                setParentSuggestOpen(false);
                                validateParentSku(item.code);
                              }}
                            >
                              <b>{item.code}</b>
                              <span>{item.name}</span>
                              <small>{item.specification || "—"}</small>
                            </FeedbackActionButton>
                          ))}
                      </div>
                    )}
                  </>
                ) : (
                  <strong>{selected.sku}</strong>
                )}
              </div>
              <div>
                <span>THÀNH PHẨM / BTP</span>
                {mode === "create" ? (
                  <input
                    value={selected.name}
                    readOnly
                    placeholder="Tự động theo SKU Master"
                  />
                ) : (
                  <strong>{selected.name}</strong>
                )}
              </div>
              <div>
                <span>QUY CÁCH</span>
                {mode === "create" ? (
                  <input
                    value={selected.spec}
                    readOnly
                    placeholder="Tự động theo SKU Master"
                  />
                ) : (
                  <strong>{selected.spec || "—"}</strong>
                )}
              </div>
              <div>
                <span>ĐƠN VỊ</span>
                {mode === "create" ? (
                  <select value={selected.unit} disabled>
                    <option>CÁI</option>
                    <option>BỘ</option>
                    <option>SỢI</option>
                    <option>KG</option>
                    <option>TỜ</option>
                  </select>
                ) : (
                  <strong>{selected.unit}</strong>
                )}
              </div>
              <div><span>NHÓM SP</span><input aria-label="Nhóm SP" value={metadataFor(selected).group} readOnly placeholder="Tự động theo SKU Master" /></div>
              <div><span>NGUỒN</span><input aria-label="Nguồn" value={bomSourceLabel(sourceFor(selected.sku))} readOnly /></div>
              <div><span>PHÂN LOẠI</span><select aria-label="Phân loại BOM" value={selected.category} onChange={e => setSelected(current => current ? {...current, category:e.target.value} : current)}>{bomClassifications.map(value => <option key={value}>{value}</option>)}</select></div>
              <div>
                <span>TRẠNG THÁI</span>
                <strong
                  className={
                    confirmed ? "status-confirmed" : "status-unconfirmed"
                  }
                >
                  {confirmed ? "Đã xác nhận" : selected.status}
                </strong>
              </div>
            </section>
          )}
          {mode === "create" && parentSkuError && (
            <div className="bom-parent-error">{parentSkuError}</div>
          )}
          {notice && (
            <div className={`bom-action-notice ${mode} ${noticeIsError?"error":"success"}`} role={noticeIsError?"alert":"status"}>{notice}</div>
          )}
          {showMeta && (
            <section className="bom-summary bom-summary-expanded bom-meta-panel">
              <div className="bom-info-grid">
                {mode !== "create" && (
                  <div className="bom-info-group bom-basic-info">
                    <h3>Thông tin BOM</h3>
                    <dl>
                      <div>
                        <dt>SKU</dt>
                        <dd className="master-sku">{selected.sku}</dd>
                      </div>
                      <div>
                        <dt>Tên sản phẩm / BTP</dt>
                        <dd>{selected.name}</dd>
                      </div>
                      <div>
                        <dt>Quy cách</dt>
                        <dd>{selected.spec || "—"}</dd>
                      </div>
                      <div>
                        <dt>Nhóm SP</dt>
                        <dd>{metadataFor(selected).group || "—"}</dd>
                      </div>
                      <div>
                        <dt>Phân loại</dt>
                        <dd>{metadataFor(selected).category || "—"}</dd>
                      </div>
                      <div>
                        <dt>Đơn vị</dt>
                        <dd>{selected.unit}</dd>
                      </div>
                      <div>
                        <dt>Nguồn</dt>
                        <dd>{bomSourceLabel(sourceFor(selected.sku))}</dd>
                      </div>
                      <div>
                        <dt>Trạng thái</dt>
                        <dd
                          className={
                            confirmed
                              ? "status-confirmed"
                              : "status-unconfirmed"
                          }
                        >
                          {confirmed ? "Đã xác nhận" : selected.status}
                        </dd>
                      </div>
                    </dl>
                  </div>
                )}
                <div className="bom-info-group">
                  <h3>Thiết lập và xác nhận</h3>
                  <dl>
                    <div>
                      <dt>Ngày thay đổi</dt>
                      <dd>
                        {selected.changeDate || latestChange?.setup || "—"}
                      </dd>
                    </div>
                    <div>
                      <dt>Ngày thiết lập</dt>
                      <dd>{selected.setup || "—"}</dd>
                    </div>
                    <div>
                      <dt>Ngày chỉnh sửa</dt>
                      <dd>
                        {selected.modifiedDate ||
                          latestChange?.effective ||
                          "—"}
                      </dd>
                    </div>
                    <div>
                      <dt>Ngày xác nhận</dt>
                      <dd>
                        {confirmed
                          ? selected.confirmedDate ||
                            latestChange?.effective ||
                            "—"
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt>Người xác nhận</dt>
                      <dd>
                        {confirmed
                          ? selected.confirmedBy ||
                            latestChange?.user ||
                            confirmedBy
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt>Phiên bản</dt>
                      <dd>{selected.version}</dd>
                    </div>
                    <div>
                      <dt>Mã phiếu đổi</dt>
                      <dd>
                        {selected.changeDocument || latestChange?.id || "—"}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </section>
          )}
        </section>
        <datalist id="bom-parent-sku-options">
          {skus.map((item) => (
            <option key={item.code} value={item.code}>
              {item.name} · {item.specification}
            </option>
          ))}
        </datalist>
        <datalist id="bom-material-options">
          {bomMasterOptions.map((item) => (
            <option key={item.code} value={item.code}>
              {item.name} · {item.spec}
            </option>
          ))}
        </datalist>
        <section className="data-card bom-card bom-fill">
          <div className="bom-item-filter" aria-label="Lọc trạng thái vật tư">
            <strong>Trạng thái vật tư</strong>
            {(["Đang sử dụng", "Ngưng sử dụng", "Tất cả"] as const).map(
              (status) => (
                <FeedbackActionButton
                  type="button"
                  key={status}
                  className={itemStatusFilter === status ? "active" : ""}
                  onClick={() => setItemStatusFilter(status)}
                >
                  {status}
                </FeedbackActionButton>
              ),
            )}
          </div>
          <DataTable className="table-wrap">
            <table className="bom-table" data-page-size="20">
              <thead>
                <tr>
                  <th>STT</th>
                  <th>MÃ NVL/BTP</th>
                  <th>TÊN</th>
                  <th>QUY CÁCH</th>
                  <th>HAO HỤT (%)</th>
                  <th>LƯỢNG DÙNG</th>
                  <th>MẪU SỐ</th>
                  <th>
                    {mode === "create" ? "NGÀY THIẾT LẬP" : "NGÀY CÓ HIỆU LỰC"}
                  </th>
                  <th>NGÀY HẾT HIỆU LỰC</th>
                  <th>ĐƠN VỊ</th>
                  <th>NGUỒN</th>
                  {mode === "create" && <th></th>}
                </tr>
              </thead>
              <tbody>
                {visibleSelectedItems.map((item, i) => {
                  const editable = mode === "create" || mode === "edit";
                  return (
                    <tr
                      key={`${item.stt}-${i}`}
                      onKeyDownCapture={(e)=>{if(editable && e.key==='ArrowDown'){e.preventDefault();e.stopPropagation();setSuggestRow(null);moveToNextItem(i);}}}
                      onDoubleClick={() => {
                        const next = bomCatalog.find(
                          (x) => x.sku === item.code,
                        );
                        if (!editable && next) openBom(next);
                      }}
                    >
                      <DataCell kind="number">{item.stt}</DataCell>
                      <DataCell>
                        {editable ? (
                          <div className="bom-code-entry">
                            <input
                              data-bom-code-row={i}
                              className="bom-cell-input code"
                              value={item.code}
                              onFocus={() => setSuggestRow(i)}
                              onBlur={() =>
                                setTimeout(() => setSuggestRow(null), 120)
                              }
                              onChange={(e) => {
                                selectMaterial(i, e.target.value);
                                setSuggestRow(i);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "ArrowDown" && item.code.trim()) {
                                  e.preventDefault();
                                  setSuggestRow(null);
                                  moveToNextItem(i);
                                }
                              }}
                              placeholder="Nhập mã NVL/BTP"
                            />
                            {suggestRow === i &&
                              item.code &&
                              !bomMasterOptions.some(
                                (x) => x.code === item.code,
                              ) && (
                                <div className="bom-compact-suggestions">
                                  {bomMasterOptions
                                    .filter((x) =>
                                      `${x.code} ${x.name}`
                                        .toLowerCase()
                                        .includes(item.code.toLowerCase()),
                                    )
                                    .slice(0, 5)
                                    .map((option) => (
                                      <FeedbackActionButton
                                        type="button"
                                        key={option.code}
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => {
                                          selectMaterial(i, option.code);
                                          setSuggestRow(null);
                                        }}
                                      >
                                        <b>{option.code}</b>
                                        <span>{option.name}</span>
                                        <small>{option.spec || "—"}</small>
                                      </FeedbackActionButton>
                                    ))}
                                </div>
                              )}
                          </div>
                        ) : (
                          <FeedbackActionButton className="sku-link" title="Nhấp đúp vào dòng để mở BOM phù hợp.">{item.code}</FeedbackActionButton>
                        )}
                      </DataCell>
                      <DataCell className="product-name">
                        {editable ? (
                          <input
                            className="bom-cell-input name autofill"
                            value={item.name}
                            readOnly
                            placeholder="Tự động theo SKU"
                          />
                        ) : (
                          item.name
                        )}
                      </DataCell>
                      <DataCell>
                        {editable ? (
                          <input
                            className="bom-cell-input autofill"
                            value={item.spec}
                            readOnly
                            placeholder="Tự động theo SKU"
                          />
                        ) : (
                          item.spec || "—"
                        )}
                      </DataCell>
                      <DataCell>
                        {editable ? (
                          <input
                            className="bom-cell-input number"
                            value={item.waste === "—" ? "" : item.waste}
                            onChange={(e) =>
                              updateItem(i, "waste", e.target.value)
                            }
                            onBlur={() => {
                              const value = normalizeBomWaste(item.waste);
                              if (value !== null) updateItem(i, "waste", value);
                            }}
                            placeholder="Nhập tỷ lệ %"
                          />
                        ) : (
                          item.waste || "—"
                        )}
                      </DataCell>
                      <DataCell kind="number" className="qty-cell">
                        {editable ? (
                          <input
                            className="bom-cell-input number"
                            value={item.qty}
                            onChange={(e) =>
                              updateItem(i, "qty", e.target.value)
                            }
                          />
                        ) : (
                          item.qty
                        )}
                      </DataCell>
                      <DataCell>
                        {editable ? (
                          <input
                            className="bom-cell-input number"
                            value={item.denominator ?? "1"}
                            onChange={(e) =>
                              updateItem(i, "denominator", e.target.value)
                            }
                          />
                        ) : (
                          (item.denominator ?? "1")
                        )}
                      </DataCell>
                      <DataCell>
                        {editable ? (
                          <input
                            className="bom-cell-input date"
                            value={item.setup ?? setupDateDisplay}
                            readOnly
                          />
                        ) : (
                          (item.effective ?? "—")
                        )}
                      </DataCell>
                      <DataCell kind="date">{item.expiry ?? "—"}</DataCell>
                      <DataCell kind="code">{item.unit}</DataCell>
                      <DataCell>
                        {item.source ? (
                          <span
                            className={`source-badge ${item.source === "Tự chế" ? "make" : item.source === "Ủy thác" ? "outsourced" : "buy"}`}
                          >
                            {bomSourceLabel(item.source)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </DataCell>
                      {editable && (
                        <DataCell>
                          <FeedbackActionButton
                            className="bom-remove-row"
                            onClick={() => removeItem(i)}
                          >
                            ×
                          </FeedbackActionButton>
                        </DataCell>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </DataTable>
          {mode === "create" && (
            <div className="document-footer-actions bom-create-footer">
              <FeedbackActionButton className="outline-button" onClick={cancelAction}>
                Hủy
              </FeedbackActionButton>
              <FeedbackActionButton
                className="primary-button"
                disabled={Boolean(parentSkuError)} disabledExplanation={parentSkuError || "Kiểm tra lại SKU thành phẩm trước khi lưu BOM."}
                onClick={confirmBom}
              >
                Lưu
              </FeedbackActionButton>
            </div>
          )}
        </section>
        {historyOpen && (
          <>
            <FeedbackActionButton
              className="overlay"
              aria-label="Đóng lịch sử BOM"
              onClick={() => setHistoryOpen(false)}
            />
            <aside className="detail-panel bom-history-panel bom-version-history-panel">
              <div className="detail-header">
                <div>
                  <p>LỊCH SỬ THAY ĐỔI BOM</p>
                  <h2>{selected.sku}</h2>
                  <span>
                    {selected.name} · Phiên bản hiện tại {selected.version}
                  </span>
                </div>
                <FeedbackActionButton onClick={() => setHistoryOpen(false)}>×</FeedbackActionButton>
              </div>
              <div className="detail-scroll">
                {selectedChanges.length === 0 ? (
                  <section>
                    <div className="empty-state">
                      Chưa có lịch sử thay đổi được xác nhận.
                    </div>
                  </section>
                ) : (
                  selectedChanges.map((record) => (
                    <section className="bom-drawer-record" key={record.id}>
                      <div className="bom-inline-detail-title">
                        <b>{record.id}</b>
                        <span>
                          {record.oldVersion} → {record.newVersion} ·{" "}
                          {record.status}
                        </span>
                      </div>
                      <div className="bom-audit-summary">
                        <div>
                          <span>Người lập</span>
                          <b>{legacyBomChangeCreator(record)}</b>
                          <small>
                            {displayAuditTime(record.createdAt || record.setup)}
                          </small>
                        </div>
                        <div>
                          <span>Người sửa gần nhất</span>
                          <b>{bomChangeModifier(record)}</b>
                          <small>{displayAuditTime(record.modifiedAt)}</small>
                        </div>
                        <div>
                          <span>Người xác nhận</span>
                          <b>{bomChangeConfirmer(record)}</b>
                          <small>
                            {displayAuditTime(
                              record.confirmedAt ||
                                (record.effective !== "—"
                                  ? record.effective
                                  : undefined),
                            )}
                          </small>
                        </div>
                        <div>
                          <span>Lý do thay đổi</span>
                          <b>{record.reason || "—"}</b>
                          <small>{record.lines.length} dòng thay đổi</small>
                        </div>
                      </div>
                      <DataTable className="table-wrap">
                        <table className="bom-drawer-lines">
                          <thead>
                            <tr>
                              <th>MÃ CŨ</th>
                              <th>MÃ MỚI</th>
                              <th>LOẠI</th>
                              <th>TÊN / QUY CÁCH</th>
                              <th>GIÁ TRỊ CŨ</th>
                              <th>GIÁ TRỊ MỚI</th>
                              <th>MẪU SỐ</th>
                              <th>HAO HỤT</th>
                              <th>GHI CHÚ</th>
                            </tr>
                          </thead>
                          <tbody>
                            {record.lines.map((line, index) => (
                              <tr key={`${record.id}-${line.code}-${index}`}>
                                <DataCell kind="code">{line.code || "—"}</DataCell>
                                <DataCell kind="code">{line.newCode || "—"}</DataCell>
                                <DataCell>
                                  <span className="change-badge">
                                    {line.action}
                                  </span>
                                </DataCell>
                                <DataCell>
                                  <b>{line.name || "—"}</b>
                                  <small>{line.spec || "—"}</small>
                                </DataCell>
                                <DataCell kind="number">{line.oldQty || "—"}</DataCell>
                                <DataCell kind="number">{line.newQty || "—"}</DataCell>
                                <DataCell kind="number">{line.denominator || "—"}</DataCell>
                                <DataCell kind="number">{line.waste || "—"}</DataCell>
                                <DataCell>{line.note || "—"}</DataCell>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </DataTable>
                    </section>
                  ))
                )}
              </div>
            </aside>
          </>
        )}
      </main>
    );
  return (
    <main key="bom-lookup" className="workspace bom-workspace">
      {toolbar(false)}
      <section className="data-card bom-lookup-card">
        
        <DataTable className="table-wrap">
          <table className="bom-catalog-table" data-page-size="20">
            <thead>
              <tr>
                <th>SKU</th>
                <th>TÊN SẢN PHẨM / BTP</th>
                <th>NHÓM SP</th>
                <th>PHÂN LOẠI</th>
                <th>QUY CÁCH</th>
                <th>ĐƠN VỊ</th>
                <th>PHIÊN BẢN</th>
                <th>TRẠNG THÁI</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr
                  key={row.sku}
                  className={highlighted?.sku === row.sku ? "selected-row" : ""}
                  onClick={() => setHighlighted(row)}
                  onDoubleClick={() => openBom(row)}
                >
                  <DataCell kind="code">
                    <FeedbackActionButton className="sku-link"  >{row.sku}</FeedbackActionButton>
                  </DataCell>
                  <DataCell>{row.name}</DataCell>
                  <DataCell kind="code">{row.group || "—"}</DataCell>
                  <DataCell>{row.category || "—"}</DataCell>
                  <DataCell>{row.spec}</DataCell>
                  <DataCell kind="code">{row.unit}</DataCell>
                  <DataCell kind="code">{row.version}</DataCell>
                  <DataCell>
                    <span
                      className={
                        displayStatus(row) === "Cần kiểm tra"
                          ? "change-badge"
                          : "pending-badge"
                      }
                    >
                      {displayStatus(row)}
                    </span>
                  </DataCell>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>
      </section>
    </main>
  );
}

type PlanRow = {
  skuPending?: boolean;
  warnings?: string[];
  id: string;
  sku: string;
  name: string;
  spec: string;
  group: string;
  suggested: number;
  plan: number;
  line: string;
  start: string;
  end: string;
  priority: string;
  type: string;
  status: string;
  sequence?: number;
  setupAt?: string;
  createdBy?: string;
  source?: string;
  week?: string;
};

const normalizePlanRow = (row: Partial<PlanRow>, index = 0): PlanRow => ({
  id: String(row.id || row.sku || `PLAN-${index + 1}`),
  sku: String(row.sku || ""),
  name: String(row.name || ""),
  spec: String(row.spec || ""),
  group: String(row.group || ""),
  suggested: Number(row.suggested) || 0,
  plan: Number(row.plan) || 0,
  line: String(row.line || ""),
  start: String(row.start || ""),
  end: String(row.end || ""),
  priority: String(row.priority || ""),
  type: String(row.type || "Tuần chính"),
  status: String(row.status || "Dự kiến"),
  sequence: Number(row.sequence) || index + 1,
  setupAt: row.setupAt ? String(row.setupAt) : undefined,
  createdBy: row.createdBy ? String(row.createdBy) : undefined,
  source: row.source ? String(row.source) : undefined,
  week: row.week ? String(row.week) : undefined,
});

type EngineMetric = {
  warnings?: string[];
  defaults?: string[];
  weekLabel: string;
  month: string;
  dailyDemand: number;
  eventWeek: number;
  eventQty: number;
  fillQty: number;
  stock: number;
  inTransit: number;
  leadTime: number;
  safetyDays: number;
  rop: number;
  need: string;
  replenish: number;
  moq: number;
  afterMoq: number;
  reason: string;
  safetyLeadTime: number;
  safetyForecast: number;
  safetySituation: number;
  ruleCode: string;
  ruleVersion: string;
  ruleEffectiveFrom: string;
  ruleEffectiveTo: string;
};

const parseViDate = (value: string) => {
  const p = value.split("/").map(Number);
  return p.length === 3 ? new Date(p[2], p[1] - 1, p[0]) : null;
};
const formatViDate = (value: Date) =>
  `${String(value.getDate()).padStart(2, "0")}/${String(value.getMonth() + 1).padStart(2, "0")}/${value.getFullYear()}`;
const mondayOf = (value: Date) => {
  const d = new Date(value);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(0, 0, 0, 0);
  return d;
};
const priorityRank = (value: string) =>
  ({
    "KHẨN - EVENT": 1,
    "CAO - EVENT": 2,
    "KHẨN - SAFETY": 3,
    "CAO - ROP": 4,
    "ĐỦ TỒN - EVENT": 5,
    "BÙ TẢI": 6,
    "KHÔNG BỔ SUNG": 7,
  })[value.replace(" + BÙ TẢI", "")] || 99;

function buildProductionEngine(
  forecasts: ForecastRow[],
  events: DemandRow[],
  weekValue: string,
  stockBySku: Map<string, number>,
  rule?: SafetyRuleSet,
  transitBySku: Map<string, number> | null = null,
  masterRows: Sku[] = skus,
) {
  const weekStart = mondayOf(new Date(`${weekValue}T00:00:00`));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const thursday = new Date(weekStart);
  thursday.setDate(thursday.getDate() + 3);
  const month = `${String(thursday.getMonth() + 1).padStart(2, "0")}/${thursday.getFullYear()}`;
  const master = new Map(masterRows.map((s) => [s.code.toUpperCase(), s]));
  const metrics = new Map<string, EngineMetric>();
  const rows: PlanRow[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const inputs: Pick<ForecastRow, "sku" | "used" | "name" | "spec" | "line">[] = engineInputRows(forecasts, events, month, weekValue);
  if (!inputs.length)
    errors.push(`${month}: chưa có Base Forecast hoặc Demand Event chưa lập kế hoạch đúng tuần`);
  inputs
    .forEach((f, index) => {
      const sku = f.sku.toUpperCase();
      const item = master.get(sku);
      if (item && !usableSku(item)) {
        warnings.push(
          `${sku}: SKU chưa xác nhận hoặc chưa sử dụng — không tính Engine`,
        );
        return;
      }
      if (!item) {
        errors.push(`${sku}: không khớp SKU Master`);
        return;
      }
      const relevant = events.filter(
        (e) =>
          e.sku.toUpperCase() === sku &&
          pendingDemand(e, weekValue),
      );
      const eventQty = relevant
        .filter((e) => {
          if (e.type !== "Phát sinh") return false;
          return true;
        })
        .reduce((s, e) => s + Number(e.qty || 0), 0);
      const fillQty = relevant
        .filter((e) => e.type === "Bù tải")
        .reduce((s, e) => s + Number(e.qty || 0), 0);
      const eventWeek = eventQty + fillQty;
      if (
        !Number.isFinite(f.used) ||
        f.used < 0 ||
        relevant.some(
          (e) => !Number.isFinite(Number(e.qty)) || Number(e.qty) < 0,
        )
      ) {
        errors.push(
          `${sku}: Daily Demand hoặc số lượng Demand Event không hợp lệ`,
        );
        return;
      }
      const savedLead = leadtimeBySku.get(sku);
      const sourceLead = leadtimeRows.find((r) => r.sku.toUpperCase() === sku);
      const legacy = forecastData[sku];
      const parsedLead = Number.parseFloat(item.leadTime);
      const rawLead = savedLead?._deleted
        ? NaN
        : (savedLead?.leadTime ??
          sourceLead?.leadTime ??
          (Number.isFinite(parsedLead) ? parsedLead : (legacy?.lead ?? NaN)));
      const rawMoq =
        savedLead?.moq ??
        sourceLead?.moq ??
        (Number(item.moq) || legacy?.moq || 0);
      const defaults: string[] = [],
        rowWarnings: string[] = [];
      const warn = (key: string, message: string) => {
        defaults.push(key);
        rowWarnings.push(message);
      };
      const leadTime = Number.isFinite(rawLead) && rawLead >= 0 ? rawLead : 0;
      if (!Number.isFinite(rawLead) || rawLead < 0)
        warn("leadTime", "Chưa thiết lập Lead Time - đang tính bằng 0");
      const moq = Number.isFinite(rawMoq) && rawMoq > 0 ? rawMoq : 0;
      if (!moq) warn("moq", "Chưa thiết lập MOQ - sử dụng đúng SL cần bổ sung");
      const stock = stockBySku.get(sku) ?? 0;
      if (!stockBySku.has(sku))
        warn("stock", "Không có tồn kho - đang tính bằng 0");
      const inTransit = transitBySku?.get(sku) ?? legacy?.wip ?? 0;
      if (!transitBySku?.has(sku) && legacy?.wip !== undefined)
        rowWarnings.push("In Transit từ dữ liệu nền Site 162");
      if (!transitBySku?.has(sku) && legacy?.wip === undefined)
        warn("inTransit", "Không có In Transit - đang tính bằng 0");
      const matchedSafety = rule?.leadTimeRules
        ?.filter(
          (r) =>
            r.status === "Đang áp dụng" &&
            (!r.sku || r.sku.toUpperCase() === sku) &&
            (!r.group || r.group === item.group) &&
            leadTime >= r.from &&
            (r.to === null || leadTime <= r.to),
        )
        .sort(
          (a, b) =>
            Number(!!b.sku) * 2 +
            Number(!!b.group) -
            Number(!!a.sku) * 2 -
            Number(!!a.group),
        )[0];
      const safety = matchedSafety
        ? {
            total: matchedSafety.days,
            leadTimeDays: matchedSafety.days,
            forecastDays: 0,
            situationDays: 0,
          }
        : { total: 0, leadTimeDays: 0, forecastDays: 0, situationDays: 0 };
      if (!matchedSafety)
        warn("safetyDays", "Chưa thiết lập Safety Days - đang tính bằng 0");
      const safetyDays = safety.total;
      const skuPending = item.status === "Chờ xác nhận";
      if (skuPending) rowWarnings.push("SKU chờ xác nhận");
      warnings.push(...rowWarnings.map((w) => `${sku}: ${w}`));
      const available = stock + inTransit;
      const safetyQty = f.used * safetyDays;
      const rop = f.used * (leadTime + safetyDays);
      const normal = Math.max(0, rop + eventQty - available);
      const replenish = normal + fillQty;
      const afterMoq =
        replenish <= 0
          ? 0
          : moq > 0
            ? Math.ceil(replenish / moq) * moq
            : replenish;
      const withFill = (p: string) => (fillQty > 0 ? `${p} + BÙ TẢI` : p);
      let priority = "KHÔNG BỔ SUNG";
      let reason =
        "Không có Phát sinh hoặc Bù tải hợp lệ; tồn khả dụng vẫn lớn hơn ROP.";
      const eventShort = Math.max(0, eventQty - available);
      if (eventQty > 0 && eventShort > 0 && replenish > 0) {
        priority = withFill("KHẨN - EVENT");
        reason = `Phát sinh ${eventQty.toLocaleString("vi-VN")}; tồn khả dụng ${available.toLocaleString("vi-VN")}; thiếu riêng Event ${eventShort.toLocaleString("vi-VN")}.`;
      } else if (eventQty > 0 && normal > 0) {
        priority = withFill("CAO - EVENT");
        reason = `Tồn đủ riêng Event nhưng chưa đủ ROP và nhu cầu; thiếu ${normal.toLocaleString("vi-VN")}.`;
      } else if (eventQty <= 0 && f.used > 0 && available < safetyQty) {
        priority = withFill("KHẨN - SAFETY");
        reason = `Tồn khả dụng ${available.toLocaleString("vi-VN")} thấp hơn Safety ${safetyQty.toLocaleString("vi-VN")}.`;
      } else if (eventQty <= 0 && f.used > 0 && available <= rop) {
        priority = withFill("CAO - ROP");
        reason = `Tồn khả dụng ${available.toLocaleString("vi-VN")} đã chạm ROP ${rop.toLocaleString("vi-VN")}.`;
      } else if (eventQty > 0 && normal <= 0) {
        priority = withFill("ĐỦ TỒN - EVENT");
        reason = "Tồn khả dụng đã đủ Event và nhu cầu thông thường.";
      } else if (fillQty > 0) {
        priority = "BÙ TẢI";
        reason = `Cộng nguyên Bù tải ${fillQty.toLocaleString("vi-VN")}, không trừ tồn và đang đi.`;
      }
      const need =
        eventWeek > 0 || (f.used > 0 && available <= rop) ? "YES" : "NO";
      const id = `PE-${weekValue}-${sku}`;
      rows.push({
        id,
        sku,
        name: f.name || item.name,
        spec: f.spec || item.specification,
        group: item.group,
        suggested: Math.round(afterMoq * 100) / 100,
        plan: Math.round(afterMoq * 100) / 100,
        line: f.line || item.line,
        start: formatViDate(weekStart),
        end: formatViDate(weekEnd),
        priority,
        type: "Tuần chính",
        skuPending,
        warnings: rowWarnings,
        status: skuPending
          ? "SKU chờ xác nhận"
          : priority === "KHÔNG BỔ SUNG"
            ? "Không bổ sung"
            : "Chưa đưa vào kế hoạch",
      });
      metrics.set(id, {
        weekLabel: `${formatViDate(weekStart)} - ${formatViDate(weekEnd)}`,
        month,
        dailyDemand: f.used,
        eventWeek,
        eventQty,
        fillQty,
        stock,
        inTransit,
        leadTime,
        safetyDays,
        rop,
        need,
        replenish,
        moq,
        afterMoq,
        reason: [reason, ...rowWarnings].join(" · "),
        warnings: rowWarnings,
        defaults,
        safetyLeadTime: safety.leadTimeDays,
        safetyForecast: safety.forecastDays,
        safetySituation: safety.situationDays,
        ruleCode: rule?.code || "Chưa có",
        ruleVersion: rule?.version || "—",
        ruleEffectiveFrom: rule?.effectiveFrom || "",
        ruleEffectiveTo: rule?.effectiveTo || "",
      });
    });
  rows.sort(
    (a, b) =>
      priorityRank(a.priority) - priorityRank(b.priority) ||
      a.line.localeCompare(b.line) ||
      b.suggested - a.suggested,
  );
  return {
    rows,
    errors,
    warnings,
    stats: {
      input: inputs.length,
      calculated: rows.length,
      pending: rows.filter((r) => r.skuPending).length,
      defaults: [...metrics.values()].filter((m) => m.defaults?.length).length,
      unmatched: errors.filter((e) => e.includes("không khớp SKU Master"))
        .length,
    },
    metrics,
    month,
    weekLabel: `${formatViDate(weekStart)}–${formatViDate(weekEnd)}`,
  };
}

const proposalRows: PlanRow[] = [];

const forecastData: Record<
  string,
  {
    f30: number;
    f60: number;
    f90: number;
    d30: number;
    d60: number;
    d90: number;
    used: number;
    event: number;
    stock: number;
    wip: number;
    lead: number;
    safety: number;
    moq: number;
    rop: number;
    hours: number;
    warning: string;
  }
> = {};

function EngineView({
  rows,
  onCalc,
  onMove,
}: {
  rows: PlanRow[];
  onCalc: (sku: string) => void;
  onMove: (id: string) => void;
}) {
  return (
    <section className="data-card engine-view">
      <StandardToolbar name="EngineView" items={[toolbarConfig.group([toolbarConfig.note(<strong>
            05_PRODUCTION_ENGINE · Đề xuất bổ sung sản xuất theo tuần
          </strong>),
toolbarConfig.note(<span>Tuần 24/08–30/08/2026 · Forecast áp dụng 08/2026</span>)]),
toolbarConfig.group([toolbarConfig.note(<b>4</b>),
toolbarConfig.note(<small>Cần bổ sung</small>)]),
toolbarConfig.group([toolbarConfig.note(<b>8.900</b>),
toolbarConfig.note(<small>SL sau MOQ</small>)])]} />
      <div className="engine-rules">
        <div>
          <b>KHẨN – EVENT</b>
          <span>Đơn phát sinh giao trong tuần, nguồn cung không đáp ứng.</span>
        </div>
        <div>
          <b>CAO – EVENT</b>
          <span>Có đơn phát sinh nhưng chưa chạm mức khẩn.</span>
        </div>
        <div>
          <b>KHẨN – SAFETY</b>
          <span>Nguồn cung chạm mức tồn an toàn.</span>
        </div>
        <div>
          <b>CAO – ROP</b>
          <span>Nguồn cung chạm điểm kích hoạt bổ sung.</span>
        </div>
        <div>
          <b>ĐỦ TỒN – EVENT</b>
          <span>Nguồn cung đã đáp ứng đơn phát sinh.</span>
        </div>
        <div>
          <b>BÙ TẢI</b>
          <span>Demand Event loại Bù tải, Line còn năng lực.</span>
        </div>
      </div>
      <DataTable className="table-wrap">
        <table className="engine-table">
          <thead>
            <tr>
              <th>TUẦN KẾ HOẠCH</th>
              <th>MONTH</th>
              <th>NHÓM SP</th>
              <th className="engine-sku-column">SKU</th>
              <th className="engine-name-column">TÊN SẢN PHẨM</th>
              <th>QUY CÁCH</th>
              <th>LINE</th>
              <th>DAILY DEMAND</th>
              <th>DEMAND EVENT TUẦN</th>
              <th>TỒN ERP</th>
              <th>ĐANG ĐI</th>
              <th>LEAD TIME</th>
              <th>TỔNG SAFETY DAYS</th>
              <th>ROP</th>
              <th>CẦN BỔ SUNG?</th>
              <th>SL CẦN BỔ SUNG</th>
              <th>MOQ</th>
              <th>SL SAU MOQ</th>
              <th className="engine-priority-column">ƯU TIÊN</th>
              <th className="engine-reason-column">LÝ DO</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const f = forecastData[r.sku];
              const reason = r.priority.includes("Event")
                ? `Có phát sinh ${f.event.toLocaleString("vi-VN")}; Tồn ERP + Đang đi ${(f.stock + f.wip).toLocaleString("vi-VN")}; đề xuất theo Event và MOQ.`
                : r.priority === "Bù tải"
                  ? "Demand Event loại Bù tải hợp lệ; Line còn năng lực để bổ sung sản xuất."
                  : `Không có phát sinh giao trong tuần; Tồn ERP + Đang đi ${(f.stock + f.wip).toLocaleString("vi-VN")}; ROP ${f.rop.toLocaleString("vi-VN")}; cần bổ sung để bảo đảm mức tồn.`;
              return (
                <tr key={r.id}>
                  <DataCell>24/08/2026</DataCell>
                  <DataCell>08/2026</DataCell>
                  <DataCell kind="code">{r.group}</DataCell>
                  <DataCell kind="code" className="engine-sku-column">
                    <FeedbackActionButton
                      className="plan-sku calc-link"
                      onClick={() => onCalc(r.sku)}
                    >
                      {r.sku}
                    </FeedbackActionButton>
                  </DataCell>
                  <DataCell className="engine-name-column">
                    <strong>{r.name}</strong>
                  </DataCell>
                  <DataCell>{r.spec}</DataCell>
                  <DataCell kind="code">{r.line}</DataCell>
                  <DataCell kind="number" className="number engine-demand">
                    {f.used.toLocaleString("vi-VN")}
                  </DataCell>
                  <DataCell kind="number" className="number">{f.event.toLocaleString("vi-VN")}</DataCell>
                  <DataCell kind="number" className="number engine-supply">
                    {f.stock.toLocaleString("vi-VN")}
                  </DataCell>
                  <DataCell kind="number" className="number engine-supply">
                    {f.wip.toLocaleString("vi-VN")}
                  </DataCell>
                  <DataCell kind="number" className="number">{f.lead.toFixed(2)}</DataCell>
                  <DataCell kind="number" className="number">{f.safety.toFixed(2)}</DataCell>
                  <DataCell kind="number" className="number engine-rop">
                    {f.rop.toLocaleString("vi-VN")}
                  </DataCell>
                  <DataCell>
                    <span className="need-yes">YES</span>
                  </DataCell>
                  <DataCell kind="number" className="number">
                    {r.suggested.toLocaleString("vi-VN")}
                  </DataCell>
                  <DataCell kind="number" className="number">{f.moq.toLocaleString("vi-VN")}</DataCell>
                  <DataCell kind="number" className="number engine-result">
                    {r.suggested.toLocaleString("vi-VN")}
                  </DataCell>
                  <DataCell className="engine-priority-column">
                    <span
                      className={`priority engine-priority-${enginePriorityTone(r.priority)}`}
                    >
                      {enginePriorityTone(r.priority) === "no-add" ? "KO BỔ SUNG" : r.priority.toUpperCase()}
                    </span>
                  </DataCell>
                  <DataCell className="reason-cell"><EngineReason reason={reason} sku={r.sku} /></DataCell>
                  <DataCell>
                    <div className="proposal-actions">
                      <FeedbackActionButton
                        className="calc-button"
                        onClick={() => onCalc(r.sku)}
                      >
                        Xem cách tính
                      </FeedbackActionButton>
                      <FeedbackActionButton
                        className="row-action"
                        disabled={r.status !== "Chưa đưa vào kế hoạch"} disabledExplanation={"Chỉ đưa vào kế hoạch các dòng có trạng thái Chưa đưa vào kế hoạch."}
                        onClick={() => onMove(r.id)}
                      >
                        Đưa vào 06 →
                      </FeedbackActionButton>
                    </div>
                  </DataCell>
                </tr>
              );
            })}
          </tbody>
        </table>
      </DataTable>
      <details className="engine-footnote">
        <summary>Quy tắc chuyển 05 → 06 / 轉入規則</summary>
        <b>Đúng theo Sheet 05:</b> Forecast chi tiết nằm ở trang Base Forecast;
        05 chỉ lấy Daily Demand để tính cùng Demand Event, tồn ERP, đang đi,
        Lead Time, Safety Days, ROP và MOQ.
      </details>
    </section>
  );
}

function BulkEngineView({
  rows,
  metrics,
  week,
  onWeekChange,
  onCalc,
  onMove,
  snapshot,
  snapshotsLoaded,
  savedEngineReady,
  savedEngineLoading,
}: {
  rows: PlanRow[];
  metrics: Map<string, EngineMetric>;
  week: string;
  onWeekChange: (value: string) => void | Promise<void>;
  onCalc: (sku: string) => void;
  onMove: (ids: string[]) => Promise<void | boolean>;
  snapshot?: InventorySnapshot;
  snapshotsLoaded: boolean;
  savedEngineReady: boolean;
  savedEngineLoading: boolean;
}) {
  const [draftWeek, setDraftWeek] = useState(week);
  const [skuQuery, setSkuQuery] = useState("");
  const [searchOpen,setSearchOpen] = useState(false);
  const [searchField,setSearchField] = useState<'sku'|'name'|'spec'|'group'|'line'|'priority'>('sku');
  const visibleRows = rows.filter(r => String(r[searchField] || '').toLocaleLowerCase('vi').includes(skuQuery.trim().toLocaleLowerCase('vi')));
  const locked = !snapshotsLoaded;
  const weekNeedsUpdate = draftWeek !== week;
  const transferLocked =
    locked || savedEngineLoading || !savedEngineReady || weekNeedsUpdate;
  const eligible = visibleRows.filter(
    (r) =>
      !locked &&
      r.priority !== "KHÔNG BỔ SUNG" &&
      r.suggested > 0 &&
      r.status === "Chưa đưa vào kế hoạch",
  );
  const [selected, setSelected] = useState<string[]>(eligible.map((r) => r.id));
  useEffect(() => setDraftWeek(week), [week]);
  useEffect(() => setSelected(eligible.map((r) => r.id)), [week, skuQuery]);
  const validWeek = /^\d{4}-\d{2}-\d{2}$/.test(draftWeek) && !Number.isNaN(new Date(`${draftWeek}T00:00:00`).getTime());
  const draftStart = mondayOf(new Date(`${validWeek ? draftWeek : week}T00:00:00`));
  const draftEnd = new Date(draftStart);
  draftEnd.setDate(draftEnd.getDate() + 6);
  const updateWeek = async () => {
    if (!validWeek) return;
    const normalized = `${draftStart.getFullYear()}-${String(draftStart.getMonth() + 1).padStart(2, "0")}-${String(draftStart.getDate()).padStart(2, "0")}`;
    setDraftWeek(normalized);
    await onWeekChange(normalized);
  };
  const toggle = (id: string) =>
    setSelected((v) =>
      v.includes(id) ? v.filter((x) => x !== id) : [...v, id],
    );
  const selectedIds = eligible.filter(r=>selected.includes(r.id)).map(r=>r.id);
  const [moving, setMoving] = useState(false);
  const moveBulk = async () => {
    if (transferLocked || moving || !selectedIds.length) return;
    setMoving(true);
    try {
      const completed = await onMove(selectedIds);
      if (completed !== false) setSelected([]);
    } finally {
      setMoving(false);
    }
  };
  return (
    <section className="data-card engine-view bulk-engine">
      <StandardToolbar name="BulkEngineView" items={[
        toolbarConfig.action({onClick:()=>setSearchOpen(true)},'Tra cứu',true,'lookup'),
        toolbarConfig.action({onClick:updateWeek,disabled:!validWeek || !snapshotsLoaded || savedEngineLoading || moving, disabledExplanation: moving || savedEngineLoading || !snapshotsLoaded ? "Đang xử lý dữ liệu. Vui lòng chờ hoàn tất rồi thử lại." : "Chọn tuần hợp lệ trước khi cập nhật."},'Cập nhật dữ liệu',true,'action'),
        toolbarConfig.action({onClick:moveBulk,disabled:transferLocked || moving || !selectedIds.length, disabledExplanation: moving || locked || savedEngineLoading ? "Đang xử lý dữ liệu. Vui lòng chờ hoàn tất rồi thử lại." : !savedEngineReady ? "Chưa có kết quả Engine đã lưu để chuyển kế hoạch." : weekNeedsUpdate ? "Cập nhật tuần đã chọn trước khi chuyển kế hoạch." : "Chọn ít nhất một dòng đủ điều kiện để chuyển kế hoạch."},'Đưa hàng loạt sang Production Plan',true,'action'),
        toolbarConfig.field('TUẦN KẾ HOẠCH',[
          toolbarConfig.input({type:'date','aria-label':'Chọn tuần kế hoạch',value:draftWeek,disabled:moving,onChange:e=>{
            const raw=e.target.value;
            if(!raw){setDraftWeek('');return;}
            const monday=mondayOf(new Date(`${raw}T00:00:00`));
            setDraftWeek(`${monday.getFullYear()}-${String(monday.getMonth()+1).padStart(2,'0')}-${String(monday.getDate()).padStart(2,'0')}`);
          }}),
          toolbarConfig.note(<span>{validWeek ? `${formatViDate(draftStart)} - ${formatViDate(draftEnd)}` : 'Chọn tuần kế hoạch'}</span>),
        ]),
        searchOpen && toolbarConfig.group([
          toolbarConfig.field('TRA THEO',[toolbarConfig.select({value:searchField,onChange:e=>{setSearchField(e.target.value as typeof searchField);setSkuQuery('')}},<><option value="sku">Mã SKU</option><option value="name">Tên sản phẩm</option><option value="spec">Quy cách</option><option value="group">Nhóm sản phẩm</option><option value="line">Line</option><option value="priority">Ưu tiên</option></>)]),
          toolbarConfig.field('NỘI DUNG TRA',[
            ['group','line','priority'].includes(searchField)
              ? toolbarConfig.select({value:skuQuery,onChange:e=>setSkuQuery(e.target.value)},<><option value="">Tất cả</option>{Array.from(new Set(rows.map(r=>String(r[searchField] || '')))).filter(Boolean).sort().map(value=><option key={value} value={value}>{value}</option>)}</>)
              : toolbarConfig.input({value:skuQuery,onChange:e=>setSkuQuery(e.target.value),placeholder:'Nhập nội dung cần tra'}),
          ]),
          toolbarConfig.action({onClick:()=>setSkuQuery('')},'Xóa lọc',true,'clear'),
          toolbarConfig.action({onClick:()=>{}},'Tìm kiếm',true,'search'),
          toolbarConfig.action({onClick:()=>{setSkuQuery('');setSearchOpen(false)}},'Quay lại',true,'back'),
        ]),
      ]} />
      {!snapshotsLoaded ? (
        <div className="snapshot-engine-alert">
          Đang kiểm tra dữ liệu tồn kho chốt của tuần...
        </div>
      ) : !snapshot ? (
        <div className="snapshot-engine-alert error">
          Chưa có dữ liệu tồn kho chốt cho tuần {formatViDate(draftStart)}–
          {formatViDate(draftEnd)}. Engine vẫn tính với tồn kho = 0; không tạo
          phiếu chốt giả.
        </div>
      ) : null}
      {savedEngineLoading && !savedEngineReady ? (
        <div className="engine-save-state">
          Đang kiểm tra dữ liệu của tuần này… / 正在檢查本週資料…
        </div>
      ) : !savedEngineLoading && weekNeedsUpdate ? (
        <div className="engine-save-state warning">
          Ngày bắt đầu tuần đã thay đổi. Hãy bấm “Cập nhật dữ liệu tuần” trước
          khi chuyển sang Production Plan. /
          週開始日期已變更，請先按「更新週資料」，再轉入 Production Plan。
        </div>
      ) : !savedEngineLoading && !savedEngineReady ? (
        <div className="engine-save-state warning">
          Dữ liệu tuần chưa được cập nhật. Hãy bấm “Cập nhật dữ liệu tuần” trước
          khi chuyển sang Production Plan. /
          週資料尚未更新，請先更新週資料，再轉入 Production Plan。
        </div>
      ) : null}
      <DataTable className="table-wrap">
        <table className="engine-table bulk-table">
          <thead>
            <tr>
              <th><input type="checkbox" aria-label="Chọn tất cả dòng đủ điều kiện"
                disabled={transferLocked || moving || !eligible.length}
                checked={eligible.length > 0 && selectedIds.length === eligible.length}
                ref={node=>{if(node)node.indeterminate=selectedIds.length>0 && selectedIds.length<eligible.length}}
                onChange={e=>setSelected(e.target.checked?eligible.map(r=>r.id):[])} /></th>
              <th>TUẦN KẾ HOẠCH</th>
              <th>MONTH</th>
              <th>NHÓM SP</th>
              <th className="engine-sku-column">SKU</th>
              <th className="engine-name-column">TÊN SẢN PHẨM</th>
              <th>QUY CÁCH</th>
              <th>LINE</th>
              <th>DAILY DEMAND</th>
              <th>DEMAND EVENT TUẦN</th>
              <th>TỒN KHO CHỐT</th>
              <th>ĐANG ĐI</th>
              <th>LEAD TIME</th>
              <th>TỔNG SAFETY DAYS</th>
              <th>ROP</th>
              <th>CẦN BỔ SUNG?</th>
              <th>SL CẦN BỔ SUNG</th>
              <th>MOQ</th>
              <th>SL SAU MOQ</th>
              <th className="engine-priority-column">ƯU TIÊN</th>
              <th className="engine-reason-column">LÝ DO</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {!visibleRows.length && (
              <tr data-no-data="true">
                <DataCell colSpan={22}>
                  Chưa có kết quả phù hợp. Kiểm tra chi tiết dữ liệu đầu vào
                  hoặc điều kiện tra SKU. / 尚無有效結果，請檢查資料。
                </DataCell>
              </tr>
            )}
            {!locked &&
              visibleRows.map((r) => {
                const f = metrics.get(r.id)!;
                const canSelect =
                  r.priority !== "KHÔNG BỔ SUNG" &&
                  r.suggested > 0 &&
                  r.status === "Chưa đưa vào kế hoạch";
                const reason = f.reason;
                return (
                  <tr key={r.id} className={!canSelect ? "no-supply-row" : ""}>
                    <DataCell className="select-cell">
                      <input
                        type="checkbox"
                        disabled={transferLocked || moving || !canSelect}
                        checked={selectedIds.includes(r.id)}
                        onChange={() => toggle(r.id)}
                      />
                    </DataCell>
                    <DataCell>{f.weekLabel}</DataCell>
                    <DataCell kind="date">{f.month}</DataCell>
                    <DataCell kind="code">{r.group}</DataCell>
                    <DataCell kind="code" className="engine-sku-column">
                      <FeedbackActionButton
                        className="plan-sku calc-link"
                        onClick={() => onCalc(r.sku)}
                      >
                        {r.sku}
                      </FeedbackActionButton>
                    </DataCell>
                    <DataCell className="engine-name-column">
                      <strong>{r.name}</strong>
                    </DataCell>
                    <DataCell>{r.spec}</DataCell>
                    <DataCell kind="code">{r.line}</DataCell>
                    <DataCell kind="number" className="number engine-demand">
                      {f.dailyDemand.toLocaleString("vi-VN")}
                    </DataCell>
                    <DataCell kind="number" className="number">
                      {f.eventWeek.toLocaleString("vi-VN")}
                    </DataCell>
                    <DataCell kind="number" className="number engine-supply">
                      {f.stock.toLocaleString("vi-VN")}
                    </DataCell>
                    <DataCell kind="number" className="number engine-supply">
                      {f.inTransit.toLocaleString("vi-VN")}
                    </DataCell>
                    <DataCell kind="number" className="number">{f.leadTime.toFixed(2)}</DataCell>
                    <DataCell kind="number" className="number">{f.safetyDays.toFixed(2)}</DataCell>
                    <DataCell kind="number" className="number engine-rop">
                      {f.rop.toLocaleString("vi-VN", {
                        maximumFractionDigits: 2,
                      })}
                    </DataCell>
                    <DataCell>
                      <span className={canSelect ? "need-yes" : "need-no"}>
                        {canSelect ? "YES" : "NO"}
                      </span>
                    </DataCell>
                    <DataCell kind="number" className="number">
                      {f.replenish.toLocaleString("vi-VN", {
                        maximumFractionDigits: 2,
                      })}
                    </DataCell>
                    <DataCell kind="number" className="number">{f.moq.toLocaleString("vi-VN")}</DataCell>
                    <DataCell kind="number" className="number engine-result">
                      {r.suggested.toLocaleString("vi-VN")}
                    </DataCell>
                    <DataCell className="engine-priority-column">
                      <span
                        className={`priority engine-priority-${enginePriorityTone(r.priority)}`}
                      >
                        {enginePriorityTone(r.priority) === "no-add" ? "KO BỔ SUNG" : r.priority.toUpperCase()}
                      </span>
                    </DataCell>
                    <DataCell className="reason-cell"><EngineReason reason={reason} sku={r.sku} /></DataCell>
                    <DataCell>
                      <FeedbackActionButton
                        className="calc-button"
                        onClick={() => onCalc(r.sku)}
                      >
                        Xem cách tính
                      </FeedbackActionButton>
                    </DataCell>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </DataTable>
      <details className="engine-footnote">
        <summary>Quy tắc chuyển 05 → 06 / 轉入規則</summary>
        <b>Quy tắc chuyển 05 → 06:</b> chỉ những dòng có mức ưu tiên hợp lệ mới
        được chọn. “KHÔNG BỔ SUNG” luôn bị loại, kể cả khi người dùng chọn tất
        cả.
      </details>
    </section>
  );
}

function UserSystemView() { return <p>Không có dữ liệu mẫu trong bản xuất source.</p>; }

function DemandEventView() { return <p>Không có dữ liệu mẫu trong bản xuất source.</p>; }

function DemandEventViewV2() { return <p>Không có dữ liệu mẫu trong bản xuất source.</p>; }

type DemandRow = {
  sourceRecordedAt?: string;
  sourceUpdatedBy?: string;
  createdAt?: string;
  id: string;
  requestDate: string;
  type: "Phát sinh" | "Bù tải";
  sku: string;
  name: string;
  spec: string;
  qty: number;
  delivery: string;
  priority: string;
  order: string;
  status: "Chưa lập kế hoạch" | "Đã lập kế hoạch";
  plannedWeek: string;
  planningWeekStart?: string;
  planningWeekEnd?: string;
  updatedBy: string;
  updatedAt: string;
};

let demandEventSessionCache: DemandRow[] | null = null;

function DemandEventViewV3({
  masterRows = skus,
  operator = "sample_user_15",
}: {
  masterRows?: Sku[];
  operator: string;
}) {
  const session = useRef(clientSessionGeneration()).current;
  const [events, setEvents] = useState<DemandRow[]>(() =>
    (
      planningSessionCache?.engineEvents ||
      demandEventSessionCache ||
      []
    ).filter((row) => !(row as DemandRow & { _deleted?: boolean })._deleted),
  );
  /* Historical fixture omitted from source export. */
  const [historyImport,setHistoryImport]=useState(false);
  const [added, setAdded] = useState(false);
  const [editingDemand,setEditingDemand] = useState<DemandRow|null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [saveMessage, setSaveMessage] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [dateRange, setDateRange] = useState<[string, string]>(["", ""]);
  const [demandLoading, setDemandLoading] = useState(false);
  const [markingPlanned, setMarkingPlanned] = useState(false);
  const [demandTableRevision, setDemandTableRevision] = useState(0);
  const refreshDemand = async (reset = false) => {
    const feedbackScope = actionFeedbackScope();
    const range: [string, string] = reset ? ["", ""] : [fromDate, toDate];
    if (range[0] && range[1] && range[0] > range[1]) {
      setSaveMessage(
        "Từ ngày phải trước hoặc bằng Đến ngày. / 起日不得晚於迄日。",
      );
      return;
    }
    setDemandLoading(true);
    setSaveMessage("");
    try {
      const response = await recordFetch("/api/records?entity=demand_event", {
        cache: "no-store",
      });
      if (!response.ok) throw Error();
      const data = await response.json();
      assertCurrentClientSession(session);
      const next: DemandRow[] = data.records
        .map((r: { payload: DemandRow & { _deleted?: boolean } }) => r.payload)
        .filter((r: DemandRow & { _deleted?: boolean }) => !r._deleted);
      setEvents(next);
      demandEventSessionCache = next;
      setDateRange(range);
      setSelected([]);
      if (reset) {
        setFromDate("");
        setToDate("");
      }
      setDemandTableRevision((value) => value + 1);
      const count = next.filter((row) => {
        const date = row.requestDate.split("/").reverse().join("-");
        return (
          (!range[0] || date >= range[0]) && (!range[1] || date <= range[1])
        );
      }).length;
      setSaveMessage(
        reset
          ? `Đã làm mới: hiển thị toàn bộ ${next.length} dòng. / 已重新載入全部資料。`
          : `Đã tra theo ngày yêu cầu: ${count} dòng phù hợp. / 已依需求日期篩選。`,
      );
    } catch {
      (feedbackScope === actionFeedbackScope() && notifyActionFailure("Không tải được dữ liệu. Vui lòng thử lại. / 載入失敗，請重試。"), setSaveMessage(
        "Không tải được dữ liệu. Vui lòng thử lại. / 載入失敗，請重試。",
      ));
    } finally {
      setDemandLoading(false);
    }
  };
  const weekRows = [...events]
    .sort((a, b) => {
      const time = (r: DemandRow) =>
        r.sourceRecordedAt || r.createdAt ||
        r.requestDate.split("/").reverse().join("-") + "T00:00:00+07:00";
      return (
        (Date.parse(time(b)) || 0) - (Date.parse(time(a)) || 0) ||
        a.id.localeCompare(b.id)
      );
    })
    .filter((row) => {
      const date = row.requestDate.split("/").reverse().join("-");
      return (
        (!dateRange[0] || date >= dateRange[0]) &&
        (!dateRange[1] || date <= dateRange[1])
      );
    });
  const selectable = weekRows.filter(
    (row) => row.status.toUpperCase() === "CHƯA LẬP KẾ HOẠCH",
  );
  useEffect(() => {
    recordFetch("/api/records?entity=demand_event")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => {
        const saved = data.records.map(
          (record: { payload: DemandRow }) => record.payload,
        );
        setEvents((current) => {
          if (session !== clientSessionGeneration()) return current;
          const next = saved.filter(
            (row: DemandRow & { _deleted?: boolean }) => !row._deleted,
          );
          demandEventSessionCache = next;
          return next;
        });
      })
      .catch(() =>
        setSaveMessage(
          "Không tải được Demand Event từ database TEST. 載入失敗。",
        ),
      );
  }, []);
  const selectedEligible = selectable.filter((row) => selected.includes(row.id));
  const markPlanned = async () => {
    if (markingPlanned || !selectedEligible.length) return;
    if (selectedEligible.some(row => !row.planningWeekStart)) {
      setSaveMessage('Không thể đánh dấu: đơn cũ chưa có tuần kế hoạch được chọn. Không tự gán tuần mặc định. / 舊資料未指定計畫週，無法標記。');
      return;
    }
    setMarkingPlanned(true);
    setSaveMessage("");
    const changed = selectedEligible.map((row) => ({
      ...row, status: "Đã lập kế hoạch" as const, plannedWeek: demandWeekLabel(row),
    }));
    try {
      const results = await Promise.allSettled(changed.map(async (row) => {
        const response = await recordFetch("/api/records", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({entity: "demand_event", key: row.id, payload: row, updatedBy: operator}),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return row;
      }));
      const saved = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
      setEvents((rows) => {
        if (session !== clientSessionGeneration()) return rows;
        const next = rows.map((row) => saved.find((item) => item.id === row.id) || row);
        demandEventSessionCache = next;
        return next;
      });
      setSelected((ids) => ids.filter((id) => !saved.some((row) => row.id === id)));
      const failed = results.flatMap((result, index) => result.status === "rejected"
        ? [`${changed[index].sku}: ${result.reason instanceof Error ? result.reason.message : "Lỗi kết nối"}`] : []);
      setSaveMessage(failed.length
        ? `Đã cập nhật ${saved.length}/${changed.length} dòng. Chưa xác nhận thành công: ${failed.join("; ")}. Hãy tải lại dữ liệu để kiểm tra trước khi thử lại; kiểm tra quyền nếu gặp HTTP 403.`
        : `Đã đánh dấu lập kế hoạch thành công ${saved.length} dòng.`);
    } finally {
      setMarkingPlanned(false);
    }
  };
  return (
    <section className="data-card demand-view demand-compact-view">
      <StandardToolbar name="DemandEventViewV3" items={[toolbarConfig.field(<>Từ ngày
          </>,[toolbarConfig.input({"aria-label": "Từ ngày","type": "date","value": fromDate,"onChange": (e) => setFromDate(e.target.value)})]),
toolbarConfig.field(<>Đến ngày
          </>,[toolbarConfig.input({"aria-label": "Đến ngày","type": "date","value": toDate,"onChange": (e) => setToDate(e.target.value)})]),
toolbarConfig.action({"type": "button","disabled": demandLoading || markingPlanned, disabledExplanation: "Đang xử lý dữ liệu. Vui lòng chờ hoàn tất rồi thử lại.","onClick": () => void refreshDemand(false)},<>{demandLoading ? "Đang tải…" : "Tra dữ liệu"}</>, true, "search"),
toolbarConfig.action({"type": "button","disabled": demandLoading || markingPlanned, disabledExplanation: "Đang xử lý dữ liệu. Vui lòng chờ hoàn tất rồi thử lại.","onClick": () => void refreshDemand(true)},<>Làm mới
        </>, true, "action"),
toolbarConfig.action({onClick:()=>setHistoryImport(true)},"Nhập dữ liệu lịch sử"),
toolbarConfig.action({"onClick": () => {setEditingDemand(null);setAdded(true)}},<>＋ Thêm Demand Event
        </>, true, "action"),
toolbarConfig.action({disabled:demandLoading||markingPlanned||selectedEligible.length!==1, disabledExplanation: demandLoading || markingPlanned ? "Đang xử lý dữ liệu. Vui lòng chờ hoàn tất rồi thử lại." : "Chọn đúng một dòng chưa lập kế hoạch để chỉnh sửa.",onClick:()=>{setEditingDemand(selectedEligible[0]);setAdded(true)}},"Chỉnh sửa"),
toolbarConfig.action({type: "button", disabled: demandLoading || markingPlanned || !selectedEligible.length, disabledExplanation: demandLoading || markingPlanned ? "Đang xử lý dữ liệu. Vui lòng chờ hoàn tất rồi thử lại." : "Chọn ít nhất một dòng chưa lập kế hoạch.", onClick: markPlanned}, <>Đánh dấu đã lập kế hoạch</>, true, "action")]} />
      {historyImport && <DemandHistoryImport masterRows={masterRows} operator={operator} onClose={()=>setHistoryImport(false)} onSaved={()=>void refreshDemand(true)}/>}
      {added && (
        <DemandEventDialog
          onBatchSaved={()=>{void refreshDemand(true);setSaveMessage("Đã lưu Demand event từ hình.");}}
          initial={editingDemand as any || undefined}
          masterRows={masterRows}
          operator={operator}
          onClose={() => setAdded(false)}
          onSaved={(row) => {
            if (session !== clientSessionGeneration()) return;
            setEvents((current) => {
              if (session !== clientSessionGeneration()) return current;
              const next = [
                row,
                ...current.filter((item) => item.id !== row.id),
              ];
              demandEventSessionCache = next;
              return next;
            });
            setDateRange(["", ""]);
            setFromDate("");
            setToDate("");
            setSelected([]);
            setDemandTableRevision((v) => v + 1);
            setAdded(false);
            setSaveMessage(editingDemand?"Điều chỉnh Demand Event thành công / 調整成功":"Thêm Demand Event thành công / 新增需求成功");
            setEditingDemand(null);
          }}
        />
      )}
      {saveMessage && (
        <div className="plan-notice" data-own-language role="status">
          {saveMessage}
          <FeedbackActionButton onClick={() => setSaveMessage("")}>×</FeedbackActionButton>
        </div>
      )}
      <DataTable className="table-wrap">
        <table
          key={demandTableRevision}
          className="event-table demand-event-table"
          data-page-size="25"
        >
          <thead>
            <tr>
              <th><input type="checkbox" aria-label="Chọn tất cả dòng chưa lập kế hoạch"
                disabled={markingPlanned || demandLoading || !selectable.length}
                checked={selectable.length > 0 && selectedEligible.length === selectable.length}
                ref={(input) => { if (input) input.indeterminate = selectedEligible.length > 0 && selectedEligible.length < selectable.length; }}
                onChange={(event) => setSelected(event.target.checked ? selectable.map((row) => row.id) : [])}
              /></th>
              <th>NGÀY YÊU CẦU</th>
              <th>LOẠI</th>
              <th>SKU</th>
              <th>TÊN SẢN PHẨM</th>
              <th>QUY CÁCH</th>
              <th>SL PHÁT SINH</th>
              <th>NGÀY GIAO</th>
              <th>ƯU TIÊN</th>
              <th>KHÁCH HÀNG/ĐƠN</th>
              <th>TRẠNG THÁI</th>
              <th>TUẦN KẾ HOẠCH</th>
              <th>NGƯỜI CẬP NHẬT</th>
            </tr>
          </thead>
          <tbody>
            {weekRows.map((row) => (
              <tr key={row.id}>
                <DataCell className="select-cell">
                  <input
                    type="checkbox"
                    aria-label={`Chọn ${row.sku}`}
                    disabled={markingPlanned || demandLoading || row.status.toUpperCase() !== "CHƯA LẬP KẾ HOẠCH"}
                    checked={selected.includes(row.id)}
                    onChange={() =>
                      setSelected((ids) =>
                        ids.includes(row.id)
                          ? ids.filter((id) => id !== row.id)
                          : [...ids, row.id],
                      )
                    }
                  />
                </DataCell>
                <DataCell kind="date">{row.requestDate}</DataCell>
                <DataCell>
                  <span
                    className={`event-type ${row.type === "Phát sinh" ? "urgent" : "load"}`}
                  >
                    {row.type}
                  </span>
                </DataCell>
                <DataCell kind="code">
                  <b className="plan-sku">{row.sku}</b>
                </DataCell>
                <DataCell>
                  <strong>{row.name}</strong>
                </DataCell>
                <DataCell>{row.spec}</DataCell>
                <DataCell kind="number" className="number">{row.qty.toLocaleString("vi-VN")}</DataCell>
                <DataCell kind="date">{row.delivery}</DataCell>
                <DataCell>{row.priority}</DataCell>
                <DataCell kind="number">{row.order}</DataCell>
                <DataCell>
                  <span
                    className={
                      row.status.toUpperCase() === "ĐÃ LẬP KẾ HOẠCH"
                        ? "done-badge"
                        : "pending-badge"
                    }
                  >
                    {row.status}
                  </span>
                </DataCell>
                <DataCell>
                  {demandWeekLabel(row)}
                </DataCell>
                <DataCell>
                  {row.sourceUpdatedBy || row.updatedBy}
                  <br />
                  <small title={row.sourceRecordedAt ? `Thời gian nguồn · Nhập trên web: ${approvalTime(row.updatedAt)} · ${row.updatedBy}` : undefined}>{approvalTime(row.sourceRecordedAt || row.updatedAt)}</small>
                </DataCell>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTable>
      <div className="source-note">
        <b>Phạm vi tổng hợp:</b> Các chỉ số phía trên tính trên toàn bộ Demand
        Event. Event đã đánh dấu lập kế hoạch sẽ không được sử dụng lại khi chạy
        05.
      </div>
    </section>
  );
}

type PlanningTab =
  "base" | "demand" | "proposal" | "rules" | "plan" | "tracking" | "report";
type ForecastRow = {
  sourceReportMonth?: string;
  applicationMonth?: string;
  reportExportDate?: string;
  sourceFileId?: string;
  adjustment30D?: number;
  month: string;
  group: string;
  sku: string;
  name: string;
  spec: string;
  line: string;
  f30: number;
  f60: number;
  f90: number;
  d30: number;
  d60: number;
  used: number;
  d90: number;
  warning: string;
};

const calculateForecastDemand = (row: ForecastRow): ForecastRow => {
  const d30 = row.f30 / 30;
  const d60 = row.f60 / 60;
  const used = Math.round(Math.max(d30, d60));
  const rawD90 = row.f90 / 90;
  const d90 = rawD90 < 1 ? 0 : rawD90;
  return {
    ...row,
    d30,
    d60,
    used,
    d90,
    warning:
      d90 >= 1 && d90 > used ? "Cảnh báo 90D tăng - xem xét NVL/MOQ" : "",
  };
};

const nextForecastMonth = (month: string) => {
  const [monthPart, yearPart] = month.split("/").map(Number);
  if (!monthPart || !yearPart) return month;
  const next = new Date(Date.UTC(yearPart, monthPart, 1));
  return `${String(next.getUTCMonth() + 1).padStart(2, "0")}/${next.getUTCFullYear()}`;
};

async function readForecastPdf(file: File): Promise<{rows: ForecastRow[]; reportMonth: string; applicationMonth: string; declaredSkuCount: number}> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
  }).promise;
  const allocationRows: ForecastRow[] = [];
  let reportMonth = "", reportExportDate = "", expectedCount = 0;
  let reportGroup = "";
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const cells = (content.items as Array<{ str?: string }>)
      .map((item) => item.str?.trim() || "")
      .filter(Boolean);
    const allText = cells.join(" ");
    const monthMatch = allText.match(/Tháng\s+báo\s+cáo\s*:?\s*(0?[1-9]|1[0-2])\/(\d{4})/i);
    if(monthMatch) reportMonth = `${monthMatch[1].padStart(2,"0")}/${monthMatch[2]}`;
    const dateMatch = allText.match(/Ngày\s+xuất\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i);
    if(dateMatch) reportExportDate = dateMatch[1];
    const countMatch = allText.match(/Tổng\s+SKU\s*:?\s*(\d+)/i);
    if(countMatch) expectedCount = Number(countMatch[1]);
    const visualRows = new Map<number, Array<{ x: number; text: string }>>();
    for (const item of content.items as Array<{
      str?: string;
      transform?: number[];
    }>) {
      if (!item.str?.trim() || !item.transform) continue;
      const y = Math.round(item.transform[5]);
      visualRows.set(y, [
        ...(visualRows.get(y) || []),
        { x: item.transform[4], text: item.str.trim() },
      ]);
    }
    for (const [, rawItems] of [...visualRows.entries()].sort(
      (a, b) => b[0] - a[0],
    )) {
      const items = rawItems.sort((a, b) => a.x - b.x);
      const monthCell = items.find((item) => /^\d{2}\/\d{4}$/.test(item.text));
      if (!reportMonth && items.some((item) => item.text.includes("Tháng báo cáo")) && monthCell)
        reportMonth = monthCell.text;
      const groupText = items.map((item) => item.text).join(" ").match(/^NHÓM:\s*(.+)$/i);
      if (groupText) {
        reportGroup = groupText[1].trim();
        continue;
      }
      const sku = items[0]?.text || "";
      if (!/^[A-Z0-9-]{7,20}$/.test(sku) || !reportMonth || !reportGroup)
        continue;
      const numericCells = items.filter(
        (item) => item.x >= 395 && /^-?(?:\d+|\d{1,3}(?:[.,]\d{3})+)$/.test(item.text),
      );
      if (numericCells.length < 4) continue;
      const numberValue = (value: string) => Number(value.replace(/[.,]/g, ""));
      const values = numericCells.slice(-4).map((item) => numberValue(item.text));
      const name = items
        .filter((item) => item.x >= 80 && item.x < 290)
        .map((item) => item.text)
        .join(" ");
      const spec = items
        .filter((item) => item.x >= 290 && item.x < 395)
        .map((item) => item.text)
        .join(" ");
      const line =
        items.find(
          (item) =>
            item.x >= 395 && item.x < 470 && /^(A|B|C|NK)$/.test(item.text),
        )?.text || "";
      allocationRows.push(
        calculateForecastDemand({
          month: nextForecastMonth(reportMonth),
          applicationMonth: nextForecastMonth(reportMonth),
          sourceReportMonth: reportMonth,
          reportExportDate,
          group: reportGroup,
          sku,
          name,
          spec,
          line,
          adjustment30D: values[0],
          f30: values[1],
          f60: values[2],
          f90: values[3],
          d30: 0,
          d60: 0,
          used: 0,
          d90: 0,
          warning: "",
        }),
      );
    }
  }
  if(!reportMonth) throw Error("Không tìm thấy Tháng báo cáo trong PDF; chưa nhập dữ liệu.");
  if(!expectedCount) throw Error("Không tìm thấy Tổng SKU trong PDF; chưa nhập dữ liệu.");
  if(allocationRows.length!==expectedCount || new Set(allocationRows.map(row=>row.sku)).size!==allocationRows.length)
    throw Error(`PDF ghi ${expectedCount} SKU nhưng chỉ đọc được ${allocationRows.length} dòng hợp lệ. Chưa nhập dữ liệu để tránh thiếu hoặc trùng SKU.`);
  if(allocationRows.some(row=>!row.group||![row.f30,row.f60,row.f90].every(value=>Number.isSafeInteger(value)&&value>=0)))
    throw Error("PDF có nhóm hoặc số Forecast không hợp lệ; chưa nhập dữ liệu.");
  return {rows:allocationRows,reportMonth,applicationMonth:nextForecastMonth(reportMonth),declaredSkuCount:expectedCount};
}

function PlanningLookupBar({
  tab,
}: {
  tab: PlanningTab;
  onForecastImported?: (rows: ForecastRow[]) => void;
}) {
  return (
    <section className="planning-lookup">
      <p>
        {tab === "base"
          ? "Nguồn: database TEST · Chọn tháng áp dụng SX bên dưới. PDF mới được nhập qua quy trình kiểm tra và sao lưu local trong README."
          : "Hiển thị toàn bộ lịch sử Demand Event trong database TEST, gồm các dòng ngoài PDF được giữ nguyên."}
      </p>
    </section>
  );
}

function ProductionEngineRules() {
  const priorities = [
    [
      "1",
      "KHẨN - EVENT",
      "Có Demand Event phát sinh giao trong tuần và tồn ERP + đang đi không đủ riêng Event.",
      "Ưu tiên lên lệnh đầu tiên để hạn chế nguy cơ trễ giao.",
    ],
    [
      "2",
      "CAO - EVENT",
      "Có Demand Event phát sinh trong tuần; tồn đủ riêng Event nhưng chưa đủ Forecast, Lead Time và Safety.",
      "Ưu tiên trước các SKU chỉ chạm Safety hoặc ROP.",
    ],
    [
      "3",
      "KHẨN - SAFETY",
      "Không có Event trong tuần và tồn ERP + đang đi thấp hơn Safety Qty.",
      "Bổ sung sớm để hạn chế nguy cơ thiếu hàng.",
    ],
    [
      "4",
      "CAO - ROP",
      "Không có Event trong tuần và tồn ERP + đang đi nhỏ hơn hoặc bằng ROP.",
      "Đưa vào kế hoạch bổ sung theo thứ tự ưu tiên.",
    ],
    [
      "5",
      "ĐỦ TỒN - EVENT",
      "Có Event trong tuần nhưng tồn ERP + đang đi đã đủ Event và nhu cầu thông thường.",
      "Không bắt buộc sản xuất; cân nhắc theo Capacity.",
    ],
    [
      "6",
      "BÙ TẢI",
      "Demand Event loại Bù tải đang ở trạng thái Chưa lập kế hoạch.",
      "Cộng nguyên số lượng Bù tải, không trừ tồn ERP hoặc đang đi.",
    ],
    [
      "7",
      "KHÔNG BỔ SUNG",
      "Không có Phát sinh/Bù tải hợp lệ và tồn khả dụng lớn hơn ROP.",
      "Không cho chọn hoặc chuyển sang Production_plan.",
    ],
  ];
  return (
    <main className="workspace engine-rules-workspace">
      <StandardToolbar name="ProductionEngineRules" items={[toolbarConfig.note(<span>
          <b>Quy tắc áp dụng Production_engine</b>
          <small>
            Dùng để kiểm tra tuần Forecast và thứ tự ưu tiên trước khi tạo dữ
            liệu
          </small>
        </span>)]} />
      <section className="data-card rule-card">
        <div className="section-title">
          <div>
            <h2>Quy định tuần kế hoạch và tháng Forecast</h2>
            <p>
              Tháng Forecast luôn được xác định theo ngày thứ Năm trong tuần.
            </p>
          </div>
        </div>
        <DataTable className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>NỘI DUNG</th>
                <th>QUY ĐỊNH</th>
                <th>VÍ DỤ</th>
                <th>KẾT QUẢ</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <DataCell>Ngày nhập</DataCell>
                <DataCell>
                  Người dùng chọn ngày thuộc tuần cần lập kế hoạch; hệ thống tự
                  đưa về thứ Hai.
                </DataCell>
                <DataCell>Chọn 05/08/2026</DataCell>
                <DataCell>Tuần bắt đầu 03/08/2026</DataCell>
              </tr>
              <tr>
                <DataCell>Phạm vi tuần</DataCell>
                <DataCell>Tính từ thứ Hai đến Chủ nhật, tổng cộng 7 ngày.</DataCell>
                <DataCell>03/08–09/08</DataCell>
                <DataCell>Tuần 03/08–09/08/2026</DataCell>
              </tr>
              <tr>
                <DataCell>Tháng Forecast</DataCell>
                <DataCell>
                  Không lấy theo tháng của ngày thứ Hai; lấy tháng chứa ngày thứ
                  Năm.
                </DataCell>
                <DataCell>Tuần 31/08–06/09</DataCell>
                <DataCell>Dùng Forecast 09/2026</DataCell>
              </tr>
              <tr>
                <DataCell>Tuần giao tháng</DataCell>
                <DataCell>
                  Ngày thứ Năm đại diện cho tháng chiếm phần lớn thời gian của
                  tuần.
                </DataCell>
                <DataCell>Tuần 30/11–06/12</DataCell>
                <DataCell>Thứ Năm 03/12 → Forecast 12/2026</DataCell>
              </tr>
              <tr>
                <DataCell>Tuần chủ yếu thuộc tháng cũ</DataCell>
                <DataCell>
                  Nếu ngày thứ Năm vẫn thuộc tháng cũ thì tiếp tục dùng Forecast
                  tháng cũ.
                </DataCell>
                <DataCell>Tuần 27/07–02/08</DataCell>
                <DataCell>Thứ Năm 30/07 → Forecast 07/2026</DataCell>
              </tr>
              <tr>
                <DataCell>Mục đích</DataCell>
                <DataCell>
                  Tránh chọn sai tháng khi tuần bắt đầu ngày 30 hoặc 31 nhưng
                  phần lớn tuần nằm trong tháng sau.
                </DataCell>
                <DataCell>—</DataCell>
                <DataCell>Forecast phù hợp với tuần sản xuất</DataCell>
              </tr>
            </tbody>
          </table>
        </DataTable>
      </section>
      <section className="data-card rule-card">
        <div className="section-title">
          <div>
            <h2>Quy tắc và thứ tự ưu tiên bổ sung sản xuất</h2>
            <p>
              Hệ thống sắp theo ưu tiên, sau đó theo Line và số lượng sau MOQ
              giảm dần.
            </p>
          </div>
        </div>
        <DataTable className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>THỨ TỰ</th>
                <th>MỨC ƯU TIÊN</th>
                <th>ĐIỀU KIỆN</th>
                <th>HƯỚNG XỬ LÝ</th>
              </tr>
            </thead>
            <tbody>
              {priorities.map((row) => (
                <tr key={row[0]}>
                  <DataCell className="rule-order">{row[0]}</DataCell>
                  <DataCell>
                    <span className={`priority-rule p${row[0]}`}>{row[1]}</span>
                  </DataCell>
                  <DataCell>{row[2]}</DataCell>
                  <DataCell>{row[3]}</DataCell>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>
        <div className="source-note">
          <b>Công thức:</b> Tồn khả dụng = Tồn ERP + Đang đi · ROP = Daily
          Demand × (Lead Time + Safety Days) · SL cần bổ sung = MAX(0, ROP +
          Phát sinh − Tồn khả dụng) + Bù tải · Sau đó làm tròn MOQ.
        </div>
      </section>
    </main>
  );
}

type PlanningSessionCache = {
  planRows: PlanRow[];
  baseRows: ForecastRow[];
  baseMonth: string;
  engineEvents: DemandRow[];
  engineWeek: string;
  snapshots: InventorySnapshot[];
  snapshotsLoaded: boolean;
};

let planningSessionCache: PlanningSessionCache | null = null;
let forecastRecordsCache: ForecastRow[] | null = null;
let forecastRecordsPromise: Promise<ForecastRow[]> | null = null;
const loadForecastRecords = async (): Promise<ForecastRow[]> => {
  const browser = typeof window !== "undefined";
  const session = clientSessionGeneration();
  if (browser && forecastRecordsCache) return forecastRecordsCache;
  if (browser && forecastRecordsPromise) return forecastRecordsPromise;
  const request = recordFetch("/api/records?entity=forecast")
      .then(async (response) => {
        if (!response.ok) throw Error("Không tải được Base forecast");
        const data = await response.json();
        assertCurrentClientSession(session);
        const rows: ForecastRow[] = data.records
          .flatMap((record: { payload: ForecastRow[] }) => record.payload)
          .map(calculateForecastDemand);
        if (browser) forecastRecordsCache = rows;
        return rows;
      })
      .finally(() => {
        if (forecastRecordsPromise === request) forecastRecordsPromise = null;
      });
  if (browser) forecastRecordsPromise = request;
  return request;
};
type EngineRecord = {
  key: string;
  payload: {
    week?: string;
    rows?: unknown[];
    metrics?: [string, EngineMetric][];
    [key: string]: unknown;
  };
};
let productionEngineRecordsCache: EngineRecord[] | null = null;
let productionEngineRecordsPromise: Promise<EngineRecord[]> | null = null;
const loadProductionEngineRecords = async (): Promise<EngineRecord[]> => {
  const browser = typeof window !== "undefined";
  const session = clientSessionGeneration();
  if (browser && productionEngineRecordsCache) return productionEngineRecordsCache;
  if (browser && productionEngineRecordsPromise) return productionEngineRecordsPromise;
  const request = recordFetch(
      "/api/records?entity=production_engine",
    )
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            "Không tải được dữ liệu Engine. 無法載入 Engine 資料。",
          );
        const data = await response.json();
        assertCurrentClientSession(session);
        const records: EngineRecord[] = data.records || [];
        if (browser) productionEngineRecordsCache = records;
        return records;
      })
      .finally(() => {
        if (productionEngineRecordsPromise === request) productionEngineRecordsPromise = null;
      });
  if (browser) productionEngineRecordsPromise = request;
  return request;
};

const prefetchProductionEngine = () => {
  const session = clientSessionGeneration();
  void loadProductionEngineRecords()
    .then((records) => {
      assertCurrentClientSession(session);
      const latestWeek = records.find(
        (record) => typeof record.payload?.week === "string",
      )?.payload?.week;
      return prefetchProductionPlan(
        planningSessionCache?.engineWeek || latestWeek || "",
      );
    })
    .catch(() => {});
  void loadInventorySnapshots().catch(() => {});
  void loadForecastRecords().catch(() => {});
  void prefetchInTransit().catch(() => {});
};

const updatePlanningSessionCacheForSession = (next: Partial<PlanningSessionCache>, session: number) => {
  if (typeof window === "undefined" || session !== clientSessionGeneration()) return;
  const defaults: PlanningSessionCache = {
    planRows: proposalRows,
    baseRows: (baseForecastData as ForecastRow[]).map(calculateForecastDemand),
    baseMonth: "",
    engineEvents: demandEventSessionCache || (demandEventData as DemandRow[]),
    engineWeek: "2026-08-31",
    snapshots: [],
    snapshotsLoaded: false,
  };
  planningSessionCache = { ...(planningSessionCache || defaults), ...next };
};

function PlanningView({
  tab,
  operator,
  masterRows = skus,
}: {
  masterRows?: Sku[];
  tab: PlanningTab;
  operator: string;
}) {
  const session = useRef(clientSessionGeneration()).current;
  const updatePlanningSessionCache = (next: Partial<PlanningSessionCache>) => updatePlanningSessionCacheForSession(next, session);
  const masterDataRevision = useDataRefresh(['sku', 'leadtime', 'leadtime_versions', 'safety_rules', 'labor_hours', 'forecast', 'demand_event', 'inventory_snapshot'], {poll:false});
  const [rows, setRows] = useState<PlanRow[]>(() =>
    (planningSessionCache?.planRows || proposalRows).map(normalizePlanRow),
  );
  const [savedEngine, setSavedEngine] = useState<{
    key: string;
    payload: {
      week?: string;
      rows: PlanRow[];
      metrics?: [string, EngineMetric][];
      warnings?: string[];
      errors?: string[];
      stats?: {
        input: number;
        calculated: number;
        pending: number;
        defaults: number;
        unmatched: number;
      };
    };
  } | null>(() => {
    const preferredWeek =
      planningSessionCache?.engineWeek ||
      productionEngineRecordsCache?.find((record) =>
        /^\d{4}-\d{2}-\d{2}$/.test(record.payload?.week || ""),
      )?.payload.week;
    return (productionEngineRecordsCache?.find(
      (record) => record.payload?.week === preferredWeek,
    ) || null) as any;
  });
  const [savedEngineLoading, setSavedEngineLoading] = useState(
    () => !productionEngineRecordsCache,
  );
  const [engineDemandLoaded, setEngineDemandLoaded] = useState(false);
  const [engineEvents, setEngineEvents] = useState<DemandRow[]>(
    () => planningSessionCache?.engineEvents || demandEventSessionCache || [],
  );
  const [engineWeek, setEngineWeek] = useState(
    () =>
      planningSessionCache?.engineWeek ||
      productionEngineRecordsCache?.find((record) =>
        /^\d{4}-\d{2}-\d{2}$/.test(record.payload?.week || ""),
      )?.payload.week ||
      "2026-08-31",
  );
  const [engineWeekReady, setEngineWeekReady] = useState(
    () => !!productionEngineRecordsCache && !!inventorySnapshotsCache,
  );
  useEffect(() => {
    let active = true;
    if (session !== clientSessionGeneration()) return;
    if (masterDataRevision) productionEngineRecordsCache = null;
    setSavedEngine(current => current?.payload.week === engineWeek ? current : null);
    setSavedEngineLoading(true);
    loadProductionEngineRecords()
      .then((records) => {
        if (active)
          setSavedEngine(
            (records.find(
              (r) =>
                r.payload?.week === engineWeek && Array.isArray(r.payload.rows),
            ) || null) as any,
          );
      })
      .catch((error) => {
        if (active) setNotice(error.message);
      })
      .finally(() => {
        if (active) setSavedEngineLoading(false);
      });
    return () => {
      active = false;
    };
  }, [engineWeek, masterDataRevision]);
  const [baseRows, setBaseRows] = useState<ForecastRow[]>(
    () =>
      planningSessionCache?.baseRows ||
      forecastRecordsCache ||
      (baseForecastData as ForecastRow[]).map(calculateForecastDemand),
  );
  const masterGroupBySku = useMemo(
    () =>
      new Map(masterRows.map((row) => [normalizeSkuCode(row.code), row.group])),
    [masterRows],
  );
  const baseRowsWithMasterGroups = useMemo(
    () =>
      baseRows.map((row) => ({
        ...row,
        group:
          masterGroupBySku.get(normalizeSkuCode(row.sku)) || row.group || "—",
      })),
    [baseRows, masterGroupBySku],
  );
  const baseMonths = Array.from(
    new Set(baseRowsWithMasterGroups.map((row) => row.month)),
  ).sort();
  const forecastPdfInputRef = useRef<HTMLInputElement>(null);
  const preparedForecastRef = useRef<{file:File;parsed:Awaited<ReturnType<typeof readForecastPdf>>}|null>(null);
  const [forecastPdfUploadReady,setForecastPdfUploadReady] = useState(false);
  const [forecastImportedFileIds,setForecastImportedFileIds] = useState<string[]>([]);
  const [baseMonth, setBaseMonth] = useState(
    () => planningSessionCache?.baseMonth || baseMonths.at(-1) || "",
  );
  const periodBaseRows = baseRowsWithMasterGroups.filter(
    (row) => row.month === baseMonth,
  );
  const hasReport = periodBaseRows.some((row) => row.sourceReportMonth);
  const visibleBaseRows = periodBaseRows.filter(
    (row) => !hasReport || row.sourceReportMonth,
  );
  const [baseSearchOpen, setBaseSearchOpen] = useState(false);
  const [baseSearchField, setBaseSearchField] = useState("sku");
  const [baseSearchDraft, setBaseSearchDraft] = useState("");
  const [baseSearch, setBaseSearch] = useState({ field: "sku", query: "" });
  const searchedBaseRows = visibleBaseRows
    .filter((row) =>
      normalizeSearchText(
        String(row[baseSearch.field as keyof ForecastRow] || ""),
      ).includes(normalizeSearchText(baseSearch.query)),
    );
  const [notice, setNotice] = useState("");
  useEffect(()=>{
    if(tab!=="base")return;
    recordFetch('/api/records?entity=forecast_import_history',{cache:'no-store'})
      .then(response=>response.ok?response.json():Promise.reject())
      .then(data=>setForecastImportedFileIds((data.records||[]).map((record:{key:string})=>record.key)))
      .catch(()=>{});
  },[tab]);
  const prepareForecastUpload = async (file:File) => {
    if(!file.name.toLowerCase().endsWith('.pdf'))throw Error('Chọn PDF báo cáo Forecast.');
    const parsed=await readForecastPdf(file);
    preparedForecastRef.current={file,parsed};
    return parsed.applicationMonth;
  };
  const importForecastFromFile = async (file:File,stored:StoredFile) => {
    const parsed=preparedForecastRef.current?.file===file?preparedForecastRef.current.parsed:await readForecastPdf(file);
    preparedForecastRef.current=null;
    const current=baseRows.filter(row=>row.month===parsed.applicationMonth);
    if(current.some(row=>row.sourceReportMonth)&&!window.confirm(`Tháng ${parsed.applicationMonth} đã có ${current.length} dòng Forecast. Nhập PDF ${stored.original_name} sẽ thay bản tháng này; bản cũ được lưu lịch sử. Tiếp tục?`))
      return `PDF ${stored.original_name} đã lưu; dữ liệu tháng ${parsed.applicationMonth} chưa thay đổi.`;
    if(knownRecordRevision('forecast',parsed.applicationMonth)===undefined){
      const loaded=await recordFetch('/api/records?entity=forecast',{cache:'no-store'});
      if(!loaded.ok)throw Error('Chưa tải được phiên bản Forecast; hãy thử lại.');
    }
    const expectedRevision=knownRecordRevision('forecast',parsed.applicationMonth);
    const response=await fetch('/api/forecast-import',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({fileId:stored.file_id,reportMonth:parsed.reportMonth,declaredSkuCount:parsed.declaredSkuCount,rows:parsed.rows,expectedRevision})});
    const data=await response.json();
    if(!response.ok)throw Error(`PDF ${stored.original_name} đã lưu, nhưng chưa nhập dữ liệu: ${data.error||'Không thể nhập Forecast.'}`);
    if(data.revision)acceptRecordRevision('forecast',data.month,data.revision);
    if(!data.alreadyImported){
      const next=[...baseRows.filter(row=>row.month!==data.month),...data.rows];
      forecastRecordsCache=[...(forecastRecordsCache||[]).filter(row=>row.month!==data.month),...data.rows];
      setBaseRows(next);updatePlanningSessionCache({baseRows:next,baseMonth:data.month});
    }else{
      forecastRecordsCache=null;
      const saved=await loadForecastRecords();
      setBaseRows(current=>[...current.filter(row=>row.month!==data.month),...saved.filter(row=>row.month===data.month)]);
    }
    setBaseMonth(data.month);
    setForecastImportedFileIds(previous=>[...new Set([...previous,stored.file_id])]);
    return `Đã nhập ${data.count} SKU từ báo cáo ${parsed.reportMonth} vào Base Forecast tháng ${data.month}.`;
  };
  const importStoredForecast = async (stored:StoredFile) => {
    const response=await fetch(`/api/storage-download?id=${encodeURIComponent(stored.file_id)}`,{cache:'no-store'});
    if(!response.ok)throw Error('Không tải được PDF gốc đã lưu.');
    const file=new File([await response.blob()],stored.original_name,{type:'application/pdf'});
    return importForecastFromFile(file,stored);
  };
  const [transferFeedback,setTransferFeedback]=useState<{kind:'success'|'error';message:string}|null>(null);
  useEffect(()=>setTransferFeedback(null),[tab,engineWeek]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 30_000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  const [fullView, setFullView] = useState(false);
  const [calcSku, setCalcSku] = useState<string | null>(null);

  const [inventorySnapshots, setInventorySnapshots] = useState<
    InventorySnapshot[]
  >(() =>
    planningSessionCache?.snapshots?.length
      ? planningSessionCache.snapshots
      : inventorySnapshotsCache || [],
  );
  const [snapshotsLoaded, setSnapshotsLoaded] = useState(
    () => planningSessionCache?.snapshotsLoaded || !!inventorySnapshotsCache,
  );
  const [masterRuleRevision, setMasterRuleRevision] = useState(0);
  const [transitBySku, setTransitBySku] = useState<Map<string, number> | null>(
    null,
  );
  useEffect(() => {
    fetch("/api/in-transit", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw Error("Không tải được In Transit");
        const data = await response.json();
        if (!data.rows.length) {
          setTransitBySku(null);
          return;
        }
        setTransitBySku(engineTransitBySku(data.rows));
      })
      .catch((error) => {
        setTransitBySku(null);
      });
  }, [tab, engineWeek]);

  useEffect(() => {
    Promise.all([
      recordFetch("/api/records?entity=leadtime"),
      recordFetch("/api/records?entity=leadtime_versions"),
      recordFetch("/api/records?entity=safety_rules"),
    ])
      .then(async ([leadResponse, versionResponse, ruleResponse]) => {
        const leadSaved: LeadtimeRow[] = leadResponse.ok
          ? (await leadResponse.json()).records.map(
              (item: { payload: LeadtimeRow }) => item.payload,
            )
          : [];
        const leadVersions: LeadTimeVersion[] = versionResponse.ok
          ? (await versionResponse.json()).records.map(
              (item: { payload: LeadTimeVersion }) => item.payload,
            )
          : [];
        const savedRules: SafetyRuleSet[] = ruleResponse.ok
          ? (await ruleResponse.json()).records
              .map((item: { payload: SafetyRuleSet }) => item.payload)
              .filter((item: SafetyRuleSet) => !item._deleted)
          : [];
        assertCurrentClientSession(session);
        leadtimeBySku.clear();
        leadtimeRows.forEach((row) =>
          leadtimeBySku.set(normalizeSkuCode(row.sku), row),
        );
        leadSaved.forEach((row: LeadtimeRow) =>
          row._deleted
            ? leadtimeBySku.set(normalizeSkuCode(row.sku), row)
            : leadtimeBySku.set(row.sku.toUpperCase(), row),
        );
        const calculationAt = `${engineWeek}T00:00:00+07:00`;
        new Set(leadVersions.map((item: LeadTimeVersion) => item.sku)).forEach(
          (sku) => {
            const version = activeLeadTimeAt(leadVersions, sku, calculationAt);
            const master = masterRows.find(
              (item) => normalizeSkuCode(item.code) === normalizeSkuCode(sku),
            );
            if (version && master)
              leadtimeBySku.set(sku, {
                sku,
                name: master.name,
                spec: master.specification,
                group: master.group,
                line: master.line,
                ltProduction: version.leadTime,
                ltQc: 0,
                ltWarehouse: 0,
                note: `Snapshot ${version.version} · ${version.validFrom}`,
                leadTime: version.leadTime,
                moq: master.moq,
              });
          },
        );
        safetyRuleSets = savedRules;
        setMasterRuleRevision((value) => value + 1);
      })
      .catch(() => {});
  }, [engineWeek, masterDataRevision]);
  useEffect(() => {
    loadForecastRecords()
      .then((saved) => {
        if (!saved.length) return;
        const months = new Set(saved.map((row: ForecastRow) => row.month));
        setBaseRows((current) => {
          const next = [
            ...current.filter((row) => !months.has(row.month)),
            ...saved,
          ];
          updatePlanningSessionCache({ baseRows: next });
          return next;
        });
        setBaseMonth((current) => {
          if (current && months.has(current)) return current;
          const next = [...months].sort().at(-1) || current;
          updatePlanningSessionCache({ baseMonth: next });
          return next;
        });
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    let active = true;
    recordFetch("/api/records?entity=demand_event", {cache:"reload"})
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => {
        if (!active || session !== clientSessionGeneration()) return;
        setEngineDemandLoaded(true);
        const saved = data.records.map(
          (record: { payload: DemandRow }) => record.payload,
        );
        setEngineEvents((current) => {
          if (session !== clientSessionGeneration()) return current;
          const next = saved.filter(
            (row: DemandRow & { _deleted?: boolean }) => !row._deleted,
          );
          demandEventSessionCache = next;
          updatePlanningSessionCache({ engineEvents: next });
          return next;
        });
      })
      .catch(() => {});
    return () => { active = false; };
  }, [masterDataRevision]);
  useEffect(() => {
    Promise.all([
      loadProductionEngineRecords()
        .then((records) => ({ records }))
        .catch(() => ({ records: [] as EngineRecord[] })),
      loadInventorySnapshots().catch(
        () => planningSessionCache?.snapshots || [],
      ),
    ])
      .then(([data, items]) => {
        if (session !== clientSessionGeneration()) return;
        const latest = data.records?.find(
          (record: { payload?: { week?: string } }) =>
            /^\d{4}-\d{2}-\d{2}$/.test(record.payload?.week || ""),
        )?.payload?.week;
        const nextWeek = latest || engineWeek;
        setEngineWeek(nextWeek);
        setInventorySnapshots(items);
        setSnapshotsLoaded(true);
        updatePlanningSessionCache({
          engineWeek: nextWeek,
          snapshots: items,
          snapshotsLoaded: true,
        });
      })
      .finally(() => {
        setEngineWeekReady(true);
      });
  }, []);
  useEffect(() => {
    updatePlanningSessionCache({
      planRows: rows,
      baseRows,
      baseMonth,
      engineEvents,
      engineWeek,
      snapshots: inventorySnapshots,
      snapshotsLoaded,
    });
  }, [
    baseRows,
    rows,
    baseMonth,
    engineEvents,
    engineWeek,
    inventorySnapshots,
    snapshotsLoaded,
  ]);
  const activeSnapshot = [...inventorySnapshots]
    .sort((a, b) => b.snapshotAt.localeCompare(a.snapshotAt))
    .find(
      (item) =>
        item.weekKey === weekKeyOf(engineWeek) &&
        ["Đã chốt", "Đã được Production_engine sử dụng"].includes(item.status),
    );
  const activeSafetyRule = activeSafetyRuleFor(weekKeyOf(engineWeek));
  const calculatedEngineResult = useMemo(
    () =>
      buildProductionEngine(
        baseRows,
        engineEvents,
        engineWeek,
        snapshotStockMap(activeSnapshot),
        activeSafetyRule,
        transitBySku,
        masterRows,
      ),
    [
      baseRows,
      engineEvents,
      engineWeek,
      activeSnapshot,
      activeSafetyRule,
      masterRuleRevision,
      transitBySku,
      masterRows,
    ],
  );
  const engineDemandCurrent = engineDemandLoaded && engineDemandMatches(savedEngine?.payload, engineEvents);
  const engineResult = useMemo(() => {
    if (
      savedEngine?.payload.week === engineWeek &&
      (!engineDemandLoaded || engineDemandCurrent) &&
      Array.isArray(savedEngine.payload.rows) &&
      Array.isArray(savedEngine.payload.metrics)
    ) {
      const rows = savedEngine.payload.rows.map((row, index) => ({
        ...normalizePlanRow(row, index),
        group:
          masterGroupBySku.get(normalizeSkuCode(row.sku)) || row.group || "—",
      }));
      const metrics = new Map(savedEngine.payload.metrics);
      if (rows.every((row) => metrics.has(row.id))) {
        return {
          rows,
          metrics,
          errors: savedEngine.payload.errors || [],
          warnings: savedEngine.payload.warnings || [],
          stats: savedEngine.payload.stats || calculatedEngineResult.stats,
          weekLabel:
            rows[0] && metrics.get(rows[0].id)?.weekLabel
              ? metrics.get(rows[0].id)!.weekLabel
              : calculatedEngineResult.weekLabel,
        };
      }
    }
    return calculatedEngineResult;
  }, [savedEngine, engineWeek, masterGroupBySku, calculatedEngineResult, engineDemandLoaded, engineDemandCurrent]);
  if (tab === "rules") return <ProductionEngineRules />;
  const planned = rows.filter((r) =>
    ["Dự kiến", "Đã chốt", "Hoãn", "Hủy"].includes(r.status),
  );
  return (
    <main
      data-report-auto-preview={tab === "proposal" ? "false" : undefined}
      className={`workspace planning-workspace ${tab === "base" ? "base-compact" : tab === "demand" ? "demand-compact" : tab === "proposal" ? "proposal-compact" : ""}`}
    >
      {transferFeedback && <PlanningFeedback {...transferFeedback} onClose={()=>setTransferFeedback(null)} />}
      {tab !== "proposal" && tab !== "demand" && (
        <RecordFiles
          hidePanel={tab === "base"}
          uploadInputRef={tab === "base" ? forecastPdfInputRef : undefined}
          onUploadReadyChange={tab === "base" ? setForecastPdfUploadReady : undefined}
          externalUpload={tab === "base"}
          showAll={tab === "base"}
          onPrepareUpload={tab === "base" ? prepareForecastUpload : undefined}
          onFileStored={tab === "base" ? importForecastFromFile : undefined}
          onImportStored={tab === "base" ? importStoredForecast : undefined}
          importedFileIds={tab === "base" ? forecastImportedFileIds : undefined}
          accept={tab === "base" ? ".pdf,application/pdf" : undefined}
          module={tab === "base" ? "base-forecast" : "demand-event"}
          recordId={tab === "base" ? baseMonth : ""}
          label={
            tab === "base" ? "PDF Base Forecast" : "PDF / Excel Demand Event"
          }
        />
      )}
      {false && (
        <PlanningLookupBar
          key={tab}
          tab={tab}
          onForecastImported={(imported) => {
            const months = new Set(imported.map((row) => row.month));
            setBaseRows((current) => [
              ...current.filter((row) => !months.has(row.month)),
              ...imported,
            ]);
            const month = imported[0]?.month || baseMonth;
            setBaseMonth(month);
            updatePlanningSessionCache({ baseMonth: month });
          }}
        />
      )}
      {tab !== "plan" && (
        <>
          <div className="page-heading plan-heading">
            <div>
              <p className="eyebrow">KẾ HOẠCH SẢN XUẤT</p>
              <PageTitle>Điều hành kế hoạch tuần</PageTitle>
              <p>
                Tính đề xuất tự động, KHSX điều chỉnh kế hoạch và theo dõi lệnh
                đã gửi Sản xuất.
              </p>
            </div>
            <FeedbackActionButton
              className="primary-button"
              onClick={() =>
                setNotice(
                  "Đã tạo phiên tính RUN-20260827-001 từ Forecast, Demand Event, tồn kho, Lead time, Safety Days và MOQ.",
                )
              }
            >
              ↻ Tính lại đề xuất 05
            </FeedbackActionButton>
          </div>
          <div className="flow-strip">
            <span>
              <b>01</b> Base Forecast + Demand Event
            </span>
            <i>→</i>
            <span>
              <b>05</b> Đề xuất tuần
            </span>
            <i>→</i>
            <span>
              <b>06</b> Kế hoạch KHSX
            </span>
            <i>→</i>
            <span>
              <b>04</b> Theo dõi LSX
            </span>
          </div>
          {notice && (
            <div className="plan-notice">
              ✓ {notice}
              <FeedbackActionButton onClick={() => setNotice("")}>×</FeedbackActionButton>
            </div>
          )}
        </>
      )}
      {tab === "demand" && (
        <DemandEventViewV3 masterRows={masterRows} operator={operator} />
      )}
      {tab === "proposal" &&
        (!engineWeekReady ? (
          <div className="data-card planning-loading" role="status">
            Đang mở dữ liệu tuần đã cập nhật gần nhất…
          </div>
        ) : (
          <>
            <BulkEngineView
              rows={engineResult.rows}
              metrics={engineResult.metrics}
              week={engineWeek}
              snapshot={activeSnapshot}
              snapshotsLoaded={snapshotsLoaded}
              savedEngineLoading={savedEngineLoading}
              savedEngineReady={
                engineDemandCurrent && savedEngine?.payload.week === engineWeek &&
                Array.isArray(savedEngine.payload.rows) &&
                Array.isArray(savedEngine.payload.metrics)
              }
              onWeekChange={async (value) => {
                try {
                  const read = async (entity: string) => {
                    const response = await recordFetch(
                      `/api/records?entity=${entity}`,
                      { cache: "no-store" },
                    );
                    if (!response.ok)
                      throw Error(
                        `Không tải được ${entity}; chưa chạy Engine.`,
                      );
                    return (await response.json()).records
                      .flatMap((r: { payload: any }) =>
                        Array.isArray(r.payload)
                          ? r.payload
                          : r.payload.rows || [r.payload],
                      )
                      .filter(
                        (r: { _deleted?: boolean }) =>
                          !r._deleted ||
                          entity === "sku" ||
                          entity === "leadtime",
                      );
                  };
                  const readTransit = async () => {
                    const response = await fetch("/api/in-transit", { cache: "no-store" });
                    if (!response.ok) throw Error("Không tải được In Transit; chưa chạy Engine.");
                    return (await response.json()).rows;
                  };
                  const [
                    freshForecast,
                    freshEvents,
                    freshSkus,
                    freshLeads,
                    freshRules,
                    freshSnapshots,
                    freshTransit,
                    freshVersions,
                  ] = await Promise.all(
                    [
                      "forecast",
                      "demand_event",
                      "sku",
                      "leadtime",
                      "safety_rules",
                      "inventory_snapshot",
                      "in_transit",
                      "leadtime_versions",
                    ].map((entity) => entity === "in_transit" ? readTransit() : read(entity)),
                  );
                  assertCurrentClientSession(session);
                  const calculationForecast = freshForecast.map(
                    calculateForecastDemand,
                  );
                  const calculationMasters = [
                    ...new Map(
                      (freshSkus as Sku[]).map((r) => [r.code, r]),
                    ).values(),
                  ].filter(
                    (r) => !(r as Sku & { _deleted?: boolean })._deleted,
                  ) as Sku[];
                  leadtimeBySku.clear();
                  leadtimeRows.forEach((row) =>
                    leadtimeBySku.set(normalizeSkuCode(row.sku), row),
                  );
                  freshLeads.forEach((r: LeadtimeRow) =>
                    leadtimeBySku.set(r.sku.toUpperCase(), r),
                  );
                  for (const code of new Set<string>(
                    freshVersions.map((r: LeadTimeVersion) => r.sku),
                  )) {
                    const version = activeLeadTimeAt(
                      freshVersions,
                      code,
                      `${value}T00:00:00+07:00`,
                    );
                    if (version) {
                      const lead = leadtimeBySku.get(code);
                      leadtimeBySku.set(code, {
                        ...lead,
                        sku: code,
                        leadTime: version.leadTime,
                      } as LeadtimeRow);
                    }
                  }
                  safetyRuleSets = freshRules;
                  const calculationTransit = engineTransitBySku(freshTransit);
                  setBaseRows(calculationForecast);
                  setEngineEvents(freshEvents);
                  setInventorySnapshots(freshSnapshots);
                  setTransitBySku(calculationTransit);
                  setEngineWeek(value);
                  setMasterRuleRevision((r) => r + 1);
                  const matched = [...freshSnapshots]
                    .sort((a, b) => b.snapshotAt.localeCompare(a.snapshotAt))
                    .find(
                      (item) =>
                        item.weekKey === weekKeyOf(value) &&
                        [
                          "Đã chốt",
                          "Đã được Production_engine sử dụng",
                        ].includes(item.status),
                    );
                  const matchedRule = activeSafetyRuleFor(weekKeyOf(value));
                  const result = buildProductionEngine(
                    calculationForecast,
                    freshEvents,
                    value,
                    snapshotStockMap(matched),
                    matchedRule,
                    calculationTransit,
                    calculationMasters,
                  );
                  if (!result.rows.length) {
                    setNotice(
                      result.errors.join("; ") || "Không có SKU tính được",
                    );
                    return;
                  }
                  const now = new Date().toISOString();
                  const enginePayload = {
                    week: value,
                    weekKey: weekKeyOf(value),
                    snapshotId: matched?.id,
                    snapshotCode: matched?.code,
                    snapshotAt: matched?.snapshotAt,
                    generatedAt: now,
                    generatedBy: operator,
                    ruleId: matchedRule?.id,
                    ruleCode: matchedRule?.code,
                    ruleVersion: matchedRule?.version,
                    ruleEffectiveFrom: matchedRule?.effectiveFrom,
                    ruleEffectiveTo: matchedRule?.effectiveTo,
                    rows: result.rows,
                    metrics: Array.from(result.metrics.entries()),
                    warnings: result.warnings,
                    errors: result.errors,
                    stats: result.stats,
                    stockDefaultZero: !matched,
                  };
                  const response = await fetch("/api/engine-run", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ payload: enginePayload }),
                  });
                  const stored = await response.json();
                  if (!response.ok)
                    throw Error(
                      stored.error || "Không thể cập nhật dữ liệu tuần",
                    );
                  productionEngineRecordsCache = [
                    { key: stored.key, payload: stored.payload },
                    ...(productionEngineRecordsCache || []).filter(
                      (record) => record.payload.week !== value,
                    ),
                  ];
                  setSavedEngine({ key: stored.key, payload: stored.payload });
                  if (stored.snapshot) {
                    inventorySnapshotsCache = (inventorySnapshotsCache || freshSnapshots).map((item: InventorySnapshot) =>
                      item.id === stored.snapshot.id ? stored.snapshot : item,
                    );
                    setInventorySnapshots((current) => current.map((item) =>
                      item.id === stored.snapshot.id ? stored.snapshot : item,
                    ));
                  }
                  setNotice(
                    response.ok
                      ? `Đã cập nhật ${stored.payload.rows.length} SKU hợp lệ cho tuần ${result.weekLabel} bằng ${matched?.code || "tồn kho mặc định 0"}.${stored.skippedSkus?.length ? ` Đã loại ${stored.skippedSkus.length} SKU chưa xác nhận hoặc chưa sử dụng trong SKU Master.` : ""} Bạn có thể chọn dòng và chuyển sang Production Plan.`
                      : "Không thể cập nhật dữ liệu tuần. Vui lòng thử lại.",
                  );
                } catch (error) {
                  setNotice(
                    error instanceof Error
                      ? error.message
                      : "Không thể cập nhật Engine",
                  );
                }
              }}
              onCalc={setCalcSku}
              onMove={async (ids) => {
                setTransferFeedback(null);
                let committed=false;
                try {
                  if (!savedEngine || savedEngine.payload.week !== engineWeek)
                    throw new Error(
                      "Dữ liệu tuần chưa được cập nhật. Hãy bấm “Cập nhật dữ liệu tuần” trước khi chuyển sang Production Plan. 週資料尚未更新，請先更新週資料再轉入 Production Plan。",
                    );
                  const current = await fetch(
                    `/api/production-plan?week=${engineWeek}`,
                  );
                  const planState = await current.json();
                  if (!current.ok) throw new Error(formatPlanningFailure(planState,engineResult.rows,toolbarLocale(),current.status));
                  const response = await fetch("/api/production-plan", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                      action: "receive",
                      week: engineWeek,
                      revision: planState.revision,
                      sourceKey: savedEngine.key,
                      ids,
                    }),
                  });
                  const result = await response.json();
                  if (!response.ok)
                    throw new Error(
                      formatPlanningFailure(result,engineResult.rows,toolbarLocale(),response.status),
                    );
                  committed=true;
                  refreshTransferredPlan(engineWeek);
                  const verify = await fetch(
                    `/api/production-plan?week=${engineWeek}`,
                  );
                  if (!verify.ok)
                    throw new Error(
                      "Đã lưu nhưng chưa tải lại được. 已儲存但無法重新載入。",
                    );
                  const persisted = await verify.json();
                  if (persisted.revision < result.revision)
                    throw new Error(
                      "Chưa xác nhận được phiên bản lưu. 尚未確認儲存版本。",
                    );
                  refreshTransferredPlan(engineWeek, persisted);
                  setTransferFeedback({kind:'success',message:`Đã chuyển sang Production Plan thành công. Thêm mới: ${result.added ?? 0}; đã tồn tại: ${result.existing ?? 0}; cập nhật: ${result.updated ?? 0}.`});
                  return true;
                } catch (error) {
                  const detail=error instanceof Error?error.message:'Không nhận được phản hồi hợp lệ.';
                  setTransferFeedback({kind:'error',message:committed
                    ? 'Máy chủ đã nhận dữ liệu nhưng chưa xác nhận được kết quả hiển thị. Hãy tải lại Production Plan để đối chiếu trước khi chuyển lại.\n'+detail
                    : detail});
                  return false;
                }
              }}
            />
          </>
        ))}
      {tab === "base" && (
        <section className="data-card">
          <StandardToolbar name="PlanningView" items={[
            toolbarConfig.action({onClick:()=>forecastPdfInputRef.current?.click(),disabled:!forecastPdfUploadReady, disabledExplanation: "Chức năng tải PDF Forecast chưa sẵn sàng. Chờ tải xong dữ liệu và thử lại."},'Tải file Forecast PDF',true,'action'),toolbarConfig.group([toolbarConfig.group([toolbarConfig.field(<><span>Tháng áp dụng SX</span></>,[toolbarConfig.select({"aria-label": "Tháng áp dụng SX","value": baseMonth,"onChange": (event) => {
                  setBaseMonth(event.target.value);
                  updatePlanningSessionCache({ baseMonth: event.target.value });
                }},<>{baseMonths.map((month) => (
                  <option key={month}>{month}</option>
                ))}</>)]),
toolbarConfig.action({"type": "button","onClick": () => setBaseSearchOpen((v) => !v)},<>⌕ Tra cứu
            </>, true, "lookup")]),
baseSearchOpen && (
            toolbarConfig.group([toolbarConfig.field(<>Tra theo
                </>,[toolbarConfig.select({"aria-label": "Tra theo Forecast","value": baseSearchField,"onChange": (e) => {
                    setBaseSearchField(e.target.value);
                    setBaseSearch({ field: e.target.value, query: baseSearchDraft });
                  }},<>{Object.entries({
                    sku: "Mã SKU",
                    name: "Tên sản phẩm",
                    spec: "Quy cách",
                    group: "Nhóm sản phẩm",
                    line: "Line",
                  }).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}</>)]),
toolbarConfig.field(<>Nội dung tra
                </>,[(['group','line'].includes(baseSearchField) ? toolbarConfig.select({value:baseSearchDraft,onChange:e=>{setBaseSearchDraft(e.target.value);setBaseSearch({field:baseSearchField,query:e.target.value})}},<><option value="">Tất cả</option>{Array.from(new Set(periodBaseRows.map(row=>String(row[baseSearchField as keyof ForecastRow] || '')))).filter(Boolean).sort().map(value=><option key={value} value={value}>{value}</option>)}</>) : toolbarConfig.input({"aria-label": "Nội dung tra Forecast","value": baseSearchDraft,"autoComplete": "off","placeholder": "Nhập nội dung cần tra","onChange": (e) => {
                    setBaseSearchDraft(e.target.value);
                    setBaseSearch({ field: baseSearchField, query: e.target.value });
                  },"onKeyDown": (e) => {
                    if (e.key === "Enter")
                      setBaseSearch({
                        field: baseSearchField,
                        query: baseSearchDraft,
                      });
                  }}))]),
toolbarConfig.action({"onClick": () =>
                  setBaseSearch({
                    field: baseSearchField,
                    query: baseSearchDraft,
                  })},<>Tìm kiếm
              </>, true, "search"),
toolbarConfig.action({"onClick": () => {
                  setBaseSearchDraft("");
                  setBaseSearch({ field: baseSearchField, query: "" });
                }},<>Xóa lọc
              </>, true, "clear"),
toolbarConfig.action({"onClick": () => {
                  setBaseSearchDraft("");
                  setBaseSearchField("sku");
                  setBaseSearch({ field: "sku", query: "" });
                  setBaseSearchOpen(false);
                }},<>Quay lại
              </>, true, "back")])
          )])]} />
          <div className="planning-status">
            Nguồn: PDF Kinh doanh | Báo cáo:{" "}
            {visibleBaseRows[0]?.sourceReportMonth || "—"} | Áp dụng SX:{" "}
            {baseMonth}
          </div>
          {notice && (
            <div className="planning-status" role="status">
              {notice}
            </div>
          )}
          <DataTable className="table-wrap">
            <table className="base-table" data-page-size="20">
              <thead>
                <tr>
                  <th>MONTH</th>
                  <th>NHÓM SP</th>
                  <th>SKU</th>
                  <th>TÊN SẢN PHẨM</th>
                  <th>QUY CÁCH</th>
                  <th>LINE</th>
                  <th>FORECAST 30D</th>
                  <th>FORECAST 60D</th>
                  <th>FORECAST 90D</th>
                  <th>DAILY DEMAND 30D</th>
                  <th>DAILY DEMAND 60D</th>
                  <th>DEMAND DÙNG CHO SX</th>
                  <th>DAILY DEMAND 90D</th>
                  <th>CẢNH BÁO 90D</th>
                </tr>
              </thead>
              <tbody>
                {searchedBaseRows.map((r) => {
                  return (
                    <tr key={`${r.month}-${r.sku}`}>
                      <DataCell kind="date">{r.month}</DataCell>
                      <DataCell kind="code">{r.group}</DataCell>
                      <DataCell kind="code">
                        <b className="plan-sku">{r.sku}</b>
                      </DataCell>
                      <DataCell>
                        <strong>{r.name}</strong>
                      </DataCell>
                      <DataCell>{r.spec}</DataCell>
                      <DataCell>
                        {r.line
                          ? `${r.line === "NK" ? "NK" : `Line ${r.line}`}`
                          : "—"}
                      </DataCell>
                      <DataCell kind="number" className="number">
                        {r.f30.toLocaleString("vi-VN")}
                      </DataCell>
                      <DataCell kind="number" className="number">
                        {r.f60.toLocaleString("vi-VN")}
                      </DataCell>
                      <DataCell kind="number" className="number">
                        {r.f90.toLocaleString("vi-VN")}
                      </DataCell>
                      <DataCell kind="number" className="number">
                        {r.d30.toLocaleString("vi-VN")}
                      </DataCell>
                      <DataCell kind="number" className="number">
                        {r.d60.toLocaleString("vi-VN")}
                      </DataCell>
                      <DataCell kind="number" className="number demand-used">
                        {r.used.toLocaleString("vi-VN")}
                      </DataCell>
                      <DataCell kind="number" className="number">
                        {r.d90.toLocaleString("vi-VN")}
                      </DataCell>
                      <DataCell>
                        {r.warning ? (
                          <span className="change-badge" title={r.warning}>
                            NVL/MOQ
                          </span>
                        ) : null}
                      </DataCell>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </DataTable>
          <div className="source-note">
            <b>Nguồn dữ liệu:</b> Forecast Kinh doanh chuyển sang KHSX. Khi Kinh
            doanh cập nhật, hệ thống tạo phiên bản mới và giữ lịch sử phiên bản
            cũ.
          </div>
        </section>
      )}
      {calcSku &&
        (() => {
          const r =
            engineResult.rows.find((x) => x.sku === calcSku) ||
            rows.find((x) => x.sku === calcSku);
          const metric = engineResult.rows.find((x) => x.sku === calcSku);
          const m = metric ? engineResult.metrics.get(metric.id) : undefined;
          const base = m
            ? baseRows.find((x) => x.sku === calcSku && x.month === m.month)
            : undefined;
          const legacy = forecastData[calcSku];
          if (!r) return null;
          const f =
            m && base
              ? {
                  f30: base.f30,
                  f60: base.f60,
                  f90: base.f90,
                  d30: base.d30,
                  d60: base.d60,
                  used: base.used,
                  stock: m.stock,
                  wip: m.inTransit,
                  lead: m.leadTime,
                  safety: m.safetyDays,
                  moq: m.moq,
                  rop: m.rop,
                  hours:
                    Number.parseFloat(
                      skus.find((item) => item.code === calcSku)
                        ?.standardHours || "",
                    ) || 0,
                  event: m.eventWeek,
                  replenish: m.replenish,
                  reason: m.reason,
                }
              : legacy;
          if (!f) return null;
          return (
            <>
              <FeedbackActionButton
                className="overlay"
                aria-label="Đóng cách tính"
                onClick={() => setCalcSku(null)}
              />
              <aside className="detail-panel calc-panel">
                <div className="detail-header">
                  <div>
                    <p>GIẢI THÍCH ĐỀ XUẤT SẢN XUẤT</p>
                    <h2>{r.sku}</h2>
                    <span>
                      {r.name} · {r.spec}
                    </span>
                  </div>
                  <FeedbackActionButton onClick={() => setCalcSku(null)}>×</FeedbackActionButton>
                </div>
                <section>
                  <h3>Forecast Kinh doanh</h3>
                  <dl>
                    <div>
                      <dt>Forecast 30D</dt>
                      <dd>{f.f30.toLocaleString("vi-VN")}</dd>
                    </div>
                    <div>
                      <dt>Forecast 60D</dt>
                      <dd>{f.f60.toLocaleString("vi-VN")}</dd>
                    </div>
                    <div>
                      <dt>Forecast 90D</dt>
                      <dd>{f.f90.toLocaleString("vi-VN")}</dd>
                    </div>
                    <div>
                      <dt>Daily Demand 30D</dt>
                      <dd>{f.d30.toLocaleString("vi-VN")} SP/ngày</dd>
                    </div>
                    <div>
                      <dt>Daily Demand 60D</dt>
                      <dd>{f.d60.toLocaleString("vi-VN")} SP/ngày</dd>
                    </div>
                    <div className="highlight-row">
                      <dt>Demand dùng cho SX</dt>
                      <dd>Forecast 30D / 30 = {f.used}</dd>
                    </div>
                  </dl>
                </section>
                <section>
                  <h3>Nguồn cung và ngưỡng bổ sung</h3>
                  <dl>
                    <div>
                      <dt>Tồn kho ERP</dt>
                      <dd>{f.stock.toLocaleString("vi-VN")}</dd>
                    </div>
                    <div>
                      <dt>Đang sản xuất/đang đi</dt>
                      <dd>{f.wip.toLocaleString("vi-VN")}</dd>
                    </div>
                    <div>
                      <dt>Demand Event tuần</dt>
                      <dd>{f.event.toLocaleString("vi-VN")}</dd>
                    </div>
                    <div>
                      <dt>Nguồn cung khả dụng</dt>
                      <dd>{(f.stock + f.wip).toLocaleString("vi-VN")}</dd>
                    </div>
                    <div>
                      <dt>Lead time + Safety</dt>
                      <dd>
                        {f.lead} + {f.safety} = {f.lead + f.safety} ngày
                      </dd>
                    </div>
                    <div className="highlight-row">
                      <dt>ROP</dt>
                      <dd>
                        {f.used} × {f.lead + f.safety} ={" "}
                        {f.rop.toLocaleString("vi-VN")}
                      </dd>
                    </div>
                  </dl>
                </section>
                <section className="calc-result">
                  <h3>Kết quả đề xuất</h3>
                  <p>
                    Nguồn cung được so sánh với ROP, cộng Demand Event và làm
                    tròn theo MOQ {f.moq.toLocaleString("vi-VN")}.
                  </p>
                  {m && (
                    <div>
                      <span>SL cần bổ sung trước MOQ</span>
                      <b>
                        {m.replenish.toLocaleString("vi-VN", {
                          maximumFractionDigits: 2,
                        })}{" "}
                        SP
                      </b>
                    </div>
                  )}
                  <div>
                    <span>Số lượng đề xuất tuần</span>
                    <b>{r.suggested.toLocaleString("vi-VN")} SP</b>
                  </div>
                  {m && (
                    <p className="calc-reason">
                      <b>Lý do:</b> {m.reason}
                    </p>
                  )}
                  <div>
                    <span>Tổng giờ công dự kiến</span>
                    <b>
                      {(r.suggested * f.hours).toLocaleString("vi-VN", {
                        maximumFractionDigits: 1,
                      })}{" "}
                      giờ
                    </b>
                  </div>
                </section>
              </aside>
            </>
          );
        })()}
    </main>
  );
}

type MainView =
  "users" | "sku" | "warehouse" | "bom" | "planning" | "production";

type OverviewStep = {
  id: string;
  tab?: PlanningTab;
  title: string;
  note: string;
  children?: Array<{ id: string; tab?: PlanningTab; title: string }>;
};
const moduleOverviewSteps: Record<
  Exclude<MainView, "users">,
  OverviewStep[]
> = {
  sku: [
    {
      id: "sku-master",
      title: "SKU Master",
      note: "Tạo nguồn dữ liệu gốc của sản phẩm",
    },
    {
      id: "employees",
      title: "Danh sách nhân viên",
      note: "Phân công theo Line và chọn tên trong lịch Capacity",
    },
    {
      id: "leadtime",
      title: "Leadtime",
      note: "Thiết lập và xác nhận thời gian sản xuất",
    },
    {
      id: "labor-hours",
      title: "Giờ công",
      note: "Quản lý giờ công chuẩn theo SKU",
    },
    {
      id: "safety-days",
      title: "Quy tắc Safety Days",
      note: "Tính ngày an toàn theo Lead Time",
    },
  ],
  bom: [
    {
      id: "bom-data",
      title: "Dữ liệu lượng dùng BOM",
      note: "Tạo BOM mới từ SKU Master",
    },
    {
      id: "bom-change",
      title: "Phiếu thay đổi BOM",
      note: "Sửa cấu trúc và gửi chờ xác nhận",
    },
  ],
  planning: [
    {
      id: "base",
      tab: "base",
      title: "Base Forecast",
      note: "Nhận nhu cầu cơ sở từ kinh doanh",
    },
    {
      id: "demand",
      tab: "demand",
      title: "Demand Event",
      note: "Ghi nhận nhu cầu phát sinh và bù tải",
    },
    {
      id: "proposal",
      tab: "proposal",
      title: "Production Engine",
      note: "Tính ROP và đề xuất bổ sung",
    },
    {
      id: "plan",
      tab: "plan",
      title: "Production Plan",
      note: "Điều chỉnh, chốt và mở lệnh sản xuất",
    },
    {
      id: "tracking",
      tab: "tracking",
      title: "In Transit",
      note: "Theo dõi tiến độ lệnh đang sản xuất",
    },
    {
      id: "report",
      tab: "report",
      title: "Report",
      note: "Tổng hợp kết quả kế hoạch",
    },
  ],
  production: [
    {
      id: "production-report",
      title: "Theo dõi lệnh sản xuất",
      note: "Chọn nghiệp vụ theo dõi lệnh sản xuất",
      children: [
        { id: "report-work", title: "SX báo công" },
        { id: "report-review", title: "Lịch sản xuất thực tế" },
        { id: "report-progress", title: "Tiến độ sản xuất" },
        { id: "report-dashboard", title: "Nhật ký báo công" },
        { id: "report-cancel", title: "Điều chỉnh báo công" },
        { id: "report-output", title: "Sản lượng và giờ công" },
        { id: "report-payroll", title: "Hiệu suất và tiền sản lượng" },
      ],
    },
    {
      id: "weekly-capacity",
      title: "Capacity tuần",
      note: "Theo dõi năng lực và giờ khả dụng",
      children: [
        { id: "capacity-calendar", title: "Lịch làm việc dự kiến" },
        { id: "capacity-summary", title: "Tổng hợp Capacity" },
      ],
    },

  ],
  warehouse: [
    {
      id: "warehouse-overview",
      title: "Tổng quan",
      note: "Theo dõi trạng thái kho thành phẩm",
    },
    {
      id: "warehouse-in",
      title: "Nhập kho",
      note: "Tiếp nhận và xác nhận số lượng thực nhập",
    },
    {
      id: "inventory",
      title: "Tồn kho ERP",
      note: "Kiểm tra tồn theo SKU, kho và vị trí",
    },
    {
      id: "warehouse-transfer",
      title: "Chuyển kho",
      note: "Điều chuyển và xác nhận kho nhận",
    },
    {
      id: "warehouse-out",
      title: "Xuất kho",
      note: "Xác nhận xuất và cập nhật tồn",
    },
    {
      id: "warehouse-docs",
      title: "Phiếu kho",
      note: "Quản lý trạng thái chứng từ kho",
    },
    {
      id: "warehouse-count",
      title: "Kiểm kê",
      note: "Đối chiếu và xử lý chênh lệch",
    },
    {
      id: "warehouse-report",
      title: "Báo cáo",
      note: "Tra cứu lịch sử giao dịch",
    },
  ],
};

function ModuleOverview({
  view,
  onOpen,
  sessionLine,
  canOpen,
}: {
  view: Exclude<MainView, "users">;
  onOpen: (id: string, tab?: PlanningTab) => void;
  sessionLine?: "A" | "B";
  canOpen: (view: MainView, child?: string) => boolean;
}) {
  const titles: Record<Exclude<MainView, "users">, string> = {
    sku: "Dữ liệu cơ bản",
    warehouse: "Quản lý kho",
    bom: "Cấu trúc thành phẩm",
    planning: "Kế hoạch sản xuất",
    production: "Hệ thống báo công",
  };
  const steps = moduleOverviewSteps[view].filter((step) =>
    canOpen(view, step.id),
  );
  return (
    <main className="workspace module-overview">
      <div className="module-overview-heading">
        <span>QUY TRÌNH NGHIỆP VỤ</span>
        <PageTitle variant="menu-root">{titles[view]}</PageTitle>
        <p>
          {view === "planning"
            ? "Dữ liệu đi lần lượt theo chiều mũi tên từ Forecast đến báo cáo"
            : view === "production"
              ? "Thực hiện báo công theo thứ tự từ nhập trạm đến hoàn thành"
              : "Chọn một bước để mở màn hình thao tác"}
        </p>
      </div>
      <section className={`process-map process-map-${view}`}>
        {steps.map((step, index) => {
          const restricted = Boolean(
            view === "production" &&
            sessionLine &&
            ["data-recovery"].includes(step.id),
          );
          return (
            <article
              className={`process-stage ${step.children?.length ? "has-branches" : ""}`}
              key={step.id}
            >
              <div className="process-stage-number">
                {String(index + 1).padStart(2, "0")}
              </div>
              <FeedbackActionButton
                className="process-stage-main"
                disabled={restricted} disabledExplanation={`Thiết bị Line ${sessionLine} không có quyền thao tác phân hệ này.`}
                onClick={() => onOpen(step.id, step.tab)}
              >
                <b>{step.title}</b>
                <span>
                  {restricted
                    ? `Không áp dụng cho thiết bị Line ${sessionLine}`
                    : step.note}
                </span>
                <em>Mở nghiệp vụ</em>
              </FeedbackActionButton>
              {step.children && (
                <div
                  className={`process-branches ${step.id === "production-report" ? "report-flow" : ""}`}
                >
                  {step.children.filter(child => canOpen(view, child.id)).map((child, childIndex) => (
                    <FeedbackActionButton
                      key={child.id}
                      onClick={() => onOpen(child.id, child.tab)}
                    >
                      <small>{String(childIndex + 1).padStart(2, "0")}</small>
                      <b>{child.title}</b>
                    </FeedbackActionButton>
                  ))}
                </div>
              )}
              {index < steps.length - 1 && (
                <span className="process-flow-line" aria-hidden="true" />
              )}
            </article>
          );
        })}
      </section>
    </main>
  );
}

function TopModules({
  view,
  onParent,
  sessionLine,
  allowedViews,
}: {
  view: MainView;
  onParent: (v: MainView) => void;
  sessionLine?: "A" | "B";
  allowedViews: Set<MainView>;
}) {
  const moduleButton = (key: MainView, label: string) => {
    if (!allowedViews.has(key)) return null;
    const restricted = Boolean(sessionLine && key !== "production");
    return (
      <FeedbackActionButton
        className={`${view === key ? "active " : ""}${restricted ? "permission-disabled" : ""}`}
        disabled={restricted} disabledExplanation={`Thiết bị Line ${sessionLine} không có quyền thao tác phân hệ này.`}
        title={
          restricted
            ? `Thiết bị Line ${sessionLine} không có quyền thao tác phân hệ này`
            : undefined
        }
        onClick={() => onParent(key)}
      >
        <UiLabel>{label}</UiLabel>
        {restricted && <span className="permission-lock">⌁</span>}
      </FeedbackActionButton>
    );
  };
  return (
    <div className="top-modules">
      {moduleButton("users", "Quản trị hệ thống")}
      {moduleButton("sku", "Dữ liệu cơ bản")}
      {moduleButton("warehouse", "Quản lý kho")}
      {moduleButton("bom", "Cấu trúc thành phẩm")}
      {moduleButton("planning", "Kế hoạch sản xuất")}
      {moduleButton("production", "Hệ thống báo công")}
    </div>
  );
}

function AppSidebar({
  view,
  child,
  collapsed,
  onToggleCollapsed,
  onParent,
  onChild,
  sessionLine,
  allowedViews,
  canOpen,
  isAdmin,
  reportMenu,
  productionReportExpanded,
  onToggleProductionReport,
  capacityExpanded,
  onToggleCapacity,
  scopeId,
  language,
}: {
  view: MainView;
  child: string | null;
  collapsed: boolean;
  language: Language;
  onToggleCollapsed: () => void;
  onParent: (v: MainView) => void;
  onChild: (v: MainView, c: string, tab?: PlanningTab) => void;
  sessionLine?: "A" | "B";
  allowedViews: Set<MainView>;
  canOpen: (view: MainView, child?: string) => boolean;
  isAdmin: boolean;
  reportMenu?: React.ReactNode;
  productionReportExpanded: boolean;
  onToggleProductionReport: () => void;
  capacityExpanded: boolean;
  onToggleCapacity: () => void;
  scopeId: string;
}) {
  const [canBackup, setCanBackup] = useState(false);
  useEffect(() => {
    if (!isAdmin) {
      setCanBackup(false);
      return;
    }
    let active = true;
    fetch("/api/storage-capability", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (active) setCanBackup(d.allowed === true);
      })
      .catch(() => {
        if (active) setCanBackup(false);
      });
    return () => {
      active = false;
    };
  }, [view, isAdmin]);
  if (!allowedViews.has(view)) return null;
  return (
    <>
    <aside id={`${scopeId}-navigation`} className={`app-sidebar${collapsed ? " collapsed" : ""}`}>
      <p><UiLabel>{"PHÂN HỆ"}</UiLabel></p>
      {isAdmin && (
        <FeedbackActionButton
          className={view === "users" ? "active" : ""}
          onClick={() => onParent("users")}
        ><UiLabel>{"👤 Quản trị hệ thống"}</UiLabel><i>{view === "users" ? "⌄" : "›"}</i>
        </FeedbackActionButton>
      )}
      {isAdmin && view === "users" && (
        <div className="sidebar-children">
          <FeedbackActionButton
            className={child === "users-list" ? "active" : ""}
            onClick={() => onChild("users", "users-list")}
          >
            <span className="menu-icon">♟</span><UiLabel>{"Quản lý người dùng"}</UiLabel></FeedbackActionButton>
          <FeedbackActionButton
            className={child === "permissions" ? "active" : ""}
            onClick={() => onChild("users", "permissions")}
          >
            <span className="menu-icon">◆</span><UiLabel>{"Phân quyền"}</UiLabel></FeedbackActionButton>
          <FeedbackActionButton
            className={child === "departments" ? "active" : ""}
            onClick={() => onChild("users", "departments")}
          >
            <span className="menu-icon">▦</span><UiLabel>{"Thiết lập bộ phận"}</UiLabel></FeedbackActionButton>
          <FeedbackActionButton
            className={child === "audit" ? "active" : ""}
            onClick={() => onChild("users", "audit")}
          >
            <span className="menu-icon">◷</span><UiLabel>{"Nhật ký thao tác"}</UiLabel></FeedbackActionButton>
          <FeedbackActionButton className={child === "test-log" ? "active" : ""} onClick={() => onChild("users", "test-log")}><span className="menu-icon">◷</span><UiLabel>{"Nhật ký test website"}</UiLabel></FeedbackActionButton>
          <FeedbackActionButton className={child === "feedback" ? "active" : ""} onClick={()=>onChild("users","feedback")}><span className="menu-icon">✉</span><UiLabel>{"Phản hồi người dùng"}</UiLabel></FeedbackActionButton>
          <FeedbackActionButton
            className={child === "versions" ? "active" : ""}
            onClick={() => onChild("users", "versions")}
          >
            <span className="menu-icon">▤</span><UiLabel>{"Quản lý phiên bản"}</UiLabel></FeedbackActionButton>
          <FeedbackActionButton
            className={child === "data-status" ? "active" : ""}
            onClick={() => onChild("users", "data-status")}
          >
            <span className="menu-icon">◉</span><UiLabel>{"Tình trạng dữ liệu"}</UiLabel></FeedbackActionButton>
          {canBackup && (
            <FeedbackActionButton
              className={child === "backup-restore" ? "active" : ""}
              onClick={() => onChild("users", "backup-restore")}
            >
              <span className="menu-icon">⛁</span><UiLabel>{"Sao lưu & Bàn giao"}</UiLabel></FeedbackActionButton>
          )}
        </div>
      )}
      {allowedViews.has("sku") && (
        <FeedbackActionButton
          className={view === "sku" ? "active" : ""}
          onClick={() => onParent("sku")}
        ><UiLabel>{"▦ Dữ liệu cơ bản"}</UiLabel><i>{view === "sku" ? "⌄" : "›"}</i>
        </FeedbackActionButton>
      )}
      {view === "sku" && (
        <div className="sidebar-children">
          {canOpen("sku", "sku-master") && (
            <FeedbackActionButton
              className={child === "sku-master" ? "active" : ""}
              onClick={() => onChild("sku", "sku-master")}
            >
              <span className="menu-icon">▦</span><UiLabel>{"SKU Master"}</UiLabel></FeedbackActionButton>
          )}
          {canOpen("sku", "employees") && (
            <FeedbackActionButton className={child === "employees" ? "active" : ""} onClick={() => onChild("sku", "employees")}>
              <span className="menu-icon">♙</span><UiLabel>{"Danh sách nhân viên"}</UiLabel></FeedbackActionButton>
          )}
          {canOpen("sku", "leadtime") && (
            <FeedbackActionButton
              className={child === "leadtime" ? "active" : ""}
              onClick={() => onChild("sku", "leadtime")}
            >
              <span className="menu-icon">◷</span><UiLabel>{"Leadtime"}</UiLabel></FeedbackActionButton>
          )}
          {canOpen("sku", "labor-hours") && (
            <FeedbackActionButton
              className={child === "labor-hours" ? "active" : ""}
              onClick={() => onChild("sku", "labor-hours")}
            >
              <span className="menu-icon">◴</span><UiLabel>{"Giờ công"}</UiLabel></FeedbackActionButton>
          )}
          {canOpen("sku", "safety-days") && (
            <FeedbackActionButton
              className={child === "safety-days" ? "active" : ""}
              onClick={() => onChild("sku", "safety-days")}
            >
              <span className="menu-icon">◇</span><UiLabel>{"Quy tắc Safety Days"}</UiLabel></FeedbackActionButton>
          )}
        </div>
      )}
      {allowedViews.has("warehouse") && (
        <FeedbackActionButton
          className={view === "warehouse" ? "active" : ""}
          onClick={() => onParent("warehouse")}
        ><UiLabel>{"▣ Quản lý kho"}</UiLabel><i>{view === "warehouse" ? "⌄" : "›"}</i>
        </FeedbackActionButton>
      )}
      {view === "warehouse" && (
        <div className="sidebar-children warehouse-children">
          {canOpen(view,"department-changes") && <FeedbackActionButton className={child==="department-changes"?"active":""} onClick={()=>onChild(view,"department-changes")}><span className="menu-icon">▤</span><UiLabel>Phiếu thay đổi</UiLabel></FeedbackActionButton>}
          {canOpen("warehouse", "warehouse-overview") && (
            <FeedbackActionButton
              className={child === "warehouse-overview" ? "active" : ""}
              onClick={() => onChild("warehouse", "warehouse-overview")}
            >
              <span className="menu-icon">⌂</span><UiLabel>{"Tổng quan"}</UiLabel></FeedbackActionButton>
          )}
          {canOpen("warehouse", "inventory") && (
            <FeedbackActionButton
              className={child === "inventory" ? "active" : ""}
              onClick={() => onChild("warehouse", "inventory")}
            >
              <span className="menu-icon">▤</span><UiLabel>{"Tồn kho ERP"}</UiLabel></FeedbackActionButton>
          )}
          {canOpen("warehouse", "warehouse-in") && (
            <FeedbackActionButton
              className={child === "warehouse-in" ? "active" : ""}
              onClick={() => onChild("warehouse", "warehouse-in")}
            >
              <span className="menu-icon">⇥</span><UiLabel>{"Nhập kho"}</UiLabel></FeedbackActionButton>
          )}
          {canOpen("warehouse", "warehouse-out") && (
            <FeedbackActionButton
              className={child === "warehouse-out" ? "active" : ""}
              onClick={() => onChild("warehouse", "warehouse-out")}
            >
              <span className="menu-icon">⇤</span><UiLabel>{"Xuất kho"}</UiLabel></FeedbackActionButton>
          )}
          {canOpen("warehouse", "warehouse-transfer") && (
            <FeedbackActionButton
              className={child === "warehouse-transfer" ? "active" : ""}
              onClick={() => onChild("warehouse", "warehouse-transfer")}
            >
              <span className="menu-icon">⇄</span><UiLabel>{"Chuyển kho"}</UiLabel></FeedbackActionButton>
          )}
          {canOpen("warehouse", "warehouse-docs") && (
            <FeedbackActionButton
              className={child === "warehouse-docs" ? "active" : ""}
              onClick={() => onChild("warehouse", "warehouse-docs")}
            >
              <span className="menu-icon">▧</span><UiLabel>{"Phiếu kho"}</UiLabel></FeedbackActionButton>
          )}
          {canOpen("warehouse", "warehouse-count") && (
            <FeedbackActionButton
              className={child === "warehouse-count" ? "active" : ""}
              onClick={() => onChild("warehouse", "warehouse-count")}
            >
              <span className="menu-icon">✓</span><UiLabel>{"Kiểm kê"}</UiLabel></FeedbackActionButton>
          )}
          {canOpen("warehouse", "warehouse-report") && (
            <FeedbackActionButton
              className={child === "warehouse-report" ? "active" : ""}
              onClick={() => onChild("warehouse", "warehouse-report")}
            >
              <span className="menu-icon">▥</span><UiLabel>{"Báo cáo"}</UiLabel></FeedbackActionButton>
          )}
        </div>
      )}
      {allowedViews.has("bom") && (
        <FeedbackActionButton
          className={view === "bom" ? "active" : ""}
          onClick={() => onParent("bom")}
        ><UiLabel>{"⌘ Cấu trúc thành phẩm"}</UiLabel><i>{view === "bom" ? "⌄" : "›"}</i>
        </FeedbackActionButton>
      )}
      {view === "bom" && (
        <div className="sidebar-children">
          {canOpen("bom", "bom-data") && (
            <FeedbackActionButton
              className={child === "bom-data" ? "active" : ""}
              onClick={() => onChild("bom", "bom-data")}
            >
              <span className="menu-icon">⌘</span><UiLabel>{"Dữ liệu lượng dùng BOM"}</UiLabel></FeedbackActionButton>
          )}
          {canOpen("bom", "bom-change") && (
            <FeedbackActionButton
              className={child === "bom-change" ? "active" : ""}
              onClick={() => onChild("bom", "bom-change")}
            >
              <span className="menu-icon">✎</span><UiLabel>{"Phiếu thay đổi BOM"}</UiLabel></FeedbackActionButton>
          )}
        </div>
      )}
      {allowedViews.has("planning") && (
        <FeedbackActionButton
          className={view === "planning" ? "active" : ""}
          onClick={() => onParent("planning")}
        ><UiLabel>{"◫ Kế hoạch sản xuất"}</UiLabel><i>{view === "planning" ? "⌄" : "›"}</i>
        </FeedbackActionButton>
      )}
      {view === "planning" && (
        <div className="sidebar-children">
          {canOpen(view,"department-changes") && <FeedbackActionButton className={child==="department-changes"?"active":""} onClick={()=>onChild(view,"department-changes")}><span className="menu-icon">▤</span><UiLabel>Phiếu thay đổi KH</UiLabel></FeedbackActionButton>}
          {canOpen("planning", "base") && (
            <FeedbackActionButton
              className={child === "base" ? "active" : ""}
              onClick={() => onChild("planning", "base", "base")}
            >
              <span className="menu-icon">▦</span><UiLabel>{"Base_forecast"}</UiLabel></FeedbackActionButton>
          )}
          {canOpen("planning", "demand") && (
            <FeedbackActionButton
              className={child === "demand" ? "active" : ""}
              onClick={() => onChild("planning", "demand", "demand")}
            >
              <span className="menu-icon">＋</span><UiLabel>{"Demand_event"}</UiLabel></FeedbackActionButton>
          )}
          {canOpen("planning", "proposal") && (
            <FeedbackActionButton
              className={child === "proposal" ? "active" : ""}
              onClick={() => onChild("planning", "proposal", "proposal")}
            >
              <span className="menu-icon">⚙</span><UiLabel>{"Production_engine"}</UiLabel></FeedbackActionButton>
          )}
          {canOpen("planning", "rules") && (
            <FeedbackActionButton
              className={`engine-rule-menu ${child === "rules" ? "active" : ""}`}
              onClick={() => onChild("planning", "rules", "rules")}
            >
              <span className="menu-icon">↳</span><UiLabel>{"Quy tắc áp dụng"}</UiLabel></FeedbackActionButton>
          )}
          {canOpen("planning", "plan") && (
            <FeedbackActionButton
              className={child === "plan" ? "active" : ""}
              onClick={() => onChild("planning", "plan", "plan")}
            >
              <span className="menu-icon">▣</span><UiLabel>{"Production_plan"}</UiLabel></FeedbackActionButton>
          )}
          {canOpen("planning", "tracking") && (
            <FeedbackActionButton
              className={child === "tracking" ? "active" : ""}
              onClick={() => onChild("planning", "tracking", "tracking")}
            >
              <span className="menu-icon">⇄</span><UiLabel>{"In transit"}</UiLabel></FeedbackActionButton>
          )}
          {canOpen("planning", "report") && (
            <FeedbackActionButton
              className={child === "report" ? "active" : ""}
              onClick={() => onChild("planning", "report", "report")}
            >
              <span className="menu-icon">▥</span><UiLabel>{"Report"}</UiLabel></FeedbackActionButton>
          )}
          {child === "report" && canOpen("planning", "report") && !collapsed && reportMenu}
        </div>
      )}
      {view === "production" && (
        <div className="sidebar-children">
          {canOpen(view,"department-changes") && <FeedbackActionButton className={child==="department-changes"?"active":""} onClick={()=>onChild(view,"department-changes")}><span className="menu-icon">▤</span><UiLabel>Phiếu thay đổi SX</UiLabel></FeedbackActionButton>}
          {canOpen("production", "production-report") && (
            <FeedbackActionButton
              className={
                productionReportExpanded || child === "production-report" || child?.startsWith("report-")
                  ? "active"
                  : ""
              }
              onClick={onToggleProductionReport}
              aria-expanded={productionReportExpanded}
              aria-controls={`${scopeId}-production-report-menu`}
            >
              <span className="menu-icon">▶</span>{translateToolbar("Theo dõi lệnh sản xuất", toolbarLocale())}{" "}
              <i>
                {productionReportExpanded
                  ? "⌄"
                  : "›"}
              </i>
            </FeedbackActionButton>
          )}
          {canOpen("production", "production-report") &&
            productionReportExpanded && (
              <div className="production-report-actions" id={`${scopeId}-production-report-menu`}>
                {canOpen("production", "report-work") && (<FeedbackActionButton
                  className={child === "report-work" || child === "production-report" ? "active" : ""}
                  onClick={() => onChild("production", "report-work")}
                >
                  <span>▦</span><UiLabel>{"SX báo công"}</UiLabel></FeedbackActionButton>)}
                {canOpen("production", "report-review") && (<FeedbackActionButton
                  className={child === "report-review" ? "active" : ""}
                  onClick={() => onChild("production", "report-review")}
                >
                  <span>▤</span><UiLabel>{"Lịch sản xuất thực tế"}</UiLabel></FeedbackActionButton>)}
                {canOpen("production", "report-progress") && (<FeedbackActionButton
                  className={child === "report-progress" ? "active" : ""}
                  onClick={() => onChild("production", "report-progress")}
                >
                  <span>↗</span><UiLabel>{"Tiến độ sản xuất"}</UiLabel></FeedbackActionButton>)}
                {canOpen("production", "report-dashboard") && (<FeedbackActionButton
                  className={child === "report-dashboard" ? "active" : ""}
                  onClick={() => onChild("production", "report-dashboard")}
                >
                  <span>▥</span><UiLabel>{"Nhật ký báo công"}</UiLabel></FeedbackActionButton>)}
                {canOpen("production", "report-cancel") && (<FeedbackActionButton className={child === "report-cancel" ? "active" : ""} onClick={() => onChild("production", "report-cancel")}><span>✎</span>{translateToolbar("Điều chỉnh báo công", toolbarLocale())}</FeedbackActionButton>)}
                {canOpen("production", "report-output") && (<FeedbackActionButton className={child === "report-output" ? "active" : ""} onClick={() => onChild("production", "report-output")}><span>◫</span><UiLabel>{"Sản lượng và giờ công"}</UiLabel></FeedbackActionButton>)}
                {canOpen("production", "report-payroll") && (<FeedbackActionButton className={child === "report-payroll" ? "active" : ""} onClick={() => onChild("production", "report-payroll")}><span>◫</span>{translateToolbar("Hiệu suất và tiền sản lượng", toolbarLocale())}</FeedbackActionButton>)}
              </div>
            )}
          {(canOpen("production", "weekly-capacity") || canOpen("production", "capacity-calendar")) && (
            <div className="capacity-sidebar-group">
              <FeedbackActionButton
                className={`${capacityExpanded || child?.startsWith("capacity-") ? "active " : ""}`}
                onClick={onToggleCapacity}
                aria-expanded={capacityExpanded}
                aria-controls={`${scopeId}-capacity-menu`}
              ><span className="menu-icon">▥</span><UiLabel>{"Capacity tuần"}</UiLabel><i>{capacityExpanded ? "⌄" : "›"}</i></FeedbackActionButton>
              {capacityExpanded && <div className="capacity-sidebar-group" id={`${scopeId}-capacity-menu`}>
              {canOpen("production", "capacity-calendar") && (<FeedbackActionButton className={`capacity-sidebar-child ${child === "capacity-calendar" ? "active" : ""}`} onClick={() => onChild("production", "capacity-calendar")}><UiLabel>{"↳ Lịch làm việc dự kiến"}</UiLabel></FeedbackActionButton>)}
              {canOpen("production", "capacity-summary") && (<FeedbackActionButton className={`capacity-sidebar-child ${child === "capacity-summary" ? "active" : ""}`} onClick={() => onChild("production", "capacity-summary")}><UiLabel>{"↳ Tổng hợp Capacity"}</UiLabel></FeedbackActionButton>)}
              </div>}
            </div>
          )}
        </div>
      )}
      {allowedViews.has("production") && (
        <FeedbackActionButton onClick={() => onParent("production")}><UiLabel>{"⚙ Hệ thống báo công"}</UiLabel><i>›</i>
        </FeedbackActionButton>
      )}
    </aside>
      <div className="sidebar-toggle-slot"><FeedbackActionButton
        type="button"
        className="sidebar-collapse-toggle"
        onClick={onToggleCollapsed}
        aria-expanded={!collapsed}
        aria-controls={`${scopeId}-navigation`}
        aria-label={translateToolbar(collapsed ? "Mở menu chức năng" : "Ẩn menu chức năng", language)}
        title={translateToolbar(collapsed ? "Mở menu chức năng" : "Ẩn menu chức năng", language)}
      >
        <span aria-hidden="true">{collapsed ? "»" : "«"}</span>
      </FeedbackActionButton></div>
    </>
  );
}

type SystemUser = {
  company: string;
  department: string;
  login: string;
  name: string;
  email?: string;
  role?: string;
  authMode?: string;
  line?: "A" | "B";
  phone: string;
  mobile: string;
  active: boolean;
};
const initialSystemUsers: SystemUser[] = [];

let systemUsersCache: SystemUser[] | null = null;
let systemUsersPromise: Promise<SystemUser[]> | null = null;

function rememberSystemUsers(users: SystemUser[]) {
  if (typeof window === "undefined") return users;
  systemUsersCache = users;
  if (LOCAL_TEST && typeof window !== "undefined")
    localStorage.setItem("onspa-system-users", JSON.stringify(users));
  return users;
}

function cachedSystemUsers() {
  if (typeof window === "undefined") return null;
  if (systemUsersCache) return systemUsersCache;
  if (!LOCAL_TEST || typeof window === "undefined") return null;
  try {
    const saved = JSON.parse(
      localStorage.getItem("onspa-system-users") || "null",
    );
    if (Array.isArray(saved)) systemUsersCache = saved;
  } catch {}
  return systemUsersCache;
}

function loadSystemUsers() {
  const browser = typeof window !== "undefined";
  const session = clientSessionGeneration();
  if (browser && systemUsersPromise) return systemUsersPromise;
  const request = recordFetch("/api/records?entity=users")
    .then((response) => (response.ok ? response.json() : Promise.reject()))
    .then((data) => {
      assertCurrentClientSession(session);
      const saved = new Map<string, SystemUser & { _deleted?: boolean }>(
        data.records.map(
          (record: {
            key: string;
            payload: SystemUser & { _deleted?: boolean };
          }) => [record.key, record.payload],
        ),
      );
      const source = LOCAL_TEST ? initialSystemUsers : [];
      const merged = source
        .filter((user) => !saved.get(user.login)?._deleted)
        .map((user) => saved.get(user.login) || user);
      for (const [key, user] of saved)
        if (!user._deleted && !merged.some((item) => item.login === key))
          merged.push(user);
      return rememberSystemUsers(merged);
    })
    .catch(error => {
      assertCurrentClientSession(session);
      if (isClientSessionReadCancelled(error)) throw error;
      return cachedSystemUsers() || (LOCAL_TEST ? initialSystemUsers : []);
    })
    .finally(() => {
      if (systemUsersPromise === request) systemUsersPromise = null;
    });
  if (browser) systemUsersPromise = request;
  return request;
}

type DepartmentRecord = {
  code: string;
  name: string;
  company: string;
  description: string;
  active: boolean;
};

const defaultDepartments: DepartmentRecord[] = [
  {
    code: "SHINTUNG",
    name: "SHINTUNG",
    company: "SHINTUNG",
    description: "Khối quản trị và dùng chung",
    active: true,
  },
  {
    code: "KHSX",
    name: "Kế hoạch sản xuất",
    company: "SHINTUNG",
    description: "Lập và điều phối kế hoạch sản xuất",
    active: true,
  },
  {
    code: "SX",
    name: "Sản xuất",
    company: "SHINTUNG",
    description: "Thực hiện và báo công sản xuất",
    active: true,
  },
  {
    code: "KHO",
    name: "Kho",
    company: "SHINTUNG",
    description: "Quản lý tồn kho và giao dịch kho",
    active: true,
  },
  {
    code: "QC",
    name: "QC",
    company: "SHINTUNG",
    description: "Kiểm soát chất lượng",
    active: true,
  },
];
let departmentRecordsCache: DepartmentRecord[] | null = null;
let departmentRecordsPromise: Promise<DepartmentRecord[]> | null = null;
function rememberDepartments(records: DepartmentRecord[]) {
  if (typeof window !== "undefined") departmentRecordsCache = records;
  return records;
}
function loadDepartments(force = false) {
  const browser = typeof window !== "undefined";
  const session = clientSessionGeneration();
  if (browser && departmentRecordsCache && !force)
    return Promise.resolve(departmentRecordsCache);
  if (browser && departmentRecordsPromise) return departmentRecordsPromise;
  const request = recordFetch("/api/records?entity=departments", {
    cache: "no-store",
  })
    .then((response) => (response.ok ? response.json() : Promise.reject()))
    .then((data) => {
      assertCurrentClientSession(session);
      const saved = new Map<string, DepartmentRecord & { _deleted?: boolean }>(
        data.records.map(
          (record: {
            key: string;
            payload: DepartmentRecord & { _deleted?: boolean };
          }) => [record.key.toUpperCase(), record.payload],
        ),
      );
      const merged = defaultDepartments
        .filter((item) => !saved.get(item.code)?._deleted)
        .map((item) => saved.get(item.code) || item);
      for (const [key, item] of saved)
        if (!item._deleted && !merged.some((current) => current.code === key))
          merged.push(item);
      return rememberDepartments(
        merged.sort((a, b) => a.name.localeCompare(b.name, "vi")),
      );
    })
    .catch(error => {
      assertCurrentClientSession(session);
      if (isClientSessionReadCancelled(error)) throw error;
      return (browser && departmentRecordsCache) || defaultDepartments;
    })
    .finally(() => {
      if (departmentRecordsPromise === request) departmentRecordsPromise = null;
    });
  if (browser) departmentRecordsPromise = request;
  return request;
}
function useDepartmentRecords() {
  const [departments, setDepartments] = useState<DepartmentRecord[]>(
    () => departmentRecordsCache || defaultDepartments,
  );
  useEffect(() => {
    let active = true;
    loadDepartments().then((records) => {
      if (active) setDepartments(records);
    }).catch(() => { /* The old view is discarded when its session changes. */ });
    return () => {
      active = false;
    };
  }, []);
  return { departments, setDepartments };
}
const departmentName = (departments: DepartmentRecord[], code: string) =>
  departments.find((item) => item.code === code || item.name === code)?.name ||
  code ||
  "—";

async function adminApiError(response: Response, fallback: string) {
  const result = (await response.json().catch(() => ({}))) as {
    error?: string;
  };
  if (response.status === 401)
    return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại. / 登入工作階段已過期，請重新登入。";
  if (response.status === 403)
    return `${result.error || "Tài khoản không có quyền thực hiện thao tác này."} / 此帳號沒有執行此操作的權限。`;
  return result.error || fallback;
}

function AdminOperationNotice({
  message,
  onClose,
  inline = false,
  dismissible = true,
}: {
  message: string;
  onClose: () => void;
  inline?: boolean;
  dismissible?: boolean;
}) {
  if (!message) return null;
  const success =
    message.startsWith("Đã ") &&
    !/(không thể|chưa|thất bại|lỗi)/i.test(message);
  return (
    <div
      className={`save-notice admin-operation-notice ${inline ? "panel-operation-notice" : ""} ${success ? "success" : "error"}`}
      role={success ? "status" : "alert"}
      aria-live="assertive"
    >
      <span>{message}</span>
      {dismissible && (
        <FeedbackActionButton type="button" aria-label="Đóng thông báo" onClick={onClose}>
          ×
        </FeedbackActionButton>
      )}
    </div>
  );
}

function UserManagementV2() {
  const session = useRef(clientSessionGeneration()).current;
 const [toolbarSearchOpen,setToolbarSearchOpen]=useState(false);
 const [toolbarSearchField,setToolbarSearchField]=useState(2);

  const { departments } = useDepartmentRecords();
  const [users, setUsers] = useState<SystemUser[]>(
    () => cachedSystemUsers() || (LOCAL_TEST ? initialSystemUsers : []),
  );
  const [page, setPage] = useState(1);
  const [companyFilter, setCompanyFilter] = useState("Tất cả công ty");
  const [departmentFilter, setDepartmentFilter] = useState("Tất cả bộ phận");
  const [userQuery, setUserQuery] = useState("");
  const [editing, setEditing] = useState<SystemUser | null>(null);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletedLogin, setDeletedLogin] = useState("");
  const pageSize = 10;
  const normalizedUserQuery = userQuery.trim().toLocaleLowerCase("vi");
  const filteredUsers = users.filter(
    (user) =>
      (companyFilter === "Tất cả công ty" || user.company === companyFilter) &&
      (departmentFilter === "Tất cả bộ phận" ||
        user.department === departmentFilter) &&
      (!normalizedUserQuery ||
        `${user.login} ${user.name}`
          .toLocaleLowerCase("vi")
          .includes(normalizedUserQuery)),
  );
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const pagedUsers = filteredUsers.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );
  useEffect(
    () => setPage((current) => Math.min(current, totalPages)),
    [totalPages],
  );
  useEffect(() => setPage(1), [companyFilter, departmentFilter, userQuery]);
  const formUser = editing || {
    company: "SHINTUNG",
    department: "KHSX",
    login: "",
    name: "",
    email: "",
    role: "USER",
    phone: "",
    mobile: "",
    active: true,
    authMode: "password",
    line: undefined,
  };
  const formRole = ["SUPER_ADMIN", "SUPER ADMIN"].includes(
    String(formUser.role || "")
      .trim()
      .toUpperCase()
      .replaceAll("-", "_"),
  )
    ? "SUPER_ADMIN"
    : String(formUser.role || "")
          .trim()
          .toUpperCase() === "ADMIN"
      ? "ADMIN"
      : "USER";
  const closeUserPanel = () => {
    setEditing(null);
    setAdding(false);
    setNotice("");
    setDeletedLogin("");
  };
  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (deletedLogin) return;
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") || "");
    const confirmPassword = String(fd.get("confirmPassword") || "");
    if (password && password !== confirmPassword) {
      setNotice("Mật khẩu nhập lại chưa khớp.");
      return;
    }
    const u: SystemUser = {
      company: String(fd.get("company")),
      department: String(fd.get("department")),
      login: String(fd.get("login")),
      name: String(fd.get("name")),
      email: String(fd.get("email") || "").trim(),
      role: formUser.authMode === "quick_line" ? "USER" : String(fd.get("role") || "USER"),
      ...(formUser.authMode === "quick_line" ? {authMode: formUser.authMode, line: formUser.line} : {}),
      phone: formUser.phone || "",
      mobile: formUser.mobile || "",
      active: fd.get("active") === "true",
    };
    setSaving(true);
    const response = await recordFetch("/api/records", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entity: "users",
        key: u.login,
        payload: u,
        updatedBy: "sample_user_15",
      }),
    });
    if (!response.ok) {
      setSaving(false);
      setNotice(
        await adminApiError(
          response,
          "Không thể lưu người dùng. Vui lòng thử lại. / 無法儲存使用者，請再試一次。",
        ),
      );
      return;
    }
    if (password) {
      const passwordResponse = await fetch("/api/auth/admin/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          login: u.login,
          password,
          passwordConfirm: confirmPassword,
        }),
      });
      if (!passwordResponse.ok) {
        const result = await passwordResponse.json().catch(() => ({}));
        setSaving(false);
        setNotice(
          result.error || "Đã lưu người dùng nhưng chưa đặt được mật khẩu.",
        );
        return;
      }
    }
    setSaving(false);
    setUsers((p) => {
      if (session !== clientSessionGeneration()) return p;
      const next = editing
        ? p.map((x) => (x.login === editing.login ? u : x))
        : [...p.filter((x) => x.login !== u.login), u];
      rememberSystemUsers(next);
      return next;
    });
    permissionRecordsCache = null;
    setNotice(
      editing
        ? "Đã lưu thay đổi người dùng. / 已儲存使用者變更。"
        : "Đã thêm người dùng mới. / 已新增使用者。",
    );
    setEditing(u);
    setAdding(false);
    setDeletedLogin("");
  };
  const remove = async () => {
    if (!editing) return;
    if (confirm(`Xóa người dùng ${editing.login}?`)) {
      setSaving(true);
      const response = await recordFetch("/api/records", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          entity: "users",
          key: editing.login,
          payload: {
            ...editing,
            _deleted: true,
            deletedAt: new Date().toISOString(),
          },
          updatedBy: "sample_user_15",
        }),
      });
      setSaving(false);
      if (!response.ok) {
        setNotice(
          await adminApiError(
            response,
            "Không thể xóa người dùng. Vui lòng thử lại. / 無法刪除使用者，請再試一次。",
          ),
        );
        return;
      }
      setUsers((p) => {
        if (session !== clientSessionGeneration()) return p;
        const next = p.filter((x) => x.login !== editing.login);
        rememberSystemUsers(next);
        return next;
      });
      permissionRecordsCache = null;
      setNotice(
        "Đã xóa người dùng. Dữ liệu xóa vẫn được lưu để có thể khôi phục. / 已刪除使用者並保留可復原紀錄。",
      );
      setDeletedLogin(editing.login);
    }
  };
  return (
    <main data-report-auto-preview="false" className="workspace">
      <div className="page-heading">
        <div>
          <p className="eyebrow">QUẢN TRỊ HỆ THỐNG</p>
          <PageTitle variant="menu-root">Quản lý người dùng</PageTitle>
          <p>
            Quản lý tài khoản, thông tin liên hệ, mật khẩu và trạng thái đăng
            nhập.
          </p>
        </div>
        
      </div>
      <section className="data-card">
        <StandardToolbar name="UserManagementV2" items={[toolbarConfig.action({onClick:() => {
            setNotice("");
            setDeletedLogin("");
            setEditing(null);
            setAdding(true);
          }},"＋ Thêm người dùng",true,"action"),

toolbarConfig.note(<span>{filteredUsers.length} người dùng</span>),
toolbarConfig.action({onClick:()=>setToolbarSearchOpen(true)},"Tra cứu",true,"lookup"),
toolbarSearchOpen && toolbarConfig.group([toolbarConfig.field("TRA THEO",[toolbarConfig.select({value:toolbarSearchField,onChange:e=>{setToolbarSearchField(Number(e.target.value));setCompanyFilter("Tất cả công ty");setDepartmentFilter("Tất cả bộ phận");setUserQuery("");}},<><option value={0}>Công ty</option><option value={1}>Bộ phận</option><option value={2}>Tên đăng nhập / Họ tên</option></>)]),toolbarSearchField === 0 && toolbarConfig.field("NỘI DUNG TRA",[toolbarConfig.select({"value": companyFilter,"onChange": (event) => setCompanyFilter(event.target.value)},<><option>Tất cả công ty</option><option>SHINTUNG</option></>)]),toolbarSearchField === 1 && toolbarConfig.field("NỘI DUNG TRA",[toolbarConfig.select({"value": departmentFilter,"onChange": (event) => setDepartmentFilter(event.target.value)},<><option>Tất cả bộ phận</option>{departments.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.name}
                  </option>
                ))}</>)]),toolbarSearchField === 2 && toolbarConfig.field("NỘI DUNG TRA",[toolbarConfig.input({"value": userQuery,"onChange": (event) => setUserQuery(event.target.value),"placeholder": "Tên đăng nhập hoặc họ tên"})]),toolbarConfig.action({onClick:()=>{setCompanyFilter("Tất cả công ty");setDepartmentFilter("Tất cả bộ phận");setUserQuery("");}},"Xóa lọc",true,"clear"),toolbarConfig.action({onClick:()=>{}},"Tìm kiếm",true,"search"),toolbarConfig.action({onClick:()=>{setCompanyFilter("Tất cả công ty");setDepartmentFilter("Tất cả bộ phận");setUserQuery("");setToolbarSearchOpen(false)}},"Quay lại",true,"back")])]} />
        <DataTable className="table-wrap">
          <table className="system-user-table" data-no-pagination="true">
            <thead>
              <tr>
                <th>CÔNG TY LỆ THUỘC</th>
                <th>BỘ PHẬN LỆ THUỘC</th>
                <th>TÊN ĐĂNG NHẬP</th>
                <th>TÊN</th>
                <th>VAI TRÒ</th>
                <th>ĐĂNG NHẬP</th>
                <th>TRẠNG THÁI</th>
                <th>THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {pagedUsers.map((u) => (
                <tr key={u.login}>
                  <DataCell kind="code">{u.company || "—"}</DataCell>
                  <DataCell>{departmentName(departments, u.department)}</DataCell>
                  <DataCell kind="code" className="user-login">{u.login}</DataCell>
                  <DataCell>{u.name}</DataCell>
                  <DataCell>{u.role || "USER"}</DataCell>
                  <DataCell>{u.authMode === "quick_line" ? `Nút Vào Line ${u.line} · Không mật khẩu` : "ID / Mật khẩu"}</DataCell>
                  <DataCell>
                    <span className={u.active ? "done-badge" : "version-old"}>
                      {u.active ? "Hoạt động" : "Ngưng"}
                    </span>
                  </DataCell>
                  <DataCell>
                    <FeedbackActionButton
                      className="edit-user-link"
                      onClick={() => {
                        setNotice("");
                        setDeletedLogin("");
                        setAdding(false);
                        setEditing(u);
                      }}
                    >
                      Sửa đổi
                    </FeedbackActionButton>
                  </DataCell>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>
        <ManualPagination total={filteredUsers.length} page={page} pageSize={pageSize} onPageChange={setPage}/>
      </section>
      {(editing || adding) && (
        <>
          <FeedbackActionButton
            className="overlay"
            aria-label="Đóng"
            onClick={closeUserPanel}
          />
          <aside className="detail-panel user-edit-panel">
            <div className="detail-header">
              <div>
                <p>{editing ? "CẬP NHẬT NGƯỜI DÙNG" : "THÊM NGƯỜI DÙNG"}</p>
                <h2>{editing ? editing.login : "Tài khoản mới"}</h2>
                <span>
                  {editing ? editing.name : "Nhập đầy đủ thông tin bên dưới"}
                </span>
              </div>
              <FeedbackActionButton onClick={closeUserPanel}>×</FeedbackActionButton>
            </div>
            <form className="edit-user-form" onSubmit={save} onInvalid={() => notifyActionFailure("Thông tin bắt buộc còn thiếu hoặc chưa hợp lệ. Kiểm tra các trường được đánh dấu trước khi tiếp tục.")}>
              <label>
                <span>Công ty lệ thuộc</span>
                <select name="company" defaultValue={formUser.company}>
                  <option>SHINTUNG</option>
                </select>
              </label>
              <label>
                <span>Bộ phận lệ thuộc</span>
                <select name="department" defaultValue={formUser.department}>
                  {!departments.some(
                    (item) => item.code === formUser.department,
                  ) &&
                    formUser.department && (
                      <option value={formUser.department}>
                        {formUser.department}
                      </option>
                    )}
                  {departments
                    .filter(
                      (item) =>
                        item.active || item.code === formUser.department,
                    )
                    .map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                <span>Tên đăng nhập *</span>
                <input
                  name="login"
                  required
                  defaultValue={formUser.login}
                  readOnly={!!editing}
                />
              </label>
              <label>
                <span>Họ và tên *</span>
                <input name="name" required defaultValue={formUser.name} />
              </label>
              <label>
                <span>Email</span>
                <input
                  name="email"
                  type="email"
                  defaultValue={formUser.email || ""}
                />
              </label>
              <label>
                <span>Vai trò</span>
                <select name="role" defaultValue={formRole} disabled={formUser.authMode === "quick_line"}>
                  <option value="USER">USER</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                </select>
              </label>
              <label>
                <span>{formUser.authMode === "quick_line" ? `Đăng nhập bằng nút Vào Line ${formUser.line}` : editing ? "Đặt/bổ sung mật khẩu" : "Mật khẩu *"}</span>
                <input
                  name="password"
                  disabled={formUser.authMode === "quick_line"}
                  type="password"
                  minLength={4}
                  maxLength={64}
                  required={!editing}
                  placeholder={
                    editing
                      ? "Để trống nếu không đổi mật khẩu"
                      : "Từ 4 đến 64 ký tự"
                  }
                />
              </label>
              <label>
                <span>Nhập lại mật khẩu</span>
                <input
                  name="confirmPassword"
                  disabled={formUser.authMode === "quick_line"}
                  type="password"
                  minLength={4}
                  maxLength={64}
                  placeholder="Nhập lại mật khẩu mới"
                />
              </label>
              <label>
                <span>Cho phép đăng nhập</span>
                <select name="active" defaultValue={String(formUser.active)}>
                  <option value="true">Có</option>
                  <option value="false">Không</option>
                </select>
              </label>
              <div className="edit-user-actions">
                {editing && !deletedLogin && (
                  <FeedbackActionButton
                    type="button"
                    className="delete-user-button"
                    onClick={remove}
                  >
                    Xóa người dùng
                  </FeedbackActionButton>
                )}
                <span />
                <FeedbackActionButton
                  type="button"
                  className="ghost-button"
                  onClick={closeUserPanel}
                >
                  Hủy
                </FeedbackActionButton>
                <FeedbackActionButton
                  type="submit"
                  className="primary-button"
                  disabled={saving || !!deletedLogin} disabledExplanation={saving ? "Thao tác đang được xử lý. Vui lòng chờ hoàn tất rồi thử lại." : "Tên đăng nhập này đã bị xóa. Chọn tên đăng nhập khác trước khi lưu."}
                >
                  {saving ? "Đang lưu..." : "Lưu lại"}
                </FeedbackActionButton>
              </div>
              <AdminOperationNotice
                message={notice}
                onClose={() => setNotice("")}
                inline
                dismissible={false}
              />
            </form>
          </aside>
        </>
      )}
    </main>
  );
}

type PermissionRecord = {
  company: string;
  department: string;
  login: string;
  name: string;
  phone: string;
  mobile: string;
  permissions: string;
  permissionMode?: "DEPARTMENT" | "CUSTOM";
  active: boolean;
};
function temporaryPermissions(user: SystemUser) {
  const make = (group: string, menus: string[], actions: string[]) =>
    menus.flatMap((menu) =>
      actions.map((action) => `${group} / ${menu} / ${action}`),
    );
  if (
    isSuperAdminUser(user) ||
    user.login === "admin" ||
    user.login === "sample_user_15"
  )
    return permissionMenuGroups
      .flatMap((group) => make(group.group, group.menus, permissionActions))
      .join(" · ");
  if (user.department === "KHO")
    return [
      ...make("Dữ liệu cơ bản", ["SKU Master"], ["Xem"]),
      ...make(
        "Quản lý kho",
        [
          "Tổng quan",
          "Tồn kho ERP",
          "Nhập kho",
          "Xuất kho",
          "Chuyển kho",
          "Phiếu kho",
          "Kiểm kê",
          "Báo cáo",
        ],
        ["Xem", "Thêm", "Sửa", "Xác nhận", "Xuất dữ liệu"],
      ),
    ].join(" · ");
  if (user.department === "SX")
    return [
      ...make("Dữ liệu cơ bản", ["SKU Master"], ["Xem"]),
      ...make("Cấu trúc thành phẩm", ["Dữ liệu lượng dùng BOM"], ["Xem"]),
      ...make(
        "Quản lý sản xuất",
        ["Báo công sản xuất", "Điều chỉnh nhân lực", "Capacity tuần"],
        ["Xem", "Thêm", "Sửa", "Xác nhận"],
      ),
    ].join(" · ");
  if (user.department === "QC")
    return [
      ...make("Dữ liệu cơ bản", ["SKU Master"], ["Xem"]),
      ...make(
        "Cấu trúc thành phẩm",
        ["Dữ liệu lượng dùng BOM", "Phiếu thay đổi BOM"],
        ["Xem"],
      ),
      ...make(
        "Quản lý sản xuất",
        ["Báo công sản xuất", "Khôi phục dữ liệu"],
        ["Xem", "Sửa"],
      ),
    ].join(" · ");
  return permissionMenuGroups
    .flatMap((group) => make(group.group, group.menus, ["Xem"]))
    .join(" · ");
}
const permissionMenuGroups = [
  {
    group: "Quản trị hệ thống",
    menus: [
      "Quản lý người dùng",
      "Thiết lập bộ phận",
      "Phân quyền",
      "Nhật ký thao tác",
      "Quản lý phiên bản",
    ],
  },
  {
    group: "Dữ liệu cơ bản",
    menus: ["SKU Master", "Danh sách nhân viên", "Leadtime", "Giờ công", "Quy tắc Safety Days"],
  },
  {
    group: "Quản lý kho",
    menus: [
      "Tổng quan",
      "Tồn kho ERP",
      "Nhập kho",
      "Xuất kho",
      "Chuyển kho",
      "Phiếu kho",
      "Kiểm kê",
      "Báo cáo",
    ],
  },
  {
    group: "Cấu trúc thành phẩm",
    menus: ["Dữ liệu lượng dùng BOM", "Phiếu thay đổi BOM"],
  },
  {
    group: "Kế hoạch sản xuất",
    menus: [
      "Base_forecast",
      "Demand_event",
      "Production_engine",
      "Quy tắc áp dụng",
      "Production_plan",
      "In_transit",
      "Report",
    ],
  },
  {
    group: "Quản lý sản xuất",
    menus: [
      "Báo công sản xuất",
      "Lịch SX thực tế", "Tiến độ sản xuất", "Nhật ký", "Điều chỉnh báo công", "Sản lượng và giờ công", "Hiệu suất và tính sản lượng",
      "Capacity tuần",
    ],
  },
];
const permissionActions = [
  "Xem",
  "Thêm",
  "Sửa",
  "Xóa",
  "Xác nhận",
  "Hủy xác nhận",
  "Hủy",
  "Xuất dữ liệu",
  "Ghi vắng mặt",
  "Sửa hệ số",
];
const permissionActionsForMenu=(group:string,menu:string)=>permissionActions.filter(action=>!(group==="Quản lý sản xuất"&&menu==="Capacity tuần"&&["Xóa","Hủy","Xuất dữ liệu"].includes(action))).filter(action=>action!=="Ghi vắng mặt"&&action!=="Sửa hệ số"||group==="Quản lý sản xuất"&&(action==="Ghi vắng mặt"&&menu==="Lịch SX thực tế"||action==="Sửa hệ số"&&menu==="Capacity tuần"));

const normalizedSystemRole = (role?: string) =>
  String(role || "")
    .trim()
    .toUpperCase()
    .replaceAll("-", "_")
    .replaceAll(" ", "_");

const isSuperAdminUser = (user?: Pick<SystemUser, "role"> | null) =>
  ["ADMIN","SUPER_ADMIN"].includes(normalizedSystemRole(user?.role));

const allSystemPermissions = () =>
  permissionMenuGroups.flatMap((group) =>
    group.menus.flatMap((menu) =>
      permissionActionsForMenu(group.group,menu).map((action) => `${group.group} / ${menu} / ${action}`),
    ),
  );

function PermissionMatrix({
  value,
  onChange,
  disabled = false,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const toggle = (key: string, checked: boolean) =>
    onChange(
      checked
        ? Array.from(new Set([...value, key]))
        : value.filter((item) => item !== key),
    );
  return (
    <div className="permission-matrix-wrap">
      <table className="permission-matrix" data-no-pagination="true">
        <thead>
          <tr>
            <th>PHÂN HỆ / CHỨC NĂNG</th>
            {permissionActions.map((action) => (
              <th key={action}>{action.toUpperCase()}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {permissionMenuGroups.flatMap((group) => [
            <tr className="permission-group-row" key={`${group.group}-group`}>
              <DataCell colSpan={permissionActions.length + 1}>{group.group}</DataCell>
            </tr>,
            ...group.menus.map((menu) => (
              <tr key={`${group.group}-${menu}`}>
                <DataCell>{menu}</DataCell>
                {permissionActions.map((action) => {
                  const key = `${group.group} / ${menu} / ${action}`;
                  if(!permissionActionsForMenu(group.group,menu).includes(action))return <DataCell key={key}>—</DataCell>;
                  return (
                    <DataCell key={key}>
                      <input
                        type="checkbox"
                        aria-label={`${menu} - ${action}`}
                        disabled={disabled}
                        checked={value.includes(key)}
                        onChange={(event) => toggle(key, event.target.checked)}
                      />
                    </DataCell>
                  );
                })}
              </tr>
            )),
          ])}
        </tbody>
      </table>
    </div>
  );
}

type DepartmentPermissionRecord = {
  department: string;
  permissions: string;
  active: boolean;
  updatedAt?: string;
};

function DepartmentManagement() {
  const { departments, setDepartments } = useDepartmentRecords();
  const [toolbarSearchOpen,setToolbarSearchOpen]=useState(false);
  const [toolbarSearchField,setToolbarSearchField]=useState<'code'|'name'|'company'>('code');
  const [toolbarSearchValue,setToolbarSearchValue]=useState('');
  const visibleDepartments=departments.filter(item=>String(item[toolbarSearchField] || '').toLocaleLowerCase().includes(toolbarSearchValue.trim().toLocaleLowerCase()));
  const [templates, setTemplates] = useState<
    Map<string, DepartmentPermissionRecord>
  >(new Map());
  const [editing, setEditing] = useState<DepartmentRecord | null>(null),
    [adding, setAdding] = useState(false),
    [permissionDepartment, setPermissionDepartment] =
      useState<DepartmentRecord | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]),
    [notice, setNotice] = useState(""),
    [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    recordFetch("/api/records?entity=department_permissions", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => {
        if (active)
          setTemplates(
            new Map(
              data.records
                .filter(
                  (record: {
                    payload: DepartmentPermissionRecord & {
                      _deleted?: boolean;
                    };
                  }) => !record.payload._deleted,
                )
                .map(
                  (record: {
                    key: string;
                    payload: DepartmentPermissionRecord;
                  }) => [record.key, record.payload],
                ),
            ),
          );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (permissionDepartment)
      setSelectedPermissions(
        (templates.get(permissionDepartment.code)?.permissions || "")
          .split(" · ")
          .filter(Boolean),
      );
  }, [permissionDepartment, templates]);
  const form = editing || {
    code: "",
    name: "",
    company: "SHINTUNG",
    description: "",
    active: true,
  };
  const saveDepartment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget),
      code = String(data.get("code") || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_"),
      record: DepartmentRecord = {
        code,
        name: String(data.get("name") || "").trim(),
        company: "SHINTUNG",
        description: String(data.get("description") || "").trim(),
        active: data.get("active") === "true",
      };
    if (!code || !record.name) {
      setNotice("Vui lòng nhập mã và tên bộ phận. / 請輸入部門代碼與名稱。");
      return;
    }
    if (!editing && departments.some((item) => item.code === code)) {
      setNotice("Mã bộ phận đã tồn tại. / 部門代碼已存在。");
      return;
    }
    setSaving(true);
    try {
      const response = await recordFetch("/api/records", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          entity: "departments",
          key: code,
          payload: record,
        }),
      });
      if (!response.ok) {
        setNotice(
          await adminApiError(
            response,
            "Không thể lưu bộ phận. / 無法儲存部門。",
          ),
        );
        return;
      }
      const next = [
        ...departments.filter((item) => item.code !== code),
        record,
      ].sort((a, b) => a.name.localeCompare(b.name, "vi"));
      rememberDepartments(next);
      setDepartments(next);
      setEditing(null);
      setAdding(false);
      setNotice(
        editing
          ? "Đã cập nhật bộ phận. / 已更新部門。"
          : "Đã thêm bộ phận mới. / 已新增部門。",
      );
    } catch {
      setNotice(
        "Không thể kết nối để lưu bộ phận. Vui lòng thử lại. / 無法連線儲存部門，請再試一次。",
      );
    } finally {
      setSaving(false);
    }
  };
  const saveTemplate = async () => {
    if (!permissionDepartment) return;
    if (!selectedPermissions.length) {
      setNotice(
        "Vui lòng chọn ít nhất một quyền cho bộ phận. / 請至少選擇一項部門權限。",
      );
      return;
    }
    const record: DepartmentPermissionRecord = {
      department: permissionDepartment.code,
      permissions: selectedPermissions.join(" · "),
      active: true,
      updatedAt: new Date().toISOString(),
    };
    setSaving(true);
    try {
      const response = await recordFetch("/api/records", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          entity: "department_permissions",
          key: permissionDepartment.code,
          payload: record,
        }),
      });
      if (!response.ok) {
        setNotice(
          await adminApiError(
            response,
            "Không thể lưu quyền bộ phận. / 無法儲存部門權限。",
          ),
        );
        return;
      }
      setTemplates((current) =>
        new Map(current).set(permissionDepartment.code, record),
      );
      setPermissionDepartment(null);
      setNotice(
        `Đã lưu quyền mặc định cho ${permissionDepartment.name}. / 已儲存部門預設權限。`,
      );
    } catch {
      setNotice(
        "Không thể kết nối để lưu quyền bộ phận. Vui lòng thử lại. / 無法連線儲存部門權限，請再試一次。",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <main data-report-auto-preview="false" className="workspace">
      <div className="page-heading">
        <div>
          <p className="eyebrow">QUẢN TRỊ HỆ THỐNG</p>
          <PageTitle variant="menu-root">Thiết lập bộ phận</PageTitle>
          <p>
            Quản lý danh mục bộ phận và quyền mặc định áp dụng cho người dùng kế
            thừa.
          </p>
        </div>
        
      </div>
      <AdminOperationNotice message={notice} onClose={() => setNotice("")} />
      <section className="data-card user-content-card">
        <StandardToolbar name="DepartmentManagement" items={[
          toolbarConfig.action({onClick:()=>setAdding(true)},'＋ Thêm bộ phận',true,'action'),
          toolbarConfig.action({onClick:()=>setToolbarSearchOpen(true)},'Tra cứu',true,'lookup'),
          toolbarSearchOpen && toolbarConfig.group([
            toolbarConfig.field('TRA THEO',[toolbarConfig.select({value:toolbarSearchField,onChange:e=>{setToolbarSearchField(e.target.value as typeof toolbarSearchField);setToolbarSearchValue('')}},<><option value="code">Mã bộ phận</option><option value="name">Tên bộ phận</option><option value="company">Công ty</option></>)]),
            toolbarConfig.field('NỘI DUNG TRA',[toolbarSearchField==='company' ? toolbarConfig.select({value:toolbarSearchValue,onChange:e=>setToolbarSearchValue(e.target.value)},<><option value="">Tất cả công ty</option>{Array.from(new Set(departments.map(item=>item.company))).filter(Boolean).map(company=><option key={company} value={company}>{company}</option>)}</>) : toolbarConfig.input({value:toolbarSearchValue,onChange:e=>setToolbarSearchValue(e.target.value)})]),
            toolbarConfig.action({onClick:()=>setToolbarSearchValue('')},'Xóa lọc',true,'clear'),
            toolbarConfig.action({onClick:()=>{}},'Tìm kiếm',true,'search'),
            toolbarConfig.action({onClick:()=>{setToolbarSearchValue('');setToolbarSearchOpen(false)}},'Quay lại',true,'back'),
          ])
        ]} />
        <DataTable className="table-wrap">
          <table data-no-pagination="true">
            <thead>
              <tr>
                <th>MÃ BỘ PHẬN</th>
                <th>TÊN BỘ PHẬN</th>
                <th>CÔNG TY</th>
                <th>MÔ TẢ</th>
                <th>QUYỀN MẶC ĐỊNH</th>
                <th>TRẠNG THÁI</th>
                <th>THAO TÁC</th>
              </tr>
            </thead>
            <tbody>{!visibleDepartments.length && <tr data-no-data="true"><DataCell colSpan={7}>Không tìm thấy bộ phận phù hợp.</DataCell></tr>}
              {visibleDepartments.map((item) => {
                const count = (templates.get(item.code)?.permissions || "")
                  .split(" · ")
                  .filter(Boolean).length;
                return (
                  <tr key={item.code}>
                    <DataCell kind="code" className="user-login">{item.code}</DataCell>
                    <DataCell>{item.name}</DataCell>
                    <DataCell kind="code">{item.company}</DataCell>
                    <DataCell>{item.description || "—"}</DataCell>
                    <DataCell>{count ? `${count} quyền` : "Chưa thiết lập"}</DataCell>
                    <DataCell>
                      <span
                        className={item.active ? "done-badge" : "version-old"}
                      >
                        {item.active ? "Hoạt động" : "Ngưng"}
                      </span>
                    </DataCell>
                    <DataCell>
                      <div className="department-row-actions">
                        <FeedbackActionButton
                          className="edit-user-link"
                          onClick={() => setPermissionDepartment(item)}
                        >
                          Phân quyền
                        </FeedbackActionButton>
                        <FeedbackActionButton
                          className="edit-user-link"
                          onClick={() => setEditing(item)}
                        >
                          Sửa
                        </FeedbackActionButton>
                      </div>
                    </DataCell>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DataTable>
      </section>
      {(editing || adding) && (
        <>
          <FeedbackActionButton
            className="overlay"
            aria-label="Đóng"
            onClick={() => {
              setEditing(null);
              setAdding(false);
            }}
          />
          <aside className="detail-panel user-edit-panel">
            <div className="detail-header">
              <div>
                <p>QUẢN TRỊ HỆ THỐNG</p>
                <h2>{editing ? "Sửa bộ phận" : "Thêm bộ phận"}</h2>
              </div>
              <FeedbackActionButton
                onClick={() => {
                  setEditing(null);
                  setAdding(false);
                }}
              >
                ×
              </FeedbackActionButton>
            </div>
            <form className="edit-user-form" onSubmit={saveDepartment} onInvalid={() => notifyActionFailure("Thông tin bắt buộc còn thiếu hoặc chưa hợp lệ. Kiểm tra các trường được đánh dấu trước khi tiếp tục.")}>
              <label>
                <span>Mã bộ phận *</span>
                <input
                  name="code"
                  required
                  readOnly={!!editing}
                  defaultValue={form.code}
                  placeholder="Ví dụ: KHSX"
                />
              </label>
              <label>
                <span>Tên bộ phận *</span>
                <input name="name" required defaultValue={form.name} />
              </label>
              <label>
                <span>Công ty</span>
                <select name="company" defaultValue={form.company}>
                  <option>SHINTUNG</option>
                </select>
              </label>
              <label>
                <span>Trạng thái</span>
                <select name="active" defaultValue={String(form.active)}>
                  <option value="true">Hoạt động</option>
                  <option value="false">Ngưng</option>
                </select>
              </label>
              <label className="department-description">
                <span>Mô tả</span>
                <textarea name="description" defaultValue={form.description} />
              </label>
              <div className="edit-user-actions">
                <span />
                <span />
                <FeedbackActionButton
                  type="button"
                  className="ghost-button"
                  onClick={() => {
                    setEditing(null);
                    setAdding(false);
                  }}
                >
                  Hủy
                </FeedbackActionButton>
                <FeedbackActionButton className="primary-button" disabled={saving} disabledExplanation={"Thao tác đang được xử lý. Vui lòng chờ hoàn tất rồi thử lại."} type="submit">
                  {saving ? "Đang lưu…" : "Lưu lại"}
                </FeedbackActionButton>
              </div>
            </form>
          </aside>
        </>
      )}
      {permissionDepartment && (
        <>
          <FeedbackActionButton
            className="overlay"
            aria-label="Đóng"
            onClick={() => setPermissionDepartment(null)}
          />
          <aside className="drawer department-permission-panel">
            <div className="drawer-title">
              <div>
                <span>PHÂN QUYỀN THEO BỘ PHẬN</span>
                <h2>{permissionDepartment.name}</h2>
                <p>
                  Người dùng chọn “Kế thừa quyền bộ phận” sẽ nhận đúng các quyền
                  dưới đây.
                </p>
              </div>
              <FeedbackActionButton onClick={() => setPermissionDepartment(null)}>×</FeedbackActionButton>
            </div>
            <div className="department-permission-body">
              <PermissionMatrix
                value={selectedPermissions}
                onChange={setSelectedPermissions}
              />
              <div className="permission-selection-note">
                Đã chọn <b>{selectedPermissions.length}</b> quyền. Quyền Xác
                nhận và Hủy xác nhận luôn được chọn riêng.
              </div>
              <div className="edit-user-actions">
                <span />
                <span />
                <FeedbackActionButton
                  className="ghost-button"
                  onClick={() => setPermissionDepartment(null)}
                >
                  Hủy
                </FeedbackActionButton>
                <FeedbackActionButton
                  className="primary-button"
                  disabled={saving} disabledExplanation={"Thao tác đang được xử lý. Vui lòng chờ hoàn tất rồi thử lại."}
                  onClick={saveTemplate}
                >
                  {saving ? "Đang lưu…" : "Lưu quyền bộ phận"}
                </FeedbackActionButton>
              </div>
            </div>
          </aside>
        </>
      )}
    </main>
  );
}
const initialPermissionRecords: PermissionRecord[] = initialSystemUsers.map(
  (user) => ({
    company: user.company || "SHINTUNG",
    department: user.department || "SHINTUNG",
    login: user.login,
    name: user.name,
    phone: user.phone,
    mobile: user.mobile,
    permissions: temporaryPermissions(user),
    permissionMode: "CUSTOM" as const,
    active: user.active,
  }),
);

let permissionRecordsCache: PermissionRecord[] | null = null;
let permissionRecordsPromise: Promise<PermissionRecord[]> | null = null;

function rememberPermissionRecords(records: PermissionRecord[]) {
  if (typeof window === "undefined") return records;
  permissionRecordsCache = records;
  if (LOCAL_TEST && typeof window !== "undefined")
    localStorage.setItem("onspa-permission-records", JSON.stringify(records));
  return records;
}

function cachedPermissionRecords() {
  if (typeof window === "undefined") return null;
  if (permissionRecordsCache) return permissionRecordsCache;
  if (!LOCAL_TEST || typeof window === "undefined") return null;
  try {
    const saved = JSON.parse(
      localStorage.getItem("onspa-permission-records") || "null",
    );
    if (Array.isArray(saved)) permissionRecordsCache = saved;
  } catch {}
  return permissionRecordsCache;
}

function loadPermissionRecords() {
  const browser = typeof window !== "undefined";
  const session = clientSessionGeneration();
  if (browser && permissionRecordsPromise) return permissionRecordsPromise;
  const request = Promise.all([
    recordFetch("/api/records?entity=users").then((response) =>
      response.ok ? response.json() : Promise.reject(),
    ),
    recordFetch("/api/records?entity=permissions").then((response) =>
      response.ok ? response.json() : Promise.reject(),
    ),
  ])
    .then(([userData, permissionData]) => {
      assertCurrentClientSession(session);
      const savedUsers = new Map<string, SystemUser & { _deleted?: boolean }>(
        userData.records.map(
          (record: {
            key: string;
            payload: SystemUser & { _deleted?: boolean };
          }) => [record.key, record.payload],
        ),
      );
      const sourceUsers = LOCAL_TEST ? initialSystemUsers : [];
      const users = sourceUsers
        .filter((user) => !savedUsers.get(user.login)?._deleted)
        .map((user) => savedUsers.get(user.login) || user);
      for (const [key, user] of savedUsers)
        if (!user._deleted && !users.some((item) => item.login === key))
          users.push(user);
      const defaults = users.map((user) => ({
        company: user.company || "SHINTUNG",
        department: user.department || "SHINTUNG",
        login: user.login,
        name: user.name,
        phone: user.phone,
        mobile: user.mobile,
        permissions: LOCAL_TEST ? temporaryPermissions(user) : "",
        permissionMode: "DEPARTMENT" as const,
        active: user.active,
      }));
      const saved = new Map<string, PermissionRecord & { _deleted?: boolean }>(
        permissionData.records.map(
          (record: {
            key: string;
            payload: PermissionRecord & { _deleted?: boolean };
          }) => [record.key, record.payload],
        ),
      );
      const merged = defaults
        .map((record) =>
          saved.has(record.login)
            ? {
                ...record,
                ...saved.get(record.login)!,
                ...(saved.get(record.login)?._deleted ? {active:false} : {}),
                company: record.company,
                department: record.department,
                name: record.name,
              }
            : record,
        );
      for (const [key, record] of saved)
        if (!record._deleted && !merged.some((item) => item.login === key))
          merged.push({
            ...record,
            permissionMode: record.permissionMode || "CUSTOM",
          });
      return rememberPermissionRecords(merged);
    })
    .catch(error => {
      assertCurrentClientSession(session);
      if (isClientSessionReadCancelled(error)) throw error;
      return cachedPermissionRecords() || (LOCAL_TEST ? initialPermissionRecords : []);
    })
    .finally(() => {
      if (permissionRecordsPromise === request) permissionRecordsPromise = null;
    });
  if (browser) permissionRecordsPromise = request;
  return request;
}

function PermissionManagement() {
  const session = useRef(clientSessionGeneration()).current;
 const [toolbarSearchOpen,setToolbarSearchOpen]=useState(false);
 const [toolbarSearchField,setToolbarSearchField]=useState(1);

  const { departments } = useDepartmentRecords();
  const [users, setUsers] = useState<SystemUser[]>(
    () => cachedSystemUsers() || [],
  );
  const [records, setRecords] = useState<PermissionRecord[]>(
    () =>
      cachedPermissionRecords() || (LOCAL_TEST ? initialPermissionRecords : []),
  );
  const [loadingRecords,setLoadingRecords] = useState(true);
  const [setupOpen,setSetupOpen]=useState(false);
  const [templates,setTemplates]=useState<Record<string,{active:boolean;permissions:string}>>({});
  const reloadPermissions=async()=>{if(session!==clientSessionGeneration())return;setLoadingRecords(true);try{permissionRecordsCache=null;permissionRecordsPromise=null;systemUsersPromise=null;const [nextUsers,nextRecords,response]=await Promise.all([loadSystemUsers(),loadPermissionRecords(),recordFetch("/api/records?entity=department_permissions")]);assertCurrentClientSession(session);setUsers(nextUsers);setRecords(nextRecords);if(response.ok){const body=await response.json();setTemplates(Object.fromEntries(body.records.filter((r:any)=>!r.payload._deleted).map((r:any)=>[r.key,r.payload])));}}catch(error){if(!isClientSessionReadCancelled(error))throw error;}finally{setLoadingRecords(false)}};
  const [departmentFilter, setDepartmentFilter] = useState("Tất cả bộ phận");
  const [permissionQuery, setPermissionQuery] = useState("");
  const [editing, setEditing] = useState<PermissionRecord | null>(null);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [permissionMode, setPermissionMode] = useState<"DEPARTMENT" | "CUSTOM">(
    "DEPARTMENT",
  );
  const [selectedLogin, setSelectedLogin] = useState("");
  useEffect(()=>{void reloadPermissions();},[]);
  const normalizedPermissionQuery = permissionQuery
    .trim()
    .toLocaleLowerCase("vi");
  const filteredRecords = records.filter(
    (record) =>
      (departmentFilter === "Tất cả bộ phận" ||
        record.department === departmentFilter) &&
      (!normalizedPermissionQuery ||
        `${record.login} ${record.name}`
          .toLocaleLowerCase("vi")
          .includes(normalizedPermissionQuery)),
  );
  useEffect(() => {
    if (editing) {
      const targetUser = users.find((user) => user.login === editing.login);
      const superAdmin = isSuperAdminUser(targetUser);
      setSelectedPermissions(
        superAdmin
          ? allSystemPermissions()
          : targetUser?.authMode === "quick_line" ? quickLinePermissions
          : editing.permissions
            ? editing.permissions.split(" · ")
            : [],
      );
      setPermissionMode(
        superAdmin || targetUser?.authMode === "quick_line" ? "CUSTOM" : editing.permissionMode || "CUSTOM",
      );
      setSelectedLogin(editing.login);
    } else if (adding) {
      setSelectedPermissions([]);
      setPermissionMode("DEPARTMENT");
      setSelectedLogin("");
    }
  }, [editing, adding, users]);
  const selectedUser = users.find((user) => user.login === selectedLogin);
  const selectedIsSuperAdmin = isSuperAdminUser(selectedUser);
  const selectedIsLine=selectedUser?.authMode === "quick_line";
  const formRecord =
    editing ||
    (selectedUser
      ? {
          company: selectedUser.company,
          department: selectedUser.department,
          login: selectedUser.login,
          name: selectedUser.name,
          phone: selectedUser.phone,
          mobile: selectedUser.mobile,
          permissions: "",
          permissionMode: "DEPARTMENT" as const,
          active: selectedUser.active,
        }
      : {
          company: "SHINTUNG",
          department: "KHSX",
          login: "",
          name: "",
          phone: "",
          mobile: "",
          permissions: "",
          permissionMode: "DEPARTMENT" as const,
          active: true,
        });
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if(selectedIsLine)return;
    const data = new FormData(event.currentTarget);
    const login = String(data.get("login")).trim();
    const targetUser = users.find((user) => user.login === login);
    const targetIsSuperAdmin = isSuperAdminUser(targetUser);
    const record: PermissionRecord = {
      company: String(data.get("company")),
      department: String(data.get("department")),
      login,
      name: String(data.get("name")).trim(),
      phone: formRecord.phone || "",
      mobile: formRecord.mobile || "",
      // SUPER_ADMIN receives full access from the backend role. Keeping the
      // persisted record in department mode prevents stale full grants if the
      // account is later downgraded to a normal user.
      permissions: targetIsSuperAdmin
        ? ""
        : permissionMode === "CUSTOM"
          ? selectedPermissions.join(" · ")
          : "",
      permissionMode: targetIsSuperAdmin ? "DEPARTMENT" : permissionMode,
      active: targetIsSuperAdmin
        ? targetUser?.active !== false
        : data.get("active") === "true",
    };
    if (
      !targetIsSuperAdmin &&
      permissionMode === "CUSTOM" &&
      !record.permissions
    ) {
      setNotice("Vui lòng chọn ít nhất một quyền thao tác.");
      return;
    }
    setSaving(true);
    const response = await recordFetch("/api/records", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entity: "permissions",
        key: record.login,
        payload: record,
        updatedBy: "sample_user_15",
      }),
    });
    setSaving(false);
    if (!response.ok) {
      setNotice(
        await adminApiError(
          response,
          "Không thể lưu phân quyền. Vui lòng thử lại. / 無法儲存權限，請再試一次。",
        ),
      );
      return;
    }
    setRecords((current) => {
      if (session !== clientSessionGeneration()) return current;
      const next = editing
        ? current.map((item) => (item.login === editing.login ? record : item))
        : [...current.filter((item) => item.login !== record.login), record];
      rememberPermissionRecords(next);
      return next;
    });
    setNotice(
      targetIsSuperAdmin
        ? "Đã xác nhận toàn quyền hệ thống cho SUPER_ADMIN. / 已確認超級管理員擁有完整系統權限。"
        : editing
          ? "Đã cập nhật phân quyền. / 已更新權限。"
          : "Đã thêm phân quyền mới. / 已新增權限。",
    );
    setEditing(null);
    setAdding(false);
  };
  const remove = async () => {
    if (!editing || !confirm(`Xóa phân quyền của ${editing.login}?`)) return;
    setSaving(true);
    const response = await recordFetch("/api/records", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entity: "permissions",
        key: editing.login,
        payload: {
          ...editing,
          _deleted: true,
          deletedAt: new Date().toISOString(),
        },
        updatedBy: "sample_user_15",
      }),
    });
    setSaving(false);
    if (!response.ok) {
      setNotice(
        await adminApiError(
          response,
          "Không thể xóa phân quyền. Vui lòng thử lại. / 無法刪除權限，請再試一次。",
        ),
      );
      return;
    }
    setRecords((current) => {
      if (session !== clientSessionGeneration()) return current;
      const next = current.filter((item) => item.login !== editing.login);
      rememberPermissionRecords(next);
      return next;
    });
    setEditing(null);
    setNotice("Đã xóa phân quyền. / 已刪除權限。");
  };
  return (
    <main data-report-auto-preview="false" className="workspace">
      <div className="page-heading">
        <div>
          <p className="eyebrow">QUẢN TRỊ HỆ THỐNG</p>
          <PageTitle variant="menu-root">Phân quyền người dùng</PageTitle>
          <p>User nội bộ có quyền Xem tất cả menu nghiệp vụ. Quyền thao tác vẫn theo bộ phận hoặc quyền riêng đã lưu; user Line chỉ xem Quản lý sản xuất theo Line của mình.</p>
        </div>
        <span className="permission-heading-note">
          SUPER_ADMIN luôn có toàn quyền trên toàn bộ website
        </span>
      </div>
      <AdminOperationNotice message={notice} onClose={() => setNotice("")} />
      <section className="data-card user-content-card">
        <StandardToolbar name="PermissionManagement" items={[toolbarConfig.action({onClick:()=>setSetupOpen(true)},"Bổ sung quyền theo user",true,"action"),toolbarConfig.note(<span>
            {loadingRecords
              ? "Đang tải dữ liệu..."
              : `${filteredRecords.length} phân quyền`}
          </span>),
toolbarConfig.action({onClick:()=>setToolbarSearchOpen(true)},"Tra cứu",true,"lookup"),
toolbarSearchOpen && toolbarConfig.group([toolbarConfig.field("TRA THEO",[toolbarConfig.select({value:toolbarSearchField,onChange:e=>{setToolbarSearchField(Number(e.target.value));setDepartmentFilter("Tất cả bộ phận");setPermissionQuery("");}},<><option value={0}>Bộ phận</option><option value={1}>Tên đăng nhập / Họ tên</option></>)]),toolbarSearchField === 0 && toolbarConfig.field("NỘI DUNG TRA",[toolbarConfig.select({"value": departmentFilter,"onChange": (event) => setDepartmentFilter(event.target.value)},<><option>Tất cả bộ phận</option>{departments.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.name}
                  </option>
                ))}</>)]),toolbarSearchField === 1 && toolbarConfig.field("NỘI DUNG TRA",[toolbarConfig.input({"value": permissionQuery,"onChange": (event) => setPermissionQuery(event.target.value),"placeholder": "ID hoặc họ tên người dùng"})]),toolbarConfig.action({onClick:()=>{setDepartmentFilter("Tất cả bộ phận");setPermissionQuery("");}},"Xóa lọc",true,"clear"),toolbarConfig.action({onClick:()=>{}},"Tìm kiếm",true,"search"),toolbarConfig.action({onClick:()=>{setDepartmentFilter("Tất cả bộ phận");setPermissionQuery("");setToolbarSearchOpen(false)}},"Quay lại",true,"back")])]} />
        <DataTable className="table-wrap">
          <table data-no-pagination="true">
            <thead>
              <tr>
                <th>CÔNG TY</th>
                <th>BỘ PHẬN</th>
                <th>ID ĐĂNG NHẬP</th>
                <th>HỌ VÀ TÊN</th>
                <th>QUYỀN ĐƯỢC CẤP</th>
                <th>TRẠNG THÁI</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loadingRecords ? (
                <tr data-no-data="true">
                  <DataCell colSpan={7} className="permission-loading">
                    Đang tải dữ liệu phân quyền đã lưu...
                  </DataCell>
                </tr>
              ) : (
                filteredRecords.map((record) => {
                  const systemUser = users.find(
                    (user) => user.login === record.login,
                  );
                  const superAdmin = isSuperAdminUser(systemUser);
                  const isLine=systemUser?.authMode === "quick_line";
                  const effectivePermissions = superAdmin ? allSystemPermissions() : isLine ? quickLinePermissions : withBusinessViews((record.permissionMode === "DEPARTMENT" ? (templates[record.department]?.active ? templates[record.department].permissions : "") : record.permissions).split(" · ").filter(Boolean),record.active);
                  return (
                    <tr key={record.login}>
                      <DataCell kind="code">{record.company}</DataCell>
                      <DataCell>{departmentName(departments, record.department)}</DataCell>
                      <DataCell kind="code" className="user-login">{record.login}</DataCell>
                      <DataCell>{record.name}</DataCell>
                      <DataCell>
                        <details className="permission-summary">
                          <summary>
                            {superAdmin
                              ? `Toàn quyền hệ thống · ${effectivePermissions.length} quyền`
                              : isLine ? `Xem Quản lý sản xuất · Báo công Line ${systemUser?.line}` : record.permissionMode === "DEPARTMENT"
                                ? effectivePermissions.length ? `${effectivePermissions.length} quyền hiệu lực · bộ phận + Xem nghiệp vụ` : "Chưa cấp quyền bộ phận"
                                : record.permissions
                                  ? `${effectivePermissions.length} quyền hiệu lực · quyền riêng + Xem nghiệp vụ`
                                  : record.active ? "Xem tất cả menu nghiệp vụ" : "Quyền ngưng hoạt động"}
                          </summary>
                          <div>
                            {superAdmin ? (
                              <>
                                <span>
                                  <b>
                                    SUPER_ADMIN — toàn quyền theo vai trò, không
                                    phụ thuộc quyền bộ phận.
                                  </b>
                                </span>
                                {effectivePermissions.map((permission) => (
                                  <span key={permission}>{permission}</span>
                                ))}
                              </>
                            ) : (effectivePermissions.length ? effectivePermissions.map(permission=><span key={permission}>{permission}</span>) : <span>Chưa có quyền thao tác.</span>                            )}
                          </div>
                        </details>
                      </DataCell>
                      <DataCell>
                        <span
                          className={
                            (
                              superAdmin
                                ? systemUser?.active !== false
                                : record.active
                            )
                              ? "done-badge"
                              : "version-old"
                          }
                        >
                          {(
                            superAdmin
                              ? systemUser?.active !== false
                              : record.active
                          )
                            ? "Hoạt động"
                            : "Ngưng"}
                        </span>
                      </DataCell>
                      <DataCell>
                        <FeedbackActionButton
                          className="edit-user-link"
                          onClick={() => setEditing(record)}
                        >
                          Sửa đổi
                        </FeedbackActionButton>
                      </DataCell>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </DataTable>
      </section>
      {setupOpen && <UserPermissionSetup onClose={()=>setSetupOpen(false)} onApplied={()=>{void reloadPermissions();setNotice("Đã lưu quyền theo bộ phận và nhật ký thay đổi.");}}/>}
      {(editing || adding) && (
        <>
          <FeedbackActionButton
            className="overlay"
            aria-label="Đóng"
            onClick={() => {
              setEditing(null);
              setAdding(false);
            }}
          />
          <aside className="drawer user-edit-panel">
            <div className="drawer-title">
              <div>
                <span>QUẢN TRỊ HỆ THỐNG</span>
                <h2>{editing ? "Sửa phân quyền" : "Thêm phân quyền"}</h2>
              </div>
              <FeedbackActionButton
                onClick={() => {
                  setEditing(null);
                  setAdding(false);
                }}
              >
                ×
              </FeedbackActionButton>
            </div>
            <form className="edit-user-form" onSubmit={save} onInvalid={() => notifyActionFailure("Thông tin bắt buộc còn thiếu hoặc chưa hợp lệ. Kiểm tra các trường được đánh dấu trước khi tiếp tục.")}>
              <label>
                <span>Công ty</span>
                <select name="company" defaultValue={formRecord.company}>
                  <option>SHINTUNG</option>
                </select>
              </label>
              <label>
                <span>Bộ phận</span>
                <input
                  name="department"
                  readOnly
                  value={formRecord.department}
                />
              </label>
              <label>
                <span>ID đăng nhập *</span>
                {editing ? (
                  <input
                    name="login"
                    required
                    readOnly
                    value={formRecord.login}
                  />
                ) : (
                  <select
                    name="login"
                    required
                    value={selectedLogin}
                    onChange={(event) => setSelectedLogin(event.target.value)}
                  >
                    <option value="">Chọn người dùng</option>
                    {users
                      .filter(
                        (user) =>
                          user.active &&
                          !records.some(
                            (record) => record.login === user.login,
                          ),
                      )
                      .map((user) => (
                        <option key={user.login} value={user.login}>
                          {user.login} · {user.name}
                        </option>
                      ))}
                  </select>
                )}
              </label>
              <label>
                <span>Họ và tên *</span>
                <input name="name" required readOnly value={formRecord.name} />
              </label>
              <label className="permission-mode-field">
                <span>Cách áp dụng quyền</span>
                <select
                  disabled={selectedIsSuperAdmin || selectedIsLine}
                  value={permissionMode}
                  onChange={(event) =>
                    setPermissionMode(
                      event.target.value as "DEPARTMENT" | "CUSTOM",
                    )
                  }
                >
                  <option value="DEPARTMENT">Kế thừa quyền bộ phận</option>
                  <option value="CUSTOM">Tùy chỉnh quyền cá nhân</option>
                </select>
                <small>
                  {selectedIsSuperAdmin
                    ? "SUPER_ADMIN tự động có toàn bộ quyền và không thể bị bỏ quyền tại ma trận này."
                    : permissionMode === "DEPARTMENT"
                      ? `Sử dụng quyền mặc định của ${departmentName(departments, formRecord.department)}.`
                      : "Chỉ các ô được chọn bên dưới mới có hiệu lực."}
                </small>
              </label>
              <div className="permission-field">
                <span>QUYỀN TÙY CHỈNH CHI TIẾT</span>
                <PermissionMatrix
                  value={selectedPermissions}
                  onChange={setSelectedPermissions}
                  disabled={selectedIsSuperAdmin || selectedIsLine || permissionMode !== "CUSTOM"}
                />
                <ExistingPermissionGrants existing={(editing?.permissions || "").split(" · ").filter(Boolean)} known={allSystemPermissions()} value={selectedPermissions} onChange={setSelectedPermissions} disabled={selectedIsSuperAdmin || selectedIsLine || permissionMode !== "CUSTOM"}/>
                <small>
                  {selectedIsSuperAdmin
                    ? `Đã cấp đủ ${selectedPermissions.length} quyền trên toàn bộ website theo vai trò SUPER_ADMIN.`
                    : permissionMode === "CUSTOM"
                      ? `Đã chọn ${selectedPermissions.length} quyền thao tác. Không chọn Xác nhận nếu người dùng không được duyệt dữ liệu.`
                      : "Ma trận khóa vì người dùng đang kế thừa quyền bộ phận."}
                </small>
              </div>
              <label>
                <span>Trạng thái</span>
                <select
                  name="active"
                  disabled={selectedIsSuperAdmin || selectedIsLine}
                  defaultValue={String(
                    selectedIsSuperAdmin
                      ? selectedUser?.active !== false
                      : formRecord.active,
                  )}
                >
                  <option value="true">Hoạt động</option>
                  <option value="false">Ngưng</option>
                </select>
              </label>
              <div className="edit-user-actions">
                {editing && !selectedIsSuperAdmin && !selectedIsLine && (
                  <FeedbackActionButton
                    type="button"
                    className="delete-user-button"
                    onClick={remove}
                  >
                    Xóa phân quyền
                  </FeedbackActionButton>
                )}
                <span />
                <FeedbackActionButton
                  type="button"
                  className="ghost-button"
                  onClick={() => {
                    setEditing(null);
                    setAdding(false);
                  }}
                >
                  Hủy
                </FeedbackActionButton>
                <FeedbackActionButton
                  type="submit"
                  className="primary-button"
                  disabled={saving || selectedIsLine} disabledExplanation={saving ? "Thao tác đang được xử lý. Vui lòng chờ hoàn tất rồi thử lại." : "Không thể sửa tài khoản Line tại biểu mẫu này."}
                >
                  {saving ? "Đang lưu..." : "Lưu lại"}
                </FeedbackActionButton>
              </div>
            </form>
          </aside>
        </>
      )}
    </main>
  );
}

type DataStatusCounts = Record<string, number>;


function DataStatusView() {
  const monitored = [
    ["users", "Quản lý người dùng"],
    ["departments", "Danh mục bộ phận"],
    ["department_permissions", "Quyền mặc định theo bộ phận"],
    ["permissions", "Phân quyền"],
    ["sku", "SKU Master bổ sung trên web"],
    ["leadtime_versions", "Phiên bản Lead Time"],
    ["safety_rules", "Bộ quy tắc Safety Days"],
    ["safety_rule_groups", "Nhóm quy tắc Safety Days"],
    ["forecast", "Base Forecast đã lưu"],
    ["demand_event", "Demand Event đã lưu"],
    ["production_engine", "Dữ liệu Production Engine"],
    ["production_plan", "Production Plan"],
    ["in_transit", "In Transit"],
    ["production_report", "Báo công sản xuất"],
    ["inventory_snapshot", "Bản chốt tồn kho"],
    ["warehouse_docs", "Phiếu kho"],
  ] as const;
  const [counts, setCounts] = useState<DataStatusCounts>({});
  const [checking, setChecking] = useState(true);
  const [connected, setConnected] = useState(false);
  const [checkedAt, setCheckedAt] = useState("");
  const [lastError, setLastError] = useState("");
  const [readStatus, setReadStatus] = useState<"ok" | "unauthorized" | "forbidden" | "unavailable">("unavailable");
  const missingLine = skus.filter(
    (sku) => !sku.line || sku.line === "—",
  ).length;
  const missingLeadTime = skus.filter(
    (sku) => !leadtimeBySku.has(normalizeSkuCode(sku.code)),
  ).length;

  const refresh = async () => {
    setChecking(true);
    setLastError("");
    try {
      const response = await recordFetch('/api/data-status-counts', {cache:'no-store'});
      if (!response.ok) { const error = new Error(`HTTP ${response.status}`); (error as Error & {status?:number}).status = response.status; throw error; }
      const data = await response.json();
      if (!data.counts || typeof data.counts !== 'object') throw new Error('Invalid counts');
      const next: DataStatusCounts = {};
      for (const [entity] of monitored) {
        const count = data.counts[entity];
        if (typeof count !== 'number' || !Number.isFinite(count) || count < 0) throw new Error('Invalid count for '+entity);
        else next[entity] = count;
      }
      setCounts(next);
      setConnected(true);
      setReadStatus("ok");
    } catch (error) {
      const readFailure = dataStatusReadState(error);
      setReadStatus(readFailure.kind);
      setCounts({});
      setConnected(false);
      setLastError(readFailure.message);
    }
    setCheckedAt(new Date().toISOString());
    setChecking(false);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const exportIssues = () => {
    const rows = [
      ["Hạng mục", "Số lượng", "Trạng thái"],
      [
        "SKU thiếu Line",
        String(missingLine),
        missingLine ? "Cần kiểm tra" : "Tốt",
      ],
      [
        "SKU thiếu Lead Time",
        String(missingLeadTime),
        missingLeadTime ? "Cần kiểm tra" : "Tốt",
      ],
      ["Bản sao lưu D1 đã kiểm chứng", "0", "Chưa thiết lập"],
      ["R2", "0", "Chưa cấu hình"],
      ["Migration nền", "1", "Đã nhận diện"],
    ];
    const csv = `\uFEFF${rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\r\n")}`;
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `ONSPA-tinh-trang-du-lieu-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="workspace data-status-workspace">
      <div className="page-heading compact-heading">
        <div>
          <p className="eyebrow">QUẢN TRỊ HỆ THỐNG</p>
          <PageTitle variant="menu-root">Tình trạng dữ liệu</PageTitle>
          <p>
            Giám sát chỉ đọc; không cho phép sửa dữ liệu gốc tại màn hình này.
          </p>
        </div>
        <div className="data-status-actions">
          <FeedbackActionButton className="outline-button" onClick={exportIssues}>
            Xuất báo cáo lỗi
          </FeedbackActionButton>
          <FeedbackActionButton
            className="primary-button"
            disabled={checking} disabledExplanation={"Đang kiểm tra trạng thái. Vui lòng chờ hoàn tất rồi làm mới."}
            onClick={() => void refresh()}
          >
            {checking ? "Đang kiểm tra..." : "Làm mới"}
          </FeedbackActionButton>
        </div>
      </div>
      <section className="data-status-summary">
        <article>
          <span>KẾT NỐI CƠ SỞ DỮ LIỆU</span>
          <b className={connected ? "status-good" : "status-error"}>
            {checking
              ? "Đang kiểm tra"
              : connected
                ? "D1 đang kết nối"
                : readStatus === "unauthorized" ? "Cần đăng nhập" : readStatus === "forbidden" ? "Không có quyền xem dữ liệu quản trị" : "Mất kết nối"}
          </b>
          <small>Kiểm tra thông qua API phía máy chủ</small>
        </article>
        <article>
          <span>MÔI TRƯỜNG HIỆN TẠI</span>
          <b className="status-warning">DEVELOPMENT / TEST</b>
          <small>Website đang trong giai đoạn điều chỉnh</small>
        </article>
        <article>
          <span>KIỂM TRA GẦN NHẤT</span>
          <b>{checkedAt ? formatDateTimeDisplay(checkedAt) : "—"}</b>
          <small>{lastError || "Không phát hiện lỗi đọc API"}</small>
        </article>
        <article>
          <span>SAO LƯU D1 GẦN NHẤT</span>
          <b className="status-warning">Chưa thiết lập</b>
          <small>Chưa có bản sao D1 được kiểm chứng</small>
        </article>
      </section>
      <section className="data-card data-status-card">
        <div className="section-title">
          <div>
            <h2>Số lượng bản ghi trên máy chủ</h2>
            <p>
              Số lượng bên dưới chỉ phản ánh dữ liệu đang có trong D1; dữ liệu
              JSON được báo riêng.
            </p>
          </div>
        </div>
        <DataTable className="table-wrap">
          <table data-no-pagination="true">
            <thead>
              <tr>
                <th>PHÂN HỆ</th>
                <th>NGUỒN</th>
                <th>SỐ BẢN GHI</th>
                <th>TRẠNG THÁI</th>
              </tr>
            </thead>
            <tbody>
              {monitored.map(([entity, label]) => (
                <tr key={entity}>
                  <DataCell>{label}</DataCell>
                  <DataCell>D1 · app_records</DataCell>
                  <DataCell>{checking ? "…" : (counts[entity] ?? "Lỗi")}</DataCell>
                  <DataCell>
                    <span
                      className={
                        counts[entity] === undefined && !checking
                          ? "data-status-bad"
                          : "data-status-ok"
                      }
                    >
                      {counts[entity] === undefined && !checking
                        ? "Không đọc được"
                        : "Đã kiểm tra"}
                    </span>
                  </DataCell>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>
      </section>
      <section className="data-status-grid">
        <article>
          <h2>Dữ liệu đóng gói cùng website</h2>
          <dl>
            <div>
              <dt>SKU Master JSON</dt>
              <dd>{skus.length}</dd>
            </div>
            <div>
              <dt>Lead Time JSON</dt>
              <dd>{leadtimeRows.length}</dd>
            </div>
            <div>
              <dt>Tồn kho ERP JSON</dt>
              <dd>{inventoryErpRows.length}</dd>
            </div>
            <div>
              <dt>BOM JSON</dt>
              <dd>{bomCatalog.length}</dd>
            </div>
          </dl>
          <p>Dữ liệu này chưa phải dữ liệu trung tâm hoàn chỉnh.</p>
        </article>
        <article>
          <h2>Cảnh báo chất lượng dữ liệu</h2>
          <dl>
            <div>
              <dt>SKU thiếu Line</dt>
              <dd className={missingLine ? "status-warning" : "status-good"}>
                {missingLine}
              </dd>
            </div>
            <div>
              <dt>SKU thiếu Lead Time</dt>
              <dd
                className={missingLeadTime ? "status-warning" : "status-good"}
              >
                {missingLeadTime}
              </dd>
            </div>
            <div>
              <dt>R2 lưu file</dt>
              <dd className="status-warning">Chưa cấu hình</dd>
            </div>
            <div>
              <dt>Migration</dt>
              <dd>1 migration nền</dd>
            </div>
          </dl>
          <p>
            Chưa có bảng system_errors và chưa có kiểm tra snapshot kế hoạch đầy
            đủ.
          </p>
        </article>
      </section>
    </main>
  );
}

type AdminAuditEntry = {
  action?: string;
  actor?: string;
  at?: string;
  entity?: string;
  key?: string;
  target?: string;
  loginMode?: string;
};
function AdminAuditView() { return <p>Không có dữ liệu mẫu trong bản xuất source.</p>; }

function UserContent({ section }: { section: string }) {
  if (section === "feedback") return <FeedbackInbox language={toolbarLocale()} />;
  if (section === "users-list") return <UserManagementV2 />;
  if (section === "departments") return <DepartmentManagement />;
  if (section === "permissions") return <PermissionManagement />;
  if (section === "versions") return <VersionManagement />;
  if (section === "data-status") return <DataStatusView />;
  if (section === "backup-restore") return <StorageHandover />;
  if (section === "audit") return <AdminAuditView />;
  if (section === "test-log") return <WebsiteTestLog language={toolbarLocale()} />;
  const [adding, setAdding] = useState(false);
  const [saved, setSaved] = useState(false);
  const title =
    section === "users-list"
      ? "Quản lý người dùng"
      : section === "permissions"
        ? "Phân quyền người dùng"
        : "Nhật ký thao tác";
  return (
    <main className="workspace">
      <div className="page-heading">
        <div>
          <p className="eyebrow">QUẢN TRỊ HỆ THỐNG</p>
          <PageTitle>{title}</PageTitle>
          <p>Quản lý tài khoản và quyền thao tác theo từng bộ phận.</p>
        </div>
        {section === "users-list" && (
          <FeedbackActionButton className="primary-button" onClick={() => setAdding(true)}>
            ＋ Thêm người dùng
          </FeedbackActionButton>
        )}
      </div>
      {adding && section === "users-list" && (
        <section className="data-card add-user-card">
          <div className="form-title">
            <div>
              <h2>Thêm người dùng</h2>
              <p>Nhập thông tin tài khoản mới, sau đó bấm Lưu lại.</p>
            </div>
            <FeedbackActionButton onClick={() => setAdding(false)}>×</FeedbackActionButton>
          </div>
          <form
            className="user-form"
            onSubmit={(e) => {
              e.preventDefault();
              setSaved(true);
              setAdding(false);
            }} onInvalid={() => notifyActionFailure("Thông tin bắt buộc còn thiếu hoặc chưa hợp lệ. Kiểm tra các trường được đánh dấu trước khi tiếp tục.")}
          >
            <label>
              <span>Công ty lệ thuộc</span>
              <select defaultValue="SHINTUNG">
                <option>SHINTUNG</option>
              </select>
            </label>
            <label>
              <span>Bộ phận lệ thuộc</span>
              <select defaultValue="Kế hoạch sản xuất">
                <option>Kế hoạch sản xuất</option>
                <option>Sản xuất</option>
                <option>Kho</option>
                <option>QC</option>
              </select>
            </label>
            <label>
              <span>ID đăng nhập *</span>
              <input required placeholder="Ví dụ: nguyenvana" />
            </label>
            <label>
              <span>Họ và tên *</span>
              <input required placeholder="Nhập họ tên người dùng" />
            </label>
            <label>
              <span>Mật khẩu tạm thời *</span>
              <input required type="password" placeholder="Tối thiểu 8 ký tự" />
            </label>
            <label>
              <span>Nhập lại mật khẩu *</span>
              <input required type="password" placeholder="Nhập lại mật khẩu" />
            </label>
            <label>
              <span>Điện thoại</span>
              <input placeholder="Số điện thoại" />
            </label>
            <label>
              <span>Email</span>
              <input type="email" placeholder="sample@example.invalid" />
            </label>
            <label>
              <span>Vai trò</span>
              <select>
                <option>KHSX</option>
                <option>Sản xuất</option>
                <option>Kho</option>
                <option>QC</option>
                <option>Quản trị</option>
              </select>
            </label>
            <label>
              <span>Cho phép đăng nhập</span>
              <select>
                <option>Có</option>
                <option>Không</option>
              </select>
            </label>
            <div className="form-actions">
              <FeedbackActionButton
                type="button"
                className="ghost-button"
                onClick={() => setAdding(false)}
              >
                Hủy
              </FeedbackActionButton>
              <FeedbackActionButton type="submit" className="primary-button">
                Lưu lại
              </FeedbackActionButton>
            </div>
          </form>
        </section>
      )}
      {saved && (
        <div className="save-notice">
          Đã lưu người dùng mới vào danh sách mô phỏng.
        </div>
      )}
      <section className="data-card user-content-card">
        <StandardToolbar name="UserContent" items={[toolbarConfig.group([toolbarConfig.field(<><span>BỘ PHẬN</span></>,[toolbarConfig.select({},<><option>Tất cả bộ phận</option><option>Kế hoạch sản xuất</option><option>Sản xuất</option><option>Kho</option></>)]),
toolbarConfig.field(<><span>TÌM KIẾM</span></>,[toolbarConfig.input({"placeholder": "ID hoặc họ tên người dùng"})])]),
toolbarConfig.note(<span>{saved ? "3" : "2"} người dùng</span>)]} />
        <DataTable className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>CÔNG TY</th>
                <th>BỘ PHẬN</th>
                <th>ID ĐĂNG NHẬP</th>
                <th>HỌ VÀ TÊN</th>
                <th>VAI TRÒ / QUYỀN CHÍNH</th>
                <th>TRẠNG THÁI</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <DataCell kind="code">SHINTUNG</DataCell>
                <DataCell>Kế hoạch sản xuất</DataCell>
                <DataCell>sample_user_15</DataCell>
                <DataCell>Nhân viên mẫu 104</DataCell>
                <DataCell>
                  {section === "permissions"
                    ? "Forecast · Demand Event · 05 · 06 · Mở LSX"
                    : "KHSX"}
                </DataCell>
                <DataCell>
                  <span className="done-badge">Hoạt động</span>
                </DataCell>
                <DataCell>
                  <FeedbackActionButton className="calc-button" disabled disabledExplanation="Chức năng này chưa được kết nối thao tác tại màn hình hiện tại.">Sửa đổi</FeedbackActionButton>
                </DataCell>
              </tr>
              <tr>
                <DataCell kind="code">SHINTUNG</DataCell>
                <DataCell>Sản xuất</DataCell>
                <DataCell>sanxuat01</DataCell>
                <DataCell>Người dùng Sản xuất</DataCell>
                <DataCell>
                  {section === "permissions"
                    ? "Nhận LSX · Báo công · Trả tiến độ"
                    : "Sản xuất"}
                </DataCell>
                <DataCell>
                  <span className="done-badge">Hoạt động</span>
                </DataCell>
                <DataCell>
                  <FeedbackActionButton className="calc-button" disabled disabledExplanation="Chức năng này chưa được kết nối thao tác tại màn hình hiện tại.">Sửa đổi</FeedbackActionButton>
                </DataCell>
              </tr>
              {saved && (
                <tr>
                  <DataCell kind="code">SHINTUNG</DataCell>
                  <DataCell>Kế hoạch sản xuất</DataCell>
                  <DataCell>nguoidungmoi</DataCell>
                  <DataCell>Người dùng mới</DataCell>
                  <DataCell>KHSX</DataCell>
                  <DataCell>
                    <span className="done-badge">Hoạt động</span>
                  </DataCell>
                  <DataCell>
                    <FeedbackActionButton className="calc-button" disabled disabledExplanation="Chức năng này chưa được kết nối thao tác tại màn hình hiện tại.">Sửa đổi</FeedbackActionButton>
                  </DataCell>
                </tr>
              )}
            </tbody>
          </table>
        </DataTable>
      </section>
    </main>
  );
}

function BackupRestorePreparation() {
  const unavailable =
    "Đang khóa an toàn: chưa có xác thực Super Admin tại backend và chưa cấu hình kho ZIP phía máy chủ.";
  const readiness = [
    [
      "Công cụ Windows",
      "Đã sẵn sàng để test",
      "Tải bộ cài và chạy trên máy có ổ F:",
    ],
    [
      "Quản trị viên cao nhất",
      "Chưa kích hoạt",
      "Phải xác thực và kiểm tra quyền tại backend",
    ],
    [
      "Nơi lưu trên máy Windows",
      "Sẵn sàng kiểm tra",
      "F:\\CompanyBackups · không chia sẻ qua mạng",
    ],
    [
      "Lịch tự động",
      "Có bộ cài thử nghiệm",
      "12:00 thứ Bảy theo giờ của máy Windows",
    ],
    [
      "Khôi phục thử",
      "Chỉ thư mục test",
      "Không kết nối và không ghi vào database production",
    ],
    [
      "Database D1 thật",
      "Đang khóa",
      "Chờ API xác thực riêng và kho ZIP phía backend",
    ],
  ];
  return (
    <main className="workspace backup-workspace">
      <div className="page-heading compact-heading">
        <div>
          <p className="eyebrow">QUẢN TRỊ HỆ THỐNG</p>
          <PageTitle variant="menu-root">Sao lưu và khôi phục</PageTitle>
          <p>
            Kiểm thử quy trình lưu cục bộ trên Windows mà không tác động dữ liệu
            chính thức.
          </p>
        </div>
        <span className="backup-preparation-badge">TEST LOCAL AN TOÀN</span>
      </div>

      <section
        className="backup-status-grid"
        aria-label="Trạng thái hệ thống sao lưu"
      >
        <article>
          <span>MÔI TRƯỜNG WEBSITE</span>
          <b>Cloudflare Sites + D1</b>
          <small>Database thật chưa được xuất trong chế độ test</small>
        </article>
        <article>
          <span>THƯ MỤC TRÊN WINDOWS</span>
          <b>F:\\CompanyBackups</b>
          <small>Do chương trình trên máy tính quản lý</small>
        </article>
        <article>
          <span>SAO LƯU GẦN NHẤT</span>
          <b>Chưa đồng bộ</b>
          <small>Website không đọc trực tiếp ổ F:</small>
        </article>
        <article>
          <span>LỊCH TEST</span>
          <b>Thứ Bảy · 12:00</b>
          <small>Cài bằng Windows Task Scheduler</small>
        </article>
      </section>

      <section className="backup-local-kit">
        <div>
          <span>DỮ LIỆU TEST CỤC BỘ</span>
          <h2>Sao lưu và chuẩn bị folder bàn giao</h2>
          <p>
            Chạy npm run db:export trong terminal của Project để xuất JSON có
            ngày giờ. Chạy npm run handoff để kiểm tra và tạo folder gửi Sếp.
            Xem README.md để nhập lại dữ liệu TEST.
          </p>
        </div>
        <p>
          Bộ ZIP Windows cũ chưa tích hợp API TEST này; không dùng để sao lưu
          database local mới.
        </p>
      </section>

      <section className="data-card backup-card">
        <div className="section-title backup-section-title">
          <div>
            <h2>Trạng thái thiết lập</h2>
            <p>
              Phân biệt rõ phần có thể thử trên Windows và phần backend vẫn bị
              khóa.
            </p>
          </div>
        </div>
        <DataTable className="table-wrap">
          <table className="backup-readiness-table" data-no-pagination="true">
            <thead>
              <tr>
                <th>HẠNG MỤC</th>
                <th>TRẠNG THÁI</th>
                <th>YÊU CẦU TIẾP THEO</th>
              </tr>
            </thead>
            <tbody>
              {readiness.map(([item, status, next]) => (
                <tr key={item}>
                  <DataCell>
                    <b>{item}</b>
                  </DataCell>
                  <DataCell>
                    <span className="backup-waiting">{status}</span>
                  </DataCell>
                  <DataCell>{next}</DataCell>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>
      </section>

      <section className="data-card backup-card">
        <div className="section-title backup-section-title">
          <div>
            <h2>Danh sách bản sao lưu trên website</h2>
            <p>
              Website không thể đọc trực tiếp F:\\CompanyBackups; danh sách này
              chỉ hoạt động khi có API backend an toàn.
            </p>
          </div>
          <div className="backup-actions">
            <FeedbackActionButton className="outline-button" disabled disabledExplanation={unavailable} title={unavailable}>
              Quét lại
            </FeedbackActionButton>
            <FeedbackActionButton className="primary-button" disabled disabledExplanation={unavailable} title={unavailable}>
              Sao lưu ngay
            </FeedbackActionButton>
          </div>
        </div>
        <div className="backup-empty">
          <span>⛁</span>
          <b>Chưa có bản sao lưu</b>
          <p>
            Hãy chạy bộ PowerShell trên máy Windows để tạo và kiểm tra gói
            TEST_LOCAL.
          </p>
        </div>
      </section>

      <section className="backup-safety-note">
        <b>Database chính thức được bảo vệ</b>
        <span>
          Bộ test chỉ giải nén vào F:\\CompanyBackups\\restore-test. Nút khôi
          phục production và API xuất D1 vẫn bị khóa cho đến khi có Super Admin
          backend và staging.
        </span>
      </section>
    </main>
  );
}

type ModuleVersion = {
  group: string;
  menu: string;
  code: string;
  version: string;
  date: string;
  status: "Đang sử dụng" | "Phiên bản cũ";
  user: string;
  previous: string;
  change: string;
  impact: string;
};
const currentModuleVersions: Array<[string, string, string]> = [
  ["Quản trị hệ thống", "Quản lý người dùng", "USR"],
  ["Quản trị hệ thống", "Thiết lập bộ phận", "DEPT"],
  ["Quản trị hệ thống", "Phân quyền", "PERM"],
  ["Quản trị hệ thống", "Nhật ký thao tác", "AUD"],
  ["Quản trị hệ thống", "Quản lý phiên bản", "VER"],
  ["Quản trị hệ thống", "Tình trạng dữ liệu", "DATA"],
  ["Quản trị hệ thống", "Sao lưu và khôi phục", "BKP"],
  ["Dữ liệu cơ bản", "SKU Master", "SKU"],
  ["Dữ liệu cơ bản", "Danh sách nhân viên", "EMP"],
  ["Dữ liệu cơ bản", "Leadtime", "LT"],
  ["Dữ liệu cơ bản", "Quy tắc Safety Days", "SDR"],
  ["Quản lý kho", "Tổng quan", "WH-OV"],
  ["Quản lý kho", "Tồn kho ERP", "INV"],
  ["Quản lý kho", "Chốt tồn tuần", "STK"],
  ["Quản lý kho", "Nhập kho", "WH-IN"],
  ["Quản lý kho", "Xuất kho", "WH-OUT"],
  ["Quản lý kho", "Chuyển kho", "WH-TR"],
  ["Quản lý kho", "Phiếu kho", "WH-DOC"],
  ["Quản lý kho", "Kiểm kê", "WH-COUNT"],
  ["Quản lý kho", "Báo cáo", "WH-RPT"],
  ["Cấu trúc thành phẩm", "Dữ liệu lượng dùng BOM", "BOM"],
  ["Cấu trúc thành phẩm", "Phiếu thay đổi BOM", "BOM-DC"],
  ["Kế hoạch sản xuất", "Base_forecast", "BF"],
  ["Kế hoạch sản xuất", "Demand_event", "DE"],
  ["Kế hoạch sản xuất", "Production_engine", "PE"],
  ["Kế hoạch sản xuất", "Quy tắc áp dụng", "PE-RULE"],
  ["Kế hoạch sản xuất", "Production_plan", "PP"],
  ["Kế hoạch sản xuất", "In_transit", "IT"],
  ["Kế hoạch sản xuất", "Report", "RPT"],
  ["Quản lý sản xuất", "Báo công sản xuất", "PROD"],
  ["Quản lý sản xuất", "Điều chỉnh nhân lực", "LAB"],
  ["Quản lý sản xuất", "Khôi phục dữ liệu", "REC"],
  ["Quản lý sản xuất", "Capacity tuần", "CAP"],
];
const moduleVersionHistory: ModuleVersion[] = [];
function VersionManagement() {
  const [group, setGroup] = useState("Tất cả nhóm menu");
  const [status, setStatus] = useState("Tất cả trạng thái");
  const [query, setQuery] = useState("");
  const [openVersion, setOpenVersion] = useState<string | null>(null);
  const groups = Array.from(new Set(moduleVersionHistory.map((r) => r.group)));
  const rows = moduleVersionHistory.filter((r) => {
    const q = query.trim().toLocaleLowerCase("vi");
    return (
      (group === "Tất cả nhóm menu" || r.group === group) &&
      (status === "Tất cả trạng thái" || r.status === status) &&
      (!q ||
        `${r.menu} ${r.code} ${r.version}`.toLocaleLowerCase("vi").includes(q))
    );
  });
  return (
    <main className="workspace version-workspace">
      <div className="page-heading compact-heading">
        <div>
          <p className="eyebrow">QUẢN TRỊ HỆ THỐNG</p>
          <PageTitle variant="menu-root">Quản lý phiên bản</PageTitle>
          <p>
            Theo dõi phiên bản hiện hành và lịch sử thay đổi riêng của từng menu
            con.
          </p>
        </div>
      </div>
      <section className="data-card version-card">
        <div className="version-filters">
          <label>
            <span>NHÓM MENU</span>
            <select value={group} onChange={(e) => setGroup(e.target.value)}>
              <option>Tất cả nhóm menu</option>
              {groups.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
          <label>
            <span>TÌM MENU / MÃ PHIÊN BẢN</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ví dụ: Production_engine hoặc PE"
            />
          </label>
          <label>
            <span>TRẠNG THÁI</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option>Tất cả trạng thái</option>
              <option>Đang sử dụng</option>
              <option>Phiên bản cũ</option>
            </select>
          </label>
        </div>
        <div className="version-count">
          <b>{rows.length}</b> phiên bản được tìm thấy
        </div>
        <DataTable className="table-wrap version-table-wrap">
          <table className="version-table">
            <thead>
              <tr>
                <th>NHÓM MENU</th>
                <th>MENU CON</th>
                <th>MÃ CHỨC NĂNG</th>
                <th>PHIÊN BẢN</th>
                <th>NGÀY ÁP DỤNG</th>
                <th>TRẠNG THÁI</th>
                <th>NGƯỜI CẬP NHẬT</th>
                <th>CHI TIẾT</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Fragment key={`${r.menu}-${r.version}`}>
                  <tr>
                    <DataCell kind="code">{r.group}</DataCell>
                    <DataCell>
                      <b>{r.menu}</b>
                    </DataCell>
                    <DataCell kind="code" className="version-code">{r.code}</DataCell>
                    <DataCell kind="number" className="version-number">{r.version}</DataCell>
                    <DataCell kind="date">{r.date}</DataCell>
                    <DataCell>
                      <span
                        className={
                          r.status === "Đang sử dụng"
                            ? "version-current"
                            : "version-old"
                        }
                      >
                        {r.status}
                      </span>
                    </DataCell>
                    <DataCell>{r.user}</DataCell>
                    <DataCell>
                      <FeedbackActionButton
                        className="table-link"
                        onClick={() =>
                          setOpenVersion(
                            openVersion === r.version ? null : r.version,
                          )
                        }
                      >
                        {openVersion === r.version ? "Thu gọn" : "Xem thay đổi"}
                      </FeedbackActionButton>
                    </DataCell>
                  </tr>
                  {openVersion === r.version && (
                    <tr className="version-detail-row">
                      <DataCell colSpan={8}>
                        <div className="version-detail">
                          <div>
                            <span>NỘI DUNG THAY ĐỔI</span>
                            <b>{r.change}</b>
                          </div>
                          <div>
                            <span>PHIÊN BẢN TRƯỚC</span>
                            <b>{r.previous}</b>
                          </div>
                          <div>
                            <span>ẢNH HƯỞNG DỮ LIỆU</span>
                            <b>{r.impact}</b>
                          </div>
                        </div>
                      </DataCell>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </DataTable>
        <div className="version-rule-note">
          <b>Quy tắc tạo mã:</b> Mã chức năng – YYYYMMDD – số lần cập nhật trong
          ngày. Mỗi menu con chỉ có một phiên bản “Đang sử dụng”; các phiên bản
          trước được giữ lại để tra cứu.
        </div>
      </section>
    </main>
  );
}

type StockRow = {
  sku: string;
  name: string;
  spec: string;
  unit: string;
  warehouse: string;
  location: string;
  lot: string;
  onHand: number;
  inTransit: number;
  updated: string;
  age: number;
};
type InventorySafetyMetric = {
  dailyDemand: number;
  leadTime: number;
  safetyDays: number;
  safetyStock: number;
  rop: number;
};
const erpDisplayRows: StockRow[] = inventoryErpRows.map((row) => ({
  sku: row.sku,
  name: row.name,
  spec: row.spec || "—",
  unit: row.unit || "—",
  warehouse: `KHO ${row.warehouse}`,
  location: "—",
  lot: "—",
  onHand: row.qty,
  inTransit: 0,
  updated: inventoryDisplayTime(row.snapshotAt),
  age: 0,
}));

const inventoryRowsForDisplay = (rows: InventoryErpRow[]): StockRow[] =>
  rows.map((row) => ({
    sku: row.sku,
    name: row.name,
    spec: row.spec || "—",
    unit: row.unit || "—",
    warehouse: `KHO ${row.warehouse}`,
    location: "—",
    lot: "—",
    onHand: row.qty,
    inTransit: 0,
    updated: inventoryDisplayTime(row.snapshotAt),
    age: 0,
  }));

const excelColumnIndex = (reference: string) => {
  const letters = reference.match(/[A-Z]+/i)?.[0]?.toUpperCase() || "A";
  return [...letters].reduce(
    (value, letter) => value * 26 + letter.charCodeAt(0) - 64,
    0,
  ) - 1;
};

const inventoryHeader = (value: unknown) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

async function readInventoryExcel(file: File): Promise<{
  rows: InventoryErpRow[];
  skippedWarehouseRows: number;
}> {
  if (!file.name.toLowerCase().endsWith(".xlsx"))
    throw Error(`File “${file.name}” không đúng định dạng .xlsx.`);
  if (!file.size) throw Error(`File “${file.name}” đang trống.`);
  let archive: ReturnType<typeof unzipSync>;
  try {
    archive = unzipSync(new Uint8Array(await file.arrayBuffer()));
  } catch {
    throw Error(
      `Không mở được file “${file.name}”. File có thể bị hỏng, đặt mật khẩu hoặc không phải Excel .xlsx hợp lệ.`,
    );
  }
  const sheetPath = Object.keys(archive)
    .filter((path) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(path))
    .sort()[0];
  if (!sheetPath)
    throw Error(`File “${file.name}” không có sheet dữ liệu để nhập.`);
  const sharedXml = archive["xl/sharedStrings.xml"];
  const parser = new DOMParser();
  const sharedStrings = sharedXml
    ? [...parser.parseFromString(strFromU8(sharedXml), "application/xml").getElementsByTagName("si")].map(
        (item) =>
          [...item.getElementsByTagName("t")]
            .map((node) => node.textContent || "")
            .join(""),
      )
    : [];
  const document = parser.parseFromString(
    strFromU8(archive[sheetPath]),
    "application/xml",
  );
  if (document.getElementsByTagName("parsererror").length)
    throw Error("Không đọc được nội dung file Excel.");
  const values = [...document.getElementsByTagName("row")].map((row) => {
    const cells: unknown[] = [];
    [...row.getElementsByTagName("c")].forEach((cell) => {
      const index = excelColumnIndex(cell.getAttribute("r") || "A1");
      const type = cell.getAttribute("t");
      const raw = cell.getElementsByTagName("v")[0]?.textContent || "";
      const inline = [...cell.getElementsByTagName("t")]
        .map((node) => node.textContent || "")
        .join("");
      cells[index] =
        type === "s"
          ? sharedStrings[Number(raw)] || ""
          : type === "inlineStr"
            ? inline
            : raw;
    });
    return cells;
  });
  const required = ["MA SP", "TEN SP", "QUY CACH", "DV", "KHO", "SL TON KHO"];
  const headers = (values[0] || []).slice(0, 6).map(inventoryHeader);
  if (required.some((name, index) => headers[index] !== name))
    throw Error(
      `Sai cấu trúc cột. Cần đúng thứ tự: Mã SP, Tên SP, Quy cách, ĐV, Kho, SL tồn kho. File đang có: ${headers.map((item) => item || "(trống)").join(", ")}.`,
    );
  const importedAt = new Date().toISOString();
  let skippedWarehouseRows = 0;
  const rows = values.slice(1).flatMap((row, index) => {
    const warehouse = String(row[4] || "").trim().toUpperCase();
    if (!["TP", "KD"].includes(warehouse)) {
      if (row.some((value) => String(value || "").trim()))
        skippedWarehouseRows += 1;
      return [];
    }
    const sku = String(row[0] || "").trim().toUpperCase();
    if (!sku)
      throw Error(`Dòng ${index + 2}: Kho là ${warehouse} nhưng Mã SP đang trống.`);
    const qty = Number(row[5]);
    if (!Number.isFinite(qty) || qty < 0)
      throw Error(
        `Dòng ${index + 2} – SKU ${sku}: “SL tồn kho” phải là số từ 0 trở lên; giá trị hiện tại là “${String(row[5] ?? "trống")}”.`,
      );
    return [{
      sku,
      name: String(row[1] || "").trim(),
      spec: String(row[2] || "").trim(),
      unit: String(row[3] || "").trim(),
      warehouse: warehouse as "TP" | "KD",
      qty,
      snapshotAt: importedAt,
    }];
  });
  if (!rows.length)
    throw Error(
      `Không có dòng tồn kho hợp lệ. Hệ thống chỉ nhận các dòng có cột Kho là TP hoặc KD; đã bỏ qua ${skippedWarehouseRows} dòng.`,
    );
  return { rows, skippedWarehouseRows };
}
const stockRows: StockRow[] = [];
const warehouseTransactions = [] as { id: string; time: string; type: string; from: string; to: string; items: number; qty: number; status: string; user: string; }[];
const warehouseStatus = (status: string) => (
  <span
    className={
      status.includes("Đã cập nhật")
        ? "done-badge"
        : status.includes("lệch") || status.includes("lỗi")
          ? "change-badge"
          : "pending-badge"
    }
  >
    {status}
  </span>
);

function WarehouseFilters() {
  return (
    <div className="warehouse-filters">
      <label>
        <span>TỪ NGÀY</span>
        <input type="date" defaultValue="2026-08-01" />
      </label>
      <label>
        <span>ĐẾN NGÀY</span>
        <input type="date" defaultValue="2026-08-28" />
      </label>
      <label>
        <span>SKU / MÃ PHIẾU ERP</span>
        <input placeholder="Nhập mã, tên SKU hoặc mã phiếu" />
      </label>
      <label>
        <span>KHO</span>
        <select>
          <option>Tất cả kho</option>
          <option>KHO TP</option>
          <option>KHO KD</option>
        </select>
      </label>
      <label>
        <span>VỊ TRÍ / SỐ LÔ</span>
        <input placeholder="Vị trí hoặc số lô" />
      </label>
      <label>
        <span>TRẠNG THÁI</span>
        <select>
          <option>Tất cả trạng thái</option>
          <option>Chờ xác nhận cập nhật</option>
          <option>Đã cập nhật kho</option>
          <option>Có chênh lệch</option>
          <option>Đã hủy phiếu</option>
        </select>
      </label>
      <FeedbackActionButton className="row-action" disabled disabledExplanation="Chức năng này chưa được kết nối thao tác tại màn hình hiện tại.">Tra cứu</FeedbackActionButton>
    </div>
  );
}

function WarehouseContent({
  section,
  onOpenSku,
  initialSku,
  initialSkuRequest,
  operator,
}: {
  section: string;
  onOpenSku: (code: string) => void;
  initialSku?: string;
  initialSkuRequest?: number;
  operator: string;
}) {
  const warehouseApproval = useContext(ApprovalNavigationContext);
  useEffect(()=>{if(warehouseApproval?.entity === "warehouse_in")setReceiveTab("production");},[warehouseApproval?.sequence]);
  const session = useRef(clientSessionGeneration()).current;
  const skuCatalog = useContext(BusinessSkuContext);
  const [receiveTab, setReceiveTab] = useState<"production" | "erp">(
    "production",
  );
  const [receiptSearchOpen,setReceiptSearchOpen]=useState(false);
  const [notice, setNotice] = useState("");
  const [noticeKind, setNoticeKind] = useState<"success" | "error">("success");
  const [inventoryRows, setInventoryRows] = useState<InventoryErpRow[]>(
    () => inventoryImportsCache?.find((record) => !record._deleted)?.rows || [],
  );
  const [inventoryImports, setInventoryImports] = useState<InventoryImportRecord[]>(
    () => inventoryImportsCache || [],
  );
  const [selectedInventoryImportKey, setSelectedInventoryImportKey] = useState(
    () => inventoryImportsCache?.find((record) => !record._deleted)?.key || "",
  );
  const [inventorySafety, setInventorySafety] = useState(
    new Map<string, InventorySafetyMetric>(),
  );
  const [inventorySearchField, setInventorySearchField] = useState("sku");
  const [showInventorySearch, setShowInventorySearch] = useState(false);
  const [inventorySearchDraft, setInventorySearchDraft] = useState(initialSku || "");
  const [inventorySearch, setInventorySearch] = useState({ field: "sku", value: initialSku || "" });
  useEffect(()=>{if(initialSku){setInventorySearchField("sku");setInventorySearchDraft(initialSku);setInventorySearch({field:"sku",value:initialSku});}},[initialSku,initialSkuRequest]);
  const [belowSafetyOnly, setBelowSafetyOnly] = useState(false);
  const [importingInventory, setImportingInventory] = useState(false);
  const inventoryFileRef = useRef<HTMLInputElement>(null);
  const [snapshots, setSnapshots] = useState<InventorySnapshot[]>([]);
  const [snapshotsLoaded, setSnapshotsLoaded] = useState(false);
  const [snapshotWeek, setSnapshotWeek] = useState("");
  const [commitWeek, setCommitWeek] = useState("");
  const [commitImportKey, setCommitImportKey] = useState("");
  const [cancellingImport, setCancellingImport] = useState<InventoryImportRecord | null>(null);
  const [showSnapshotHistory, setShowSnapshotHistory] = useState(false);
  const [showImportHistory, setShowImportHistory] = useState(false);
  const [selectedImportDiff, setSelectedImportDiff] = useState<{
    current: InventoryImportRecord;
    previous?: InventoryImportRecord;
    changes: InventoryImportChange[];
  } | null>(null);
  const [showSnapshotConfirm, setShowSnapshotConfirm] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] =
    useState<InventorySnapshot | null>(null);
  const [reopening, setReopening] = useState<InventorySnapshot | null>(null);
  const [savingSnapshot, setSavingSnapshot] = useState(false);
  const selectedWeekKey = snapshotWeek ? weekKeyOf(snapshotWeek) : "";
  const activeImports = inventoryImports.filter((item) => !item._deleted);
  const snapshotForImport = (item: InventoryImportRecord) => snapshots.find((snapshot) =>
    snapshot.sourceImportKey === item.key || !!item.snapshotId && snapshot.id === item.snapshotId,
  );
  const importIsClosed = (item: InventoryImportRecord) => {
    const snapshot = snapshotForImport(item);
    return !!snapshot && ['Đã chốt', 'Đã được Production_engine sử dụng'].includes(snapshot.status);
  };
  const chottableImports = activeImports.filter(item=>item.status!=='Đã chốt'&&(!item.weekKey||!snapshots.some(s=>s.weekKey===item.weekKey&&['Đã chốt','Đã được Production_engine sử dụng'].includes(s.status))));
  const latestImportsByWeek = activeImports.filter(
    (item, index, list) => item.weekKey &&
      list.findIndex((candidate) => candidate.weekKey === item.weekKey) === index,
  );
  const selectedImport = inventoryImports.find(
    (item) => !item._deleted && item.key === selectedInventoryImportKey && (!item.weekKey || item.weekKey === selectedWeekKey),
  ) || (selectedWeekKey ? activeImports.find((item) => item.weekKey === selectedWeekKey) : undefined);
  const runInventorySearch = () => {
    if (inventorySearchField === "week_import") {
      const record = latestImportsByWeek.find((item) => item.key === inventorySearchDraft);
      if (record) {
        setSelectedInventoryImportKey(record.key);
        setSnapshotWeek(weekKeyOf(record.weekKey));
        setInventoryRows(record.rows);
      }
      return;
    }
    if (inventorySearchField === "upload_history") {
      setShowImportHistory(true);
      return;
    }
    if (inventorySearchField === "snapshot_history") {
      setShowSnapshotHistory(true);
      return;
    }
    setInventorySearch({ field: inventorySearchField, value: inventorySearchDraft });
  };
  useEffect(() => {
    if (section !== "inventory") return;
    loadInventoryImports()
      .then((records) => {
        setInventoryImports(records);
        const latest = records.find((item) => !item._deleted);
        if (!latest) return;
        setSelectedInventoryImportKey(latest.key);
        setSnapshotWeek(latest.weekKey || "");
        setInventoryRows(latest.rows);
      })
      .catch((error) => {
        setNoticeKind("error");
        setNotice(error instanceof Error ? error.message : "Không thể tải dữ liệu tồn kho theo tuần.");
      });
    loadInventorySnapshots()
      .then(setSnapshots)
      .catch(() => setNotice("Không thể tải lịch sử chốt tồn."))
      .finally(() => setSnapshotsLoaded(true));
  }, [section]);
  useEffect(() => {
    if (section !== "inventory") return;
    const selectedRecord = inventoryImports.find(
      (item) => !item._deleted && item.key === selectedInventoryImportKey && (!item.weekKey || item.weekKey === selectedWeekKey),
    );
    const record = selectedRecord || (selectedWeekKey ? activeImports.find((item) => item.weekKey === selectedWeekKey) : undefined);
    if (!record) {
      setInventoryRows([]);
      return;
    }
    if (record.key !== selectedInventoryImportKey) setSelectedInventoryImportKey(record.key);
    setInventoryRows(record.rows);
  }, [section, selectedWeekKey, selectedInventoryImportKey, inventoryImports]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 30_000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (section !== "inventory" || !snapshotWeek) return;
    let active = true;
    Promise.all([
      loadForecastRecords(),
      recordFetch("/api/records?entity=leadtime_versions").then((response) =>
        response.ok ? response.json() : { records: [] },
      ),
      recordFetch("/api/records?entity=safety_rules").then((response) =>
        response.ok ? response.json() : { records: [] },
      ),
    ])
      .then(([forecasts, leadData, ruleData]) => {
        if (!active) return;
        const versions: LeadTimeVersion[] = leadData.records
          .map((item: { payload: LeadTimeVersion }) => item.payload)
          .filter((item: LeadTimeVersion) => !item._deleted);
        const rules: SafetyRuleSet[] = ruleData.records
          .map((item: { payload: SafetyRuleSet }) => item.payload)
          .filter((item: SafetyRuleSet) => !item._deleted);
        const weekStart = mondayOf(new Date(`${snapshotWeek}T00:00:00`));
        const thursday = new Date(weekStart);
        thursday.setDate(thursday.getDate() + 3);
        const month = `${String(thursday.getMonth() + 1).padStart(2, "0")}/${thursday.getFullYear()}`;
        const period = forecasts.filter(
          (row) => (row.applicationMonth || row.month) === month,
        );
        const useReportRows = period.some((row) => row.sourceReportMonth);
        const forecastBySku = new Map(
          period
            .filter((row) => !useReportRows || row.sourceReportMonth)
            .map((row) => [normalizeSkuCode(row.sku), calculateForecastDemand(row)]),
        );
        const rule = rules
          .filter(
            (item) =>
              item.status === "Đang áp dụng" &&
              item.effectiveFrom <= snapshotWeek &&
              (!item.effectiveTo || item.effectiveTo >= snapshotWeek),
          )
          .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
        const next = new Map<string, InventorySafetyMetric>();
        skuCatalog.forEach((sku) => {
          const code = normalizeSkuCode(sku.code);
          const forecast = forecastBySku.get(code);
          if (!forecast) return;
          const version = activeLeadTimeAt(
            versions,
            code,
            `${snapshotWeek}T00:00:00+07:00`,
          );
          const fallbackLead = leadtimeBySku.get(code)?.leadTime;
          const leadTime = Number(version?.leadTime ?? fallbackLead ?? 0);
          const matchedSafety = rule?.leadTimeRules
            ?.filter(
              (item) =>
                item.status === "Đang áp dụng" &&
                (!item.sku || normalizeSkuCode(item.sku) === code) &&
                (!item.group || item.group === sku.group) &&
                leadTime >= item.from &&
                (item.to === null || leadTime <= item.to),
            )
            .sort(
              (a, b) =>
                Number(!!b.sku) * 2 +
                Number(!!b.group) -
                Number(!!a.sku) * 2 -
                Number(!!a.group),
            )[0];
          const dailyDemand = Number(forecast.used || 0);
          const safetyDays = Number(matchedSafety?.days || 0);
          next.set(code, {
            dailyDemand,
            leadTime,
            safetyDays,
            safetyStock: dailyDemand * safetyDays,
            rop: dailyDemand * (leadTime + safetyDays),
          });
        });
        setInventorySafety(next);
      })
      .catch(() => setInventorySafety(new Map()));
    return () => {
      active = false;
    };
  }, [section, snapshotWeek, skuCatalog]);
  const importInventory = async (file: File) => {
    const feedbackScope = actionFeedbackScope();
    setImportingInventory(true);
    setNotice("");
    try {
      const { rows, skippedWarehouseRows } = await readInventoryExcel(file);
      const response = await fetch("/api/inventory-import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "upload", sourceFile: file.name, rows,
        }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw Error(result.error || "Không thể lưu dữ liệu tồn kho.");
      }
      const data = await response.json();
      const importedRecord: InventoryImportRecord = data.record;
      setSnapshotWeek("");
      setInventoryRows(rows);
      const nextImports = [importedRecord, ...inventoryImports];
      inventoryImportsCache = nextImports;
      setInventoryImports(nextImports);
      setSelectedInventoryImportKey(importedRecord.key);
      setNoticeKind("success");
      setNotice(
        `Đã tải ${rows.length.toLocaleString("vi-VN")} dòng tồn kho. File đang chờ chốt, chưa gắn tuần kế hoạch${skippedWarehouseRows ? `; đã bỏ qua ${skippedWarehouseRows.toLocaleString("vi-VN")} dòng không thuộc kho TP hoặc KD` : ""}.`,
      );
    } catch (error) {
      setNoticeKind("error");
      (feedbackScope === actionFeedbackScope() && notifyActionFailure("Không thể hoàn tất thao tác. Vui lòng kiểm tra dữ liệu và thử lại."), setNotice(error instanceof Error ? error.message : "Không đọc được file Excel."));
    } finally {
      setImportingInventory(false);
    }
  };
  const activeWeekSnapshot = snapshots.find(
    (item) =>
      weekKeyOf(item.weekKey) === selectedWeekKey &&
      ["Đã chốt", "Đã được Production_engine sử dụng"].includes(item.status),
  );
  const reopenableWeekSnapshots = snapshots.filter(
    (item) =>
      weekKeyOf(item.weekKey) === selectedWeekKey &&
      ["Đã chốt", "Đã được Production_engine sử dụng"].includes(item.status),
  );
  const createSnapshot = async () => {
    if (!commitWeek || !commitImportKey) {
      setNoticeKind("error");
      setNotice("Chọn file Excel và tuần kế hoạch trước khi chốt tồn.");
      return;
    }
    setSavingSnapshot(true);
    try {
      const response = await fetch("/api/inventory-import", {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"commit",key:commitImportKey,week:weekKeyOf(commitWeek)})});
      const data = await response.json();
      if(!response.ok)throw Error(data.error || "Không thể chốt tồn kho.");
      const next:InventorySnapshot=data.snapshot;
      const nextSnapshots = [next, ...snapshots.map((item) => item.id===next.replacesSnapshotId?{...item,status:"Đã thay thế bằng phiên bản mới" as const,replacedBySnapshotId:next.id}:item)];
      inventorySnapshotsCache = nextSnapshots;
      setSnapshots(nextSnapshots);
      const nextImports=inventoryImports.map((item)=>item.key===data.record.key?data.record:item);
      inventoryImportsCache=nextImports;
      setInventoryImports(nextImports);
      setSelectedInventoryImportKey(data.record.key);
      setSnapshotWeek(next.weekKey);
      setInventoryRows(data.record.rows);
      setShowSnapshotConfirm(false);
      setCommitImportKey("");setCommitWeek("");
      setNoticeKind("success");
      setNotice(
        `Đã chốt tồn tuần ${next.weekStart}–${next.weekEnd}. Mã chốt ${next.code}.`,
      );
    } catch (error) {
      setNoticeKind("error");
      setNotice(error instanceof Error?error.message:"Không thể chốt tồn kho. Vui lòng thử lại.");
    } finally {
      setSavingSnapshot(false);
    }
  };
  const cancelInventoryImport = async () => {
    if(!cancellingImport)return;
    setImportingInventory(true);
    try{
      const response=await fetch('/api/inventory-import',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'cancel',key:cancellingImport.key})});
      const data=await response.json();if(!response.ok)throw Error(data.error||'Không thể hủy bản tải.');
      const nextImports=inventoryImports.map(item=>item.key===data.record.key?data.record:item);
      inventoryImportsCache=nextImports;setInventoryImports(nextImports);
      if(selectedInventoryImportKey===data.record.key){setSelectedInventoryImportKey('');setInventoryRows([]);setSnapshotWeek('');}
      setCancellingImport(null);setNoticeKind('success');setNotice(`Đã hủy file ${data.record.sourceFile}. Dữ liệu được giữ trong lịch sử tải Excel.`);
    }catch(error){setNoticeKind('error');setNotice(error instanceof Error?error.message:'Không thể hủy bản tải.');}
    finally{setImportingInventory(false);}
  };
  const reopenSnapshot = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!reopening) return;
    const reason = String(
      new FormData(event.currentTarget).get("reason") || "",
    ).trim();
    if (!reason) return;
    setSavingSnapshot(true);
    try {
      const opened = {
        ...reopening,
        status: "Đã mở chốt" as const,
        reopenReason: reason,
        reopenedBy: operator,
        reopenedAt: new Date().toISOString(),
      };
      await saveInventorySnapshot(opened, operator);
      setSnapshots((current) => {
        if (session !== clientSessionGeneration()) return current;
        const next = current.map((item) => (item.id === opened.id ? opened : item));
        inventorySnapshotsCache = next;
        return next;
      });
      setReopening(null);
      setNoticeKind("success");
      setNotice(
        `Đã mở bản chốt ${opened.code}. Bản cũ được giữ nguyên trong lịch sử; Kho có thể chốt lại tuần này.`,
      );
    } catch {
      setNoticeKind("error");
      setNotice("Không thể mở chốt. Vui lòng thử lại.");
    } finally {
      setSavingSnapshot(false);
    }
  };
  const titles: Record<string, string> = {
    "warehouse-overview": "Tổng quan kho thành phẩm",
    inventory: "Tồn kho ERP (Kho TP + Kho KD)",
    "warehouse-in": "Nhập kho",
    "warehouse-out": "Xuất kho",
    "warehouse-transfer": "Chuyển kho TP sang KD",
    "warehouse-docs": "Phiếu kho",
    "warehouse-count": "Kiểm kê",
    "warehouse-report": "Báo cáo kho",
  };
  const currentErpDisplayRows = useMemo(
    () => inventoryRowsForDisplay(inventoryRows),
    [inventoryRows],
  );
  const filteredStock = currentErpDisplayRows.filter((row) => {
    const value = inventorySearch.value.trim().toLocaleLowerCase("vi");
    const haystack =
      inventorySearch.field === "name"
        ? row.name
        : inventorySearch.field === "warehouse"
          ? row.warehouse
          : inventorySearch.field === "unit"
            ? row.unit
            : row.sku;
    return !value || haystack.toLocaleLowerCase("vi").includes(value);
  });
  const safetyStockRows = Array.from(
    inventoryRows.reduce((rows, item) => {
      const sku = normalizeSkuCode(item.sku);
      const current = rows.get(sku) || {
        sku,
        name: item.name,
        spec: item.spec || "—",
        unit: item.unit || "—",
        tpQty: 0,
        kdQty: 0,
      };
      if (item.warehouse === "TP") current.tpQty += Number(item.qty || 0);
      if (item.warehouse === "KD") current.kdQty += Number(item.qty || 0);
      rows.set(sku, current);
      return rows;
    }, new Map<string, { sku: string; name: string; spec: string; unit: string; tpQty: number; kdQty: number }>()),
  )
    .map(([, row]) => {
      const metric = inventorySafety.get(row.sku);
      const totalQty = row.tpQty + row.kdQty;
      return {
        ...row,
        totalQty,
        metric,
        shortage: metric ? Math.max(0, metric.safetyStock - totalQty) : 0,
      };
    })
    .filter((row) => row.metric && row.totalQty < row.metric.safetyStock)
    .filter((row) => {
      const value = inventorySearch.value.trim().toLocaleLowerCase("vi");
      if (!value) return true;
      const haystack = inventorySearch.field === "name"
        ? row.name
        : inventorySearch.field === "unit"
          ? row.unit
          : inventorySearch.field === "warehouse"
            ? `${row.tpQty > 0 ? "KHO TP" : ""} ${row.kdQty > 0 ? "KHO KD" : ""}`
            : row.sku;
      return haystack.toLocaleLowerCase("vi").includes(value);
    });
  const heading = (
    <div className="page-heading">
      <div>
        <p className="eyebrow">QUẢN LÝ KHO / KHO THÀNH PHẨM</p>
        <PageTitle variant="menu-root">{titles[section]}</PageTitle>
        <p>
          Dùng chung SKU Master từ Dữ liệu cơ bản; tồn kho được quản lý từ một
          nguồn dữ liệu giao dịch.
        </p>
      </div>
    </div>
  );
  if (section === "warehouse-overview")
    return (
      <main className="workspace warehouse-workspace">
        <RecordFiles
          module="warehouse"
          label="Ảnh / PDF phiếu ERP và tệp nhập kho"
        />
        {heading}
        <div className="warehouse-kpis">
          <div>
            <span>Tổng tồn hiện tại</span>
            <b>10.913</b>
            <small>5 SKU đang hiển thị</small>
          </div>
          <div>
            <span>Giá trị tồn kho</span>
            <b>1,84 tỷ</b>
            <small>Dữ liệu xem trước</small>
          </div>
          <div>
            <span>Nhập hôm nay</span>
            <b>2.600</b>
            <small>3 phiếu</small>
          </div>
          <div>
            <span>Xuất hôm nay</span>
            <b>2.060</b>
            <small>4 phiếu</small>
          </div>
          <div>
            <span>Phiếu chờ xác nhận</span>
            <b>3</b>
            <small>Cần Kho xử lý</small>
          </div>
          <div className="warning">
            <span>Tồn trên 90 ngày</span>
            <b>600</b>
            <small>1 SKU</small>
          </div>
          <div className="warning">
            <span>Cảnh báo cần xử lý</span>
            <b>2</b>
            <small>Chênh lệch / lỗi dữ liệu</small>
          </div>
        </div>
        <section className="data-card">
          <div className="section-title">
            <div>
              <h2>Giao dịch kho gần đây</h2>
              <p>Thời gian xác nhận được lưu đến giây.</p>
            </div>
          </div>
          <DataTable className="table-wrap">
            <table className="warehouse-transaction-table">
              <thead>
                <tr>
                  <th>MÃ PHIẾU ERP</th>
                  <th>NGÀY GIỜ</th>
                  <th>NGHIỆP VỤ</th>
                  <th>KHO XUẤT</th>
                  <th>KHO NHẬN</th>
                  <th>SỐ MẶT HÀNG</th>
                  <th>TỔNG SỐ LƯỢNG</th>
                  <th>TRẠNG THÁI</th>
                  <th>NGƯỜI XÁC NHẬN</th>
                </tr>
              </thead>
              <tbody>
                {warehouseTransactions.map((t) => (
                  <tr key={t.id}>
                    <DataCell>
                      <FeedbackActionButton className="sku-link" disabled disabledExplanation="Mã này chỉ dùng để tham khảo; chưa có thao tác chi tiết tại đây.">{t.id}</FeedbackActionButton>
                    </DataCell>
                    <DataCell kind="time">{t.time}</DataCell>
                    <DataCell>{t.type}</DataCell>
                    <DataCell>{t.from}</DataCell>
                    <DataCell>{t.to}</DataCell>
                    <DataCell kind="number" className="number">{t.items}</DataCell>
                    <DataCell kind="number" className="number">{t.qty.toLocaleString("vi-VN")}</DataCell>
                    <DataCell>{warehouseStatus(t.status)}</DataCell>
                    <DataCell>{t.user}</DataCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTable>
        </section>
      </main>
    );
  if (section === "inventory")
    return (
      <main data-report-auto-preview="false" className="workspace warehouse-workspace inventory-workspace">
        <div className="safety-rules-title"><PageTitle variant="menu-root">Tồn kho ERP</PageTitle></div>
        <section className="data-card">
          <StandardToolbar name="WarehouseContent" items={[toolbarConfig.group([toolbarConfig.group([toolbarConfig.input({"ref": inventoryFileRef,"type": "file","accept": ".xlsx","hidden": true,"onChange": (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void importInventory(file);
              }}),
toolbarConfig.action({"disabled": importingInventory, disabledExplanation: "Đang xử lý dữ liệu. Vui lòng chờ hoàn tất rồi thử lại.","onClick": () => inventoryFileRef.current?.click()},<>{importingInventory ? "Đang tải Excel..." : "↑ Tải Excel tồn kho"}</>, true, "action"),
toolbarConfig.action({"disabled":importingInventory||!activeImports.length, disabledExplanation: importingInventory ? "Đang xử lý dữ liệu. Vui lòng chờ hoàn tất rồi thử lại." : "Chưa có bản tải tồn kho đang hoạt động để hủy.","onClick":()=>{if(selectedImport&&!importIsClosed(selectedImport))setCancellingImport(selectedImport);else setShowImportHistory(true);}},<>Hủy bản tải sai</>,true,"action"),
toolbarConfig.action({"disabled": !snapshotsLoaded || importingInventory, disabledExplanation: "Đang xử lý dữ liệu. Vui lòng chờ hoàn tất rồi thử lại.","onClick": () => {
                if (!chottableImports.length) {
                  setNoticeKind("error");
                  notifyActionFailure("Chưa có file Excel tồn kho để chốt.");
        setNotice("Chưa có file Excel tồn kho để chốt.");
                  return;
                }
                setCommitImportKey('');setCommitWeek('');
                setShowSnapshotConfirm(true);
              }},<>✓ Chốt tồn
            </>, true, "action"),
toolbarConfig.action({"onClick": () => setShowInventorySearch((current) => !current)},<>⌕ Tra cứu</>, true, "lookup"),
activeWeekSnapshot && (
              toolbarConfig.action({"onClick": () => setReopening(reopenableWeekSnapshots[0] || null)},<>Mở chốt
              </>, true, "action")
            ),
toolbarConfig.action({"type": "button","aria-pressed": belowSafetyOnly,"onClick": () => setBelowSafetyOnly((current) => !current)},<>Tồn dưới mức an toàn
            </>, true, "action")]),
toolbarConfig.field(<><span>TUẦN XEM DỮ LIỆU</span></>,[toolbarConfig.input({"type": "date","value": snapshotWeek,"onChange": (e) => { setSelectedInventoryImportKey(""); setSnapshotWeek(e.target.value?weekKeyOf(e.target.value):""); }})]),
showInventorySearch && (
            toolbarConfig.group([toolbarConfig.field(<><span>TRA THEO</span></>,[toolbarConfig.select({"value": inventorySearchField,"onChange": (event) => {
                const field = event.target.value;
                setInventorySearchField(field);
                setInventorySearchDraft("");
                setInventorySearch({ field: "sku", value: "" });
                if (field === "upload_history") setShowImportHistory(true);
                if (field === "snapshot_history") setShowSnapshotHistory(true);
              }},<><option value="sku">Mã SKU</option><option value="name">Tên sản phẩm</option><option value="week_import">Dữ liệu tuần đã tải</option><option value="upload_history">Lịch sử tải Excel</option><option value="snapshot_history">Lịch sử chốt tồn</option></>)]),
!['upload_history', 'snapshot_history'].includes(inventorySearchField) && toolbarConfig.field(<><span>NỘI DUNG TRA</span></>,[inventorySearchField === "week_import" ? (
                  toolbarConfig.select({"value": inventorySearchDraft,"onChange": (event) => {
                    const recordKey = event.target.value;
                    setInventorySearchDraft(recordKey);
                    const record = latestImportsByWeek.find((item) => item.key === recordKey);
                    if (!record) return;
                    setSelectedInventoryImportKey(record.key);
                    setSnapshotWeek(weekKeyOf(record.weekKey));
                    setInventoryRows(record.rows);
                  }},<><option value="">Chọn dữ liệu tuần</option>{latestImportsByWeek.map((item) => { const start = mondayOf(new Date(`${weekKeyOf(item.weekKey)}T00:00:00`)); const end = new Date(start); end.setDate(end.getDate() + 6); return <option key={item.key} value={item.key}>{formatViDate(start)}–{formatViDate(end)} · {item.sourceFile}</option>; })}</>)
                ) : (
                  toolbarConfig.input({"value": inventorySearchDraft,"onChange": (event) => setInventorySearchDraft(event.target.value),"placeholder": inventorySearchField === "sku" ? "Nhập mã SKU" : "Nhập tên sản phẩm","onKeyDown": (event) => { if (event.key === "Enter") runInventorySearch(); }})
                )]),
toolbarConfig.group([!['upload_history', 'snapshot_history'].includes(inventorySearchField) && toolbarConfig.group([toolbarConfig.action({"onClick": () => { setInventorySearchDraft(""); setInventorySearch({ field: "sku", value: "" }); }},<>Xóa lọc</>, true, "clear"),
toolbarConfig.action({"onClick": runInventorySearch},<>Tìm kiếm</>, true, "search")]),
toolbarConfig.action({"onClick": () => { setShowInventorySearch(false); setInventorySearchDraft(""); setInventorySearch({ field: "sku", value: "" }); }},<>Quay lại</>, true, "back")])])
          )])]} />
          {notice && (<><FeedbackActionButton className="inventory-notice-overlay" aria-label="Đóng thông báo" onClick={() => setNotice("")} /><div className={`inventory-operation-notice ${noticeKind}`} role="status"><FeedbackActionButton aria-label="Đóng" onClick={() => setNotice("")}>×</FeedbackActionButton><b>{noticeKind === "success" ? "THAO TÁC THÀNH CÔNG" : "THAO TÁC KHÔNG THÀNH CÔNG"}</b><span>{notice}</span></div></>)}
          {selectedImport&&!selectedImport.weekKey&&<p className="inventory-pending-note"><b>{selectedImport.sourceFile}</b> · Chờ chốt, chưa gắn tuần kế hoạch. Bấm “Chốt tồn” để chọn file và tuần; tải sai có thể hủy trong Lịch sử tải Excel.</p>}
          {belowSafetyOnly ? (
          <div className="inventory-safety-result">
            <div className="inventory-safety-heading">
              <div><b>Danh sách tồn dưới mức an toàn</b><span>Mỗi SKU một dòng · Tổng tồn = Kho TP + Kho KD · Tồn an toàn = Demand/ngày × Safety Days</span></div>
              <strong>{safetyStockRows.length.toLocaleString("vi-VN")} SKU</strong>
            </div>
            <DataTable className="table-wrap">
              <table className="inventory-table inventory-safety-table">
                <thead><tr><th>MÃ SKU</th><th>TÊN SẢN PHẨM</th><th>QUY CÁCH</th><th>ĐƠN VỊ</th><th>DEMAND/NGÀY</th><th>SAFETY DAYS</th><th>TỒN TP</th><th>TỒN KD</th><th>TỔNG TỒN</th><th>TỒN AN TOÀN</th><th>SL THIẾU</th></tr></thead>
                <tbody>
                  {safetyStockRows.map((row) => (<tr key={row.sku} className="inventory-below-safety"><DataCell kind="code"><FeedbackActionButton className="sku-link" onClick={() => onOpenSku(row.sku)}>{row.sku}</FeedbackActionButton></DataCell><DataCell className="product-name">{row.name}</DataCell><DataCell>{row.spec}</DataCell><DataCell kind="code">{row.unit}</DataCell><DataCell kind="number" className="number">{row.metric!.dailyDemand.toLocaleString("vi-VN")}</DataCell><DataCell kind="number" className="number">{row.metric!.safetyDays.toLocaleString("vi-VN")}</DataCell><DataCell kind="number" className="number">{row.tpQty.toLocaleString("vi-VN")}</DataCell><DataCell kind="number" className="number">{row.kdQty.toLocaleString("vi-VN")}</DataCell><DataCell kind="number" className="number">{row.totalQty.toLocaleString("vi-VN")}</DataCell><DataCell kind="number" className="number">{Math.round(row.metric!.safetyStock).toLocaleString("vi-VN")}</DataCell><DataCell kind="number" className="number inventory-shortage">{Math.ceil(row.shortage).toLocaleString("vi-VN")}</DataCell></tr>))}
                  {!safetyStockRows.length && (<tr data-no-data="true"><DataCell colSpan={11} className="inventory-empty">Không có SKU nào dưới mức tồn an toàn theo dữ liệu hiện tại.</DataCell></tr>)}
                </tbody>
              </table>
            </DataTable>
          </div>
          ) : (<DataTable className="table-wrap">
            <table className="inventory-table" data-page-size="20">
              <thead>
                <tr>
                  <th>MÃ SKU</th>
                  <th>TÊN SẢN PHẨM</th>
                  <th>QUY CÁCH</th>
                  <th>ĐƠN VỊ</th>
                  <th>KHO</th>
                  <th>VỊ TRÍ</th>
                  <th>SỐ LÔ</th>
                  <th>TỒN KHO</th>
                  <th>THỜI GIAN CẬP NHẬT</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredStock.map((r) => {
                  return (<tr key={`${r.sku}-${r.warehouse}-${r.lot}`}>
                    <DataCell kind="code">
                      <FeedbackActionButton
                        className="sku-link"
                        onClick={() => onOpenSku(r.sku)}
                      >
                        {r.sku}
                      </FeedbackActionButton>
                    </DataCell>
                    <DataCell className="product-name">{r.name}</DataCell>
                    <DataCell>{r.spec}</DataCell>
                    <DataCell kind="code">{r.unit}</DataCell>
                    <DataCell>{r.warehouse}</DataCell>
                    <DataCell>{r.location}</DataCell>
                    <DataCell kind="code">{r.lot}</DataCell>
                    <DataCell kind="number" className="number">
                      {r.onHand.toLocaleString("vi-VN")}
                    </DataCell>
                    <DataCell kind="date">{r.updated}</DataCell>
                    <DataCell>
                      <FeedbackActionButton className="calc-button" disabled disabledExplanation="Chức năng này chưa được kết nối thao tác tại màn hình hiện tại.">Lịch sử biến động</FeedbackActionButton>
                    </DataCell>
                  </tr>)})}
                {!filteredStock.length && (<tr data-no-data="true"><DataCell colSpan={10} className="inventory-empty">Không có dữ liệu phù hợp bộ lọc.</DataCell></tr>)}
              </tbody>
            </table>
          </DataTable>)}
        </section>
        {showImportHistory && (
          <>
            <FeedbackActionButton className="overlay" aria-label="Đóng" onClick={() => setShowImportHistory(false)} />
            <aside className="drawer inventory-import-history-panel">
              <div className="drawer-title">
                <div><span>QUẢN LÝ KHO</span><h2>Lịch sử tải Excel tồn kho</h2></div>
                <FeedbackActionButton onClick={() => setShowImportHistory(false)}>×</FeedbackActionButton>
              </div>
              <DataTable className="table-wrap">
                <table>
                  <thead><tr><th>TUẦN KẾ HOẠCH</th><th>THỜI GIAN TẢI</th><th>NGƯỜI TẢI</th><th>TÊN FILE</th><th>SỐ DÒNG</th><th>TRẠNG THÁI CHỐT</th><th>SO VỚI LẦN TRƯỚC</th><th>THAO TÁC</th></tr></thead>
                  <tbody>
                    {inventoryImports.filter((item) => !inventorySearchDraft || item.key === inventorySearchDraft).map((item) => {
                      const itemIndex = inventoryImports.findIndex((candidate) => candidate.key === item.key);
                      const previous = item.weekKey ? inventoryImports.slice(itemIndex + 1).find((candidate) => candidate.weekKey === item.weekKey && !candidate._deleted) : undefined;
                      const fileSnapshot = snapshotForImport(item);
                      const closedFile = importIsClosed(item);
                      const start = item.weekKey ? mondayOf(new Date(`${weekKeyOf(item.weekKey)}T00:00:00`)) : null;
                      const end = start ? new Date(start) : null; if(end)end.setDate(end.getDate() + 6);
                      return (<tr key={item.key}><DataCell>{start&&end?`${formatViDate(start)}–${formatViDate(end)}`:'Chưa chọn tuần'}</DataCell><DataCell kind="date">{formatDateTimeDisplay(item.importedAt)}</DataCell><DataCell>{item.importedBy || "—"}</DataCell><DataCell>{item.sourceFile || "—"}</DataCell><DataCell kind="number" className="number">{item.rows.length.toLocaleString("vi-VN")}</DataCell><DataCell>{item._deleted?'Đã hủy':fileSnapshot?warehouseStatus(fileSnapshot.status):item.status==='Chờ chốt'?'Chờ chọn tuần và chốt':warehouseStatus(item.status || "Chưa chốt")}</DataCell><DataCell>{previous ? <FeedbackActionButton className="calc-button inventory-diff-button" onClick={() => setSelectedImportDiff({ current: item, previous, changes: compareInventoryImports(item, previous) })}>Khác</FeedbackActionButton> : <span className="inventory-first-import">Lần đầu</span>}</DataCell><DataCell>{!item._deleted&&<FeedbackActionButton className="calc-button" disabled={closedFile||importingInventory} disabledExplanation={importingInventory ? "Thao tác đang được xử lý. Vui lòng chờ hoàn tất rồi thử lại." : "Mở chốt của file này trước khi hủy bản tải."} title={closedFile?'Mở chốt của file này trước khi hủy':''} onClick={()=>setCancellingImport(item)}>Hủy bản tải</FeedbackActionButton>}</DataCell></tr>);
                    })}
                    {!inventoryImports.length && <tr data-no-data="true"><DataCell colSpan={8} className="inventory-empty">Chưa có lịch sử tải Excel tồn kho.</DataCell></tr>}
                  </tbody>
                </table>
              </DataTable>
            </aside>
          </>
        )}
        {cancellingImport && (<><FeedbackActionButton className="overlay overlay-top" aria-label="Đóng" onClick={()=>setCancellingImport(null)}/><aside className="drawer inventory-import-cancel-panel" role="dialog" aria-modal="true" aria-label="Hủy dữ liệu tải Excel"><div className="drawer-title"><div><span>QUẢN LÝ KHO</span><h2>Hủy dữ liệu tải sai</h2></div><FeedbackActionButton onClick={()=>setCancellingImport(null)}>×</FeedbackActionButton></div><div className="snapshot-confirm-body"><p><b>{cancellingImport.sourceFile}</b> · {cancellingImport.rows.length.toLocaleString('vi-VN')} dòng{cancellingImport.weekKey?` · Tuần ${cancellingImport.weekKey}`:' · Chưa chọn tuần'}</p><p>Bản tải sẽ không còn được dùng để chốt tồn. Lịch sử tải và bản chốt cũ vẫn được giữ.</p><div className="snapshot-actions"><FeedbackActionButton className="ghost-button" disabled={importingInventory} disabledExplanation={"Thao tác đang được xử lý. Vui lòng chờ hoàn tất rồi thử lại."} onClick={()=>setCancellingImport(null)}>Quay lại</FeedbackActionButton><FeedbackActionButton className="primary-button" disabled={importingInventory} disabledExplanation={"Thao tác đang được xử lý. Vui lòng chờ hoàn tất rồi thử lại."} onClick={()=>void cancelInventoryImport()}>{importingInventory?'Đang hủy...':'Xác nhận hủy bản tải'}</FeedbackActionButton></div></div></aside></>)}
        {selectedImportDiff && (
          <>
            <FeedbackActionButton className="overlay overlay-top" aria-label="Đóng" onClick={() => setSelectedImportDiff(null)} />
            <aside className="drawer inventory-import-diff-panel">
              <div className="drawer-title">
                <div><span>{selectedImportDiff.current.sourceFile}</span><h2>Dữ liệu khác so với lần tải trước</h2></div>
                <FeedbackActionButton onClick={() => setSelectedImportDiff(null)}>×</FeedbackActionButton>
              </div>
              <div className="inventory-diff-summary">
                <span>Tuần {formatViDate(mondayOf(new Date(`${weekKeyOf(selectedImportDiff.current.weekKey)}T00:00:00`)))}</span>
                <span>{formatDateTimeDisplay(selectedImportDiff.previous?.importedAt || "")} → {formatDateTimeDisplay(selectedImportDiff.current.importedAt)}</span>
              </div>
              <DataTable className="table-wrap">
                <table><thead><tr><th>SKU</th><th>KHO</th><th>LOẠI</th><th>NỘI DUNG</th><th>GIÁ TRỊ TRƯỚC</th><th>GIÁ TRỊ SAU</th></tr></thead><tbody>
                  {selectedImportDiff.changes.map((change, index) => (<tr key={`${change.sku}-${change.warehouse}-${change.field}-${index}`}><DataCell kind="code">{change.sku}</DataCell><DataCell>{change.warehouse}</DataCell><DataCell><span className={`inventory-change-kind ${change.kind === "Thêm mới" ? "added" : change.kind === "Không còn trong file" ? "removed" : "changed"}`}>{change.kind}</span></DataCell><DataCell>{change.field}</DataCell><DataCell>{change.before}</DataCell><DataCell>{change.after}</DataCell></tr>))}
                  {!selectedImportDiff.changes.length && <tr data-no-data="true"><DataCell colSpan={6} className="inventory-empty">Không có dữ liệu thay đổi so với lần tải ngay trước đó của cùng tuần.</DataCell></tr>}
                </tbody></table>
              </DataTable>
            </aside>
          </>
        )}
        {showSnapshotConfirm && (
          <>
            <FeedbackActionButton
              className="overlay"
              aria-label="Đóng"
              onClick={() => setShowSnapshotConfirm(false)}
            />
            <aside className="drawer snapshot-panel">
              <div className="drawer-title">
                <div>
                  <span>QUẢN LÝ KHO</span>
                  <h2>Xác nhận chốt tồn kho</h2>
                </div>
                <FeedbackActionButton onClick={() => setShowSnapshotConfirm(false)}>×</FeedbackActionButton>
              </div>
              <div className="snapshot-confirm-body">
                <label><span>FILE EXCEL CẦN CHỐT *</span><select required value={commitImportKey} onChange={(e)=>setCommitImportKey(e.target.value)}><option value="">Chọn file đã tải</option>{chottableImports.map((item)=><option key={item.key} value={item.key}>{item.sourceFile} · {formatDateTimeDisplay(item.importedAt)}{item.weekKey?` · Tuần ${item.weekKey}`:' · Chờ chọn tuần'}</option>)}</select></label>
                <label><span>TUẦN KẾ HOẠCH CẦN CHỐT *</span><input required type="date" value={commitWeek} onChange={e=>setCommitWeek(e.target.value)}/></label>
                {chottableImports.find(item=>item.key===commitImportKey)?.weekKey&&<p>File này được tải theo cách cũ và đã gắn tuần {chottableImports.find(item=>item.key===commitImportKey)?.weekKey}. Nếu gắn sai tuần, hãy hủy bản tải rồi tải lại file để chọn tuần khi chốt.</p>}
                <dl>
                  <div>
                    <dt>Tuần kế hoạch</dt>
                    <dd>
                      {commitWeek ? `${formatViDate(mondayOf(new Date(`${commitWeek}T00:00:00`)))}–${formatViDate(new Date(new Date(`${weekKeyOf(commitWeek)}T00:00:00`).getTime()+6*86400000))}` : 'Chưa chọn tuần'}
                    </dd>
                  </div>
                  <div>
                    <dt>Nguồn tồn</dt>
                    <dd>{activeImports.find(item=>item.key===commitImportKey)?.sourceFile || "Chưa chọn file"} · Kho TP + Kho KD</dd>
                  </div>
                  <div>
                    <dt>Tổng SKU</dt>
                    <dd>
                      {new Set(
                        (activeImports.find(item=>item.key===commitImportKey)?.rows||[]).map((row) => row.sku),
                      ).size.toLocaleString("vi-VN")}
                    </dd>
                  </div>
                  <div>
                    <dt>Người chốt</dt>
                    <dd>{operator}</dd>
                  </div>
                </dl>
                <p>
                  Hệ thống sẽ chụp tồn kho TP và KD tại thời điểm xác nhận. Dữ
                  liệu bản chốt không tự thay đổi khi tồn kho hiện tại thay đổi.
                </p>
                <div className="snapshot-actions">
                  <FeedbackActionButton
                    className="ghost-button"
                    onClick={() => setShowSnapshotConfirm(false)}
                  >
                    Hủy
                  </FeedbackActionButton>
                  <FeedbackActionButton
                    className="primary-button"
                    disabled={savingSnapshot||!commitWeek||!commitImportKey} disabledExplanation={savingSnapshot ? "Thao tác đang được xử lý. Vui lòng chờ hoàn tất rồi thử lại." : !commitWeek ? "Chọn tuần trước khi chốt tồn." : "Chọn bản tải dữ liệu trước khi chốt tồn."}
                    onClick={createSnapshot}
                  >
                    {savingSnapshot ? "Đang chốt..." : "Xác nhận chốt tồn"}
                  </FeedbackActionButton>
                </div>
              </div>
            </aside>
          </>
        )}
        {showSnapshotHistory && (
          <>
            <FeedbackActionButton
              className="overlay"
              aria-label="Đóng"
              onClick={() => setShowSnapshotHistory(false)}
            />
            <aside className="drawer snapshot-history-panel">
              <div className="drawer-title">
                <div>
                  <span>QUẢN LÝ KHO</span>
                  <h2>Lịch sử chốt tồn theo tuần</h2>
                </div>
                <FeedbackActionButton onClick={() => setShowSnapshotHistory(false)}>×</FeedbackActionButton>
              </div>
              <DataTable className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>MÃ CHỐT</th>
                      <th>TUẦN KẾ HOẠCH</th>
                      <th>THỜI ĐIỂM CHỐT</th>
                      <th>SKU</th>
                      <th>TỒN TP</th>
                      <th>TỒN KD</th>
                      <th>TỔNG TỒN</th>
                      <th>NGƯỜI CHỐT</th>
                      <th>TRẠNG THÁI</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshots.filter((item) => !inventorySearchDraft || item.id === inventorySearchDraft).map((item) => (
                      <tr key={item.id}>
                        <DataCell kind="code">
                          <FeedbackActionButton
                            className="sku-link"
                            onClick={() => setSelectedSnapshot(item)}
                          >
                            {item.code}
                          </FeedbackActionButton>
                        </DataCell>
                        <DataCell kind="date">
                          {item.weekStart}–{item.weekEnd}
                        </DataCell>
                        <DataCell kind="date">{formatDateTimeDisplay(item.snapshotAt)}</DataCell>
                        <DataCell kind="number" className="number">{item.skuCount}</DataCell>
                        <DataCell kind="number" className="number">
                          {item.totalTp.toLocaleString("vi-VN")}
                        </DataCell>
                        <DataCell kind="number" className="number">
                          {item.totalKd.toLocaleString("vi-VN")}
                        </DataCell>
                        <DataCell kind="number" className="number engine-rop">
                          {item.totalStock.toLocaleString("vi-VN")}
                        </DataCell>
                        <DataCell>{item.createdBy}</DataCell>
                        <DataCell>{warehouseStatus(item.status)}</DataCell>
                        <DataCell>
                          <FeedbackActionButton
                            className="calc-button"
                            onClick={() => setSelectedSnapshot(item)}
                          >
                            Chi tiết
                          </FeedbackActionButton>
                        </DataCell>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DataTable>
            </aside>
          </>
        )}
        {selectedSnapshot && (
          <>
            <FeedbackActionButton
              className="overlay overlay-top"
              aria-label="Đóng"
              onClick={() => setSelectedSnapshot(null)}
            />
            <aside className="drawer snapshot-detail-panel">
              <div className="drawer-title">
                <div>
                  <span>{selectedSnapshot.code}</span>
                  <h2>Chi tiết tồn kho đã chốt</h2>
                </div>
                <FeedbackActionButton onClick={() => setSelectedSnapshot(null)}>×</FeedbackActionButton>
              </div>
              <div className="snapshot-detail-summary">
                Tuần {selectedSnapshot.weekStart}–{selectedSnapshot.weekEnd} ·{" "}
                {selectedSnapshot.createdBy} · {selectedSnapshot.status}
              </div>
              <DataTable className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>TÊN SẢN PHẨM</th>
                      <th>QUY CÁCH</th>
                      <th>ĐƠN VỊ</th>
                      <th>TỒN TP</th>
                      <th>TỒN KD</th>
                      <th>TỒN KHO CHỐT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSnapshot.items.map((item) => (
                      <tr key={item.sku}>
                        <DataCell kind="code">{item.sku}</DataCell>
                        <DataCell>{item.name}</DataCell>
                        <DataCell>{item.spec}</DataCell>
                        <DataCell kind="code">{item.unit}</DataCell>
                        <DataCell kind="number" className="number">
                          {item.tpQty.toLocaleString("vi-VN")}
                        </DataCell>
                        <DataCell kind="number" className="number">
                          {item.kdQty.toLocaleString("vi-VN")}
                        </DataCell>
                        <DataCell kind="number" className="number engine-rop">
                          {item.totalQty.toLocaleString("vi-VN")}
                        </DataCell>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DataTable>
            </aside>
          </>
        )}
        {reopening && (
          <>
            <FeedbackActionButton
              className="overlay"
              aria-label="Đóng"
              onClick={() => setReopening(null)}
            />
            <aside className="drawer snapshot-panel">
              <div className="drawer-title">
                <div>
                  <span>{reopening.code}</span>
                  <h2>Mở chốt tồn kho</h2>
                </div>
                <FeedbackActionButton onClick={() => setReopening(null)}>×</FeedbackActionButton>
              </div>
              <form className="snapshot-confirm-body" onSubmit={reopenSnapshot} onInvalid={() => notifyActionFailure("Thông tin bắt buộc còn thiếu hoặc chưa hợp lệ. Kiểm tra các trường được đánh dấu trước khi tiếp tục.")}>
                <p>
                  Bản chốt cũ và dữ liệu Production_engine đã sử dụng sẽ không
                  bị thay đổi. Sau khi mở, Kho phải tạo bản chốt mới và KHSX chủ
                  động cập nhật lại dữ liệu tuần.
                </p>
                <label>
                  <span>BẢN CHỐT CẦN MỞ *</span>
                  <select
                    required
                    value={reopening.id}
                    onChange={(event) => {
                      const selected = reopenableWeekSnapshots.find((item) => item.id === event.target.value);
                      if (selected) setReopening(selected);
                    }}
                  >
                    {reopenableWeekSnapshots.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.code} · {formatDateTimeDisplay(item.snapshotAt)} · {item.createdBy}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>LÝ DO MỞ CHỐT *</span>
                  <textarea
                    name="reason"
                    required
                    placeholder="Nhập rõ nguyên nhân dữ liệu cần chốt lại"
                  />
                </label>
                <div className="snapshot-actions">
                  <FeedbackActionButton
                    type="button"
                    className="ghost-button"
                    onClick={() => setReopening(null)}
                  >
                    Hủy
                  </FeedbackActionButton>
                  <FeedbackActionButton
                    className="primary-button snapshot-open"
                    disabled={savingSnapshot} disabledExplanation={"Thao tác đang được xử lý. Vui lòng chờ hoàn tất rồi thử lại."} type="submit"
                  >
                    {savingSnapshot ? "Đang xử lý..." : "Xác nhận mở chốt"}
                  </FeedbackActionButton>
                </div>
              </form>
            </aside>
          </>
        )}
      </main>
    );
  if (section === "warehouse-in")
    return (
      <main className="workspace warehouse-workspace">
        {receiveTab === "erp" && <StandardToolbar name="WarehouseContent" items={[
          toolbarConfig.action({onClick:()=>setReceiveTab("production")},"Nhập từ Sản xuất báo công",true,"action"),
          toolbarConfig.action({onClick:()=>setReceiveTab("erp"),'aria-pressed':true},"Tự nhập bằng phiếu ERP",true,"action")
        ]} />}
        {receiveTab === "production" ? (
          <section className="data-card">
            <WarehouseReceipts onOpenSearch={()=>setReceiptSearchOpen(true)} onChooseErp={()=>setReceiveTab("erp")} searchOpen={receiptSearchOpen} onCloseSearch={()=>setReceiptSearchOpen(false)} catalog={skuCatalog} onOpenSku={onOpenSku} pendingOnly={warehouseApproval?.entity === "warehouse_in"} requestSequence={warehouseApproval?.sequence} />
            <div className="source-note">
              Nhân viên Kho chỉ kiểm tra số lượng thực nhận, kho và vị trí;
              không nhập lại dữ liệu Sản xuất đã khai báo.
            </div>
          </section>
        ) : (
          <section className="data-card erp-ai-card">
            <div className="erp-upload">
              <div>
                <span className="upload-icon">▧</span>
                <h2>Chụp hoặc tải phiếu ERP đã xác nhận</h2>
                <p>
                  Hỗ trợ ảnh JPG/PNG và PDF xuất từ ERP. Không tạo bản nháp và
                  không nhập lại từng dòng.
                </p>
                <RecordFiles
                  module="warehouse"
                  label="Lưu ảnh hoặc PDF ERP"
                  accept="image/*,.pdf"
                />
              </div>
              <div className="ai-flow-list">
                <span>
                  <b>1</b> Chụp hoặc tải phiếu
                </span>
                <span>
                  <b>2</b> AI đọc dữ liệu
                </span>
                <span>
                  <b>3</b> Đối chiếu SKU Master
                </span>
                <span>
                  <b>4</b> Nhân viên kiểm tra
                </span>
                <span>
                  <b>5</b> Xác nhận cập nhật kho
                </span>
              </div>
            </div>
            <div className="ai-fields">
              <h3>AI sẽ đọc và kiểm tra</h3>
              <p>
                Mã loại phiếu · Mã phiếu ERP · Ngày chứng từ · Ngày chuyển · Bộ
                phận/xưởng · Người xác nhận · Kho xuất/nhận · SKU · Tên · Quy
                cách · Đơn vị · Số lượng · Số lô · Bao bì · Vị trí.
              </p>
              <div>
                <span className="match-ok">Khớp SKU Master</span>
                <span className="match-check">Cần kiểm tra</span>
                <span className="match-error">
                  Không hợp lệ / không tìm thấy SKU
                </span>
              </div>
            </div>
            <div className="duplicate-rule">
              <b>Kiểm soát bắt buộc:</b> hệ thống kiểm tra trùng mã phiếu ERP
              trước khi cho phép bấm “Xác nhận cập nhật kho”.
            </div>
          </section>
        )}
      </main>
    );
  if (section === "warehouse-out")
    return (
      <main className="workspace warehouse-workspace">
        <RecordFiles module="warehouse" label="Tệp ERP và nhập dữ liệu kho" />
        {heading}
        <section className="data-card">
          <WarehouseFilters />
          <DataTable className="table-wrap">
            <table className="warehouse-doc-table">
              <thead>
                <tr>
                  <th>MÃ PHIẾU ERP</th>
                  <th>NGÀY CHỨNG TỪ</th>
                  <th>LOẠI NGHIỆP VỤ</th>
                  <th>SKU</th>
                  <th>TÊN SẢN PHẨM</th>
                  <th>SỐ LÔ</th>
                  <th>KHO XUẤT</th>
                  <th>KHO NHẬN</th>
                  <th>SỐ LƯỢNG</th>
                  <th>TRẠNG THÁI</th>
                  <th>NGƯỜI XÁC NHẬN</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <DataCell>ERP-XK-260828-011</DataCell>
                  <DataCell>28/08/2026 11:20:44</DataCell>
                  <DataCell>
                    <span className="event-type urgent">Xuất kho</span>
                  </DataCell>
                  <DataCell>
                    <FeedbackActionButton
                      className="sku-link"
                      onClick={() => onOpenSku("SAMPLE-SKU-102")}
                    >
                       SAMPLE-SKU-102 </FeedbackActionButton>
                  </DataCell>
                  <DataCell> Dữ liệu mẫu </DataCell>
                  <DataCell>LOT-260822-01</DataCell>
                  <DataCell>KHO TP</DataCell>
                  <DataCell>Khách hàng</DataCell>
                  <DataCell kind="number" className="number">860</DataCell>
                  <DataCell>{warehouseStatus("Đã cập nhật kho")}</DataCell>
                  <DataCell>sample_user_17</DataCell>
                </tr>
                <tr>
                  <DataCell>ERP-CK-260828-006</DataCell>
                  <DataCell>28/08/2026 13:42:07</DataCell>
                  <DataCell>
                    <span className="event-type load">Chuyển kho</span>
                  </DataCell>
                  <DataCell>
                    <FeedbackActionButton
                      className="sku-link"
                      onClick={() => onOpenSku("SAMPLE-SKU-392")}
                    >
                       SAMPLE-SKU-392 </FeedbackActionButton>
                  </DataCell>
                  <DataCell>VAN PHAO NHỰA</DataCell>
                  <DataCell>LOT-260811-02</DataCell>
                  <DataCell>KHO TP</DataCell>
                  <DataCell>KHO KD</DataCell>
                  <DataCell kind="number" className="number">1.200</DataCell>
                  <DataCell>{warehouseStatus("Chờ kho nhận")}</DataCell>
                  <DataCell>sample_user_19</DataCell>
                </tr>
              </tbody>
            </table>
          </DataTable>
        </section>
      </main>
    );
  if (section === "warehouse-transfer")
    return (
      <main className="workspace warehouse-workspace">
        <RecordFiles module="warehouse" label="Tệp ERP và nhập dữ liệu kho" />
        {heading}
        <section className="data-card transfer-document">
          <StandardToolbar name="WarehouseContent" items={[toolbarConfig.group([toolbarConfig.action({},<>⌕ Tra phiếu</>, true, "action"),
toolbarConfig.action({},<>↶ Hủy xác nhận</>, true, "action"),
toolbarConfig.action({},<>× Hủy phiếu
              </>, true, "action")]),
toolbarConfig.note(<span>{warehouseStatus("Đang chuyển")}</span>)]} />
          <div className="transfer-header">
            <div>
              <span>LOẠI PHIẾU</span>
              <b>410 · Chuyển kho TP → KD</b>
            </div>
            <div>
              <span>MÃ PHIẾU ERP</span>
              <b>ERP-CK-260828-006</b>
            </div>
            <div>
              <span>NGÀY CHỨNG TỪ</span>
              <b>28/08/2026</b>
            </div>
            <div>
              <span>NGÀY CHUYỂN</span>
              <b>28/08/2026 13:42:07</b>
            </div>
            <div>
              <span>TRẠNG THÁI ERP</span>
              <b>Đã xác nhận</b>
            </div>
            <div>
              <span>BỘ PHẬN</span>
              <b>Kho thành phẩm</b>
            </div>
            <div>
              <span>XƯỞNG CHUYỂN XUẤT</span>
              <b>SHINTUNG</b>
            </div>
            <div>
              <span>NGƯỜI XÁC NHẬN</span>
              <b>sample_user_19</b>
            </div>
            <div>
              <span>GHI CHÚ</span>
              <b>Chuyển hàng bán</b>
            </div>
            <div>
              <span>SỐ KIỆN / LẦN IN</span>
              <b>24 / 1</b>
            </div>
            <div>
              <span>ĐIỀU XE</span>
              <b>51D-123.45 · 14:30</b>
            </div>
          </div>
          <DataTable className="table-wrap">
            <table className="transfer-table">
              <thead>
                <tr>
                  <th>MÃ SẢN PHẨM</th>
                  <th>TÊN SẢN PHẨM</th>
                  <th>QUY CÁCH</th>
                  <th>SL CHUYỂN</th>
                  <th>ĐƠN VỊ</th>
                  <th>SỐ LÔ</th>
                  <th>SỐ BAO BÌ</th>
                  <th>ĐV ĐÓNG GÓI</th>
                  <th>KHO XUẤT</th>
                  <th>VỊ TRÍ XUẤT</th>
                  <th>KHO NHẬN</th>
                  <th>VỊ TRÍ NHẬN</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <DataCell>
                    <FeedbackActionButton
                      className="sku-link"
                      onClick={() => onOpenSku("SAMPLE-SKU-392")}
                    >
                       SAMPLE-SKU-392 </FeedbackActionButton>
                  </DataCell>
                  <DataCell>VAN PHAO NHỰA</DataCell>
                  <DataCell>3/4&quot;</DataCell>
                  <DataCell kind="number" className="number">1.200</DataCell>
                  <DataCell>CÁI</DataCell>
                  <DataCell>LOT-260811-02</DataCell>
                  <DataCell kind="number" className="number">24</DataCell>
                  <DataCell>THÙNG</DataCell>
                  <DataCell>KHO TP</DataCell>
                  <DataCell>B02-04</DataCell>
                  <DataCell>KHO KD</DataCell>
                  <DataCell>KD-02-01</DataCell>
                </tr>
              </tbody>
            </table>
          </DataTable>
          <div className="stock-balance-rule">
            <div>
              <span>Kho TP</span>
              <b>−1.200</b>
            </div>
            <div>
              <span>Kho KD</span>
              <b>+1.200</b>
            </div>
            <div>
              <span>Tổng tồn công ty</span>
              <b>Không thay đổi</b>
            </div>
          </div>
          <WarehouseFilters />
        </section>
      </main>
    );
  if (section === "warehouse-docs")
    return (
      <main className="workspace warehouse-workspace">
        <RecordFiles module="warehouse" label="Tệp ERP và nhập dữ liệu kho" />
        {heading}
        <section className="data-card">
          <WarehouseFilters />
          <DataTable className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>MÃ PHIẾU ERP</th>
                  <th>LOẠI PHIẾU</th>
                  <th>NGÀY GIỜ</th>
                  <th>KHO XUẤT</th>
                  <th>KHO NHẬN</th>
                  <th>TRẠNG THÁI</th>
                  <th>NGƯỜI XÁC NHẬN</th>
                  <th>THAO TÁC</th>
                </tr>
              </thead>
              <tbody>
                {warehouseTransactions.map((t) => (
                  <tr key={t.id}>
                    <DataCell>
                      <FeedbackActionButton className="sku-link" disabled disabledExplanation="Mã này chỉ dùng để tham khảo; chưa có thao tác chi tiết tại đây.">{t.id}</FeedbackActionButton>
                    </DataCell>
                    <DataCell>{t.type}</DataCell>
                    <DataCell kind="time">{t.time}</DataCell>
                    <DataCell>{t.from}</DataCell>
                    <DataCell>{t.to}</DataCell>
                    <DataCell>{warehouseStatus(t.status)}</DataCell>
                    <DataCell>{t.user}</DataCell>
                    <DataCell>
                      <div className="document-actions">
                        <FeedbackActionButton disabled disabledExplanation="Chức năng này chưa được kết nối thao tác tại màn hình hiện tại.">Hủy xác nhận</FeedbackActionButton>
                        <FeedbackActionButton disabled disabledExplanation="Chức năng này chưa được kết nối thao tác tại màn hình hiện tại.">Hủy phiếu</FeedbackActionButton>
                      </div>
                    </DataCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTable>
          <div className="source-note">
            Không xóa phiếu khỏi hệ thống. Hủy xác nhận hoặc hủy phiếu đều bắt
            buộc nhập lý do, hoàn tác tồn và lưu đầy đủ nhật ký.
          </div>
        </section>
      </main>
    );
  if (section === "warehouse-count")
    return (
      <main className="workspace warehouse-workspace">
        <RecordFiles module="warehouse" label="Tệp ERP và nhập dữ liệu kho" />
        {heading}
        <section className="data-card">
          <div className="section-title">
            <div>
              <h2>Đợt kiểm kê tháng 08/2026</h2>
              <p>So sánh tồn hệ thống và số lượng kiểm đếm thực tế.</p>
            </div>
            <FeedbackActionButton className="primary-button" disabled disabledExplanation="Chức năng này chưa được kết nối thao tác tại màn hình hiện tại.">＋ Tạo phiếu kiểm kê</FeedbackActionButton>
          </div>
          <DataTable className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>MÃ PHIẾU</th>
                  <th>KHO</th>
                  <th>VỊ TRÍ</th>
                  <th>THỜI ĐIỂM CHỐT</th>
                  <th>SỐ SKU</th>
                  <th>CHÊNH LỆCH</th>
                  <th>TRẠNG THÁI</th>
                  <th>NGƯỜI XÁC NHẬN</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <DataCell>KK-260828-01</DataCell>
                  <DataCell>KHO TP</DataCell>
                  <DataCell>Khu A</DataCell>
                  <DataCell>28/08/2026 08:00:00</DataCell>
                  <DataCell kind="number" className="number">42</DataCell>
                  <DataCell kind="number" className="number">−2</DataCell>
                  <DataCell>{warehouseStatus("Có chênh lệch")}</DataCell>
                  <DataCell>sample_user_18</DataCell>
                  <DataCell>
                    <FeedbackActionButton className="calc-button" disabled disabledExplanation="Chức năng này chưa được kết nối thao tác tại màn hình hiện tại.">Xem chi tiết</FeedbackActionButton>
                  </DataCell>
                </tr>
              </tbody>
            </table>
          </DataTable>
          <div className="document-footer-actions">
            <FeedbackActionButton className="outline-button" disabled disabledExplanation="Chức năng này chưa được kết nối thao tác tại màn hình hiện tại.">Hủy xác nhận</FeedbackActionButton>
            <FeedbackActionButton className="outline-button danger-action" disabled disabledExplanation="Chức năng này chưa được kết nối thao tác tại màn hình hiện tại.">Hủy phiếu</FeedbackActionButton>
          </div>
        </section>
      </main>
    );
  return (
    <main className="workspace warehouse-workspace">
      <RecordFiles module="warehouse" label="Tệp ERP và nhập dữ liệu kho" />
      {heading}
      <div className="warehouse-kpis report-kpis">
        <div>
          <span>Vòng quay tồn kho</span>
          <b>4,8 lần</b>
          <small>Tháng 08/2026</small>
        </div>
        <div>
          <span>Ngày tồn bình quân</span>
          <b>37 ngày</b>
          <small>Kho thành phẩm</small>
        </div>
        <div>
          <span>Tỷ lệ phiếu chính xác</span>
          <b>99,2%</b>
          <small>312 / 315 phiếu</small>
        </div>
        <div className="warning">
          <span>Tồn trên 90 ngày</span>
          <b>5,5%</b>
          <small>600 / 10.913</small>
        </div>
      </div>
      <section className="data-card">
        <div className="section-title">
          <div>
            <h2>Báo cáo kho thành phẩm</h2>
            <p>Chọn kỳ và loại báo cáo cần xuất.</p>
          </div>
          <FeedbackActionButton className="outline-button" disabled disabledExplanation="Chức năng này chưa được kết nối thao tác tại màn hình hiện tại.">⇩ Xuất Excel</FeedbackActionButton>
        </div>
        <div className="report-options">
          <FeedbackActionButton disabled disabledExplanation="Chức năng này chưa được kết nối thao tác tại màn hình hiện tại.">Tồn kho theo thời điểm</FeedbackActionButton>
          <FeedbackActionButton disabled disabledExplanation="Chức năng này chưa được kết nối thao tác tại màn hình hiện tại.">Nhập – xuất – tồn</FeedbackActionButton>
          <FeedbackActionButton disabled disabledExplanation="Chức năng này chưa được kết nối thao tác tại màn hình hiện tại.">Lịch sử giao dịch SKU</FeedbackActionButton>
          <FeedbackActionButton disabled disabledExplanation="Chức năng này chưa được kết nối thao tác tại màn hình hiện tại.">Tồn theo kho / vị trí / lô</FeedbackActionButton>
          <FeedbackActionButton disabled disabledExplanation="Chức năng này chưa được kết nối thao tác tại màn hình hiện tại.">Tồn trên 90 ngày</FeedbackActionButton>
          <FeedbackActionButton disabled disabledExplanation="Chức năng này chưa được kết nối thao tác tại màn hình hiện tại.">Phiếu có chênh lệch</FeedbackActionButton>
          <FeedbackActionButton disabled disabledExplanation="Chức năng này chưa được kết nối thao tác tại màn hình hiện tại.">Nhật ký hủy xác nhận</FeedbackActionButton>
          <FeedbackActionButton disabled disabledExplanation="Chức năng này chưa được kết nối thao tác tại màn hình hiện tại.">Nhật ký hệ thống</FeedbackActionButton>
        </div>
        <WarehouseFilters />
      </section>
    </main>
  );
}

type BomChangeLine = {
  code: string;
  newCode?: string;
  name: string;
  spec: string;
  action: string;
  oldQty: string;
  newQty: string;
  denominator: string;
  waste?: string;
  note: string;
};
type BomChangeHistory = {
  id: string;
  sku: string;
  skus?: string[];
  bulk?: boolean;
  oldVersions?: Record<string,string>;
  newVersions?: Record<string,string>;
  sourceRevisions?: Record<string,string|null>;
  oldVersion: string;
  newVersion: string;
  setup?: string;
  effective: string;
  user: string;
  createdBy?: string;
  createdAt?: string;
  modifiedBy?: string;
  modifiedAt?: string;
  confirmedBy?: string;
  confirmedAt?: string;
  reason: string;
  status: string;
  lines: BomChangeLine[];
};
type BomChangeRecordEnvelope = {
  payload: BomChangeHistory;
  updatedBy?: string;
  updatedAt?: string;
};
const legacyBomChangeCreator = (record: BomChangeHistory) =>
  record.createdBy ||
  record.user?.replace(/\s*\(người lập\)\s*/i, "").trim() ||
  "Chưa ghi nhận";
const bomChangeModifier = (record: BomChangeHistory) =>
  record.modifiedBy || record.createdBy || "Chưa ghi nhận";
const bomChangeConfirmer = (record: BomChangeHistory) =>
  record.confirmedBy ||
  (record.status === "Đã xác nhận" && !record.user?.includes("(người lập)")
    ? record.user
    : "Chưa ghi nhận");
const displayAuditTime = (value?: string) => {
  if (!value) return "Chưa ghi nhận";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hourCycle: "h23" });
};
const hydrateBomChangeRecord = ({
  payload,
  updatedBy,
  updatedAt,
}: BomChangeRecordEnvelope): BomChangeHistory => ({
  ...payload,
  createdBy: payload.createdBy || legacyBomChangeCreator(payload),
  modifiedBy: payload.modifiedBy || updatedBy || payload.createdBy,
  modifiedAt: payload.modifiedAt || updatedAt,
});
const bomChangeSkus18092026 = [] as string[];
const bomChanges18092026: BomChangeHistory[] = bomChangeSkus18092026.map(
  (sku, index) => {
    const replacementOnly = ["SAMPLE-SKU-78", "SAMPLE-SKU-79"].includes(sku);
    const oldBagCode = sku === "SAMPLE-SKU-41" ? "SAMPLE-SKU-44" : "SAMPLE-SKU-51";
    const oldBagName =
      oldBagCode === "SAMPLE-SKU-44"
        ? "Dữ liệu mẫu"
        : "Dữ liệu mẫu";
    return {
      id: `BOM-DC-20260918-${String(index + 1).padStart(3, "0")}`,
      sku,
      oldVersion: "0000",
      newVersion: "0001",
      setup: "18/09/2026",
      effective: "—",
      user: "sample_user_15 (người lập)",
      reason: "Thay túi dây dẫn nước theo dữ liệu thay đổi ngày 18/09/2026",
      status: "Chờ xác nhận",
      lines: [
        {
          code: oldBagCode,
          newCode: "SAMPLE-SKU",
          name: oldBagName,
          spec: "—",
          action: "Thay đổi",
          oldQty: "0,012",
          newQty: "1",
          denominator: "1",
          waste: "",
          note: "Thay bằng 407DX017 - TÚI DÂY DẪN NƯỚC 28x32cm",
        },
        ...(!replacementOnly
          ? [
              {
                code: "SAMPLE-SKU-43",
                newCode: "",
                name: "Dữ liệu mẫu",
                spec: "—",
                action: "Ngừng sử dụng",
                oldQty: "1",
                newQty: "—",
                denominator: "1",
                waste: "",
                note: "Xóa nhãn cũ theo phiếu thay đổi",
              },
            ]
          : []),
      ],
    };
  },
);
const bomChangeBathBagSkus18092026 = [] as string[];
const bomBathBagChanges18092026: BomChangeHistory[] =
  bomChangeBathBagSkus18092026.map((sku, index) => {
    const source = bomCatalog.find((item) => item.sku === sku);
    const oldBag = source?.items.find((item) => item.code === "SAMPLE-SKU-51");
    const oldLabel = source?.items.find((item) => item.code === "SAMPLE-SKU-50");
    return {
      id: `BOM-DC-20260918-${String(index + 35).padStart(3, "0")}`,
      sku,
      oldVersion: source?.version || "0000",
      newVersion: String(Number(source?.version || 0) + 1).padStart(4, "0"),
      setup: "18/09/2026",
      effective: "—",
      user: "sample_user_15 (người lập)",
      reason: "Thay túi dây tắm theo dữ liệu thay đổi ngày 18/09/2026",
      status: "Chờ xác nhận",
      lines: [
        {
          code: "SAMPLE-SKU-51",
          newCode: "SAMPLE-SKU",
          name: oldBag?.name || "Dữ liệu mẫu",
          spec: oldBag?.spec || "—",
          action: "Thay đổi",
          oldQty: oldBag?.qty || "0,012",
          newQty: "1",
          denominator: "1",
          waste: "",
          note: "Thay bằng 407HS004 - TÚI DÂY TẮM 27x31cm",
        },
        {
          code: "SAMPLE-SKU-50",
          newCode: "",
          name: oldLabel?.name || "Dữ liệu mẫu",
          spec: oldLabel?.spec || "—",
          action: "Ngừng sử dụng",
          oldQty: oldLabel?.qty || "1",
          newQty: "—",
          denominator: "1",
          waste: "",
          note: "Xóa nhãn cũ theo phiếu thay đổi",
        },
      ],
    };
  });
let bomChangeHistory: BomChangeHistory[] = [];
const initialBomChangeHistory = structuredClone(bomChangeHistory);

function BomChangeContent({
  initialSku = "",
  embedded = false,
  onClose,
  operator,
}: {
  initialSku?: string;
  embedded?: boolean;
  onClose?: (savedStatus?: string) => void;
  operator?: string;
} = {}) {
  const session = useRef(clientSessionGeneration()).current;
  const skus = useContext(BusinessSkuContext);
  const sourceSkus = useContext(BomSourceSkuContext);
  const sourceFor = bomSourceResolver(sourceSkus);
  const bomMasterOptions = [...originalBomMasterOptions, ...skus.filter(sku => !originalBomMasterOptions.some(item => item.code === sku.code)).map(sku => ({code:sku.code,name:sku.name,spec:sku.specification,unit:sku.unit,source:sourceFor(sku.code)}))].map(item => ({...item, source: sourceFor(item.code, item.source)}));
  const dataRevision = useDataRefresh(['bom_change','bom']);
  const emptyRow = {
    code: "",
    newCode: "",
    name: "",
    spec: "",
    action: "Thay đổi",
    oldQty: "",
    newQty: "",
    denominator: "1",
    waste: "",
    note: "",
  };
  const [creating, setCreating] = useState(Boolean(initialSku));
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkId, setBulkId] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageIsError,setMessageIsError]=useState(false);
  const [rows, setRows] = useState([emptyRow]);
  const [parentSku, setParentSku] = useState(initialSku);
  const [setupDate, setSetupDate] = useState(() =>
    new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }),
  );
  const [reason, setReason] = useState("");
  const [suggestRow, setSuggestRow] = useState<number | null>(null);
  const [suggestAnchor, setSuggestAnchor] = useState<HTMLInputElement | null>(null);
  const [replacementSuggestRow, setReplacementSuggestRow] = useState<
    number | null
  >(null);
  const [replacementSuggestAnchor, setReplacementSuggestAnchor] = useState<HTMLInputElement | null>(null);
  const [history, setHistory] = useState<BomChangeHistory[]>(
    () => bomChangeHistory,
  );
  const [selectedHistory, setSelectedHistory] =
    useState<BomChangeHistory | null>(null);
  const [detailHistory, setDetailHistory] =
    useState<BomChangeHistory | null>(null);
  const [editingId, setEditingId] = useState("");
  const [changeError, setChangeError] = useState("");
  const [changeSearchOpen, setChangeSearchOpen] = useState(false);
  const [changeSearchMode, setChangeSearchMode] = useState<
    "sku" | "document" | "status"
  >("sku");
  const [changeQueryInput, setChangeQueryInput] = useState("");
  const [changeQuery, setChangeQuery] = useState("");
  useApprovalNavigation(['bom_change'],()=>{setCreating(false);setBulkOpen(false);setDetailHistory(null);setSelectedHistory(null);setChangeSearchOpen(true);setChangeSearchMode('status');setChangeQueryInput('Chờ xác nhận');setChangeQuery('Chờ xác nhận');});
  const nextChangeId = () => {
    const key = setupDate.replaceAll("-", "");
    const prefix = `BOM-DC-${key}-`;
    const next =
      Math.max(
        0,
        ...history
          .filter((item) => item.id.startsWith(prefix))
          .map((item) => Number(item.id.slice(prefix.length)) || 0),
      ) + 1;
    return `${prefix}${String(next).padStart(3, "0")}`;
  };
  useEffect(() => {
    recordFetch("/api/records?entity=bom_change")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => {
        assertCurrentClientSession(session);
        const saved = data.records.map(hydrateBomChangeRecord);
        bomChangeHistory = [
          ...saved,
          ...bomChangeHistory.filter(
            (item) =>
              !saved.some(
                (savedItem: BomChangeHistory) => savedItem.id === item.id,
              ),
          ),
        ];
        setHistory(bomChangeHistory);
      })
      .catch(() => {});
    recordFetch('/api/records?entity=bom').then(response=>response.ok?response.json():Promise.reject()).then(data=>{
      assertCurrentClientSession(session);
      const stored=new Map<string,BomCatalogRecord>(data.records.map((row:{key:string;payload:BomCatalogRecord})=>[row.key,normalizeBomIdentityDates(row.payload)]));
      bomCatalog=[...bomCatalog.map(item=>stored.get(item.sku)||item),...[...stored].filter(([sku])=>!bomCatalog.some(item=>item.sku===sku)).map(([,item])=>item)];
      setHistory(current=>[...current]);
    }).catch(()=>{});
  }, [dataRevision]);
  const updateRow = (index: number, key: string, value: string) =>
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, [key]: value } : row)),
    );
  const filteredChangeHistory = history.filter((record) => {
    const target =
      changeSearchMode === "sku"
        ? (record.skus || [record.sku]).join(" ")
        : changeSearchMode === "document"
          ? record.id
          : record.status;
    return target.toLowerCase().includes(changeQuery.trim().toLowerCase());
  });
  const changeStatuses = [
    "Chờ xác nhận",
    "Nháp",
    "Đã xác nhận",
    "Đã hủy",
    "Đã hủy xác nhận",
    ...history.map((record) => record.status),
  ].filter((status, index, values) => values.indexOf(status) === index);
  const isUnconfirmedChange = (record: BomChangeHistory | null) =>
    Boolean(record && ["Nháp", "Chờ xác nhận"].includes(record.status));
  const selectChangeMaterial = (index: number, value: string) => {
    const code = value.toUpperCase();
    const found = bomMasterOptions.find((item) => item.code === code);
    const currentItem = bomCatalog
      .find((item) => item.sku === parentSku)
      ?.items.find(
        (item) => item.code === code && bomLineActive(item),
      );
    setRows((current) =>
      current.map((row, i) =>
        i === index
          ? {
              ...row,
              code,
              ...(found
                ? {
                    name: found.name,
                    spec: found.spec,
                    oldQty: currentItem?.qty || row.oldQty,
                    denominator: currentItem?.denominator || "1",
                  }
                : {}),
            }
          : row,
      ),
    );
  };
  const selectReplacementMaterial = (index: number, value: string) => {
    const newCode = value.toUpperCase();
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, newCode } : row)),
    );
  };
  const moveToNextChange = (index: number) => {
    if (index === rows.length - 1)
      setRows((current) => [...current, { ...emptyRow, action: "Thêm mới" }]);
    setTimeout(
      () =>
        document
          .querySelector<HTMLInputElement>(
            `.workspace-session:not([hidden]) [data-change-code-row="${index + 1}"]`,
          )
          ?.focus(),
      0,
    );
  };
  const pendingForSku = (sku: string) =>
    history.find(
      (record) =>
        (record.skus || [record.sku]).includes(sku) &&
        record.id !== editingId &&
        record.status === "Chờ xác nhận",
    );
  const validateChangeSku = (sku: string) => {
    const normalizedSku = sku.trim().toUpperCase();
    const sourceBom = bomCatalog.find((item) => item.sku === normalizedSku);
    const duplicate = pendingForSku(normalizedSku);
    const error = !normalizedSku
      ? "Vui lòng nhập SKU thành phẩm/BTP cần thay đổi."
      : !sourceBom
        ? `Không thể tạo phiếu thay đổi cho SKU ${normalizedSku}: chưa có BOM nguồn. Vui lòng tạo và xác nhận BOM nguồn trước.`
        : duplicate
          ? `Không thể tạo phiếu mới. SKU ${normalizedSku} đang có phiếu ${duplicate.id} chờ xác nhận. Vui lòng xác nhận hoặc hủy phiếu trước.`
          : "";
    setChangeError(error);
    return error;
  };
  const startEdit = (record: BomChangeHistory) => {
    if (!isUnconfirmedChange(record)) return;
    if (!bomCatalog.some((item) => item.sku === record.sku)) {
      setMessage(
        `Không thể sửa phiếu ${record.id}: SKU ${record.sku} chưa có BOM nguồn. Chỉ có thể hủy phiếu này hoặc tạo BOM nguồn trước.`,
      );
      return;
    }
    setEditingId(record.id);
    setParentSku(record.sku);
    setReason(record.reason);
    const [day, month, year] = (record.setup || "").split("/");
    if (year && month && day) setSetupDate(`${year}-${month}-${day}`);
    setRows(record.lines.map((line) => ({ ...emptyRow, ...line })));
    setSelectedHistory(null);
    setDetailHistory(null);
    setChangeError("");
    setCreating(true);
  };
  const updateChangeStatus = async (record: BomChangeHistory, status: string) => {
    setBulkSaving(true);
    try {
      const response=await fetch(record.bulk?'/api/bom-bulk':'/api/bom-change',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:status==='Đã xác nhận'?'confirm':status==='Đã hủy xác nhận'?'undo':'cancel',key:record.id,expectedRevision:knownRecordRevision('bom_change',record.id)??null})});
      const data=await response.json();if(!response.ok)throw new Error(data.error);
      acceptRecordRevision('bom_change',record.id,data.revision);
      const updated=data.change as BomChangeHistory;
      bomChangeHistory=bomChangeHistory.map(item=>item.id===updated.id?updated:item);
      setHistory([...bomChangeHistory]);setSelectedHistory(updated);
      for(const bom of data.boms||[])bomCatalog=bomCatalog.map(item=>item.sku===bom.sku?normalizeBomIdentityDates(bom):item);
      for(const [sku,revision] of Object.entries(data.bomRevisions||{}))acceptRecordRevision('bom',sku,revision as string|null);
      setMessageIsError(false);setMessage(`Phiếu ${record.id}: ${updated.status}.`);
      window.dispatchEvent(new Event('onspa-approvals-changed'));
    }catch(error){setMessageIsError(true);setMessage(error instanceof Error?error.message:'Không thể xử lý phiếu.');}
    finally{setBulkSaving(false);}
  };
  const submitChange = async (status: "Nháp" | "Chờ xác nhận") => {
    if(bulkSaving)return;setBulkSaving(true);
    const sku=(parentSku||'').trim().toUpperCase(),id=editingId||nextChangeId();
    try {
      const response=await fetch('/api/bom-change',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'save',key:id,sku,status,reason,lines:rows.filter(row=>row.code.trim()),expectedRevision:knownRecordRevision('bom_change',id)??null,sourceRevision:knownRecordRevision('bom',sku)??null})});
      const data=await response.json();if(!response.ok)throw new Error(data.error);
      acceptRecordRevision('bom_change',id,data.revision);
      const record=data.change as BomChangeHistory;
      bomChangeHistory=[record,...bomChangeHistory.filter(item=>item.id!==id)];
      setHistory([...bomChangeHistory]);setSelectedHistory(record);setCreating(false);
      setMessageIsError(false);setMessage(`Đã lưu phiếu ${id}: ${record.status}. BOM chưa thay đổi cho đến khi xác nhận.`);
      window.dispatchEvent(new Event('onspa-approvals-changed'));onClose?.(status);
    }catch(error){setMessageIsError(true);setMessage(error instanceof Error?error.message:'Không thể lưu phiếu BOM.');}
    finally{setBulkSaving(false);}
  };
  return (
    <main
      className={`workspace warehouse-workspace${embedded ? " bom-change-embedded" : ""}`}
    >
      <div className="page-heading bom-change-title">
        <div>
          <PageTitle variant="menu-root">Phiếu thay đổi BOM</PageTitle>
        </div>
      </div>
      {embedded && creating && !bulkOpen && <StandardToolbar name="BomChangeContent" items={[
        toolbarConfig.action({onClick:()=>onClose?.()},"Trở lại danh sách BOM",true,"back", 'parent'),
      ]}/>}
      {!creating && (
        <StandardToolbar name="BomChangeContent" items={[embedded && !bulkOpen && toolbarConfig.action({onClick:()=>onClose?.()},"Trở lại danh sách BOM",true,"back", 'parent'),toolbarConfig.action({"onClick": () => {
              setSelectedHistory(null);
              setMessage("");
              setChangeQueryInput("");
              setChangeQuery("");
              setChangeSearchOpen(true);
            }},<><span>⌕</span>Tra cứu
          </>, true, "lookup"),
toolbarConfig.action({"onClick": () => {setBulkId(nextChangeId());setBulkOpen(true);setSelectedHistory(null);setMessage("");}},<>Sửa hàng loạt</>, true, "action"),
toolbarConfig.action({"disabled": bulkOpen || selectedHistory?.bulk || !isUnconfirmedChange(selectedHistory), disabledExplanation: bulkOpen ? "Đóng biểu mẫu sửa hàng loạt trước khi sửa phiếu riêng." : !selectedHistory ? "Chọn phiếu thay đổi BOM trước khi sửa." : selectedHistory.bulk ? "Phiếu này phải được chỉnh sửa bằng chức năng Sửa hàng loạt." : "Chỉ sửa phiếu chưa xác nhận.","onClick": () => selectedHistory && startEdit(selectedHistory)},<><span>✎</span>Sửa
          </>, true, "action"),
toolbarConfig.action({"disabled": !isUnconfirmedChange(selectedHistory), disabledExplanation: !selectedHistory ? "Chọn phiếu thay đổi BOM trước khi thao tác." : "Chỉ thực hiện thao tác này với phiếu chưa xác nhận.","onClick": () =>
              selectedHistory && updateChangeStatus(selectedHistory, "Đã hủy")},<><span>×</span>Hủy
          </>, true, "action"),
toolbarConfig.action({"disabled": !isUnconfirmedChange(selectedHistory), disabledExplanation: !selectedHistory ? "Chọn phiếu thay đổi BOM trước khi thao tác." : "Chỉ thực hiện thao tác này với phiếu chưa xác nhận.","onClick": () =>
              selectedHistory &&
              updateChangeStatus(selectedHistory, "Đã xác nhận")},<><span>✓</span>Xác nhận
          </>, true, "action"),
toolbarConfig.action({"disabled": !selectedHistory || selectedHistory.status !== "Đã xác nhận", disabledExplanation: !selectedHistory ? "Chọn phiếu thay đổi BOM trước khi thao tác." : "Chỉ hủy xác nhận phiếu đang ở trạng thái Đã xác nhận.","onClick": () =>
              selectedHistory &&
              updateChangeStatus(selectedHistory, "Đã hủy xác nhận")},<><span>↶</span>Hủy xác nhận
          </>, true, "action"),
changeSearchOpen && null,
changeSearchOpen && (
            toolbarConfig.group([toolbarConfig.field(<><span>TRA THEO</span></>,[toolbarConfig.select({"value": changeSearchMode,"onChange": (event) => {
                    setChangeSearchMode(
                      event.target.value as "sku" | "document" | "status",
                    );
                    setChangeQueryInput("");
                    setChangeQuery("");
                  }},<><option value="sku">SKU</option><option value="document">Mã phiếu</option><option value="status">Trạng thái</option></>)]),
toolbarConfig.field(<><span>NỘI DUNG TRA</span></>,[changeSearchMode === "status" ? (
                  toolbarConfig.select({"value": changeQueryInput,"onChange": (event) => {
                      setChangeQueryInput(event.target.value);
                      setChangeQuery(event.target.value);
                      setSelectedHistory(null);
                    }},<><option value="">Tất cả</option>{changeStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}</>)
                ) : (
                  toolbarConfig.group([toolbarConfig.input({"autoComplete": "off","value": changeQueryInput,"onChange": (event) => {
                        setChangeQueryInput(event.target.value);
                        setChangeQuery(event.target.value);
                        setSelectedHistory(null);
                      },"placeholder": changeSearchMode === "sku"
                          ? "Nhập SKU"
                          : "Nhập mã phiếu"})])
                )]),
toolbarConfig.action({"onClick": () => {
                  setChangeQueryInput("");
                  setChangeQuery("");
                  setSelectedHistory(null);
                }},<>Xóa lọc
              </>, true, "clear"),
toolbarConfig.action({"onClick": () => {
                  setChangeSearchOpen(false);
                  setChangeQueryInput("");
                  setChangeQuery("");
                  setSelectedHistory(null);
                }},<>Quay lại
              </>, true, "back", 'lookup')])
          ),
!changeSearchOpen && selectedHistory && (
            toolbarConfig.action({"onClick": () => setSelectedHistory(null)},<><span>←</span>Quay lại
            </>, true, "back", 'detail')
          )]} />
      )}
      {!bulkOpen && !selectedHistory?.bulk && creating && <RecordFiles
        module="bom"
        recordId={parentSku}
        label="Tài liệu thay đổi BOM"
      />}
      {bulkOpen ? (
        <BomBulkForm boms={syncBomCatalogSources(bomCatalog, sourceSkus)} materials={bomMasterOptions} pending={history} changeId={bulkId} onCancel={()=>setBulkOpen(false)} onSaved={(payload,revision)=>{
          if (session !== clientSessionGeneration()) return;
          const record=payload as unknown as BomChangeHistory;
          acceptRecordRevision('bom_change',record.id,revision);
          bomChangeHistory=[record,...bomChangeHistory.filter(item=>item.id!==record.id)];
          setHistory([...bomChangeHistory]);setSelectedHistory(record);setBulkOpen(false);
          setMessageIsError(false);setMessage(`Đã lưu phiếu ${record.id} cho ${record.skus?.length||0} SKU. Phiếu đang chờ xác nhận; BOM hiện hành chưa thay đổi.`);
          window.dispatchEvent(new Event('onspa-approvals-changed'));
        }}/>
      ) : creating ? (
        <section className="data-card bom-change-form">
          <div className="bom-change-head">
            <label>
              <span>MÃ PHIẾU THAY ĐỔI</span>
              <input value={editingId || nextChangeId()} readOnly />
            </label>
            <label className="bom-code-entry">
              <span>SKU THÀNH PHẨM / BTP</span>
              <input
                value={parentSku}
                onChange={(e) => {
                  setParentSku(e.target.value.toUpperCase());
                  setChangeError("");
                }}
                onBlur={() => validateChangeSku(parentSku)}
                placeholder="Nhập mã SKU"
              />
              {parentSku && !bomCatalog.some((x) => x.sku === parentSku) && (
                <div className="bom-compact-suggestions">
                  {bomCatalog
                    .filter((x) =>
                      `${x.sku} ${x.name}`
                        .toLowerCase()
                        .includes(parentSku.toLowerCase()),
                    )
                    .slice(0, 5)
                    .map((x) => (
                      <FeedbackActionButton
                        type="button"
                        key={x.sku}
                        onClick={() => {
                          setParentSku(x.sku);
                          setChangeError("");
                        }}
                      >
                        <b>{x.sku}</b>
                        <span>{x.name}</span>
                        <small>{x.spec || "—"}</small>
                      </FeedbackActionButton>
                    ))}
                </div>
              )}
            </label>
            {changeError && (
              <div className="bom-change-error">{changeError}</div>
            )}
            <label>
              <span>PHIÊN BẢN HIỆN TẠI</span>
              <input
                value={
                  bomCatalog.find((x) => x.sku === parentSku)?.version || "—"
                }
                readOnly
              />
            </label>
            <label>
              <span>PHIÊN BẢN MỚI</span>
              <input
                value={
                  parentSku
                    ? String(
                        Number(
                          bomCatalog.find((x) => x.sku === parentSku)
                            ?.version || 0,
                        ) + 1,
                      ).padStart(4, "0")
                    : "—"
                }
                readOnly
              />
            </label>
            <label>
              <span>NGÀY THIẾT LẬP</span>
              <input type="date" value={setupDate} readOnly />
            </label>
            <label>
              <span>LÝ DO THAY ĐỔI</span>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Bắt buộc nhập lý do"
              />
            </label>
          </div>
          <DataTable className="table-wrap">
            <table className="bom-change-table">
              <thead>
                <tr>
                  <th>MÃ LK/NVL</th>
                  <th>TÊN LK/NVL</th>
                  <th>QUY CÁCH</th>
                  <th>LOẠI THAY ĐỔI</th>
                  <th>MÃ LINH KIỆN MỚI</th>
                  <th>LƯỢNG DÙNG CŨ</th>
                  <th>LƯỢNG DÙNG MỚI</th>
                  <th>MẪU SỐ</th>
                  <th>HAO HỤT (%)</th>
                  <th>GHI CHÚ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const suggestions =
                    row.code
                      ? bomMasterOptions
                          .filter((x) =>
                            `${x.code} ${x.name}`
                              .toLowerCase()
                              .includes(row.code.toLowerCase()),
                          )
                          .slice(0, 5)
                      : [];
                  const replacementSuggestions =
                    row.newCode
                      ? bomMasterOptions
                          .filter((x) =>
                            `${x.code} ${x.name}`
                              .toLowerCase()
                              .includes(row.newCode.toLowerCase()),
                          )
                          .slice(0, 5)
                      : [];
                  return (
                    <tr key={i}>
                      <DataCell>
                        <div className="bom-code-entry">
                          <input
                            data-change-code-row={i}
                            value={row.code}
                            onFocus={(e) => {setSuggestAnchor(e.currentTarget);setSuggestRow(i)}}
                            onBlur={() =>
                              setTimeout(() => setSuggestRow(null), 120)
                            }
                            onChange={(e) => {
                              selectChangeMaterial(i, e.target.value);
                              setSuggestAnchor(e.currentTarget);
                              setSuggestRow(i);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "ArrowDown" && row.code.trim()) {
                                e.preventDefault();
                                setSuggestRow(null);
                                moveToNextChange(i);
                              }
                            }}
                            placeholder="Nhập mã"
                          />
                          {suggestRow === i && <BomCodeSuggestions anchor={suggestAnchor} options={suggestions || []} onSelect={code=>{selectChangeMaterial(i,code);setSuggestRow(null)}}/>}
                        </div>
                      </DataCell>
                      <DataCell>
                        <input className="autofill" value={row.name} readOnly />
                      </DataCell>
                      <DataCell>
                        <input className="autofill" value={row.spec} readOnly />
                      </DataCell>
                      <DataCell>
                        <select
                          value={row.action}
                          onChange={(e) =>
                            updateRow(i, "action", e.target.value)
                          }
                        >
                          <option>Thêm mới</option>
                          <option>Thay đổi</option>
                          <option>Ngừng sử dụng</option>
                        </select>
                      </DataCell>
                      <DataCell>
                        <div className="bom-code-entry">
                          <input
                            value={row.newCode}
                            disabled={row.action !== "Thay đổi"}
                            onFocus={(e) => {setReplacementSuggestAnchor(e.currentTarget);setReplacementSuggestRow(i)}}
                            onBlur={() =>
                              setTimeout(
                                () => setReplacementSuggestRow(null),
                                120,
                              )
                            }
                            onChange={(e) => {
                              selectReplacementMaterial(i, e.target.value);
                              setReplacementSuggestAnchor(e.currentTarget);
                              setReplacementSuggestRow(i);
                            }}
                            placeholder={
                              row.action === "Thay đổi"
                                ? "Nhập mã thay thế (nếu có)"
                                : "—"
                            }
                          />
                          {replacementSuggestRow === i && <BomCodeSuggestions anchor={replacementSuggestAnchor} options={replacementSuggestions || []} onSelect={code=>{selectReplacementMaterial(i,code);setReplacementSuggestRow(null)}}/>}
                        </div>
                      </DataCell>
                      <DataCell>
                        <input
                          value={row.oldQty}
                          onChange={(e) =>
                            updateRow(i, "oldQty", e.target.value)
                          }
                        />
                      </DataCell>
                      <DataCell>
                        <input
                          value={row.newQty}
                          onChange={(e) =>
                            updateRow(i, "newQty", e.target.value)
                          }
                        />
                      </DataCell>
                      <DataCell>
                        <input
                          value={row.denominator}
                          onChange={(e) =>
                            updateRow(i, "denominator", e.target.value)
                          }
                        />
                      </DataCell>
                      <DataCell>
                        <input
                          value={row.waste || ""}
                          onChange={(e) =>
                            updateRow(i, "waste", e.target.value)
                          }
                          onBlur={() => {
                            const value = normalizeBomWaste(row.waste);
                            if (value !== null) updateRow(i, "waste", value);
                          }}
                          placeholder="Nhập tỷ lệ %"
                        />
                      </DataCell>
                      <DataCell>
                        <input
                          value={row.note}
                          onChange={(e) => updateRow(i, "note", e.target.value)}
                        />
                      </DataCell>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </DataTable>
          <div className="document-footer-actions">
            <FeedbackActionButton
              className="outline-button"
              onClick={() => (onClose ? onClose() : setCreating(false))}
            >
              Hủy
            </FeedbackActionButton>
            <FeedbackActionButton
              className="primary-button"
              disabled={
                bulkSaving || Boolean(changeError) ||
                !bomCatalog.some(
                  (item) => item.sku === parentSku.trim().toUpperCase(),
                )
              } disabledExplanation={bulkSaving ? "Thao tác đang được xử lý. Vui lòng chờ hoàn tất rồi thử lại." : changeError || "Chọn SKU thành phẩm có trong danh mục BOM trước khi lưu."}
              onClick={() => submitChange("Chờ xác nhận")}
            >
              Lưu
            </FeedbackActionButton>
          </div>
          {message && <div className={`save-notice admin-operation-notice ${messageIsError?"error":"success"}`} role={messageIsError?"alert":"status"}>{message}</div>}
        </section>
      ) : (
        <>
          {message && (
            <div className={`save-notice bom-history-notice admin-operation-notice ${messageIsError?"error":"success"}`} role={messageIsError?"alert":"status"}>{message}</div>
          )}
          {selectedHistory?.bulk && selectedHistory.status === "Chờ xác nhận" && (
            <section className="bom-bulk-confirm"><h2>Xác nhận phiếu thay đổi BOM</h2>
              <p>{selectedHistory.id} · <BomChangeSkus sku={selectedHistory.sku} skus={selectedHistory.skus} id={selectedHistory.id} /></p>
              <p>Một lần xác nhận sẽ cập nhật tất cả BOM trong phiếu. Nếu một SKU đã thay đổi, toàn bộ lần xác nhận sẽ dừng để đối chiếu.</p>
              <FeedbackActionButton className="primary-button" disabled={bulkSaving} disabledExplanation={"Thao tác đang được xử lý. Vui lòng chờ hoàn tất rồi thử lại."} onClick={()=>updateChangeStatus(selectedHistory,"Đã xác nhận")}>{bulkSaving?"Đang xác nhận…":"Xác nhận phiếu"}</FeedbackActionButton>
              <FeedbackActionButton className="outline-button" disabled={bulkSaving} disabledExplanation={"Thao tác đang được xử lý. Vui lòng chờ hoàn tất rồi thử lại."} onClick={()=>updateChangeStatus(selectedHistory,"Đã hủy")}>Hủy phiếu</FeedbackActionButton>
            </section>
          )}
          <section className="data-card">
            <div className="section-title">
              <div>
                <h2>Lịch sử phiếu thay đổi</h2>
                <p className="bom-history-guide">
                  Nhấp một lần để chọn phiếu; nhấp hai lần để xem chi tiết.
                </p>
              </div>
            </div>
            <DataTable className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>MÃ PHIẾU</th>
                    <th>SKU</th>
                    <th>PHIÊN BẢN CŨ</th>
                    <th>PHIÊN BẢN MỚI</th>
                    <th>NGƯỜI LẬP</th>
                    <th>NGƯỜI SỬA</th>
                    <th>LẦN SỬA CUỐI</th>
                    <th>NGƯỜI XÁC NHẬN</th>
                    <th>NGÀY XÁC NHẬN</th>
                    <th>TRẠNG THÁI</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredChangeHistory.map((record) => (
                    <tr
                      key={record.id}
                      className={`history-row${selectedHistory?.id === record.id ? " selected" : ""}`}
                      onClick={() => setSelectedHistory(record)}
                      onDoubleClick={() => setDetailHistory(record)}
                    >
                      <DataCell>
                        <FeedbackActionButton className="sku-link"  >{record.id}</FeedbackActionButton>
                      </DataCell>
                      <DataCell><BomChangeSkus sku={record.sku} skus={record.skus} id={record.id} /></DataCell>
                      <DataCell>{record.bulk ? "Theo từng SKU" : record.oldVersion}</DataCell>
                      <DataCell>{record.bulk ? "Theo từng SKU" : record.newVersion}</DataCell>
                      <DataCell>{legacyBomChangeCreator(record)}</DataCell>
                      <DataCell>{bomChangeModifier(record)}</DataCell>
                      <DataCell kind="date">{displayAuditTime(record.modifiedAt)}</DataCell>
                      <DataCell>{bomChangeConfirmer(record)}</DataCell>
                      <DataCell kind="date">
                        {displayAuditTime(
                          record.confirmedAt ||
                            (record.effective !== "—"
                              ? record.effective
                              : undefined),
                        )}
                      </DataCell>
                      <DataCell className="bom-history-status-cell">
                        <span className="done-badge">{record.status}</span>
                      </DataCell>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTable>
          </section>
          {detailHistory && (
            <>
              <FeedbackActionButton
                className="overlay"
                aria-label="Đóng chi tiết lịch sử BOM"
                onClick={() => setDetailHistory(null)}
              />
              <aside className="detail-panel bom-history-panel">
                <div className="detail-header">
                  <div>
                    <p>LỊCH SỬ THAY ĐỔI BOM</p>
                    <h2>{detailHistory.id}</h2>
                    <span>
                      <BomChangeSkus sku={detailHistory.sku} skus={detailHistory.skus} id={detailHistory.id} /> · Phiên bản{" "}
                      {detailHistory.oldVersion} →{" "}
                      {detailHistory.newVersion}
                    </span>
                  </div>
                  <FeedbackActionButton onClick={() => setDetailHistory(null)}>×</FeedbackActionButton>
                </div>
                <div className="detail-scroll">
                  <section>
                    <h3>Thông tin thay đổi</h3>
                    <div className="bom-audit-summary">
                      <div>
                        <span>Người lập</span>
                        <b>{legacyBomChangeCreator(detailHistory)}</b>
                        <small>
                          {displayAuditTime(
                            detailHistory.createdAt || detailHistory.setup,
                          )}
                        </small>
                      </div>
                      <div>
                        <span>Người sửa gần nhất</span>
                        <b>{bomChangeModifier(detailHistory)}</b>
                        <small>
                          {displayAuditTime(detailHistory.modifiedAt)}
                        </small>
                      </div>
                      <div>
                        <span>Người xác nhận</span>
                        <b>{bomChangeConfirmer(detailHistory)}</b>
                        <small>
                          {displayAuditTime(
                            detailHistory.confirmedAt ||
                              (detailHistory.effective !== "—"
                                ? detailHistory.effective
                                : undefined),
                          )}
                        </small>
                      </div>
                      <div>
                        <span>Lý do thay đổi</span>
                        <b>{detailHistory.reason || "—"}</b>
                        <small>{detailHistory.status}</small>
                      </div>
                    </div>
                  </section>
                  {detailHistory.bulk && detailHistory.skus && <section><h3>Phiên bản áp dụng theo SKU</h3><div className="bom-bulk-eligibility">{detailHistory.skus.map(sku=><span key={sku}>{sku} · {detailHistory.oldVersions?.[sku]} → {detailHistory.newVersions?.[sku]}</span>)}</div></section>}
                  <section>
                    <h3>
                      Chi tiết vật tư thay đổi · {detailHistory.lines.length}{" "}
                      dòng
                    </h3>
                    <DataTable className="table-wrap">
                      <table className="bom-drawer-lines">
                        <thead>
                          <tr>
                            <th>MÃ CŨ → MỚI</th>
                            <th>TÊN / QUY CÁCH</th>
                            <th>LOẠI</th>
                            <th>LƯỢNG CŨ</th>
                            <th>LƯỢNG MỚI</th>
                            <th>MẪU SỐ</th>
                            <th>HAO HỤT</th>
                            <th>GHI CHÚ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailHistory.lines.map((line, index) => (
                            <tr key={`${line.code}-${index}`}>
                              <DataCell kind="code">
                                {line.newCode
                                  ? `${line.code} → ${line.newCode}`
                                  : line.code}
                              </DataCell>
                              <DataCell>
                                <b>{line.name}</b>
                                <small>{line.spec || "—"}</small>
                              </DataCell>
                              <DataCell>
                                <span className="change-badge">
                                  {line.action}
                                </span>
                              </DataCell>
                              <DataCell kind="number">{line.oldQty}</DataCell>
                              <DataCell kind="number">{line.newQty}</DataCell>
                              <DataCell kind="number">{line.denominator}</DataCell>
                              <DataCell kind="number">{line.waste || "—"}</DataCell>
                              <DataCell>{line.note || "—"}</DataCell>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </DataTable>
                  </section>
                </div>
              </aside>
            </>
          )}
        </>
      )}
    </main>
  );
}

function ProductionContent({
  allocationOnly = false,
  actualScheduleAllowed,
  confirmReportAllowed,
  preferenceUser,
  section,
  sessionLine,
  operator,
  isManager,
  onNavigateSummary,
}: {
  allocationOnly?: boolean;
  actualScheduleAllowed?: boolean;
  confirmReportAllowed?: boolean;
  preferenceUser?: string;
  section: string;
  sessionLine?: "A" | "B";
  operator: string;
  isManager?: boolean;
  onNavigateSummary?: () => void;
}) {
  // A queue capability never mounts the legacy workflow or its broad readers.
  if (allocationOnly && section === "capacity-calendar") return (
    <main className="workspace production-workspace">
      <div className="page-heading"><PageTitle variant="menu-root">Lịch làm việc dự kiến</PageTitle></div>
      <ProductionAllocationWorkspace identity={`${preferenceUser || ""}:allocation`} refresh={async () => true} />
    </main>
  );
  const modes: Record<string, "payroll" | "schedule" | "work" | "review" | "progress" | "journal" | "output" | "reports" | "labor" | "capacity" | "recovery" | "correction"> = {
    "production-report": "work",
    "report-work": "work",
    "report-review": "schedule",
    "report-progress": "progress",
    "report-dashboard": "journal",
    "report-output": "output",
    "report-payroll": "payroll",
    "report-cancel": "correction",
    "labor-adjustment": "labor",
    "labor-add": "labor",
    "labor-reduce": "labor",
    "weekly-capacity": "capacity",
    "data-recovery": "recovery",
  };
  if (section === "weekly-capacity" || section === "capacity-summary") return <WeeklyCapacity view="summary" sessionLine={sessionLine} />;
  if (section === "capacity-calendar") return <WeeklyCapacity view="calendar" allocationIdentity={preferenceUser} sessionLine={sessionLine} onNavigateSummary={onNavigateSummary} />;
  if (modes[section])
    return <ProductionManagement actualScheduleAllowed={actualScheduleAllowed} confirmReportAllowed={confirmReportAllowed} preferenceUser={preferenceUser} mode={modes[section]} sessionLine={sessionLine} operator={operator} isManager={isManager} />;
  const titles: Record<string, string> = {
    "report-station": "Nhập trạm dòng đang chọn",
    "report-pause": "Tạm ngưng dòng đang chọn",
    "report-resume": "Tiếp tục dòng đang chọn",
    "report-complete": "Báo công dòng đang chọn",
    "report-incident": "Báo sự cố dòng đang chọn",
    "report-labor": "Điều chỉnh nhân lực báo công",
    "report-time": "Điều chỉnh thời gian sản xuất",
    "labor-add": "Bổ sung nhân lực",
    "labor-reduce": "Giảm nhân lực",
    "data-recovery": "Khôi phục dữ liệu",
    "weekly-capacity": "Capacity tuần",
  };
  return (
    <main className="workspace">
      <RecordFiles module="reports" label="Tệp nhập và báo cáo sản xuất" />
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            QUẢN LÝ SẢN XUẤT{sessionLine ? ` / LINE ${sessionLine}` : ""}
          </p>
          <PageTitle variant="menu-root">{titles[section]}</PageTitle>
          <p>
            {sessionLine
              ? `Phiên đăng nhập nhanh chỉ xem dữ liệu và báo công Line ${sessionLine}.`
              : `Nội dung nghiệp vụ sẽ được thiết kế chi tiết ở bước tiếp theo.`}
          </p>
        </div>
        {sessionLine && (
          <span className="line-session-badge">
            Đang thao tác · Line {sessionLine}
          </span>
        )}
      </div>
      <section className="data-card module-placeholder">
        <span>
          {sessionLine
            ? `Dữ liệu Quản lý sản xuất và quyền báo công được giới hạn theo phiên đăng nhập Line ${sessionLine}.`
            : "Chức năng đã được đưa vào đúng cấu trúc menu."}
        </span>
      </section>
    </main>
  );
}

type LoginSession =
  | {
      kind: "account";
      login: string;
      name: string;
      detail: string;
      role: string;
      isAdmin: boolean;
      grants: string[];
      allocationGroup?: "C" | "AB" | null;
      isSetupAdmin?: boolean;
      setupAdminExpiresAt?: string | null;
    }
  | { kind: "line"; line: "A" | "B"; login?: string; name: string; detail: string };

function restoredLoginSession(user: {login:string; name?:string; email?:string; role?:string; isAdmin?:boolean; grants?:string[]; allocationGroup?:"C"|"AB"|null; authMode?:string; line?:"A"|"B"; isSetupAdmin?:boolean; setupAdminExpiresAt?:string|null}): LoginSession {
  if(user.authMode === "quick_line" && (user.line === "A" || user.line === "B"))return {kind:"line",login:user.login,line:user.line,name:user.name || `Line ${user.line}`,detail:`Sản xuất · Line ${user.line}`};
  return {kind:"account",login:user.login,name:user.name || user.email || user.login,detail:user.isSetupAdmin?"SUPER_ADMIN · CHẾ ĐỘ THIẾT LẬP":user.isAdmin?"Quản trị ONSPA":"Tài khoản ONSPA",role:user.role || "USER",isAdmin:user.isAdmin===true,grants:Array.isArray(user.grants)?user.grants:[],allocationGroup:user.allocationGroup === "C" || user.allocationGroup === "AB" ? user.allocationGroup : null,isSetupAdmin:user.isSetupAdmin===true,setupAdminExpiresAt:user.setupAdminExpiresAt||null};
}

type PendingApprovalGroup = {
  entity: string;
  label: string;
  view: MainView;
  child: string;
  count: number;
  records?: Array<{ key: string; updatedAt: string }>;
};

type ActiveViewer = {
  login: string;
  name: string;
  department?: string;
  role?: string;
  lastSeenAt: string;
};

const normalizedGrant = (value: string) =>
  value
    .toLocaleLowerCase("vi")
    .replaceAll("_", " ")
    .replace(/\s+/g, " ")
    .trim();
const moduleGrantLabels: Record<Exclude<MainView, "users">, string> = {
  sku: "Dữ liệu cơ bản",
  warehouse: "Quản lý kho",
  bom: "Cấu trúc thành phẩm",
  planning: "Kế hoạch sản xuất",
  production: "Quản lý sản xuất",
};
const childGrantLabels: Record<string, string> = {
  "sku:sku-master": "Dữ liệu cơ bản / SKU Master",
  "sku:employees": "Dữ liệu cơ bản / Danh sách nhân viên",
  "sku:leadtime": "Dữ liệu cơ bản / Leadtime",
  "sku:labor-hours": "Dữ liệu cơ bản / Giờ công",
  "sku:safety-days": "Dữ liệu cơ bản / Quy tắc Safety Days",
  "warehouse:warehouse-overview": "Quản lý kho / Tổng quan",
  "warehouse:inventory": "Quản lý kho / Tồn kho ERP",
  "warehouse:warehouse-in": "Quản lý kho / Nhập kho",
  "warehouse:warehouse-out": "Quản lý kho / Xuất kho",
  "warehouse:warehouse-transfer": "Quản lý kho / Chuyển kho",
  "warehouse:warehouse-docs": "Quản lý kho / Phiếu kho",
  "warehouse:warehouse-count": "Quản lý kho / Kiểm kê",
  "warehouse:warehouse-report": "Quản lý kho / Báo cáo",
  "bom:bom-data": "Cấu trúc thành phẩm / Dữ liệu lượng dùng BOM",
  "bom:bom-change": "Cấu trúc thành phẩm / Phiếu thay đổi BOM",
  "planning:base": "Kế hoạch sản xuất / Base_forecast",
  "planning:demand": "Kế hoạch sản xuất / Demand_event",
  "planning:proposal": "Kế hoạch sản xuất / Production_engine",
  "planning:rules": "Kế hoạch sản xuất / Quy tắc áp dụng",
  "planning:plan": "Kế hoạch sản xuất / Production_plan",
  "planning:tracking": "Kế hoạch sản xuất / In_transit",
  "planning:report": "Kế hoạch sản xuất / Report",
  "production:production-report": "Quản lý sản xuất",
  "production:report-work": "Quản lý sản xuất / Báo công sản xuất",
  "production:report-review": "Quản lý sản xuất / Lịch SX thực tế",
  "production:report-progress": "Quản lý sản xuất / Tiến độ sản xuất",
  "production:report-dashboard": "Quản lý sản xuất / Nhật ký",
  "production:report-cancel": "Quản lý sản xuất / Điều chỉnh báo công",
  "production:report-output": "Quản lý sản xuất / Sản lượng và giờ công",
  "production:report-payroll": "Quản lý sản xuất / Hiệu suất và tính sản lượng",
  "production:capacity-calendar": "Quản lý sản xuất / Capacity tuần",
  "production:capacity-summary": "Quản lý sản xuất / Capacity tuần",
  "production:labor-adjustment": "Quản lý sản xuất / Điều chỉnh nhân lực",
  "production:data-recovery": "Quản lý sản xuất / Khôi phục dữ liệu",
  "production:weekly-capacity": "Quản lý sản xuất / Capacity tuần",
};
const canOpenLegacyMenu = (
  session: LoginSession | null,
  view: MainView,
  child?: string,
) => {
  if (!session) return false;
  if (session.kind === "line") return view === "production" && (!child || ["production-report","report-work","report-review","report-progress","report-dashboard","report-cancel","report-output","report-payroll","weekly-capacity","capacity-calendar","capacity-summary"].includes(child));
  if (session.isAdmin) return true;
  if (view === "users") return false;
  const resolvedChild = child;
  const label = resolvedChild
    ? childGrantLabels[`${view}:${resolvedChild}`]
    : moduleGrantLabels[view];
  if (!label) return false;
  const target = normalizedGrant(label);
  return (
    session.grants.some((grant) => normalizedGrant(grant).includes(target)) ||
    (view === "sku" &&
      (!resolvedChild || resolvedChild === "employees") &&
      session.grants.some((grant) =>
        normalizedGrant(grant).includes(
          normalizedGrant("Quản lý sản xuất / Capacity tuần"),
        ),
      )) ||
    (view === "sku" &&
      resolvedChild === "labor-hours" &&
      session.grants.some((grant) =>
        normalizedGrant(grant).includes(
          normalizedGrant("Dữ liệu cơ bản / SKU Master"),
        ),
      ))
  );
};

// This is navigation only. API authorization remains scoped independently on the server.
const hasAllocationCapability = (session: LoginSession | null) =>
  session?.kind === "account" && (session.allocationGroup === "C" || session.allocationGroup === "AB");
const canOpenMenu = (session: LoginSession | null, view: MainView, child?: string) =>
  (child === "department-changes" ? !!(session?.kind === "account" && (["planning","production","warehouse"].includes(view) && (session.isAdmin || !!requestDepartment(session.login)))) : canOpenLegacyMenu(session, view, child)) ||
  (hasAllocationCapability(session) && view === "production" && (!child || child === "capacity-calendar"));
const allocationOnlySchedule = (session: LoginSession | null) =>
  hasAllocationCapability(session) && !canOpenLegacyMenu(session, "production", "capacity-calendar");

function LoginGate({
  onLogin,
  language,
  onLanguage,
}: {
  onLogin: (session: LoginSession) => void;
  language: Language;
  onLanguage: (language: Language) => void;
}) {
  const [availableLines,setAvailableLines] = useState<string[]>(LOCAL_TEST?["A","B"]:[]);
  useEffect(()=>{if(LOCAL_TEST)return;let active=true;fetch("/api/auth/lines",{cache:"no-store"}).then(r=>r.json()).then(data=>{if(active)setAvailableLines(Array.isArray(data.lines)?data.lines:[])}).catch(()=>{});return ()=>{active=false}},[]);
  const loginLine = async (line:"A"|"B") => {
    if(LOCAL_TEST){onLogin({kind:"line",line,login:`LINE_${line}`,name:`Line ${line}`,detail:`Sản xuất · Line ${line}`});return;}
    setBusy(true);setError("");
    try {
      const response=await fetch("/api/auth/line-login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({line})});
      const result=await response.json();if(!response.ok)throw new Error(result.error || "Không đăng nhập được Line.");
      const sessionResponse=await fetch("/api/site-session",{cache:"no-store"}),data=await sessionResponse.json();
      if(!sessionResponse.ok||!data.authenticated||data.user?.line!==line||data.user?.authMode!=="quick_line")throw new Error("Không xác minh được phiên Line.");
      onLogin(restoredLoginSession(data.user));
    } catch(error){setError(error instanceof Error?error.message:"Không kết nối được máy chủ.");}
    finally {setBusy(false);}
  };
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [remember, setRemember] = useState(true);
  const [activation, setActivation] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [notice, setNotice] = useState("");
  const [loginMode, setLoginMode] = useState<"user" | "admin">("user");
  const [setupAdmin, setSetupAdmin] = useState<{
    enabled: boolean;
    authorized: boolean;
    expiresAt: string | null;
  }>({ enabled: false, authorized: false, expiresAt: null });
  useEffect(() => {
    if (LOCAL_TEST) return;
    let active = true;
    (async () => {
      const params = new URLSearchParams(window.location.hash.slice(1)),
        value = params.get("activate"),
        setupToken = params.get("setup-admin");
      if (value) setActivation(value);
      if (value || setupToken)
        window.history.replaceState(
          null,
          "",
          window.location.pathname + window.location.search,
        );
      if (setupToken) {
        setLoginMode("admin");
        try {
          const response = await fetch("/api/auth/setup-admin/activate", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ token: setupToken }),
            }),
            data = await response.json();
          if (!response.ok)
            throw new Error(
              data.error || "Không kích hoạt được quyền thiết lập.",
            );
          if (active)
            setNotice("Thiết bị đã được cấp quyền Admin thiết lập tạm thời.");
        } catch (reason) {
          if (active)
            setError(
              reason instanceof Error
                ? reason.message
                : "Không kích hoạt được quyền thiết lập.",
            );
        }
      }
      try {
        const response = await fetch("/api/auth/setup-admin/status", {
            cache: "no-store",
          }),
          data = await response.json();
        if (active && response.ok)
          setSetupAdmin({
            enabled: data.enabled === true,
            authorized: data.authorized === true,
            expiresAt: data.expiresAt || null,
          });
      } catch {}
    })();
    return () => {
      active = false;
    };
  }, []);
  const [error, setError] = useState("");
  const [setupRequired, setSetupRequired] = useState(false);
  useEffect(() => {
    if (!LOCAL_TEST) return;
    fetch("/api/test-environment")
      .then((r) => r.json())
      .then((data) => setSetupRequired(data.setupRequired === true))
      .catch(() => setError("Không xác minh được môi trường TEST."));
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const setupLogin =
        !LOCAL_TEST &&
        !activation &&
        loginMode === "admin" &&
        setupAdmin.enabled &&
        setupAdmin.authorized;
      const response = await fetch(
        LOCAL_TEST
          ? "/api/test-session"
          : activation
            ? "/api/auth/activate"
            : setupLogin
              ? "/api/auth/setup-admin"
              : "/api/auth/login",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            login: userId.trim(),
            password,
            passwordConfirm,
            token: activation,
            remember,
            setup: setupRequired,
            loginMode,
          }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Không đăng nhập được.");
        return;
      }
      setPassword("");
      setError("");
      if (activation) {
        setActivation("");
        setPasswordConfirm("");
        setUserId(data.login);
        setNotice("Đã đặt mật khẩu. Hãy đăng nhập bằng tài khoản của bạn.");
        return;
      }
      if (LOCAL_TEST) {
        onLogin({
          kind: "account",
          login: data.name,
          name: data.name,
          detail: "Tài khoản TEST local",
          role: "SUPER_ADMIN",
          isAdmin: true,
          grants: [],
        });
        return;
      }
      const sessionResponse = await fetch("/api/site-session", {
          cache: "no-store",
        }),
        sessionData = await sessionResponse.json();
      if (!sessionResponse.ok || !sessionData.authenticated) throw new Error();
      const current = sessionData.user;
      onLogin(restoredLoginSession(current));
    } catch {
      setError("Không kết nối được máy chủ đăng nhập.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-gate">
      <div className="login-language">
        <span>Ngôn ngữ / 語言</span>
        <LanguageSwitch language={language} onChange={onLanguage} />
      </div>
      <section className="login-stage">
        <div className="login-intro">
          <img
            className="login-brand-logo"
            src="/logo-onspa.jpg"
            alt="ONSPA — Work with Passion"
          />
          <p>HỆ THỐNG QUẢN TRỊ SẢN XUẤT</p>
          <span>Kế hoạch sản xuất · Báo công · Kho · Dữ liệu dùng chung</span>
        </div>
        <form className="login-box" onSubmit={submit} onInvalid={() => notifyActionFailure("Thông tin bắt buộc còn thiếu hoặc chưa hợp lệ. Kiểm tra các trường được đánh dấu trước khi tiếp tục.")}>
          <div className="login-box-head">
            <img src="/logo-onspa.jpg" alt="ONSPA" />
            <span>HỆ THỐNG NỘI BỘ</span>
          </div>
          <h2>
            {activation
              ? "Đặt mật khẩu quản trị ONSPA"
              : !LOCAL_TEST
                ? loginMode === "admin"
                  ? "Đăng nhập Admin"
                  : "Đăng nhập người dùng"
                : setupRequired
                  ? "Tạo tài khoản TEST trên máy này"
                  : "Đăng nhập TEST"}
          </h2>
          <p>
            {!LOCAL_TEST
              ? loginMode === "admin"
                ? "Chỉ tài khoản có vai trò ADMIN hoặc SUPER_ADMIN mới được truy cập."
                : "Nhập tài khoản hoặc email và mật khẩu ONSPA của bạn."
              : setupRequired
                ? "Đặt tên tài khoản và mật khẩu đúng 4 chữ số. Tài khoản chỉ lưu trên máy này."
                : "Dùng tài khoản TEST của máy này. Đăng nhập nhanh Line chỉ dùng xem giao diện."}
          </p>
          {!LOCAL_TEST && !activation && (
            <div
              className="login-mode-switch"
              role="tablist"
              aria-label="Loại đăng nhập"
            >
              <FeedbackActionButton
                type="button"
                role="tab"
                aria-selected={loginMode === "user"}
                className={loginMode === "user" ? "active" : ""}
                onClick={() => {
                  setLoginMode("user");
                  setError("");
                }}
              >
                Đăng nhập người dùng
              </FeedbackActionButton>
              <FeedbackActionButton
                type="button"
                role="tab"
                aria-selected={loginMode === "admin"}
                className={loginMode === "admin" ? "active admin" : ""}
                onClick={() => {
                  setLoginMode("admin");
                  setError("");
                }}
              >
                Đăng nhập Admin
              </FeedbackActionButton>
            </div>
          )}
          {!LOCAL_TEST &&
            !activation &&
            loginMode === "admin" &&
            setupAdmin.enabled &&
            setupAdmin.authorized && (
              <div className="setup-admin-warning" role="alert">
                <b>CHẾ ĐỘ THIẾT LẬP</b>
                <span>
                  Nút Admin đang được phép tự động đăng nhập trên thiết bị này.
                  Phải tắt chế độ này trước khi đưa website vào sử dụng chính
                  thức.
                </span>
                {setupAdmin.expiresAt && (
                  <small>
                    Hết hạn:{" "}
                    {formatDateTimeDisplay(setupAdmin.expiresAt)}
                  </small>
                )}
              </div>
            )}
          {!activation && loginMode === "user" && <>
            <div className="quick-line-login">
              <span>ĐĂNG NHẬP LINE · KHÔNG CẦN ID VÀ MẬT KHẨU</span>
              <div>{(["A", "B"] as const).map(line => (
                <FeedbackActionButton key={line} type="button" disabled={busy || !availableLines.includes(line)} disabledExplanation={busy ? "Thao tác đang được xử lý. Vui lòng chờ hoàn tất rồi thử lại." : "Tài khoản Line chưa hoạt động nên chưa thể đăng nhập."} onClick={() => loginLine(line)} title={availableLines.includes(line) ? undefined : "User Line chưa hoạt động"}>
                  <b aria-hidden="true">{line}</b>
                  <em>Đăng nhập line {line}</em>
                </FeedbackActionButton>
              ))}</div>
            </div>
            <div className="login-divider"><span>hoặc đăng nhập bằng tài khoản</span></div>
          </>}
          {!(
            loginMode === "admin" &&
            setupAdmin.enabled &&
            setupAdmin.authorized
          ) &&
            !activation && (
              <label>
                <span>Tài khoản hoặc email</span>
                <input
                  autoFocus
                  autoComplete="username"
                  required
                  value={userId}
                  onChange={(e) => {
                    setUserId(e.target.value);
                    setError("");
                  }}
                  placeholder="Nhập tài khoản hoặc email"
                />
              </label>
            )}
          {!(
            loginMode === "admin" &&
            setupAdmin.enabled &&
            setupAdmin.authorized
          ) && (
            <label>
              <span>Mật khẩu</span>
              <div className="login-password-field">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete={
                    activation ? "new-password" : "current-password"
                  }
                  minLength={4}
                  maxLength={64}
                  required
                  title="Mật khẩu từ 4 đến 64 ký tự"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  placeholder="Nhập mật khẩu"
                />
                <FeedbackActionButton
                  className={
                    showPassword ? "password-eye is-visible" : "password-eye"
                  }
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 4.2A10.5 10.5 0 0112 4c5.5 0 9 5 9 5a16 16 0 01-2.1 2.7M6.6 6.6C4.3 8 3 10 3 10s3.5 5 9 5c1.2 0 2.3-.2 3.3-.6" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M3 12s3.5-5 9-5 9 5 9 5-3.5 5-9 5-9-5-9-5z" />
                      <circle cx="12" cy="12" r="2.5" />
                    </svg>
                  )}
                </FeedbackActionButton>
              </div>
            </label>
          )}
          {activation && (
            <label>
              <span>Nhập lại mật khẩu</span>
              <input
                type="password"
                autoComplete="new-password"
                inputMode="numeric"
                pattern="[0-9]{4}"
                minLength={4}
                maxLength={4}
                required
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
              />
            </label>
          )}
          {!(
            loginMode === "admin" &&
            setupAdmin.enabled &&
            setupAdmin.authorized
          ) && (
            <label className="remember-login">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <span>Nhớ tôi trên thiết bị này</span>
            </label>
          )}
          {error && <div className="login-error">{error}</div>}
          {notice && <p role="status">{notice}</p>}
          <FeedbackActionButton
            className={
              loginMode === "admin" && setupAdmin.authorized
                ? "setup-admin-login-button"
                : undefined
            }
            type="submit"
            disabled={busy} disabledExplanation={"Thao tác đang được xử lý. Vui lòng chờ hoàn tất rồi thử lại."}
          >
            {busy
              ? "Đang xử lý…"
              : activation
                ? "Đặt mật khẩu"
                : loginMode === "admin" &&
                    setupAdmin.enabled &&
                    setupAdmin.authorized
                  ? language === "zh"
                    ? "管理員登入"
                    : "Đăng nhập Admin"
                  : "Đăng nhập"}
          </FeedbackActionButton>
          <small className="preview-account">
            Chỉ người dùng được phân quyền mới được phép truy cập.
          </small>
        </form>
      </section>
    </main>
  );
}

const safetyRuleStatusClass = (value: string) =>
  value === "Đang áp dụng" || value === "Đã xác nhận"
    ? "active"
    : value === "Chờ xác nhận"
      ? "pending"
      : value === "Sắp có hiệu lực"
        ? "future"
        : value === "Hết hiệu lực"
          ? "expired"
          : "draft";
const validateLeadTimeRules = (items: SafetyRuleRange[]) => {
  const sorted = [...items].sort((a, b) => a.from - b.from);
  if (!sorted.length || sorted[0].from !== 1)
    return "Khoảng Lead Time phải bắt đầu từ 1.";
  for (let i = 0; i < sorted.length; i++) {
    const row = sorted[i];
    if (
      !Number.isInteger(row.from) ||
      row.from < 1 ||
      !Number.isInteger(row.days) ||
      row.days < 1
    )
      return "Lead Time và số ngày an toàn phải là số nguyên dương.";
    if (row.to !== null && (!Number.isInteger(row.to) || row.from > row.to))
      return "Lead Time từ phải nhỏ hơn hoặc bằng Lead Time đến.";
    if (
      i < sorted.length - 1 &&
      (row.to === null || row.to + 1 !== sorted[i + 1].from)
    )
      return "Khoảng Lead Time không được chồng nhau hoặc bị thiếu.";
  }
  return sorted.at(-1)?.to !== null ? "Dòng cuối phải là Không giới hạn." : "";
};

function LegacySafetyRulesView() {
  const session = useRef(clientSessionGeneration()).current;
  const dataRevision = useDataRefresh(['safety_rules', 'safety_rule_groups', 'leadtime_versions', 'labor_hours']);
  const [rules, setRules] = useState<SafetyRuleSet[]>([defaultSafetyRuleSet]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Tất cả trạng thái");
  const [editing, setEditing] = useState<SafetyRuleSet | null>(null);
  const [notice, setNotice] = useState("");
  const [history, setHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const operator = "sample_user_15";
  useEffect(() => {
    recordFetch("/api/records?entity=safety_rules")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(async (data) => {
        assertCurrentClientSession(session);
        const saved = data.records
          .map((x: { payload: SafetyRuleSet }) => x.payload)
          .filter((x: SafetyRuleSet) => !x._deleted);
        const next = saved.length ? saved : [defaultSafetyRuleSet];
        safetyRuleSets = next;
        setRules(next);
      })
      .catch(() => setNotice("Không thể tải bộ quy tắc đã lưu."));
  }, [dataRevision]);
  const selected = rules.find((x) => x.id === selectedId) || null;
  const filtered = rules.filter(
    (x) =>
      (status === "Tất cả trạng thái" || x.status === status) &&
      (!query ||
        `${x.code} ${x.name} ${x.version} ${x.createdBy} ${x.confirmedBy || ""}`
          .toLowerCase()
          .includes(query.toLowerCase())),
  );
  const persist = async (next: SafetyRuleSet, before: SafetyRuleSet | null, action: string) => {
    setSaving(true);
    try {
      const response = await linkedRecordFetch("safety-rule", [{
        entity: "safety_rules", key: next.id, payload: next,
        audit: {action,ruleId:next.id,before,after:next,reason:next.changeReason},
      }]);
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || "Không thể lưu bộ quy tắc.");
      const list = [next, ...rules.filter(x => x.id !== next.id)];
      setRules(list); safetyRuleSets = list; setSelectedId(next.id); setEditing(null);
      setNotice(`Đã ${action.toLowerCase()} ${next.code} · ${next.version}.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Không thể lưu bộ quy tắc."); }
    finally { setSaving(false); }
  };
  const openNew = (source?: SafetyRuleSet) => {
    const now = new Date().toISOString();
    const serial = rules.length + 1;
    setEditing({
      ...structuredClone(source || defaultSafetyRuleSet),
      id: browserId(),
      code: `SDR-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}`,
      name: source ? `${source.name} (bản sao)` : "Quy tắc Safety Days",
      version: `V${serial}`,
      effectiveFrom: "",
      effectiveTo: "",
      status: "Nháp",
      createdBy: operator,
      createdAt: now,
      updatedBy: operator,
      updatedAt: now,
      confirmedBy: undefined,
      confirmedAt: undefined,
      changeReason: "",
      usedByPlans: [],
    });
  };
  const confirmRule = async (rule: SafetyRuleSet) => {
    const validation = validateLeadTimeRules(rule.leadTimeRules);
    if (validation) {
      setNotice(validation);
      return;
    }
    const overlap = rules.find(
      (x) =>
        x.id !== rule.id &&
        ["Đã xác nhận", "Đang áp dụng", "Sắp có hiệu lực"].includes(x.status) &&
        rule.effectiveFrom <= (x.effectiveTo || "9999-12-31") &&
        (rule.effectiveTo || "9999-12-31") >= x.effectiveFrom,
    );
    if (overlap) {
      setNotice(
        `Thời gian hiệu lực chồng với ${overlap.code} · ${overlap.version}.`,
      );
      return;
    }
    const reason = window.prompt(
      "Nhập lý do xác nhận bộ quy tắc:",
      rule.changeReason,
    );
    if (!reason) return;
    const now = new Date().toISOString();
    await persist(
      {
        ...rule,
        status: "Đã xác nhận",
        confirmedBy: operator,
        confirmedAt: now,
        changeReason: reason,
        updatedBy: operator,
        updatedAt: now,
      },
      rule,
      "Xác nhận",
    );
  };
  const unconfirm = async (rule: SafetyRuleSet) => {
    if (rule.usedByPlans?.length) {
      setNotice(
        "Bộ quy tắc đã được Production Engine sử dụng. Hãy kết thúc hiệu lực và tạo phiên bản thay thế.",
      );
      return;
    }
    const reason = window.prompt("Nhập lý do hủy xác nhận:");
    if (!reason) return;
    await persist(
      {
        ...rule,
        status: "Nháp",
        confirmedBy: undefined,
        confirmedAt: undefined,
        changeReason: reason,
        updatedBy: operator,
        updatedAt: new Date().toISOString(),
      },
      rule,
      "Hủy xác nhận",
    );
  };
  const remove = async (rule: SafetyRuleSet) => {
    if (rule.status !== "Nháp" || rule.usedByPlans?.length) {
      setNotice("Chỉ được xóa bộ quy tắc Nháp chưa từng được sử dụng.");
      return;
    }
    if (!window.confirm(`Xóa bộ quy tắc ${rule.code} · ${rule.version}?`))
      return;
    const next = {
      ...rule,
      _deleted: true,
      updatedBy: operator,
      updatedAt: new Date().toISOString(),
    };
    await persist(next, rule, "Xóa");
    setSelectedId(null);
  };
  const exportRules = () => {
    const csv = [
      "Mã bộ quy tắc,Phiên bản,Ngày hiệu lực,Ngày hết hiệu lực,Trạng thái",
      ...filtered.map((x) =>
        [x.code, x.version, x.effectiveFrom, x.effectiveTo, x.status].join(","),
      ),
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob(["\ufeff" + csv], { type: "text/csv" }),
    );
    a.download = "quy-tac-safety-days.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <main className="workspace safety-rules-workspace">
      <StandardToolbar name="LegacySafetyRulesView" items={[toolbarConfig.note(<span>
          <b>Quy tắc Safety Days</b>
          <small>
            Safety Days được tự động chọn theo ngày bắt đầu tuần kế hoạch
          </small>
        </span>),
toolbarConfig.group([toolbarConfig.action({"onClick": () => openNew()},<>＋ Thêm mới
          </>, true, "action"),
toolbarConfig.action({"disabled": !selected, disabledExplanation: "Chọn một dòng trong bảng trước khi thực hiện thao tác.","onClick": () => selected && openNew(selected)},<>Sao chép phiên bản
          </>, true, "action"),
toolbarConfig.action({"onClick": exportRules},<>Xuất Excel
          </>, true, "action")])]} />
      {notice && (
        <div className="save-notice master-save-notice">
          {notice}
          <FeedbackActionButton onClick={() => setNotice("")}>×</FeedbackActionButton>
        </div>
      )}
      <section className="safety-rule-layout">
        <div className="data-card rule-list">
          <div className="filters rule-filters">
            <label>
              <span>TRA CỨU</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Mã, tên, phiên bản, người tạo..."
              />
            </label>
            <label>
              <span>TRẠNG THÁI</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option>Tất cả trạng thái</option>
                {[
                  "Nháp",
                  "Chờ xác nhận",
                  "Đã xác nhận",
                  "Đang áp dụng",
                  "Sắp có hiệu lực",
                  "Hết hiệu lực",
                  "Đã hủy xác nhận",
                ].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
          </div>
          <DataTable className="table-wrap">
            <table className="rule-set-table">
              <thead>
                <tr>
                  <th>MÃ BỘ QUY TẮC</th>
                  <th>TÊN BỘ QUY TẮC</th>
                  <th>PHIÊN BẢN</th>
                  <th>NGÀY HIỆU LỰC</th>
                  <th>NGÀY HẾT HIỆU LỰC</th>
                  <th>TRẠNG THÁI</th>
                  <th>SỐ NHÓM ÁP DỤNG</th>
                  <th>NGƯỜI TẠO</th>
                  <th>NGƯỜI CẬP NHẬT</th>
                  <th>NGƯỜI XÁC NHẬN</th>
                  <th>THỜI GIAN XÁC NHẬN</th>
                  <th>LÝ DO THAY ĐỔI</th>
                  <th>THAO TÁC</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((rule) => (
                  <tr
                    key={rule.id}
                    className={selectedId === rule.id ? "selected" : ""}
                    onClick={() => setSelectedId(rule.id)}
                  >
                    <DataCell kind="code" className="master-sku">{rule.code}</DataCell>
                    <DataCell>{rule.name}</DataCell>
                    <DataCell kind="code">{rule.version}</DataCell>
                    <DataCell kind="date">{rule.effectiveFrom || "—"}</DataCell>
                    <DataCell kind="date">{rule.effectiveTo || "Không giới hạn"}</DataCell>
                    <DataCell>
                      <span
                        className={`rule-status ${safetyRuleStatusClass(rule.status)}`}
                      >
                        {rule.status}
                      </span>
                    </DataCell>
                    <DataCell kind="number" className="number">
                      {
                        [
                          rule.leadTimeRules,
                          rule.forecastRules,
                          rule.situationRules,
                        ].filter((g) =>
                          g.some((x) => x.status === "Đang áp dụng"),
                        ).length
                      }
                    </DataCell>
                    <DataCell>{rule.createdBy}</DataCell>
                    <DataCell>{rule.updatedBy}</DataCell>
                    <DataCell>{rule.confirmedBy || "—"}</DataCell>
                    <DataCell kind="date">
                      {rule.confirmedAt
                        ? formatDateTimeDisplay(rule.confirmedAt)
                        : "—"}
                    </DataCell>
                    <DataCell>{rule.changeReason || "—"}</DataCell>
                    <DataCell>
                      <div className="master-row-actions">
                        <FeedbackActionButton
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditing(structuredClone(rule));
                          }}
                          disabled={
                            !["Nháp", "Đã hủy xác nhận"].includes(rule.status)
                          } disabledExplanation={"Chỉ sửa quy tắc ở trạng thái Nháp hoặc Đã hủy xác nhận."}
                        >
                          Sửa
                        </FeedbackActionButton>
                        <FeedbackActionButton
                          onClick={(e) => {
                            e.stopPropagation();
                            confirmRule(rule);
                          }}
                        >
                          Xác nhận
                        </FeedbackActionButton>
                        <FeedbackActionButton
                          onClick={(e) => {
                            e.stopPropagation();
                            unconfirm(rule);
                          }}
                        >
                          Hủy xác nhận
                        </FeedbackActionButton>
                        <FeedbackActionButton
                          className="delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            remove(rule);
                          }}
                        >
                          Xóa
                        </FeedbackActionButton>
                      </div>
                    </DataCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTable>
          <div className="rule-pagination">
            <span>{filtered.length} bộ quy tắc</span>
            <FeedbackActionButton disabled disabledExplanation="Chức năng này chưa được kết nối thao tác tại màn hình hiện tại.">‹</FeedbackActionButton>
            <b>1</b>
            <FeedbackActionButton disabled disabledExplanation="Chức năng này chưa được kết nối thao tác tại màn hình hiện tại.">›</FeedbackActionButton>
            <FeedbackActionButton onClick={() => setHistory(true)}>Xem lịch sử</FeedbackActionButton>
          </div>
        </div>
        {selected ? (
          <SafetyRuleDetail rule={selected} />
        ) : (
          <div className="rule-empty">Chọn một bộ quy tắc để xem chi tiết</div>
        )}
      </section>
      {editing && (
        <SafetyRuleEditor
          value={editing}
          saving={saving}
          onClose={() => setEditing(null)}
          onSave={(next) => {
            const validation = validateLeadTimeRules(next.leadTimeRules);
            if (validation) {
              setNotice(validation);
              return;
            }
            persist(
              {
                ...next,
                updatedBy: operator,
                updatedAt: new Date().toISOString(),
              },
              rules.find((x) => x.id === next.id) || null,
              rules.some((x) => x.id === next.id) ? "Sửa" : "Thêm mới",
            );
          }}
        />
      )}
      {history && (
        <>
          <FeedbackActionButton className="overlay" onClick={() => setHistory(false)} />
          <aside className="drawer rule-history">
            <div className="drawer-title">
              <div>
                <span>QUY TẮC SAFETY DAYS</span>
                <h2>Lịch sử phiên bản</h2>
              </div>
              <FeedbackActionButton onClick={() => setHistory(false)}>×</FeedbackActionButton>
            </div>
            <DataTable className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>PHIÊN BẢN</th>
                    <th>NGÀY HIỆU LỰC</th>
                    <th>TRẠNG THÁI</th>
                    <th className="engine-reason-column">LÝ DO</th>
                    <th>NGƯỜI THAY ĐỔI</th>
                    <th>KẾ HOẠCH ĐÃ DÙNG</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((x) => (
                    <tr key={x.id}>
                      <DataCell kind="code">
                        {x.code} · {x.version}
                      </DataCell>
                      <DataCell kind="date">
                        {x.effectiveFrom} – {x.effectiveTo || "Không giới hạn"}
                      </DataCell>
                      <DataCell>{x.status}</DataCell>
                      <DataCell>{x.changeReason}</DataCell>
                      <DataCell>{x.updatedBy}</DataCell>
                      <DataCell>{x.usedByPlans?.join(", ") || "—"}</DataCell>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTable>
          </aside>
        </>
      )}
    </main>
  );
}

function SafetyRuleDetail({ rule }: { rule: SafetyRuleSet }) {
  return (
    <aside className="data-card rule-detail">
      <div className="rule-detail-head">
        <div>
          <span>MÃ BỘ QUY TẮC</span>
          <b>{rule.code}</b>
        </div>
        <div>
          <span>PHIÊN BẢN</span>
          <b>{rule.version}</b>
        </div>
        <div>
          <span>HIỆU LỰC</span>
          <b>
            {rule.effectiveFrom} – {rule.effectiveTo || "Không giới hạn"}
          </b>
        </div>
        <div>
          <span>TRẠNG THÁI</span>
          <b>{rule.status}</b>
        </div>
      </div>
      <h3>
        Theo Lead Time <span className="rule-status active">Đang áp dụng</span>
      </h3>
      <table>
        <thead>
          <tr>
            <th>STT</th>
            <th>LEAD TIME TỪ</th>
            <th>LEAD TIME ĐẾN</th>
            <th>SỐ NGÀY AN TOÀN</th>
            <th>TRẠNG THÁI</th>
            <th>GHI CHÚ</th>
          </tr>
        </thead>
        <tbody>
          {rule.leadTimeRules.map((x, i) => (
            <tr key={i}>
              <DataCell>{i + 1}</DataCell>
              <DataCell>{x.from}</DataCell>
              <DataCell>{x.to ?? "Không giới hạn"}</DataCell>
              <DataCell kind="number">{x.days}</DataCell>
              <DataCell>{x.status}</DataCell>
              <DataCell>{x.note || "—"}</DataCell>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>
        Theo độ chính xác dự báo{" "}
        <span className="rule-status draft">Chưa áp dụng</span>
      </h3>
      <table>
        <thead>
          <tr>
            <th>ĐỘ CHÍNH XÁC TỪ</th>
            <th>ĐỘ CHÍNH XÁC ĐẾN</th>
            <th>NGÀY CỘNG THÊM</th>
            <th>TRẠNG THÁI</th>
            <th>GHI CHÚ</th>
          </tr>
        </thead>
        <tbody>
          {rule.forecastRules.map((x, i) => (
            <tr key={i}>
              <DataCell>{x.from ?? "0"}%</DataCell>
              <DataCell>{x.to ?? "Không giới hạn"}</DataCell>
              <DataCell kind="number">{x.days}</DataCell>
              <DataCell>{x.status}</DataCell>
              <DataCell>{x.note}</DataCell>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>
        Điều chỉnh theo tình huống nhu cầu{" "}
        <span className="rule-status draft">Chưa áp dụng</span>
      </h3>
      <table>
        <thead>
          <tr>
            <th>MÃ</th>
            <th>TÌNH HUỐNG</th>
            <th>NGÀY CỘNG THÊM</th>
            <th>TRẠNG THÁI</th>
            <th>GHI CHÚ</th>
          </tr>
        </thead>
        <tbody>
          {rule.situationRules.map((x) => (
            <tr key={x.code}>
              <DataCell kind="code">{x.code}</DataCell>
              <DataCell>{x.name}</DataCell>
              <DataCell kind="number">{x.days}</DataCell>
              <DataCell>{x.status}</DataCell>
              <DataCell>{x.note || "—"}</DataCell>
            </tr>
          ))}
        </tbody>
      </table>
    </aside>
  );
}

function SafetyRuleEditor({
  value,
  saving,
  onClose,
  onSave,
}: {
  value: SafetyRuleSet;
  saving: boolean;
  onClose: () => void;
  onSave: (value: SafetyRuleSet) => void;
}) {
  const [draft, setDraft] = useState(value);
  const updateRange = (
    index: number,
    key: keyof SafetyRuleRange,
    value: string | number | null,
  ) =>
    setDraft((x) => ({
      ...x,
      leadTimeRules: x.leadTimeRules.map((r, i) =>
        i === index ? { ...r, [key]: value } : r,
      ),
    }));
  return (
    <>
      <FeedbackActionButton className="overlay" onClick={onClose} />
      <aside className="detail-panel safety-rule-editor">
        <div className="detail-header">
          <div>
            <p>DỮ LIỆU CƠ BẢN</p>
            <h2>
              {value.effectiveFrom ? "Sửa" : "Thêm"} bộ Quy tắc Safety Days
            </h2>
            <span>Chỉ bản Nháp mới được chỉnh sửa.</span>
          </div>
          <FeedbackActionButton onClick={onClose}>×</FeedbackActionButton>
        </div>
        <div className="rule-editor-form">
          <label>
            <span>MÃ BỘ QUY TẮC</span>
            <input
              value={draft.code}
              onChange={(e) => setDraft({ ...draft, code: e.target.value })}
            />
          </label>
          <label>
            <span>TÊN BỘ QUY TẮC</span>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label>
            <span>PHIÊN BẢN</span>
            <input
              value={draft.version}
              onChange={(e) => setDraft({ ...draft, version: e.target.value })}
            />
          </label>
          <label>
            <span>NGÀY HIỆU LỰC *</span>
            <input
              type="date"
              required
              value={draft.effectiveFrom}
              onChange={(e) =>
                setDraft({ ...draft, effectiveFrom: e.target.value })
              }
            />
          </label>
          <label>
            <span>NGÀY HẾT HIỆU LỰC</span>
            <input
              type="date"
              value={draft.effectiveTo}
              onChange={(e) =>
                setDraft({ ...draft, effectiveTo: e.target.value })
              }
            />
          </label>
          <label className="full">
            <span>LÝ DO TẠO / THAY ĐỔI *</span>
            <textarea
              required
              value={draft.changeReason}
              onChange={(e) =>
                setDraft({ ...draft, changeReason: e.target.value })
              }
            />
          </label>
          <div className="full">
            <h3>Theo Lead Time</h3>
            <table>
              <thead>
                <tr>
                  <th>TỪ</th>
                  <th>ĐẾN</th>
                  <th>SỐ NGÀY AN TOÀN</th>
                  <th>GHI CHÚ</th>
                </tr>
              </thead>
              <tbody>
                {draft.leadTimeRules.map((x, i) => (
                  <tr key={i}>
                    <DataCell>
                      <input
                        type="number"
                        min="1"
                        value={x.from}
                        onChange={(e) =>
                          updateRange(i, "from", Number(e.target.value))
                        }
                      />
                    </DataCell>
                    <DataCell>
                      {x.to === null ? (
                        <span>Không giới hạn</span>
                      ) : (
                        <input
                          type="number"
                          min="1"
                          value={x.to}
                          onChange={(e) =>
                            updateRange(i, "to", Number(e.target.value))
                          }
                        />
                      )}
                    </DataCell>
                    <DataCell>
                      <input
                        type="number"
                        min="1"
                        value={x.days}
                        onChange={(e) =>
                          updateRange(i, "days", Number(e.target.value))
                        }
                      />
                    </DataCell>
                    <DataCell>
                      <input
                        value={x.note}
                        onChange={(e) => updateRange(i, "note", e.target.value)}
                      />
                    </DataCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="form-actions full">
            <FeedbackActionButton className="ghost-button" onClick={onClose}>
              Hủy
            </FeedbackActionButton>
            <FeedbackActionButton
              className="primary-button"
              disabled={
                saving || !draft.effectiveFrom || !draft.changeReason.trim()
              } disabledExplanation={saving ? "Thao tác đang được xử lý. Vui lòng chờ hoàn tất rồi thử lại." : !draft.effectiveFrom ? "Chọn ngày hiệu lực trước khi lưu bản nháp." : "Nhập lý do thay đổi trước khi lưu bản nháp."}
              onClick={() => onSave(draft)}
            >
              {saving ? "Đang lưu..." : "Lưu bản nháp"}
            </FeedbackActionButton>
          </div>
        </div>
      </aside>
    </>
  );
}

const groupLabels: Record<SafetyRuleGroup, string> = {
  leadtime: "Theo Lead Time",
  forecast: "Theo độ chính xác dự báo",
  situation: "Theo tình huống nhu cầu",
};
const defaultSafetyGroups = basicDefaultSafetyGroups as SafetyGroupVersion[];
type SafetyToolAction =
  | "add"
  | "change"
  | "edit"
  | "search"
  | "submit"
  | "confirm"
  | "reject"
  | "withdraw"
  | "cancel-confirm"
  | "stop"
  | "history"
  | null;

function SafetyRulesView() {
  const session = useRef(clientSessionGeneration()).current;
 const [approvalReady,setApprovalReady]=useState(false);
 const dataRevision=useDataRefresh(['safety_rule_groups','safety_rules','leadtime_versions','sku']);
 const [inlineSearchField,setInlineSearchField]=useState<'code'|'version'|'status'|'creator'|'approver'|'from'|'to'|'createDate'>('code');

  const [tab, setTab] = useState<SafetyRuleGroup>("leadtime");
  const [versions, setVersions] =
    useState<SafetyGroupVersion[]>(defaultSafetyGroups);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [action, setAction] = useState<SafetyToolAction>(null);
  const [notice, setNotice] = useState("");
  const [filters, setFilters] = useState({
    code: "",
    version: "",
    status: "",
    from: "",
    to: "",
    creator: "",
    approver: "",
  });
  useApprovalNavigation(['safety_rules','safety_rule_groups'],()=>{setAction(null);setSelectedId(null);const pending=versions.find(v=>!v._deleted&&v.status==='Chờ xác nhận');if(pending)setTab(pending.group);setInlineSearchField('status');setFilters({code:'',version:'',status:'Chờ xác nhận',from:'',to:'',creator:'',approver:''});},approvalReady);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const operator = "sample_user_15";
  const cancellation=useMasterCancellation(()=>{setSelectedId(null);setNotice("Đã Hủy quy tắc. Dữ liệu được giữ lại và ngừng áp dụng.");});
  const noticeIsSuccess = notice.startsWith("Đã ");
  const noticeGuidance = noticeIsSuccess
    ? "Bạn có thể tiếp tục thao tác hoặc chọn phiên bản vừa lưu để xem chi tiết."
    : notice.includes("chồng nhau") || notice.includes("bị thiếu")
      ? "Các khoảng phải nối tiếp nhau. Ví dụ dòng trước kết thúc ở 7 thì dòng sau phải bắt đầu từ 8; không được trùng hoặc bỏ sót số."
      : notice.includes("Không thể") || notice.includes("kết nối")
        ? "Giữ nguyên màn hình, kiểm tra kết nối mạng rồi bấm lại. Nếu vẫn lỗi, không nhập lại dữ liệu và báo quản trị viên."
        : notice.includes("trạng thái") || notice.includes("bản Nháp")
          ? "Chọn đúng phiên bản trong bảng. Bản đang áp dụng phải dùng “Tạo thay đổi”; chỉ bản Nháp mới được sửa hoặc xóa."
          : "Đọc nội dung cảnh báo, điều chỉnh dữ liệu theo yêu cầu rồi thực hiện lại thao tác.";
  useEffect(() => {
    recordFetch("/api/records?entity=safety_rules")
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => { assertCurrentClientSession(session); const saved = data.records.map((row: {payload: SafetyRuleSet}) => row.payload).filter((row: SafetyRuleSet) => !row._deleted); if (saved.length) safetyRuleSets = saved; })
      .catch(() => setNotice("Không thể tải các quy tắc Safety Days liên kết."));
  }, [dataRevision]);
  useEffect(() => {
    recordFetch("/api/records?entity=safety_rule_groups")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(async (data) => {
        const saved = data.records
          .map((x: { payload: SafetyGroupVersion }) => x.payload)
          .filter((x: SafetyGroupVersion) => !x._deleted);
        if (saved.length) {
          setVersions([...new Map([...defaultSafetyGroups,...saved].map(v=>[v.id,v])).values()]);
          return;
        }
        // Defaults remain display-only; import TEST seed explicitly with npm run db:seed.
      })
      .catch(() =>
        setNotice("Không thể tải dữ liệu đã lưu; đang hiển thị dữ liệu chuẩn."),
      );
  }, [dataRevision]);
  const selected =
    versions.find((x) => x.id === selectedId && x.group === tab) || null;
  const rows = versions
    .filter(
      (x) =>
        x.group === tab &&
        !x._deleted &&
        (!filters.code ||
          x.code.toLowerCase().includes(filters.code.toLowerCase())) &&
        (!filters.version ||
          x.version.toLowerCase().includes(filters.version.toLowerCase())) &&
        (!filters.status || x.status === filters.status) &&
        (!filters.from || x.effectiveFrom >= filters.from) &&
        (!filters.to || !x.effectiveTo || x.effectiveTo <= filters.to) &&
        (!filters.creator ||
          x.createdBy.toLowerCase().includes(filters.creator.toLowerCase())) &&
        (!filters.approver ||
          (x.confirmedBy || "")
            .toLowerCase()
            .includes(filters.approver.toLowerCase())),
    )
    .sort((a, b) =>
      (inlineSearchField=== "createDate" ? newestMasterFirst(a,b) : 0) || b.version.localeCompare(a.version, undefined, { numeric: true }),
    );
  const enabled = {
    add: true,
    change: true,
    edit: true,
    delete: true,
    submit: true,
    confirm: true,
    reject: true,
    withdraw: true,
    cancel: true,
    stop: true,
  };
  const open = (next: SafetyToolAction) => {
    if (next !== "search" && next !== "history") {
      if (tab !== "leadtime") {
        notifyActionFailure("Nhóm quy tắc này hiện chỉ dùng để tra cứu và xem lịch sử; chưa tham gia tính Safety Days.");
        setNotice("Nhóm quy tắc này hiện chỉ dùng để tra cứu và xem lịch sử; chưa tham gia tính Safety Days.",
        );
        return;
      }
      if (next !== "add" && !selected) {
        notifyActionFailure("Vui lòng chọn một phiên bản trong bảng trước khi thực hiện thao tác này.");
        setNotice("Vui lòng chọn một phiên bản trong bảng trước khi thực hiện thao tác này.",
        );
        return;
      }
      const required: Partial<
        Record<Exclude<SafetyToolAction, null>, SafetyGroupStatus[]>
      > = {
        change: ["Đang áp dụng"],
        edit: ["Nháp"],
        submit: ["Nháp"],
        confirm: ["Chờ xác nhận"],
        reject: ["Chờ xác nhận"],
        withdraw: ["Chờ xác nhận"],
        "cancel-confirm": ["Đã xác nhận – Chờ hiệu lực"],
        stop: ["Đang áp dụng"],
      };
      if (
        next &&
        next !== "add" &&
        selected &&
        !required[next]?.includes(selected.status)
      ) {
        setNotice(
          selected.status === "Đang áp dụng" && next === "edit"
            ? "Bản đang áp dụng không sửa trực tiếp. Hãy bấm Tạo thay đổi để tạo bản Nháp mới."
            : `Thao tác này không áp dụng cho trạng thái “${selected.status}”. Vui lòng chọn đúng phiên bản trong bảng.`,
        );
        return;
      }
    }
    if (
      action &&
      dirty &&
      !window.confirm(
        "Biểu mẫu hiện tại có dữ liệu chưa lưu. Đóng biểu mẫu và chuyển chức năng?",
      )
    )
      return;
    setNotice("");
    setAction(next);
    setDirty(false);
  };
  const switchTab = (next: SafetyRuleGroup) => {
    if (
      action &&
      dirty &&
      !window.confirm("Dữ liệu đang nhập chưa lưu. Bạn vẫn muốn chuyển tab?")
    )
      return;
    setTab(next);
    setSelectedId(null);
    setAction(null);
    setDirty(false);
  };
  const groupOperation = (next: SafetyGroupVersion, before: SafetyGroupVersion | null, type: string, reason = next.reason) => ({
    entity: "safety_rule_groups", key: next.id, payload: next,
    audit: {group:next.group,type,before,after:next,reason},
  });
  const persist = async (next: SafetyGroupVersion, before: SafetyGroupVersion | null, type: string, extras: Array<{entity:string;key:string;payload:Record<string,unknown>;audit:Record<string,unknown>}> = []) => {
    setSaving(true);
    try {
      const response = await linkedRecordFetch("safety-group", [groupOperation(next,before,type), ...extras]);
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || "Không thể lưu dữ liệu.");
      setVersions(v => [next, ...v.filter(x => x.id !== next.id)].map(x => extras.find(op => op.entity === "safety_rule_groups" && op.key === x.id)?.payload as SafetyGroupVersion || x));
      setSelectedId(next.id); setAction(null); setDirty(false);
      setNotice(`Đã ${type.toLowerCase()} ${next.code} · ${next.version}.`);
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không thể lưu dữ liệu. Vui lòng thử lại.");
      return false;
    } finally { setSaving(false); }
  };
  const createDraft = (
    kind: "Tạo mới" | "Thay đổi",
    draftRows: Array<
      SafetyRuleRange | ForecastAccuracyRule | DemandSituationRule
    >,
    reason: string,
    note: string,
    submit = false,
  ) => {
    if (tab === "leadtime") {
      const error = validateLeadTimeRules(draftRows as SafetyRuleRange[]);
      if (error) {
        setNotice(error);
        return;
      }
    }
    const now = new Date().toISOString();
    const source = kind === "Thay đổi" ? selected : null;
    const serial = versions.filter((x) => x.group === tab).length + 1;
    const next: SafetyGroupVersion = {
      id: browserId(),
      group: tab,
      code: source?.code || `SD-LT-${now.slice(0, 10).replaceAll("-", "")}`,
      version: `V${serial}`,
      effectiveFrom: "",
      effectiveTo: "",
      status: submit ? "Chờ xác nhận" : "Nháp",
      rows: draftRows,
      reason,
      note,
      createdBy: operator,
      createdAt: now,
      submittedBy: submit ? operator : undefined,
      submittedAt: submit ? now : undefined,
      updatedBy: operator,
      updatedAt: now,
      sourceId: source?.id,
      requestType: kind,
      usedByPlans: [],
    };
    void persist(next, null, submit ? "Tạo và gửi xác nhận" : kind);
  };
  const transition = async (
    kind: Exclude<
      SafetyToolAction,
      "add" | "change" | "edit" | "search" | "history" | "stop" | null
    >,
    reason: string,
  ) => {
    if (!selected) return;
    const now = new Date().toISOString();
    let next = {
      ...selected,
      updatedBy: operator,
      updatedAt: now,
      reason: reason || selected.reason,
    };
    let label = "";
    if (kind === "submit") {
      next = {
        ...next,
        status: "Chờ xác nhận",
        submittedBy: operator,
        submittedAt: now,
      };
      label = "Gửi xác nhận";
    }
    if (kind === "confirm") {
      const confirmedDate = now.slice(0, 10);
      next = {
        ...next,
        effectiveFrom: confirmedDate,
        effectiveTo: "",
        status: "Đang áp dụng",
        confirmedBy: operator,
        confirmedAt: now,
      };
      label = "Xác nhận";
    }
    if (kind === "reject") {
      next = { ...next, status: "Từ chối" };
      label = "Từ chối";
    }
    if (kind === "withdraw") {
      next = { ...next, status: "Nháp" };
      label = "Thu hồi yêu cầu";
    }
    if (kind === "cancel-confirm") {
      next = { ...next, status: "Đã hủy" };
      label = "Hủy xác nhận";
    }
    if (kind === "confirm" && tab === "leadtime") {
      const previous = versions.find(x => x.id === selected.sourceId) ||
        versions.find(x => x.group === selected.group && x.id !== selected.id && x.status === "Đang áp dụng");
      const extras: Array<{entity:string;key:string;payload:Record<string,unknown>;audit:Record<string,unknown>}> = [];
      let closedPrevious: SafetyGroupVersion | null = null;
      let closedLinked: SafetyRuleSet | null = null;
      if (previous) {
        closedPrevious = {...previous,effectiveTo:next.effectiveFrom,status:"Hết hiệu lực",updatedBy:operator,updatedAt:now};
        extras.push(groupOperation(closedPrevious,previous,"Tự động kết thúc phiên bản cũ",`Phiên bản ${selected.version} được xác nhận và có hiệu lực từ ${next.effectiveFrom}`));
        const previousLinked = safetyRuleSets.find(x => x.id === previous.id) || defaultSafetyRuleSet;
        closedLinked = {...previousLinked,id:previous.id,code:previous.code,version:previous.version,
          effectiveFrom:previous.effectiveFrom,effectiveTo:next.effectiveFrom,status:"Hết hiệu lực",
          leadTimeRules:previous.rows as SafetyRuleRange[],updatedBy:operator,updatedAt:now};
        extras.push({entity:"safety_rules",key:closedLinked.id,payload:closedLinked,
          audit:{group:tab,type:"Tự động kết thúc quy tắc cũ",before:previousLinked,after:closedLinked,reason:next.reason}});
      }
      const linked: SafetyRuleSet = {...defaultSafetyRuleSet,id:next.id,code:next.code,version:next.version,
        effectiveFrom:next.effectiveFrom,effectiveTo:next.effectiveTo,status:"Đang áp dụng",
        leadTimeRules:next.rows as SafetyRuleRange[],createdBy:next.createdBy,createdAt:next.createdAt,
        updatedBy:operator,updatedAt:now,confirmedBy:operator,confirmedAt:now,
        changeReason:next.reason,usedByPlans:next.usedByPlans};
      extras.push({entity:"safety_rules",key:linked.id,payload:linked,
        audit:{group:tab,type:"Áp dụng quy tắc",before:null,after:linked,reason:next.reason}});
      if (await persist(next,selected,label,extras)) {
        safetyRuleSets = [linked,...(closedLinked ? [closedLinked] : []),
          ...safetyRuleSets.filter(x => x.id !== linked.id && x.id !== closedLinked?.id)];
      }
      return;
    }
    await persist(next, selected, label);
  };
  const removeDraft = async () => {
    if (!selected) {
      setNotice("Vui lòng chọn một bản Nháp trong bảng trước khi xóa.");
      return;
    }
    if (selected.status !== "Nháp") {
      setNotice(
        `Không thể xóa phiên bản ở trạng thái “${selected.status}”. Chỉ bản Nháp mới được xóa.`,
      );
      return;
    }
    if (!window.confirm(`Xóa bản Nháp ${selected.code} · ${selected.version}?`))
      return;
    await persist(
      {
        ...selected,
        _deleted: true,
        updatedBy: operator,
        updatedAt: new Date().toISOString(),
      },
      selected,
      "Xóa bản Nháp",
    );
    setSelectedId(
      versions.find(
        (x) => x.group === tab && x.id !== selected.id && !x._deleted,
      )?.id || null,
    );
  };
  return (
    <main className="workspace safety-rules-v2">
      <header className="safety-rules-title">
        <PageTitle variant="menu-root">Quy tắc Safety Days</PageTitle>
        <p>
          Mỗi nhóm quy tắc có phiên bản, thời gian hiệu lực và quy trình xác
          nhận riêng.
        </p>
      </header>
      {cancellation.dialog}
      <StandardToolbar name="SafetyRulesView" items={[toolbarConfig.group([toolbarConfig.group([toolbarConfig.action({"disabled": !enabled.add, disabledExplanation: "Thao tác này chưa khả dụng với trạng thái quy tắc hiện tại.","onClick": () => open("add")},<>＋ Thêm mới
            </>, true, "action"),
toolbarConfig.action({"disabled": !enabled.change, disabledExplanation: "Thao tác này chưa khả dụng với trạng thái quy tắc hiện tại.","onClick": () => open("change")},<>Tạo thay đổi
            </>, true, "action"),
toolbarConfig.action({"disabled": !enabled.edit, disabledExplanation: "Thao tác này chưa khả dụng với trạng thái quy tắc hiện tại.","onClick": () => open("edit")},<>Sửa bản Nháp
            </>, true, "action"),
toolbarConfig.action({disabled:!selected||isMasterCancelled(selected)||cancellation.busy, disabledExplanation: cancellation.busy ? "Đang xử lý dữ liệu. Vui lòng chờ hoàn tất rồi thử lại." : !selected ? "Chọn một dòng trong bảng trước khi thực hiện thao tác." : "Bản ghi này đã bị hủy.",onClick:()=>selected&&cancellation.open({entity:"safety_rule_groups",key:selected.id,label:"Safety Days"})},"Hủy",true,"action"),
toolbarConfig.action({"disabled": !enabled.delete, disabledExplanation: "Thao tác này chưa khả dụng với trạng thái quy tắc hiện tại.","onClick": removeDraft},<>Xóa bản Nháp
            </>, true, "action")]),
toolbarConfig.group([toolbarConfig.action({"disabled": !enabled.confirm, disabledExplanation: "Thao tác này chưa khả dụng với trạng thái quy tắc hiện tại.","onClick": () => open("confirm")},<>Xác nhận
            </>, true, "action"),
toolbarConfig.action({"disabled": !enabled.reject, disabledExplanation: "Thao tác này chưa khả dụng với trạng thái quy tắc hiện tại.","onClick": () => open("reject")},<>Từ chối
            </>, true, "action"),
toolbarConfig.action({"disabled": !enabled.withdraw, disabledExplanation: "Thao tác này chưa khả dụng với trạng thái quy tắc hiện tại.","onClick": () => open("withdraw")},<>Thu hồi yêu cầu
            </>, true, "action"),
toolbarConfig.action({"disabled": !enabled.cancel, disabledExplanation: "Thao tác này chưa khả dụng với trạng thái quy tắc hiện tại.","onClick": () => open("cancel-confirm")},<>Hủy xác nhận
            </>, true, "action")]),
toolbarConfig.group([toolbarConfig.action({"onClick": () => open("search")},<>Tra cứu</>, true, "lookup"),
toolbarConfig.action({"onClick": () => open("history")},<>Xem lịch sử</>, true, "action")])]), action==='search' && toolbarConfig.group([
    toolbarConfig.field('TRA THEO',[toolbarConfig.select({value:inlineSearchField,onChange:e=>{setInlineSearchField(e.target.value as typeof inlineSearchField);setFilters({code:'',version:'',status:'',from:'',to:'',creator:'',approver:''});}},<>{Object.entries({code:'Mã quy tắc',version:'Phiên bản',status:'Trạng thái',creator:'Người tạo',approver:'Người xác nhận',from:'Từ ngày',to:'Đến ngày',createDate:'Create - date'}).map(([v,label])=><option key={v} value={v}>{label}</option>)}</>)]),
    toolbarConfig.field('NỘI DUNG TRA',[inlineSearchField==='createDate' ? toolbarConfig.input({value:'Thêm/sửa gần nhất',readOnly:true}) : inlineSearchField==='status' ? toolbarConfig.select({value:filters.status,onChange:e=>setFilters(v=>({...v,status:e.target.value}))},<><option value="">Tất cả</option>{Array.from(new Set(versions.map(v=>v.status))).map(v=><option key={v}>{v}</option>)}</>) : toolbarConfig.input({type:['from','to'].includes(inlineSearchField)?'date':'text',value:filters[inlineSearchField],onChange:e=>setFilters(v=>({...v,[inlineSearchField]:e.target.value}))})]),
    toolbarConfig.action({onClick:()=>{setFilters({code:'',version:'',status:'',from:'',to:'',creator:'',approver:''})}},'Xóa lọc',true,'clear'),
    toolbarConfig.action({onClick:()=>{setFilters({code:'',version:'',status:'',from:'',to:'',creator:'',approver:''});setAction(null)}},'Quay lại',true,'back')])]} />
      {notice && (
        <div
          className={`save-notice master-save-notice safety-global-notice ${noticeIsSuccess ? "success" : "error"}`}
          role={noticeIsSuccess ? "status" : "alert"}
        >
          <span>
            <strong>{notice}</strong>
            <small>Hướng dẫn: {noticeGuidance}</small>
          </span>
          <FeedbackActionButton onClick={() => setNotice("")}>×</FeedbackActionButton>
        </div>
      )}
      {action && action !== "search" && (
        <SafetyFunctionPanel
          key={`${tab}:${action}:${selectedId || "none"}`}
          action={action}
          group={tab}
          selected={selected}
          saving={saving}
          history={versions.filter((x) => x.group === tab)}
          filters={filters}
          onFilters={setFilters}
          onDirty={setDirty}
          onClose={() => {
            if (!dirty || window.confirm("Đóng biểu mẫu mà không lưu?")) {
              setAction(null);
              setDirty(false);
            }
          }}
          onCreate={createDraft}
          onSaveDraft={(draft) => void persist(draft, selected, "Sửa bản Nháp")}
          onTransition={transition}
          onStop={(date, reason) => {
            if (!selected) return;
            createDraft(
              "Thay đổi",
              structuredClone(selected.rows),
              reason,
              "Đề nghị ngừng áp dụng",
            );
          }}
        />
      )}
      {(!action || action === "search") && (
        <>
          <nav className="safety-rule-tabs">
            {(["leadtime", "forecast", "situation"] as SafetyRuleGroup[]).map(
              (key) => (
                <FeedbackActionButton
                  key={key}
                  className={tab === key ? "active" : ""}
                  onClick={() => switchTab(key)}
                >
                  {groupLabels[key]}
                  <small>
                    {key === "leadtime" ? "Đang áp dụng" : "Chưa áp dụng"}
                  </small>
                </FeedbackActionButton>
              ),
            )}
          </nav>
          <section className="data-card safety-group-card">
            <div className="safety-group-meta">
              <span>
                <small>NHÓM QUY TẮC</small>
                <b>{groupLabels[tab]}</b>
              </span>
              <span>
                <small>PHIÊN BẢN ĐANG HIỂN THỊ</small>
                <b>{selected?.version || rows[0]?.version || "—"}</b>
              </span>
              <span>
                <small>HIỆU LỰC</small>
                <b>
                  {selected?.effectiveFrom || rows[0]?.effectiveFrom || "—"} –{" "}
                  {selected?.effectiveTo ||
                    rows[0]?.effectiveTo ||
                    "Không giới hạn"}
                </b>
              </span>
              <span>
                <small>TRẠNG THÁI</small>
                <b
                  className={`rule-status ${tab === "leadtime" ? "active" : "draft"}`}
                >
                  {selected?.status || rows[0]?.status || "Chưa áp dụng"}
                </b>
              </span>
            </div>
            <DataTable className="table-wrap">
              <table className="safety-version-table">
                <thead>
                  <tr>
                    <th>MÃ QUY TẮC</th>
                    <th>PHIÊN BẢN</th>
                    <th>NGÀY HIỆU LỰC</th>
                    <th>NGÀY HẾT HIỆU LỰC</th>
                    <th>TRẠNG THÁI</th>
                    <th className="engine-reason-column">LÝ DO</th>
                    <th>NGƯỜI TẠO</th>
                    <th>NGƯỜI GỬI</th>
                    <th>NGƯỜI XÁC NHẬN</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item) => (
                    <tr
                      key={item.id}
                      className={selectedId === item.id ? "selected" : ""}
                      onClick={() => setSelectedId(item.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedId(item.id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <DataCell kind="code" className="master-sku">{item.code}</DataCell>
                      <DataCell kind="code">{item.version}</DataCell>
                      <DataCell kind="date">{item.effectiveFrom}</DataCell>
                      <DataCell kind="date">{item.effectiveTo || "Không giới hạn"}</DataCell>
                      <DataCell>
                        <span
                          className={`rule-status ${item.status === "Đang áp dụng" ? "active" : item.status === "Chờ xác nhận" ? "pending" : item.status === "Nháp" ? "draft" : "expired"}`}
                        >
                          {item.status}
                        </span>
                      </DataCell>
                      <DataCell>{item.reason}</DataCell>
                      <DataCell>{item.createdBy}</DataCell>
                      <DataCell>{item.submittedBy || "—"}</DataCell>
                      <DataCell>{item.confirmedBy || "—"}</DataCell>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTable>
            <SafetyGroupRows group={tab} item={selected || undefined} />
          </section>
        </>
      )}
    </main>
  );
}

function SafetyGroupRows({
  group,
  item,
}: {
  group: SafetyRuleGroup;
  item?: SafetyGroupVersion;
}) {
  if (!item) return null;
  return (
    <div className="current-rule-data">
      <h3>
        Dữ liệu quy tắc · {item.code} · {item.version}
      </h3>
      <DataTable className="table-wrap">
        <table>
          <thead>
            <tr>
              {group === "leadtime" ? (
                <>
                  <th>STT</th>
                  <th>LEAD TIME TỪ</th>
                  <th>LEAD TIME ĐẾN</th>
                  <th>SỐ NGÀY AN TOÀN</th>
                  <th>GHI CHÚ</th>
                </>
              ) : group === "forecast" ? (
                <>
                  <th>ĐỘ CHÍNH XÁC TỪ</th>
                  <th>ĐỘ CHÍNH XÁC ĐẾN</th>
                  <th>SỐ NGÀY CỘNG THÊM</th>
                  <th>GHI CHÚ</th>
                </>
              ) : (
                <>
                  <th>MÃ TÌNH HUỐNG</th>
                  <th>TÌNH HUỐNG</th>
                  <th>SỐ NGÀY CỘNG THÊM</th>
                  <th>GHI CHÚ</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {group === "leadtime"
              ? (item.rows as SafetyRuleRange[]).map((x, i) => (
                  <tr key={i}>
                    <DataCell>{i + 1}</DataCell>
                    <DataCell>{x.from}</DataCell>
                    <DataCell>{x.to ?? "Không giới hạn"}</DataCell>
                    <DataCell kind="number">{x.days}</DataCell>
                    <DataCell>{x.note || "—"}</DataCell>
                  </tr>
                ))
              : group === "forecast"
                ? (item.rows as ForecastAccuracyRule[]).map((x, i) => (
                    <tr key={i}>
                      <DataCell>{x.from ?? 0}%</DataCell>
                      <DataCell>{x.to ?? "Không giới hạn"}</DataCell>
                      <DataCell kind="number">{x.days}</DataCell>
                      <DataCell>{x.note}</DataCell>
                    </tr>
                  ))
                : (item.rows as DemandSituationRule[]).map((x) => (
                    <tr key={x.code}>
                      <DataCell kind="code">{x.code}</DataCell>
                      <DataCell>{x.name}</DataCell>
                      <DataCell kind="number">{x.days}</DataCell>
                      <DataCell>{x.note || "—"}</DataCell>
                    </tr>
                  ))}
          </tbody>
        </table>
      </DataTable>
    </div>
  );
}

function SafetyFunctionPanel({
  action,
  group,
  selected,
  saving,
  history,
  filters,
  onFilters,
  onDirty,
  onClose,
  onCreate,
  onSaveDraft,
  onTransition,
  onStop,
}: {
  action: Exclude<SafetyToolAction, null>;
  group: SafetyRuleGroup;
  selected: SafetyGroupVersion | null;
  saving: boolean;
  history: SafetyGroupVersion[];
  filters: {
    code: string;
    version: string;
    status: string;
    from: string;
    to: string;
    creator: string;
    approver: string;
  };
  onFilters: (v: {
    code: string;
    version: string;
    status: string;
    from: string;
    to: string;
    creator: string;
    approver: string;
  }) => void;
  onDirty: (v: boolean) => void;
  onClose: () => void;
  onCreate: (
    kind: "Tạo mới" | "Thay đổi",
    rows: Array<SafetyRuleRange | ForecastAccuracyRule | DemandSituationRule>,
    reason: string,
    note: string,
    submit?: boolean,
  ) => void;
  onSaveDraft: (v: SafetyGroupVersion) => void;
  onTransition: (
    a: "submit" | "confirm" | "reject" | "withdraw" | "cancel-confirm",
    reason: string,
  ) => void;
  onStop: (date: string, reason: string) => void;
}) {
  const defaultGroup = defaultSafetyGroups.find((x) => x.group === group)!;
  const base: SafetyGroupVersion =
    action === "add"
      ? {
          ...structuredClone(defaultGroup),
          id: "",
          code: "",
          version: "",
          effectiveFrom: "",
          effectiveTo: "",
          reason: "",
          note: "",
          rows:
            group === "leadtime"
              ? [
                  {
                    from: Number.NaN,
                    to: null,
                    days: Number.NaN,
                    note: "",
                    status: "Đang áp dụng",
                  },
                ]
              : [],
        }
      : selected || defaultGroup;
  const [draft, setDraft] = useState(() => structuredClone(base));
  const [reason, setReason] = useState(
    action === "change" || action === "add" ? "" : base.reason || "",
  );
  const [date, setDate] = useState("");
  const [setupAt] = useState(() => new Date().toISOString());
  const [searchField, setSearchField] = useState<
    "code" | "version" | "status" | "creator" | "approver"
  >("code");
  const [searchValue, setSearchValue] = useState("");
  const [historySelected, setHistorySelected] =
    useState<SafetyGroupVersion | null>(null);
  const change = (fn: () => void) => {
    fn();
    onDirty(true);
  };
  const addLeadTimeRow = () => {
    const ranges = structuredClone(draft.rows as SafetyRuleRange[]);
    if (!ranges.length) {
      change(() =>
        setDraft({
          ...draft,
          rows: [
            { from: 1, to: null, days: 0, note: "", status: "Đang áp dụng" },
          ],
        }),
      );
      return;
    }
    const lastIndex = ranges.length - 1;
    const last = ranges[lastIndex];
    const nextFrom =
      last.to === null
        ? Number.isFinite(last.from)
          ? last.from + 1
          : Number.NaN
        : Number.isFinite(last.to)
          ? last.to + 1
          : Number.NaN;
    if (last.to === null && Number.isFinite(nextFrom))
      ranges[lastIndex] = { ...last, to: nextFrom - 1 };
    ranges.push({
      from: nextFrom,
      to: null,
      days: Number.NaN,
      status: "Đang áp dụng",
      note: "",
    });
    change(() => setDraft({ ...draft, rows: ranges }));
  };
  const addRowOnArrowDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
    index: number,
  ) => {
    if (
      event.key === "ArrowDown" &&
      index === (draft.rows as SafetyRuleRange[]).length - 1
    ) {
      event.preventDefault();
      addLeadTimeRow();
    }
  };
  const removeLeadTimeRow = (index: number) => {
    const ranges = (draft.rows as SafetyRuleRange[]).filter(
      (_, i) => i !== index,
    );
    if (ranges.length)
      ranges[ranges.length - 1] = { ...ranges[ranges.length - 1], to: null };
    change(() => setDraft({ ...draft, rows: ranges }));
  };
  const title = {
    add: "Thêm mới",
    change: "Tạo thay đổi",
    edit: "Sửa bản Nháp",
    search: "Tra cứu",
    submit: "Gửi xác nhận",
    confirm: "Xác nhận",
    reject: "Từ chối",
    withdraw: "Thu hồi yêu cầu",
    "cancel-confirm": "Hủy xác nhận",
    stop: "Đề nghị ngừng áp dụng",
    history: "Lịch sử thay đổi",
  }[action];
  if (action === "search")
    return (
      <section className="data-card safety-function-panel safety-search-compact">
        <header>
          <div>
            <h2>{title}</h2>
            <p>Chọn một hạng mục rồi nhập nội dung cần tìm.</p>
          </div>
          <FeedbackActionButton onClick={onClose}>×</FeedbackActionButton>
        </header>
        <div className="safety-search-grid">
          <label>
            <span>TRA THEO</span>
            <select
              value={searchField}
              onChange={(e) => {
                setSearchField(e.target.value as typeof searchField);
                setSearchValue("");
              }}
            >
              <option value="code">Mã quy tắc</option>
              <option value="version">Phiên bản</option>
              <option value="status">Trạng thái</option>
              <option value="creator">Người tạo</option>
              <option value="approver">Người xác nhận</option>
            </select>
          </label>
          <label>
            <span>NỘI DUNG TRA</span>
            {searchField === "status" ? (
              <select
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
              >
                <option value="">Chọn trạng thái</option>
                {[
                  "Nháp",
                  "Chờ xác nhận",
                  "Đã xác nhận – Chờ hiệu lực",
                  "Đang áp dụng",
                  "Hết hiệu lực",
                  "Đã hủy",
                  "Từ chối",
                ].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            ) : (
              <input
                value={searchValue}
                placeholder="Nhập nội dung cần tra..."
                onChange={(e) => setSearchValue(e.target.value)}
              />
            )}
          </label>
        </div>
        <div className="function-actions">
          <FeedbackActionButton
            className="ghost-button"
            onClick={() =>
              onFilters({
                code: "",
                version: "",
                status: "",
                from: "",
                to: "",
                creator: "",
                approver: "",
              })
            }
          >
            Hiển thị tất cả
          </FeedbackActionButton>
          <FeedbackActionButton
            className="primary-button"
            onClick={() => {
              onFilters({
                code: "",
                version: "",
                status: "",
                from: "",
                to: "",
                creator: "",
                approver: "",
                [searchField]: searchValue,
              });
              onClose();
            }}
          >
            Tra dữ liệu
          </FeedbackActionButton>
          <FeedbackActionButton className="outline-button" onClick={onClose}>
            Đóng tra cứu
          </FeedbackActionButton>
        </div>
      </section>
    );
  if (action === "history")
    return (
      <section className="data-card safety-function-panel">
        <header>
          <h2>
            {title} · {groupLabels[group]}
          </h2>
          <FeedbackActionButton onClick={onClose}>×</FeedbackActionButton>
        </header>
        <DataTable className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>MÃ</th>
                <th>PHIÊN BẢN</th>
                <th>LOẠI YÊU CẦU</th>
                <th>TRẠNG THÁI</th>
                <th className="engine-reason-column">LÝ DO</th>
                <th>NGƯỜI TẠO</th>
                <th>NGƯỜI XÁC NHẬN</th>
                <th>THỜI GIAN</th>
                <th>PRODUCTION ENGINE ĐÃ DÙNG</th>
              </tr>
            </thead>
            <tbody>
              {history.map((x) => (
                <tr
                  key={x.id}
                  className={historySelected?.id === x.id ? "selected" : ""}
                  onClick={() => setHistorySelected(x)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setHistorySelected(x);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <DataCell kind="code">{x.code}</DataCell>
                  <DataCell kind="code">{x.version}</DataCell>
                  <DataCell>{x.requestType || "Khởi tạo"}</DataCell>
                  <DataCell>{x.status}</DataCell>
                  <DataCell>{x.reason}</DataCell>
                  <DataCell>{x.createdBy}</DataCell>
                  <DataCell>{x.confirmedBy || "—"}</DataCell>
                  <DataCell kind="date">{formatDateTimeDisplay(x.updatedAt)}</DataCell>
                  <DataCell>{x.usedByPlans?.join(", ") || "—"}</DataCell>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>
        <SafetyGroupRows group={group} item={historySelected || undefined} />
      </section>
    );
  if (["add", "change", "edit"].includes(action)) {
    const ranges = draft.rows as SafetyRuleRange[];
    return (
      <section className="data-card safety-function-panel">
        <header>
          <div>
            <h2>{title}</h2>
            <p>
              {action === "change"
                ? "Quy tắc đang áp dụng được giữ nguyên; hệ thống tạo một bản Nháp mới."
                : "Dữ liệu chỉ được áp dụng sau khi gửi và xác nhận."}
            </p>
          </div>
          <FeedbackActionButton onClick={onClose}>×</FeedbackActionButton>
        </header>
        {action === "change" && selected && (
          <div className="current-version-strip">
            <span>DỮ LIỆU HIỆN TẠI</span>
            <b>
              {selected.code} · {selected.version}
            </b>
            <em>Hiệu lực {selected.effectiveFrom}</em>
          </div>
        )}
        <div className="rule-request-grid">
          <label>
            <span>NGÀY THIẾT LẬP</span>
            <input value={formatDateTimeDisplay(setupAt)} readOnly />
          </label>
          {action !== "add" && (
            <label className="wide safety-change-reason">
              <span>LÝ DO THAY ĐỔI *</span>
              <textarea
                value={reason}
                placeholder="Nhập lý do thay đổi"
                onChange={(e) => change(() => setReason(e.target.value))}
              />
            </label>
          )}
          <label className="wide">
            <span>GHI CHÚ</span>
            <input
              value={draft.note}
              onChange={(e) =>
                change(() => setDraft({ ...draft, note: e.target.value }))
              }
            />
          </label>
        </div>
        <DataTable className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>TỪ</th>
                <th>ĐẾN</th>
                <th>SỐ NGÀY AN TOÀN</th>
                <th>GHI CHÚ</th>
                <th>THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {ranges.map((x, i) => (
                <tr key={i}>
                  <DataCell>
                    <input
                      type="number"
                      value={Number.isFinite(x.from) ? x.from : ""}
                      placeholder="Nhập từ"
                      onKeyDown={(event) => addRowOnArrowDown(event, i)}
                      onChange={(e) =>
                        change(() =>
                          setDraft({
                            ...draft,
                            rows: ranges.map((r, j) =>
                              j === i
                                ? { ...r, from: Number(e.target.value) }
                                : r,
                            ),
                          }),
                        )
                      }
                    />
                  </DataCell>
                  <DataCell>
                    {x.to === null ? (
                      action === "add" ? (
                        <input
                          type="number"
                          value=""
                          placeholder="Không giới hạn"
                          onKeyDown={(event) => addRowOnArrowDown(event, i)}
                          onChange={(e) =>
                            change(() =>
                              setDraft({
                                ...draft,
                                rows: ranges.map((r, j) =>
                                  j === i
                                    ? { ...r, to: Number(e.target.value) }
                                    : r,
                                ),
                              }),
                            )
                          }
                        />
                      ) : (
                        "Không giới hạn"
                      )
                    ) : (
                      <input
                        type="number"
                        value={Number.isFinite(x.to) ? x.to : ""}
                        onKeyDown={(event) => addRowOnArrowDown(event, i)}
                        onChange={(e) =>
                          change(() =>
                            setDraft({
                              ...draft,
                              rows: ranges.map((r, j) =>
                                j === i
                                  ? { ...r, to: Number(e.target.value) }
                                  : r,
                              ),
                            }),
                          )
                        }
                      />
                    )}
                  </DataCell>
                  <DataCell>
                    <input
                      type="number"
                      value={Number.isFinite(x.days) ? x.days : ""}
                      placeholder="Nhập số ngày"
                      onKeyDown={(event) => addRowOnArrowDown(event, i)}
                      onChange={(e) =>
                        change(() =>
                          setDraft({
                            ...draft,
                            rows: ranges.map((r, j) =>
                              j === i
                                ? { ...r, days: Number(e.target.value) }
                                : r,
                            ),
                          }),
                        )
                      }
                    />
                  </DataCell>
                  <DataCell>
                    <input
                      value={x.note}
                      onKeyDown={(event) => addRowOnArrowDown(event, i)}
                      onChange={(e) =>
                        change(() =>
                          setDraft({
                            ...draft,
                            rows: ranges.map((r, j) =>
                              j === i ? { ...r, note: e.target.value } : r,
                            ),
                          }),
                        )
                      }
                    />
                  </DataCell>
                  <DataCell className="safety-row-action">
                    <FeedbackActionButton
                      type="button"
                      className="danger-link-button"
                      onClick={() => removeLeadTimeRow(i)}
                    >
                      Xóa dòng
                    </FeedbackActionButton>
                  </DataCell>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>
        <div className="function-actions">
          <FeedbackActionButton className="ghost-button" onClick={onClose}>
            Hủy thao tác
          </FeedbackActionButton>
          <FeedbackActionButton
            className="outline-button"
            disabled={saving || (action !== "add" && !reason.trim())} disabledExplanation={saving ? "Thao tác đang được xử lý. Vui lòng chờ hoàn tất rồi thử lại." : "Nhập lý do thay đổi trước khi lưu hoặc gửi xác nhận."}
            onClick={() =>
              action === "edit"
                ? onSaveDraft({
                    ...draft,
                    reason,
                    updatedAt: new Date().toISOString(),
                  })
                : onCreate(
                    action === "change" ? "Thay đổi" : "Tạo mới",
                    draft.rows,
                    reason,
                    draft.note,
                  )
            }
          >
            Lưu Nháp
          </FeedbackActionButton>
          <FeedbackActionButton
            className="primary-button"
            disabled={saving || (action !== "add" && !reason.trim())} disabledExplanation={saving ? "Thao tác đang được xử lý. Vui lòng chờ hoàn tất rồi thử lại." : "Nhập lý do thay đổi trước khi lưu hoặc gửi xác nhận."}
            onClick={() => {
              if (action === "edit")
                onSaveDraft({
                  ...draft,
                  reason,
                  status: "Chờ xác nhận",
                  submittedBy: "sample_user_15",
                  submittedAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                });
              else
                onCreate(
                  action === "change" ? "Thay đổi" : "Tạo mới",
                  draft.rows,
                  reason,
                  draft.note,
                  true,
                );
            }}
          >
            Gửi xác nhận
          </FeedbackActionButton>
        </div>
      </section>
    );
  }
  return (
    <section className="data-card safety-function-panel">
      <header>
        <div>
          <h2>{title}</h2>
          <p>
            {selected?.code} · {selected?.version} · hiệu lực{" "}
            {selected?.effectiveFrom}
          </p>
        </div>
        <FeedbackActionButton onClick={onClose}>×</FeedbackActionButton>
      </header>
      <div className="approval-summary">
        <span>
          <small>NGƯỜI ĐỀ NGHỊ</small>
          <b>{selected?.submittedBy || selected?.createdBy}</b>
        </span>
        <span>
          <small>LÝ DO THAY ĐỔI</small>
          <b>{selected?.reason}</b>
        </span>
        <span>
          <small>SỐ SKU BỊ ẢNH HƯỞNG</small>
          <b>{leadtimeRows.length}</b>
        </span>
        <span>
          <small>TRẠNG THÁI</small>
          <b>{selected?.status}</b>
        </span>
      </div>
      {action === "stop" && (
        <label>
          <span>NGÀY ĐỀ NGHỊ NGỪNG *</span>
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              onDirty(true);
            }}
          />
        </label>
      )}
      <label>
        <span>
          {action === "reject"
            ? "LÝ DO TỪ CHỐI VÀ NỘI DUNG CẦN ĐIỀU CHỈNH *"
            : "LÝ DO *"}
        </span>
        <textarea
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            onDirty(true);
          }}
        />
      </label>
      <div className="function-actions">
        <FeedbackActionButton className="ghost-button" onClick={onClose}>
          Hủy thao tác
        </FeedbackActionButton>
        <FeedbackActionButton
          className="primary-button"
          disabled={saving || !reason.trim() || (action === "stop" && !date)} disabledExplanation={saving ? "Thao tác đang được xử lý. Vui lòng chờ hoàn tất rồi thử lại." : !reason.trim() ? "Nhập lý do trước khi xác nhận thao tác." : "Chọn ngày ngừng áp dụng trước khi xác nhận."}
          onClick={() =>
            action === "stop"
              ? onStop(date, reason)
              : onTransition(
                  action as
                    | "submit"
                    | "confirm"
                    | "reject"
                    | "withdraw"
                    | "cancel-confirm",
                  reason,
                )
          }
        >
          {action === "confirm"
            ? "Xác nhận áp dụng"
            : action === "reject"
              ? "Xác nhận từ chối"
              : action === "withdraw"
                ? "Xác nhận thu hồi"
                : action === "cancel-confirm"
                  ? "Xác nhận hủy"
                  : "Xác nhận gửi"}
        </FeedbackActionButton>
      </div>
    </section>
  );
}

function LeadtimeMasterViewLegacy({ mode }: { mode: "leadtime" | "safety" }) {
  const dataRevision = useDataRefresh(['leadtime', 'safety_days', 'leadtime_versions', 'safety_rules', 'labor_hours']);
  const skus = useContext(BusinessSkuContext);
  const [searchMode, setSearchMode] = useState<SkuSearchMode>("sku");
  const [query, setQuery] = useState("");
  const [leadRows, setLeadRows] = useState<LeadtimeRow[]>(leadtimeRows);
  const [safetyRows, setSafetyRows] = useState<SafetyDayRow[]>([]);
  const [editing, setEditing] = useState<LeadtimeRow | SafetyDayRow | null>(
    null,
  );
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<LeadtimeRow | SafetyDayRow | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    Promise.all([
      recordFetch("/api/records?entity=leadtime"),
      recordFetch("/api/records?entity=safety_days"),
    ])
      .then(async ([leadResponse, safetyResponse]) => {
        const leadSaved: LeadtimeRow[] = leadResponse.ok
          ? (await leadResponse.json()).records.map(
              (item: {
                payload: LeadtimeRow;
                updatedBy: string;
                updatedAt: string;
              }) => ({
                ...item.payload,
                updatedBy: item.updatedBy,
                updatedAt: item.updatedAt,
              }),
            )
          : [];
        const safetySaved = safetyResponse.ok
          ? (await safetyResponse.json()).records.map(
              (item: { payload: SafetyDayRow }) => item.payload,
            )
          : [];
        setLeadRows([
          ...leadSaved.filter((row: LeadtimeRow) => !row._deleted),
          ...leadtimeRows.filter(
            (row) =>
              !leadSaved.some((saved: LeadtimeRow) => saved.sku === row.sku),
          ),
        ]);
        setSafetyRows(safetySaved.filter((row: SafetyDayRow) => !row._deleted));
      })
      .catch(() => setNotice("Không thể tải dữ liệu đã lưu. Vui lòng thử lại."))
      .finally(() => setLoading(false));
  }, [dataRevision]);
  const safetyBySku = useMemo(
    () => new Map(safetyRows.map((row) => [row.sku, row])),
    [safetyRows],
  );
  const displayRows =
    mode === "leadtime"
      ? leadRows
      : leadRows.map(
          (row) =>
            safetyBySku.get(row.sku) || {
              sku: row.sku,
              name: row.name,
              spec: row.spec,
              group: row.group,
              line: row.line,
              leadTime: row.leadTime,
              safetyDays: safetyBreakdown(
                row.leadTime,
                activeSafetyRuleFor(vietnamDate()),
              ).total,
              note: "Tự động theo Lead Time",
            },
        );
  const filtered = useMemo(
    () =>
      displayRows
        .filter((row) => {
          const key = normalizeSearchText(query);
          if (!key) return true;
          const value =
            searchMode === "sku"
              ? row.sku
              : searchMode === "name"
                ? row.name
                : searchMode === "specification"
                  ? row.spec
                  : searchMode === "group"
                    ? row.group
                    : row.line;
          return searchMode === "sku"
            ? normalizeSearchText(value).startsWith(key)
            : normalizeSearchText(value).includes(key);
        })
        .sort(compareGroupThenSku),
    [displayRows, query, searchMode],
  );
  const unset = displayRows.filter((row) =>
    mode === "leadtime"
      ? (row as LeadtimeRow).leadTime <= 0
      : (row as SafetyDayRow).safetyDays <= 0,
  ).length;
  const openCreate = () => {
    setEditing(null);
    setCreating(true);
    setNotice("");
  };
  const openEdit = (row: LeadtimeRow | SafetyDayRow) => {
    setEditing(row);
    setCreating(true);
    setNotice("");
  };
  const closeForm = () => {
    setCreating(false);
    setEditing(null);
  };
  const saveRow = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const sku = String(data.get("sku") || "");
    const master = skus.find((item) => item.code === sku);
    if (!master) {
      setNotice("Vui lòng chọn SKU hợp lệ.");
      return;
    }
    let row: LeadtimeRow | SafetyDayRow;
    if (mode === "leadtime") {
      const ltProduction = Number(data.get("ltProduction") || 0),
        ltQc = Number(data.get("ltQc") || 0),
        ltWarehouse = Number(data.get("ltWarehouse") || 0);
      row = {
        sku,
        name: master.name,
        spec: master.specification,
        group: master.group,
        line: master.line,
        ltProduction,
        ltQc,
        ltWarehouse,
        note: String(data.get("note") || "").trim(),
        leadTime: ltProduction + ltQc + ltWarehouse,
        moq: Number(data.get("moq") || 0),
        updatedBy: "sample_user_15",
        updatedAt: new Date().toISOString(),
      };
    } else {
      const lead = leadRows.find((item) => item.sku === sku);
      row = {
        sku,
        name: master.name,
        spec: master.specification,
        group: master.group,
        line: master.line,
        leadTime: lead?.leadTime || 0,
        safetyDays: Number(data.get("safetyDays") || 0),
        note: String(data.get("note") || "").trim(),
      };
    }
    setSaving(true);
    const entity = mode === "leadtime" ? "leadtime" : "safety_days";
    const response = await recordFetch("/api/records", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entity,
        key: sku,
        payload: row,
        updatedBy: "sample_user_15",
      }),
    });
    setSaving(false);
    if (!response.ok) {
      setNotice("Không thể lưu dữ liệu. Vui lòng thử lại.");
      return;
    }
    if (mode === "leadtime") {
      leadtimeBySku.set(sku.toUpperCase(), row as LeadtimeRow);
      setLeadRows((current) => [
        row as LeadtimeRow,
        ...current.filter((item) => item.sku !== sku),
      ]);
    } else {
      safetyDaysBySku.set(sku.toUpperCase(), row as SafetyDayRow);
      setSafetyRows((current) => [
        row as SafetyDayRow,
        ...current.filter((item) => item.sku !== sku),
      ]);
    }
    closeForm();
    setNotice(
      `Đã ${editing ? "cập nhật" : "thêm"} ${mode === "leadtime" ? "Lead Time" : "Safety Days"} cho SKU ${sku}.`,
    );
  };
  const confirmDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    const entity = mode === "leadtime" ? "leadtime" : "safety_days";
    const payload = {
      ...deleting,
      _deleted: true,
      deletedAt: new Date().toISOString(),
      deletedBy: "sample_user_15",
    };
    const response = await recordFetch("/api/records", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entity,
        key: deleting.sku,
        payload,
        updatedBy: "sample_user_15",
      }),
    });
    setSaving(false);
    if (!response.ok) {
      setNotice("Không thể xóa dữ liệu. Vui lòng thử lại.");
      return;
    }
    if (mode === "leadtime") {
      leadtimeBySku.delete(deleting.sku.toUpperCase());
      setLeadRows((current) =>
        current.filter((item) => item.sku !== deleting.sku),
      );
    } else {
      safetyDaysBySku.delete(deleting.sku.toUpperCase());
      setSafetyRows((current) =>
        current.filter((item) => item.sku !== deleting.sku),
      );
    }
    setNotice(
      mode === "leadtime"
        ? `Đã xóa Lead Time của SKU ${deleting.sku}. Dữ liệu được giữ trong lịch sử.`
        : `Đã xóa Safety Days nhập riêng của SKU ${deleting.sku}. Hệ thống quay lại tính tự động theo Lead Time.`,
    );
    setDeleting(null);
  };
  const editLead = editing as LeadtimeRow | null;
  const editSafety = editing as SafetyDayRow | null;
  return (
    <main className="workspace master-data-workspace">
      <StandardToolbar name="LeadtimeMasterViewLegacy" items={[toolbarConfig.note(<span>
          <b>{mode === "leadtime" ? "Leadtime" : "Safety Days"}</b>
          <small>
            {displayRows.length} SKU · {unset} SKU chưa thiết lập · Safety Days
            chỉ đọc, tự tính theo bộ quy tắc
          </small>
        </span>),
toolbarConfig.action({"onClick": openCreate},<>＋ Thêm mới
        </>, true, "action")]} />
      {notice && (
        <div className="save-notice master-save-notice">
          {notice}
          <FeedbackActionButton onClick={() => setNotice("")}>×</FeedbackActionButton>
        </div>
      )}
      <section className="data-card master-data-card master-standard-card">
        <div className="filters master-filter">
          <label>
            <span>TRA THEO</span>
            <select
              value={searchMode}
              onChange={(e) => setSearchMode(e.target.value as SkuSearchMode)}
            >
              <option value="sku">Mã SKU</option>
              <option value="name">Tên sản phẩm</option>
              <option value="specification">Quy cách</option>
              <option value="group">Nhóm sản phẩm</option>
              <option value="line">Line</option>
            </select>
          </label>
          <label className="search">
            <span>
              {searchMode === "sku"
                ? "MÃ SKU"
                : searchMode === "name"
                  ? "TÊN SẢN PHẨM"
                  : searchMode === "specification"
                    ? "QUY CÁCH"
                    : searchMode === "group"
                      ? "NHÓM SẢN PHẨM"
                      : "LINE"}
            </span>
            <div>
              ⌕
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nhập để tra dữ liệu..."
              />
            </div>
          </label>
        </div>
        <div className="result-bar">
          <strong>{filtered.length}</strong> dòng được tìm thấy{" "}
          {loading && <span>· Đang tải dữ liệu đã lưu...</span>}
        </div>
        <DataTable className="table-wrap">
          <table className="leadtime-table">
            <thead>
              <tr>
                <th>NHÓM SP</th>
                <th>SKU</th>
                <th>TÊN SẢN PHẨM</th>
                <th>QUY CÁCH</th>
                <th>LINE</th>
                <th>LEAD TIME</th>
                <th>SAFETY THEO LT</th>
                <th>NGÀY CỘNG DỰ BÁO</th>
                <th>NGÀY CỘNG TÌNH HUỐNG</th>
                <th>TỔNG SAFETY DAYS</th>
                <th>MÃ BỘ QUY TẮC</th>
                <th>PHIÊN BẢN</th>
                <th>TRẠNG THÁI DỮ LIỆU</th>
                <th>NGƯỜI CẬP NHẬT</th>
                <th>THỜI GIAN CẬP NHẬT</th>
                <th>THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const lead = row as LeadtimeRow;
                const rule = activeSafetyRuleFor(
                  vietnamDate(),
                );
                const safety = safetyBreakdown(lead.leadTime, rule);
                return (
                  <tr key={row.sku}>
                    <DataCell kind="code">
                      <span className="tag">{row.group}</span>
                    </DataCell>
                    <DataCell kind="code" className="master-sku">{row.sku}</DataCell>
                    <DataCell>{row.name}</DataCell>
                    <DataCell>{row.spec || "—"}</DataCell>
                    <DataCell kind="code">{row.line || "—"}</DataCell>
                    <DataCell kind="number" className="number">
                      {lead.leadTime > 0 ? (
                        lead.leadTime
                      ) : (
                        <span className="data-error">
                          Chưa thiết lập Lead Time
                        </span>
                      )}
                    </DataCell>
                    <DataCell kind="number" className="number">
                      {lead.leadTime > 0 ? safety.leadTimeDays : "—"}
                    </DataCell>
                    <DataCell kind="number" className="number">{safety.forecastDays}</DataCell>
                    <DataCell kind="number" className="number">{safety.situationDays}</DataCell>
                    <DataCell kind="number" className="number master-total">
                      {lead.leadTime > 0 ? safety.total : "—"}
                    </DataCell>
                    <DataCell kind="code">{rule?.code || "Chưa có"}</DataCell>
                    <DataCell kind="code">{rule?.version || "—"}</DataCell>
                    <DataCell>{lead.leadTime > 0 ? "Hợp lệ" : "Lỗi dữ liệu"}</DataCell>
                    <DataCell>{lead.updatedBy || "Dữ liệu gốc"}</DataCell>
                    <DataCell kind="date">
                      {lead.updatedAt
                        ? formatDateTimeDisplay(lead.updatedAt)
                        : "—"}
                    </DataCell>
                    <DataCell>
                      <div className="master-row-actions">
                        <FeedbackActionButton onClick={() => openEdit(row)}>Sửa</FeedbackActionButton>
                        <FeedbackActionButton
                          className="delete"
                          onClick={() => setDeleting(row)}
                        >
                          Xóa
                        </FeedbackActionButton>
                      </div>
                    </DataCell>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DataTable>
        <div className="source-note">
          <b>Quy tắc:</b> Người dùng chỉ nhập Leadtime. Safety Days và các thành
          phần được tự động tính, không cho nhập hoặc sửa trực tiếp.
        </div>
      </section>
      {creating && (
        <>
          <FeedbackActionButton className="overlay" aria-label="Đóng" onClick={closeForm} />
          <aside className="detail-panel master-edit-panel">
            <div className="detail-header">
              <div>
                <p>DỮ LIỆU CƠ BẢN</p>
                <h2>
                  {editing ? "Sửa" : "Thêm"}{" "}
                  {mode === "leadtime" ? "Lead Time" : "Safety Days"}
                </h2>
                <span>Dữ liệu được lưu dùng chung cho toàn hệ thống.</span>
              </div>
              <FeedbackActionButton onClick={closeForm}>×</FeedbackActionButton>
            </div>
            <form
              className="edit-user-form master-edit-form"
              onSubmit={saveRow} onInvalid={() => notifyActionFailure("Thông tin bắt buộc còn thiếu hoặc chưa hợp lệ. Kiểm tra các trường được đánh dấu trước khi tiếp tục.")}
            >
              <label>
                <span>SKU *</span>
                <select
                  name="sku"
                  required
                  defaultValue={editing?.sku || ""}
                  disabled={!!editing}
                >
                  <option value="">Chọn SKU từ SKU Master</option>
                  {skus.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.code} · {item.name}
                    </option>
                  ))}
                </select>
              </label>
              {mode === "leadtime" ? (
                <>
                  <label>
                    <span>LT SẢN XUẤT (NGÀY)</span>
                    <input
                      name="ltProduction"
                      type="number"
                      min="0"
                      required
                      defaultValue={editLead?.ltProduction || 0}
                    />
                  </label>
                  <label>
                    <span>LT QC (NGÀY)</span>
                    <input
                      name="ltQc"
                      type="number"
                      min="0"
                      required
                      defaultValue={editLead?.ltQc || 0}
                    />
                  </label>
                  <label>
                    <span>LT NHẬP KHO (NGÀY)</span>
                    <input
                      name="ltWarehouse"
                      type="number"
                      min="0"
                      required
                      defaultValue={editLead?.ltWarehouse || 0}
                    />
                  </label>
                  <label>
                    <span>MOQ</span>
                    <input
                      name="moq"
                      type="number"
                      min="0"
                      defaultValue={editLead?.moq || 0}
                    />
                  </label>
                </>
              ) : (
                <label>
                  <span>SAFETY DAYS *</span>
                  <input
                    name="safetyDays"
                    type="number"
                    min="0"
                    required
                    defaultValue={editSafety?.safetyDays || 0}
                  />
                </label>
              )}
              <label className="full">
                <span>GHI CHÚ</span>
                <textarea name="note" defaultValue={editing?.note || ""} />
              </label>
              <div className="form-actions full">
                <FeedbackActionButton
                  type="button"
                  className="ghost-button"
                  onClick={closeForm}
                >
                  Hủy
                </FeedbackActionButton>
                <FeedbackActionButton className="primary-button" disabled={saving} disabledExplanation={"Thao tác đang được xử lý. Vui lòng chờ hoàn tất rồi thử lại."} type="submit">
                  {saving ? "Đang lưu..." : "Lưu dữ liệu"}
                </FeedbackActionButton>
              </div>
            </form>
          </aside>
        </>
      )}
      {deleting && (
        <>
          <FeedbackActionButton
            className="overlay overlay-top"
            aria-label="Đóng"
            onClick={() => setDeleting(null)}
          />
          <aside className="confirm-dialog">
            <span className="confirm-icon">!</span>
            <h2>Xóa {mode === "leadtime" ? "Lead Time" : "Safety Days"}?</h2>
            <p>
              {mode === "leadtime" ? (
                <>
                  SKU <b>{deleting.sku}</b> sẽ không còn trong danh sách Lead
                  Time.
                </>
              ) : (
                <>
                  Safety Days nhập riêng của SKU <b>{deleting.sku}</b> sẽ bị xóa
                  và quay lại giá trị tự động theo Lead Time.
                </>
              )}{" "}
              Dữ liệu được xóa mềm và giữ trong lịch sử.
            </p>
            <div>
              <FeedbackActionButton
                className="ghost-button"
                onClick={() => setDeleting(null)}
              >
                Hủy
              </FeedbackActionButton>
              <FeedbackActionButton
                className="danger-button"
                disabled={saving} disabledExplanation={"Thao tác đang được xử lý. Vui lòng chờ hoàn tất rồi thử lại."}
                onClick={confirmDelete}
              >
                {saving ? "Đang xóa..." : "Xác nhận xóa"}
              </FeedbackActionButton>
            </div>
          </aside>
        </>
      )}
    </main>
  );
}

type LeadTimeStatus =
  | "Nháp"
  | "Chờ xác nhận"
  | "Đang áp dụng"
  | "Hết hiệu lực"
  | "Đã hủy xác nhận"
  | "Không hợp lệ"
  | "Đã hủy";
type LeadTimeVersion = {
  cancelled?:boolean;
  updatedAt?:string;
  _deleted?: boolean;
  id: string;
  skuId: string;
  sku: string;
  version: string;
  leadTime: number;
  status: LeadTimeStatus;
  setupAt: string;
  validFrom?: string;
  validTo?: string;
  note: string;
  reason: string;
  createdBy: string;
  updatedBy: string;
  confirmedBy?: string;
  confirmedAt?: string;
  usedByPlans?: string[];
};
type LeadTimePanel =
  "create" | "edit" | "search" | "confirm" | "cancel" | "detail" | null;

const normalizeSkuCode = (value: string) => value.trim().toUpperCase();
const skuStableId = (sku: Sku) => `sku:${normalizeSkuCode(sku.code)}`;
const leadTimeVersionNumber = (versions: LeadTimeVersion[], sku: string) =>
  `V${versions.filter((item) => item.sku === sku).length + 1}`;
const activeLeadTimeAt = (
  versions: LeadTimeVersion[],
  sku: string,
  at: string,
) =>
  versions
    .filter(
      (item) =>
        !item._deleted &&
        normalizeSkuCode(item.sku) === normalizeSkuCode(sku) &&
        (item.status === "Đang áp dụng" ||
          (item.status === "Hết hiệu lực" && !!item.confirmedAt)) &&
        !!item.validFrom &&
        Date.parse(item.validFrom) <= Date.parse(at) &&
        (!item.validTo || Date.parse(at) < Date.parse(item.validTo)),
    )
    .sort(
      (a, b) => Date.parse(b.validFrom || "") - Date.parse(a.validFrom || ""),
    )[0];

type LeadtimeDataSnapshot = {
  leadRows: LeadtimeRow[];
  versions: LeadTimeVersion[];
  rules: SafetyRuleSet[];
};

async function readRecordPayloads<T>(entity: string): Promise<T[]> {
  const response = await recordFetch(`/api/records?entity=${entity}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Không tải được ${entity}`);
  const data = await response.json();
  return data.records
    .map((record: { payload: T }) => record.payload)
    .filter((payload: T & { _deleted?: boolean }) => !payload._deleted);
}

async function loadLeadtimeDataSnapshot(): Promise<LeadtimeDataSnapshot> {
  const session = clientSessionGeneration();
  const [savedLeadRows, versions, rules] = await Promise.all([
    readRecordPayloads<LeadtimeRow>("leadtime"),
    readRecordPayloads<LeadTimeVersion>("leadtime_versions"),
    readRecordPayloads<SafetyRuleSet>("safety_rules"),
  ]);
  assertCurrentClientSession(session);
  const mergedLeadRows = Array.from(
    new Map<string, LeadtimeRow>(
      [...leadtimeRows, ...savedLeadRows].map(
        (row) => [normalizeSkuCode(row.sku), row] as const,
      ),
    ).values(),
  );
  return { leadRows: mergedLeadRows, versions, rules };
}

const currentLeadtimeSettingForSku = (
  snapshot: LeadtimeDataSnapshot,
  sku: string,
  at: string,
) => {
  const normalizedSku = normalizeSkuCode(sku);
  const activeVersion = activeLeadTimeAt(snapshot.versions, normalizedSku, at);
  const legacy = snapshot.leadRows.find(
    (row) => normalizeSkuCode(row.sku) === normalizedSku,
  );
  const leadTime = activeVersion?.leadTime ?? legacy?.leadTime ?? 0;
  const rule = activeSafetyRuleFor(at.slice(0, 10), snapshot.rules);
  return {
    leadTime,
    safety: safetyBreakdown(leadTime, rule),
    rule,
  };
};

function LeadtimeMasterView({
  masterSkus,
  skuReadState,
  operator,
  onOpenSkuMaster,
  language,
  onListReset,
}: {
  masterSkus: Sku[];
  skuReadState: {hasData:boolean;error:Error|null};
  operator: string;
  onOpenSkuMaster: () => void;
  language: Language;
  onListReset: () => void;
}) {
  const session = useRef(clientSessionGeneration()).current;
  const dataRevision = useDataRefresh(['leadtime', 'leadtime_versions', 'safety_rules', 'sku']);
  const [versions, setVersions] = useState<LeadTimeVersion[]>([]);
  const [panel, setPanel] = useState<LeadTimePanel>(null);
  const [selectedSku, setSelectedSku] = useState("");
  const [formSku, setFormSku] = useState("");
  const [leadValue, setLeadValue] = useState("");
  const [skuLookupOpen, setSkuLookupOpen] = useState(false);
  const [skuValidated, setSkuValidated] = useState(false);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [searchField, setSearchField] = useState<LeadTimeSearchField>("sku");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  useApprovalNavigation(['leadtime_versions'],()=>{setPanel(null);setSelectedSku('');setQuery('');setStatusFilter('Chờ xác nhận');});
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [discardIntent, setDiscardIntent] = useState<
    { kind: "panel"; next: LeadTimePanel } | { kind: "list" } | null
  >(null);
  const [rules, setRules] = useState<SafetyRuleSet[]>([]);
  const [localLeadRevision, setLocalLeadRevision] = useState(0);
  const previousPanel = useRef<LeadTimePanel>(null);
  const cancellation = useMasterCancellation(()=>{setSelectedSku("");setNotice("Đã Hủy Lead Time. Dữ liệu được giữ lại và ngừng áp dụng.");});
  const now = new Date().toISOString();

  useEffect(() => {
    loadLeadtimeDataSnapshot()
      .then((snapshot) => {
        assertCurrentClientSession(session);
        setVersions(snapshot.versions);
        setRules(snapshot.rules);
        safetyRuleSets = snapshot.rules;
        leadtimeBySku.clear();
        snapshot.leadRows.forEach((row) =>
          leadtimeBySku.set(normalizeSkuCode(row.sku), row),
        );
        setLocalLeadRevision((value) => value + 1);
      })
      .catch(() =>
        setError(
          "Không thể tải dữ liệu Lead Time và Safety Days. Vui lòng thử lại.",
        ),
      );
  }, [dataRevision]);

  const currentSafetyRule = activeSafetyRuleFor(now.slice(0, 10), rules);

  const masterMap = useMemo(
    () => new Map(masterSkus.map((sku) => [normalizeSkuCode(sku.code), sku])),
    [masterSkus],
  );
  const activeRows = useMemo(
    () =>
      masterSkus
        .map((master) => {
          const sku = normalizeSkuCode(master.code);
          const saved = activeLeadTimeAt(versions, sku, now);
          const pending = versions
            .filter(
              (item) => item.sku === sku && item.status === "Chờ xác nhận",
            )
            .sort((a, b) => b.setupAt.localeCompare(a.setupAt))[0];
          const legacy = leadtimeBySku.get(sku);
          const cancelled = versions.filter(item=>item.sku===sku && isMasterCancelled(item)).sort(newestMasterFirst)[0];
          const version = pending ?? saved ?? (legacy?.cancelled ? cancelled : undefined);
          const leadTime = version?.leadTime ?? (legacy as LeadtimeRow & {retainedLeadTime?:number})?.retainedLeadTime ?? legacy?.leadTime ?? 0;
          return {
            master,
            version,
            leadTime,
            safety: safetyBreakdown(isMasterCancelled(legacy)||isMasterCancelled(version) ? 0 : leadTime, currentSafetyRule),
          };
        })
        .filter(
          (item) =>
            isMasterCancelled(leadtimeBySku.get(item.master.code)) || item.leadTime > 0 ||
            item.version?.status === "Chờ xác nhận" ||
            (
              leadtimeBySku.get(item.master.code) as LeadtimeRow & {
                pendingSetup?: boolean;
              }
            )?.pendingSetup,
        ),
    [masterSkus, versions, now, localLeadRevision, currentSafetyRule],
  );
  const leadTimeGroups = useMemo(
    () =>
      Array.from(new Set(activeRows.map(({ master }) => master.group))).sort(
        (a, b) =>
          a.localeCompare(b, "vi", { numeric: true, sensitivity: "base" }),
      ),
    [activeRows],
  );
  const leadTimeLines = useMemo(
    () =>
      Array.from(new Set(activeRows.map(({ master }) => master.line))).sort(
        (a, b) =>
          a.localeCompare(b, "vi", { numeric: true, sensitivity: "base" }),
      ),
    [activeRows],
  );
  const filteredRows = useMemo(
    () =>
      activeRows
        .filter(({ master, version }) => {
          const key = normalizeSearchText(query);
          const safety = safetyBreakdown(
            version?.leadTime ??
              leadtimeBySku.get(normalizeSkuCode(master.code))?.leadTime ??
              0,
            currentSafetyRule,
          );
          const values: Record<LeadTimeSearchField, string | number> = {
            sku: master.code,
            name: master.name,
            specification: master.specification,
            group: master.group,
            line: master.line,
            leadTime:
              version?.leadTime ??
              leadtimeBySku.get(normalizeSkuCode(master.code))?.leadTime ??
              0,
            leadTimeSafety: safety.leadTimeDays,
            forecastDays: safety.forecastDays,
            situationDays: safety.situationDays,
            totalSafetyDays: safety.total,
            createDate: "",
          };
          const value = normalizeSearchText(String(values[searchField]));
          const matched =
            searchField === "sku" ? value.startsWith(key) : value.includes(key);
          return (
            (searchField === "createDate" || !key || matched) &&
            (!statusFilter ||
              (version?.status ||
                (isMasterCancelled(leadtimeBySku.get(master.code)) ? "Đã hủy" : (leadtimeBySku.get(master.code)?.leadTime || 0) > 0
                  ? "Đang áp dụng"
                  : "Chờ bổ sung")) === statusFilter)
          );
        })
        .sort((a, b) => (searchField === "createDate" ? newestMasterFirst(a.version || leadtimeBySku.get(a.master.code),b.version || leadtimeBySku.get(b.master.code)) : 0) || compareGroupThenSku(a.master, b.master)),
    [activeRows, query, searchField, statusFilter, now, currentSafetyRule],
  );
  const existingLeadtimeSkus = useMemo(() => {
    const items = new Set<string>();
    leadtimeBySku.forEach((row, sku) => {
      if (Number(row.leadTime || 0) > 0) items.add(normalizeSkuCode(sku));
    });
    versions.forEach((item) => {
      if (
        !item._deleted &&
        ["Nháp", "Chờ xác nhận", "Đang áp dụng"].includes(item.status)
      )
        items.add(normalizeSkuCode(item.sku));
    });
    return items;
  }, [versions, localLeadRevision]);
  const hasLeadtimeRecord = (skuValue: string) =>
    existingLeadtimeSkus.has(normalizeSkuCode(skuValue));
  const duplicateLeadtimeMessage = (sku: string) =>
    language === "zh"
      ? `SKU ${sku} 已有 Leadtime，不能重複新增。請選取該列後使用「編輯」。`
      : `SKU ${sku} đã có Leadtime, không thể thêm mới. Vui lòng chọn dòng và dùng chức năng Sửa.`;
  const selectedMaster = masterMap.get(normalizeSkuCode(formSku));
  const skuSuggestions = useMemo(() => {
    const key = normalizeSearchText(formSku);
    if (!key) return [];
    return masterSkus
      .filter(
        (sku) =>
          normalizeSearchText(sku.code).startsWith(key) &&
          usableSku(sku) &&
          !existingLeadtimeSkus.has(normalizeSkuCode(sku.code)),
      )
      .sort((a, b) =>
        normalizeSkuCode(a.code).localeCompare(normalizeSkuCode(b.code), "vi", {
          numeric: true,
          sensitivity: "base",
        }),
      )
      .slice(0, 8);
  }, [formSku, masterSkus, existingLeadtimeSkus]);
  const selectedVersions = versions
    .filter((item) => item.sku === normalizeSkuCode(selectedSku))
    .sort((a, b) => b.setupAt.localeCompare(a.setupAt));
  const selectedActive = activeLeadTimeAt(
    versions,
    normalizeSkuCode(selectedSku),
    now,
  );
  const selectedPending = selectedVersions.find(
    (item) => item.status === "Chờ xác nhận" || item.status === "Nháp",
  );
  const selectedLegacy = leadtimeBySku.get(normalizeSkuCode(selectedSku));
  const currentLead = selectedActive?.leadTime ?? selectedLegacy?.leadTime ?? 0;
  const selectedSafetyRule = currentSafetyRule;
  const selectedSafety = safetyBreakdown(currentLead, selectedSafetyRule);

  const finishReturnToList = () => {
    setPanel(null);
    setSelectedSku("");
    setFormSku("");
    setLeadValue("");
    setNote("");
    setReason("");
    setCancelReason("");
    setSearchField("sku");
    setQuery("");
    setStatusFilter("");
    setSkuLookupOpen(false);
    setSkuValidated(false);
    setDirty(false);
    setDiscardIntent(null);
    setError("");
    onListReset();
  };
  const returnToList = () => {
    if (dirty && (panel === "create" || panel === "edit")) {
      setDiscardIntent({ kind: "list" });
      return;
    }
    finishReturnToList();
  };
  useEffect(() => {
    if (previousPanel.current === "detail" && panel === null) {
      setSelectedSku("");
      setSearchField("sku");
      setQuery("");
      setStatusFilter("");
      onListReset();
    }
    previousPanel.current = panel;
  }, [panel, onListReset]);

  const finishOpenPanel = (next: LeadTimePanel) => {
    setPanel(next);
    setDirty(false);
    setError("");
    setNotice("");
    setDiscardIntent(null);
    if (next === "create") {
      setFormSku("");
      setLeadValue("");
      setNote("");
      setReason("");
      setSkuLookupOpen(false);
      setSkuValidated(false);
    }
    if (next === "edit" && selectedSku) {
      setFormSku(selectedSku);
      setLeadValue("");
      setNote("");
      setReason("");
    }
  };
  const openPanel = (next: LeadTimePanel) => {
    if (dirty && (panel === "create" || panel === "edit")) {
      setDiscardIntent({ kind: "panel", next });
      return;
    }
    finishOpenPanel(next);
  };
  const confirmDiscard = () => {
    const intent = discardIntent;
    if (!intent) return;
    if (intent.kind === "list") finishReturnToList();
    else finishOpenPanel(intent.next);
  };
  const validateMaster = (master?: Sku) => {
    if (!master)
      return language === "zh"
        ? "無法新增 Leadtime：SKU 不存在於 SKU Master。"
        : "Không thể thêm mới Leadtime vì SKU chưa tồn tại trong SKU Master.";
    if (!usableSku(master))
      return language === "zh"
        ? `SKU ${master.code} 尚未確認或未在使用中。`
        : `SKU ${master.code} chưa được xác nhận hoặc không ở trạng thái Đang sử dụng.`;
    const missing = [
      !master.code && "Mã SKU",
      !master.name && "Tên sản phẩm",
      !master.group && "Nhóm sản phẩm",
      (!master.line || master.line === "—") && "Line",
    ].filter(Boolean);
    return missing.length
      ? `Không thể thêm mới Lead Time vì thông tin SKU Master chưa đầy đủ. SKU ${master.code} chưa có thông tin ${missing.join(", ")}.`
      : "";
  };
  const leadOperation = (record: LeadTimeVersion, action: string) => ({
    entity: "leadtime_versions", key: record.id, payload: record,
    operation: action === "Thêm mới" ? "create" : "update",
    audit: {sku:record.sku,skuId:record.skuId,version:record.version,action,
      oldLeadTime:currentLead,newLeadTime:record.leadTime,reason:record.reason || cancelReason,
      operatedAt:new Date().toISOString(),confirmedBy:record.confirmedBy,
      confirmedAt:record.confirmedAt,validFrom:record.validFrom,validTo:record.validTo,
      usedByProductionEngine:!!record.usedByPlans?.length},
  });
  const persistMany = async (items: Array<{record: LeadTimeVersion;action:string}>) => {
    setSaving(true);
    try {
      const response = await linkedRecordFetch("leadtime", items.map(item => leadOperation(item.record,item.action)));
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || "Không thể lưu dữ liệu.");
    } finally { setSaving(false); }
  };
  const persist = async (record: LeadTimeVersion, action: string) => persistMany([{record,action}]);
  const saveDraft = async (status: "Nháp" | "Chờ xác nhận") => {
    const sku = normalizeSkuCode(formSku);
    const master = masterMap.get(sku);
    const masterError = validateMaster(master);
    const value = Number(leadValue);
    if (masterError) {
      setError(masterError);
      return;
    }
    if (!Number.isInteger(value) || value < 0) {
      (notifyActionFailure("Lead Time phải là số nguyên lớn hơn hoặc bằng 0."), setError("Lead Time phải là số nguyên lớn hơn hoặc bằng 0."));
      return;
    }
    if (
      versions.some(
        (item) =>
          item.sku === sku && ["Nháp", "Chờ xác nhận"].includes(item.status),
      )
    ) {
      setError(`SKU ${sku} đã có hồ sơ Lead Time đang chờ xử lý.`);
      return;
    }
    if (panel === "create" && hasLeadtimeRecord(sku)) {
      setError(duplicateLeadtimeMessage(sku));
      return;
    }
    if (panel === "edit" && !reason.trim()) {
      (notifyActionFailure("Vui lòng nhập Lý do thay đổi."), setError("Vui lòng nhập Lý do thay đổi."));
      return;
    }
    const record: LeadTimeVersion = {
      id: `LT-${sku}-${Date.now()}`,
      skuId: skuStableId(master!),
      sku,
      version: leadTimeVersionNumber(versions, sku),
      leadTime: value,
      status,
      setupAt: new Date().toISOString(),
      note: note.trim(),
      reason: reason.trim(),
      createdBy: operator,
      updatedBy: operator,
    };
    try {
      await persist(record, panel === "edit" ? "Tạo thay đổi" : "Thêm mới");
      setVersions((items) => [record, ...items]);
      setSelectedSku(sku);
      setPanel(null);
      setDirty(false);
      setNotice(
        status === "Nháp"
          ? "Đã lưu bản Nháp."
          : "Đã lưu và chuyển sang Chờ xác nhận.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Không thể lưu dữ liệu. Vui lòng thử lại.",
      );
    }
  };
  const confirmPending = async () => {
    if (!selectedPending || selectedPending.status !== "Chờ xác nhận") return;
    const master = masterMap.get(selectedPending.sku);
    const masterError = validateMaster(master);
    if (masterError) {
      setError(masterError);
      return;
    }
    const confirmedAt = new Date().toISOString();
    const old = activeLeadTimeAt(versions, selectedPending.sku, confirmedAt);
    const next = {
      ...selectedPending,
      status: "Đang áp dụng" as const,
      validFrom: confirmedAt,
      confirmedBy: operator,
      confirmedAt,
      updatedBy: operator,
    };
    const ended = old
      ? {
          ...old,
          status: "Hết hiệu lực" as const,
          validTo: confirmedAt,
          updatedBy: operator,
        }
      : null;
    try {
      await persistMany([...(ended ? [{record:ended,action:"Hết hiệu lực tự động"}] : []), {record:next,action:"Xác nhận áp dụng"}]);
      setVersions((items) =>
        items.map((item) =>
          item.id === next.id
            ? next
            : ended && item.id === ended.id
              ? ended
              : item,
        ),
      );
      leadtimeBySku.set(next.sku, {
        sku: next.sku,
        name: master!.name,
        spec: master!.specification,
        group: master!.group,
        line: master!.line,
        ltProduction: next.leadTime,
        ltQc: 0,
        ltWarehouse: 0,
        note: next.note,
        leadTime: next.leadTime,
        moq: master!.moq,
      });
      setPanel(null);
      setNotice("Lead Time mới đã được xác nhận và bắt đầu có hiệu lực.");
    } catch {
      setError("Không thể xác nhận dữ liệu. Vui lòng thử lại.");
    }
  };
  const cancelConfirmation = async () => {
    if (!selectedActive || !cancelReason.trim()) {
      (notifyActionFailure("Vui lòng nhập lý do hủy xác nhận."), setError("Vui lòng nhập lý do hủy xác nhận."));
      return;
    }
    if (selectedActive.usedByPlans?.length) {
      setError(
        "Lead Time này đã được Production Engine sử dụng. Vui lòng tạo một thay đổi mới thay thế.",
      );
      return;
    }
    const previous = selectedVersions.find(
      (item) =>
        item.status === "Hết hiệu lực" &&
        item.validTo === selectedActive.validFrom,
    );
    const cancelled = {
      ...selectedActive,
      status: "Đã hủy xác nhận" as const,
      updatedBy: operator,
    };
    const restored = previous
      ? {
          ...previous,
          status: "Đang áp dụng" as const,
          validTo: undefined,
          updatedBy: operator,
        }
      : null;
    try {
      await persistMany([{record:cancelled,action:"Hủy xác nhận"}, ...(restored ? [{record:restored,action:"Khôi phục phiên bản cũ"}] : [])]);
      setVersions((items) =>
        items.map((item) =>
          item.id === cancelled.id
            ? cancelled
            : restored && item.id === restored.id
              ? restored
              : item,
        ),
      );
      setPanel(null);
      setCancelReason("");
      setNotice("Đã hủy xác nhận và giữ bản ghi trong lịch sử.");
    } catch {
      setError("Không thể hủy xác nhận. Vui lòng thử lại.");
    }
  };

  return (
    <main
      className={`workspace leadtime-v2 ${panel === "create" || panel === "edit" ? "leadtime-form-only" : ""}`}
    >
      <div className="safety-rules-title">
        <PageTitle variant="menu-root">Leadtime</PageTitle>
      </div>
      {cancellation.dialog}
      <StandardToolbar name="LeadtimeMasterView" items={[toolbarConfig.group([toolbarConfig.group([toolbarConfig.action({"onClick": () => openPanel("create")},<>＋ Thêm mới</>, true, "action"),
toolbarConfig.action({"disabled": !selectedSku || isMasterCancelled(leadtimeBySku.get(selectedSku)), disabledExplanation: !selectedSku ? "Chọn một dòng trong bảng trước khi thực hiện thao tác." : "Lead Time này đã bị hủy.","onClick": () => openPanel("edit")},<>✎ Sửa
            </>, true, "action"),
toolbarConfig.action({disabled:!selectedSku||isMasterCancelled(leadtimeBySku.get(selectedSku))||cancellation.busy, disabledExplanation: cancellation.busy ? "Đang xử lý dữ liệu. Vui lòng chờ hoàn tất rồi thử lại." : !selectedSku ? "Chọn một dòng trong bảng trước khi thực hiện thao tác." : "Lead Time này đã bị hủy.",onClick:()=>cancellation.open({entity:"leadtime",key:selectedSku,label:"Lead Time",linkedKeys:versions.filter(v=>v.sku===selectedSku&&["Đang áp dụng","Nháp","Chờ xác nhận"].includes(v.status)).map(v=>v.id)})},"Hủy",true,"action"),
toolbarConfig.action({"onClick": () => openPanel("search")},<>⌕ Tra cứu</>, true, "lookup"),
toolbarConfig.action({"disabled": !selectedPending || selectedPending.status !== "Chờ xác nhận", disabledExplanation: "Chọn bản Lead Time ở trạng thái Chờ xác nhận.","onClick": () => openPanel("confirm")},<>✓ Xác nhận
            </>, true, "action"),
toolbarConfig.action({"disabled": !selectedActive, disabledExplanation: "Chọn bản Lead Time đang áp dụng trước khi hủy xác nhận.","onClick": () => openPanel("cancel")},<>↶ Hủy xác nhận
            </>, true, "action"),
toolbarConfig.action({"onClick": returnToList},<>← Quay lại danh sách
            </>, true, "back", 'parent')]),
panel === "search" && (
            toolbarConfig.group([toolbarConfig.field(<><span>TRA THEO</span></>,[toolbarConfig.select({"value": searchField,"onChange": (e) => {
                    setSearchField(e.target.value as LeadTimeSearchField);
                    setQuery("");
                  }},<><option value="sku">Mã SKU</option><option value="name">Tên sản phẩm</option><option value="specification">Quy cách</option><option value="group">Nhóm sản phẩm</option><option value="line">Line</option><option value="leadTime">Lead Time</option><option value="leadTimeSafety">Safety theo Lead Time</option><option value="forecastDays">Ngày cộng dự báo</option><option value="situationDays">Ngày cộng tình huống</option><option value="totalSafetyDays">Tổng Safety Days</option><option value="createDate">Create - date</option></>)]),
toolbarConfig.field(<><span>NỘI DUNG TRA</span></>,[searchField === "createDate" ? toolbarConfig.input({value:"Thêm/sửa gần nhất",readOnly:true}) : searchField === "group" ? (
                  toolbarConfig.select({"value": query,"onChange": (e) => setQuery(e.target.value)},<><option value="">Tất cả nhóm</option>{leadTimeGroups.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}</>)
                ) : searchField === "line" ? (
                  toolbarConfig.select({"value": query,"onChange": (e) => setQuery(e.target.value)},<><option value="">Tất cả Line</option>{leadTimeLines.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}</>)
                ) : (
                  toolbarConfig.input({"value": query,"onChange": (e) => setQuery(e.target.value),"inputMode": [
                        "leadTime",
                        "leadTimeSafety",
                        "forecastDays",
                        "situationDays",
                        "totalSafetyDays",
                      ].includes(searchField)
                        ? "numeric"
                        : "search","placeholder": `Nhập ${searchField === "sku" ? "mã SKU" : "nội dung cần tra"}...`})
                )]),
toolbarConfig.field(<><span>TRẠNG THÁI</span></>,[toolbarConfig.select({"value": statusFilter,"onChange": (e) => setStatusFilter(e.target.value)},<><option value="">Tất cả</option><option>Chờ xác nhận</option><option>Đang áp dụng</option><option>Đã hủy</option></>)]),
toolbarConfig.group([toolbarConfig.action({"title": "Xóa điều kiện","onClick": () => {
                    setQuery("");
                    setStatusFilter("");
                  }},<>Xóa lọc
                </>, true, "clear"),
toolbarConfig.action({"onClick": () => undefined},<>Tìm kiếm
                </>, true, "search"),
toolbarConfig.action({"onClick": () => {
                    setSearchField("sku");
                    setQuery("");
                    setStatusFilter("");
                    setPanel(null);
                  }},<>Quay lại
                </>, true, "back", 'lookup')])])
          )])]} />
      {(notice || (error && panel !== "create" && panel !== "edit")) && (
        <div
          className={`save-notice master-save-notice ${error ? "leadtime-error" : ""}`}
        >
          <span>{error || notice}</span>
          <span>
            {error && (
              <>
                <FeedbackActionButton className="inline-link" onClick={onOpenSkuMaster}>
                  Đi đến SKU Master
                </FeedbackActionButton>
                <FeedbackActionButton onClick={() => setError("")}>Đóng</FeedbackActionButton>
              </>
            )}
          </span>
        </div>
      )}
      {(panel === "create" || panel === "edit") && (
        <section
          className="data-card leadtime-inline-panel"
          onChangeCapture={() => setDiscardIntent(null)}
        >
          <header>
            <div>
              <h2>{panel === "create" ? "Thêm mới" : "Sửa"} Lead Time</h2>
            </div>
            <FeedbackActionButton onClick={() => openPanel(null)}>×</FeedbackActionButton>
          </header>
          <div className="leadtime-form-grid">
            <fieldset>
              <legend>Thông tin SKU</legend>
              <div className="leadtime-sku-lookup">
                <label>
                  <span>Mã SKU *</span>
                  <input
                    value={formSku}
                    readOnly={panel === "edit"}
                    autoComplete="off"
                    onFocus={() => {
                      if (panel === "create") setSkuLookupOpen(true);
                    }}
                    onChange={(e) => {
                      setFormSku(e.target.value);
                      setDirty(true);
                      setError("");
                      setSkuValidated(false);
                      setSkuLookupOpen(true);
                    }}
                    onBlur={() => {
                      const normalized = normalizeSkuCode(formSku);
                      setFormSku(normalized);
                      setSkuLookupOpen(false);
                      setSkuValidated(!!normalized);
                      if (normalized && !masterMap.has(normalized))
                        setError(validateMaster(undefined));
                      else if (
                        normalized &&
                        panel === "create" &&
                        hasLeadtimeRecord(normalized)
                      )
                        setError(duplicateLeadtimeMessage(normalized));
                      else if (normalized)
                        setError(validateMaster(masterMap.get(normalized)));
                    }}
                    placeholder="Chỉ nhập mã SKU"
                  />
                </label>
                {panel === "create" &&
                  skuLookupOpen &&
                  formSku.trim() &&
                  skuSuggestions.length > 0 && (
                    <div className="leadtime-sku-suggestions">
                      {skuSuggestions.map((sku) => (
                        <FeedbackActionButton
                          type="button"
                          key={sku.code}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            setFormSku(normalizeSkuCode(sku.code));
                            setSkuLookupOpen(false);
                            setSkuValidated(true);
                            setError(validateMaster(sku));
                          }}
                        >
                          <b>{sku.code}</b>
                          <span>{sku.name}</span>
                          <small>
                            {sku.specification} · {sku.line}
                          </small>
                        </FeedbackActionButton>
                      ))}
                    </div>
                  )}
              </div>
              <div className="leadtime-readonly-grid">
                <label>
                  <span>Tên sản phẩm</span>
                  <input readOnly value={selectedMaster?.name || ""} />
                </label>
                <label>
                  <span>Quy cách</span>
                  <input readOnly value={selectedMaster?.specification || ""} />
                </label>
                <label>
                  <span>Nhóm sản phẩm</span>
                  <input readOnly value={selectedMaster?.group || ""} />
                </label>
                <label>
                  <span>Line</span>
                  <input readOnly value={selectedMaster?.line || ""} />
                </label>
                <label>
                  <span>Trạng thái SKU</span>
                  <input readOnly value={selectedMaster?.status || ""} />
                </label>
              </div>
            </fieldset>
            <fieldset>
              <legend>Dữ liệu Lead Time</legend>
              {panel === "edit" && (
                <label>
                  <span>Lead Time hiện tại</span>
                  <input readOnly value={currentLead} />
                </label>
              )}
              <label>
                <span>
                  {panel === "edit" ? "Lead Time mới" : "Lead Time"} *
                </span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={leadValue}
                  onChange={(e) => {
                    setLeadValue(e.target.value);
                    setDirty(true);
                  }}
                />
              </label>
              <label>
                <span>Ngày thiết lập</span>
                <input readOnly value={formatDateTimeDisplay(new Date())} />
              </label>
              {panel === "edit" && (
                <label>
                  <span>Lý do thay đổi *</span>
                  <textarea
                    value={reason}
                    onChange={(e) => {
                      setReason(e.target.value);
                      setDirty(true);
                    }}
                  />
                </label>
              )}
              <label>
                <span>Ghi chú</span>
                <textarea
                  value={note}
                  onChange={(e) => {
                    setNote(e.target.value);
                    setDirty(true);
                  }}
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
                {language === "zh"
                  ? "尚未儲存的資料將會遺失。確定要離開嗎？"
                  : "Dữ liệu chưa lưu sẽ bị mất. Bạn có muốn thoát không?"}
              </span>
              <div className="form-discard-actions">
                <FeedbackActionButton type="button" onClick={() => setDiscardIntent(null)}>
                  {language === "zh" ? "否" : "Không"}
                </FeedbackActionButton>
                <FeedbackActionButton
                  type="button"
                  className="confirm-discard"
                  onClick={confirmDiscard}
                >
                  {language === "zh" ? "是" : "Có"}
                </FeedbackActionButton>
              </div>
            </div>
          )}
          <div className="function-actions">
            <FeedbackActionButton className="ghost-button" onClick={() => openPanel(null)}>
              Hủy
            </FeedbackActionButton>
            <FeedbackActionButton
              className="primary-button"
              disabled={
                saving ||
                !!validateMaster(selectedMaster) ||
                (panel === "create" && hasLeadtimeRecord(formSku)) ||
                leadValue === "" ||
                (panel === "edit" && !reason.trim())
              } disabledExplanation={saving ? "Thao tác đang được xử lý. Vui lòng chờ hoàn tất rồi thử lại." : validateMaster(selectedMaster) || (panel === "create" && hasLeadtimeRecord(formSku) ? "SKU này đã có bản ghi Leadtime. Chọn sửa bản ghi hiện có." : leadValue === "" ? "Nhập Leadtime trước khi lưu." : "Nhập lý do chỉnh sửa trước khi lưu.")}
              onClick={() => saveDraft("Chờ xác nhận")}
            >
              Lưu
            </FeedbackActionButton>
          </div>
        </section>
      )}
      {panel === "confirm" && selectedPending && (
        <section className="data-card leadtime-inline-panel">
          <header>
            <h2>Xác nhận áp dụng</h2>
            <FeedbackActionButton onClick={() => setPanel(null)}>×</FeedbackActionButton>
          </header>
          <div className="approval-summary">
            <span>
              <small>SKU</small>
              <b>{selectedPending.sku}</b>
            </span>
            <span>
              <small>Lead Time hiện tại</small>
              <b>{currentLead}</b>
            </span>
            <span>
              <small>Lead Time mới</small>
              <b>{selectedPending.leadTime}</b>
            </span>
            <span>
              <small>Safety Days mới dự kiến</small>
              <b>
                {
                  safetyBreakdown(
                    selectedPending.leadTime,
                    activeSafetyRuleFor(now.slice(0, 10)),
                  ).total
                }
              </b>
            </span>
          </div>
          <p className="leadtime-impact">
            <b>Ảnh hưởng dữ liệu:</b> Production Engine chưa chốt sẽ có cảnh báo
            và chỉ đổi khi người dùng bấm Tính lại.
          </p>
          <div className="function-actions">
            <FeedbackActionButton className="ghost-button" onClick={() => setPanel(null)}>
              Không xác nhận
            </FeedbackActionButton>
            <FeedbackActionButton
              className="primary-button"
              disabled={saving} disabledExplanation={"Thao tác đang được xử lý. Vui lòng chờ hoàn tất rồi thử lại."}
              onClick={confirmPending}
            >
              Xác nhận áp dụng
            </FeedbackActionButton>
          </div>
        </section>
      )}
      {panel === "cancel" && selectedActive && (
        <section className="data-card leadtime-inline-panel">
          <header>
            <h2>Hủy xác nhận</h2>
            <FeedbackActionButton onClick={() => setPanel(null)}>×</FeedbackActionButton>
          </header>
          <label className="leadtime-cancel-reason">
            <span>Lý do hủy xác nhận *</span>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </label>
          <div className="function-actions">
            <FeedbackActionButton className="ghost-button" onClick={() => setPanel(null)}>
              Đóng
            </FeedbackActionButton>
            <FeedbackActionButton
              className="danger-button"
              disabled={saving || !cancelReason.trim()} disabledExplanation={saving ? "Thao tác đang được xử lý. Vui lòng chờ hoàn tất rồi thử lại." : "Nhập lý do hủy xác nhận trước khi tiếp tục."}
              onClick={cancelConfirmation}
            >
              Hủy xác nhận
            </FeedbackActionButton>
          </div>
        </section>
      )}
      <section className="data-card master-data-card master-standard-card">
        <div className="result-bar">
          {skuReadState.hasData?<><strong>{filteredRows.length}</strong> SKU có dữ liệu Lead Time</>:<SkuResultCount count={0} hasData={false} error={skuReadState.error} language={language}/>} {" "}
          <span>· Bấm một lần để chọn, bấm hai lần để xem chi tiết</span>
        </div>
        <DataTable className="table-wrap">
          <table
            className="leadtime-table leadtime-main-table"
            data-page-size="25"
            data-compact-pagination="true"
          >
            <thead>
              <tr>
                <th>NHÓM SP</th>
                <th>SKU</th>
                <th>TÊN SẢN PHẨM</th>
                <th>QUY CÁCH</th>
                <th>LINE</th>
                <th>LEAD TIME</th>
                <th>SAFETY THEO LEAD TIME</th>
                <th>NGÀY CỘNG DỰ BÁO</th>
                <th>NGÀY CỘNG TÌNH HUỐNG</th>
                <th>TỔNG SAFETY DAYS</th>
                <th>TRẠNG THÁI</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(({ master, version, leadTime, safety }) => (
                <tr
                  key={master.code}
                  className={
                    selectedSku === normalizeSkuCode(master.code)
                      ? "selected"
                      : ""
                  }
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setSelectedSku(normalizeSkuCode(master.code));
                    if (panel === "detail") setPanel(null);
                  }}
                  onDoubleClick={() => {
                    setSelectedSku(normalizeSkuCode(master.code));
                    setPanel("detail");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      setSelectedSku(normalizeSkuCode(master.code));
                      setPanel("detail");
                    }
                  }}
                >
                  <DataCell kind="code">
                    <span className="tag">{master.group}</span>
                  </DataCell>
                  <DataCell kind="code">
                    <FeedbackActionButton
                      className="sku-link"
                      onClick={(e) => e.stopPropagation()}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setSelectedSku(normalizeSkuCode(master.code));
                        setPanel("detail");
                      }}
                    >
                      {master.code}
                    </FeedbackActionButton>
                  </DataCell>
                  <DataCell>{master.name}</DataCell>
                  <DataCell>{master.specification}</DataCell>
                  <DataCell kind="code">{master.line}</DataCell>
                  <DataCell kind="number" className="number">
                    {leadTime > 0 ? leadTime : "Chờ bổ sung"}
                  </DataCell>
                  <DataCell kind="number" className="number">{safety.leadTimeDays}</DataCell>
                  <DataCell kind="number" className="number">{safety.forecastDays}</DataCell>
                  <DataCell kind="number" className="number">{safety.situationDays}</DataCell>
                  <DataCell kind="number" className="number master-total">{safety.total}</DataCell>
                  <DataCell>
                    <span
                      className={
                        version?.status === "Chờ xác nhận"
                          ? "status-warning"
                          : "status-good"
                      }
                    >
                      {version?.status ||
                        (isMasterCancelled(leadtimeBySku.get(master.code)) ? "Đã hủy" : leadTime > 0 ? "Đang áp dụng" : "Chờ bổ sung")}
                    </span>
                  </DataCell>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>
      </section>
      {panel === "detail" && selectedSku && (
        <section className="data-card leadtime-detail">
          <header>
            <div>
              <h2>Thông tin đang áp dụng · {selectedSku}</h2>
              <p>
                {masterMap.get(selectedSku)?.name} ·{" "}
                {masterMap.get(selectedSku)?.specification}
              </p>
            </div>
            <FeedbackActionButton aria-label="Đóng" onClick={() => setPanel(null)}>
              ×
            </FeedbackActionButton>
          </header>
          <h3>Thông tin đang áp dụng</h3>
          <div className="leadtime-detail-grid">
            <span>
              <small>SKU</small>
              <b>{selectedSku}</b>
            </span>
            <span>
              <small>Tên sản phẩm</small>
              <b>{masterMap.get(selectedSku)?.name}</b>
            </span>
            <span>
              <small>Quy cách</small>
              <b>{masterMap.get(selectedSku)?.specification}</b>
            </span>
            <span>
              <small>Nhóm sản phẩm</small>
              <b>{masterMap.get(selectedSku)?.group}</b>
            </span>
            <span>
              <small>Line</small>
              <b>{masterMap.get(selectedSku)?.line}</b>
            </span>
            <span>
              <small>Lead Time hiện tại</small>
              <b>{currentLead}</b>
            </span>
            <span>
              <small>Safety theo Lead Time</small>
              <b>{selectedSafety.leadTimeDays}</b>
            </span>
            <span>
              <small>Ngày cộng dự báo</small>
              <b>{selectedSafety.forecastDays}</b>
            </span>
            <span>
              <small>Ngày cộng tình huống</small>
              <b>{selectedSafety.situationDays}</b>
            </span>
            <span className="leadtime-detail-total">
              <small>Tổng Safety Days</small>
              <b>{selectedSafety.total}</b>
            </span>
            <span>
              <small>Mã bộ quy tắc Safety Days</small>
              <b>{selectedSafetyRule?.code || "—"}</b>
            </span>
            <span>
              <small>Phiên bản quy tắc Safety Days</small>
              <b>{selectedSafetyRule?.version || "—"}</b>
            </span>
            <span>
              <small>Trạng thái Lead Time</small>
              <b>
                {selectedActive?.status ||
                  (currentLead > 0 ? "Đang áp dụng" : "Chờ bổ sung")}
              </b>
            </span>
            <span>
              <small>Ngày thiết lập</small>
              <b>
                {selectedActive
                  ? formatDateTimeDisplay(selectedActive.setupAt)
                  : "—"}
              </b>
            </span>
            <span>
              <small>Ngày hiệu lực</small>
              <b>
                {selectedActive?.validFrom
                  ? formatDateTimeDisplay(selectedActive.validFrom)
                  : "—"}
              </b>
            </span>
            <span>
              <small>Ngày hết hiệu lực</small>
              <b>
                {selectedActive?.validTo
                  ? formatDateTimeDisplay(selectedActive.validTo)
                  : "—"}
              </b>
            </span>
            <span>
              <small>Người tạo</small>
              <b>{selectedActive?.createdBy || "Dữ liệu gốc"}</b>
            </span>
            <span>
              <small>Người cập nhật</small>
              <b>{selectedActive?.updatedBy || "Dữ liệu gốc"}</b>
            </span>
            <span>
              <small>Người xác nhận</small>
              <b>{selectedActive?.confirmedBy || "—"}</b>
            </span>
            <span>
              <small>Thời gian xác nhận</small>
              <b>
                {selectedActive?.confirmedAt
                  ? formatDateTimeDisplay(selectedActive.confirmedAt)
                  : "—"}
              </b>
            </span>
          </div>
          <h3>Lịch sử thay đổi Lead Time</h3>
          <DataTable className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>PHIÊN BẢN</th>
                  <th>LEAD TIME</th>
                  <th>NGÀY THIẾT LẬP</th>
                  <th>NGÀY HIỆU LỰC</th>
                  <th>NGÀY HẾT HIỆU LỰC</th>
                  <th>TRẠNG THÁI</th>
                  <th>NGƯỜI TẠO</th>
                  <th>NGƯỜI CẬP NHẬT</th>
                  <th>NGƯỜI XÁC NHẬN</th>
                  <th>LÝ DO THAY ĐỔI</th>
                </tr>
              </thead>
              <tbody>
                {selectedVersions.length ? (
                  selectedVersions.map((item) => (
                    <tr key={item.id}>
                      <DataCell kind="code">{item.version}</DataCell>
                      <DataCell kind="number">{item.leadTime}</DataCell>
                      <DataCell kind="date">{formatDateTimeDisplay(item.setupAt)}</DataCell>
                      <DataCell kind="date">
                        {item.validFrom
                          ? formatDateTimeDisplay(item.validFrom)
                          : "—"}
                      </DataCell>
                      <DataCell kind="date">
                        {item.validTo
                          ? formatDateTimeDisplay(item.validTo)
                          : "—"}
                      </DataCell>
                      <DataCell>{item.status}</DataCell>
                      <DataCell>{item.createdBy}</DataCell>
                      <DataCell>{item.updatedBy}</DataCell>
                      <DataCell>{item.confirmedBy || "—"}</DataCell>
                      <DataCell>{item.reason || "—"}</DataCell>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <DataCell>Dữ liệu gốc</DataCell>
                    <DataCell>{currentLead}</DataCell>
                    <DataCell>—</DataCell>
                    <DataCell>—</DataCell>
                    <DataCell>—</DataCell>
                    <DataCell>Đang áp dụng</DataCell>
                    <DataCell>Dữ liệu gốc</DataCell>
                    <DataCell>Dữ liệu gốc</DataCell>
                    <DataCell>—</DataCell>
                    <DataCell>Khởi tạo từ dữ liệu Lead Time hiện có</DataCell>
                  </tr>
                )}
              </tbody>
            </table>
          </DataTable>
        </section>
      )}
      {panel === "detail" && (
        <FeedbackActionButton
          className="leadtime-detail-overlay"
          aria-label="Đóng bảng chi tiết"
          onClick={() => setPanel(null)}
        />
      )}
      {panel === "detail" && selectedSku && (
        <div className="leadtime-detail-heading">
          <b>SKU : {selectedSku}</b>
          <span>Tên sản phẩm: {masterMap.get(selectedSku)?.name}</span>
        </div>
      )}
    </main>
  );
}

// These legacy display snapshots are private to one authorization scope. Keep
// normal mutation refresh behavior, but never replay them after a session reset.
function clearLegacySessionCaches() {
  inventorySnapshotsCache = null;
  inventorySnapshotsPromise = null;
  inventoryImportsCache = null;
  inventoryImportsPromise = null;
  demandEventSessionCache = null;
  planningSessionCache = null;
  forecastRecordsCache = null;
  forecastRecordsPromise = null;
  productionEngineRecordsCache = null;
  productionEngineRecordsPromise = null;
  systemUsersCache = null;
  systemUsersPromise = null;
  departmentRecordsCache = null;
  departmentRecordsPromise = null;
  permissionRecordsCache = null;
  permissionRecordsPromise = null;
  leadtimeBySku.clear();
  leadtimeRows.forEach(row => leadtimeBySku.set(row.sku.toUpperCase(), row));
  safetyDaysBySku.clear();
  safetyRuleSets = [];
  bomCatalog = structuredClone(initialBomCatalog);
  bomChangeHistory = structuredClone(initialBomChangeHistory);
  if (LOCAL_TEST && typeof window !== "undefined") {
    try {
      localStorage.removeItem("onspa-system-users");
      localStorage.removeItem("onspa-permission-records");
    } catch { /* Memory is already cleared if browser storage is unavailable. */ }
  }
}
subscribeClientReadInvalidation(reason => {
  if (reason === 'session') clearLegacySessionCaches();
});

type WorkspaceRoute = {view: MainView; child: string | null; planTab: PlanningTab; report?: string; focusSku?: string; approvalEntity?: string};
type WorkspaceIdentity = {language: Language; authenticated: boolean; session: LoginSession | null};
type WorkspaceState = {overviewRoute: WorkspaceRoute;tabs: Array<{id:string;key:string;route:WorkspaceRoute;intent:{sku?:string;approval?:string;sequence:number}|null}>;active:string|null;nextId:number};
const workspaceIdentityKey=(identity:WorkspaceIdentity)=>clientAuthorizationKey(identity);
const workspaceHome: WorkspaceRoute = {view:"sku",child:null,planTab:"base"};
const workspaceModuleTitles: Record<MainView,string> = {users:"Quản trị hệ thống",sku:"Dữ liệu cơ bản",warehouse:"Quản lý kho",bom:"Cấu trúc thành phẩm",planning:"Kế hoạch sản xuất",production:"Hệ thống báo công"};
function workspaceTitle(route:WorkspaceRoute,language:Language) {
  if(route.report) {const report=reportTypes.find((item:string[])=>item[0]===route.report);if(report)return planningReportLabel(report,language);}
  const overrides: Record<string,string> = {"department-changes":route.view==="planning"?"Phiếu thay đổi KH":route.view==="production"?"Phiếu thay đổi SX":"Phiếu thay đổi",rules:"Quy tắc áp dụng","users-list":"Quản lý người dùng",feedback:"Phản hồi người dùng",permissions:"Phân quyền",departments:"Thiết lập bộ phận",audit:"Nhật ký thao tác","test-log":"Nhật ký test website",versions:"Quản lý phiên bản","data-status":"Tình trạng dữ liệu","backup-restore":"Sao lưu & Bàn giao","production-report":"SX báo công","report-work":"SX báo công","report-review":"Lịch sản xuất thực tế","report-progress":"Tiến độ sản xuất","report-dashboard":"Nhật ký báo công","report-cancel":"Điều chỉnh báo công","report-output":"Sản lượng và giờ công","report-payroll":"Hiệu suất và tiền sản lượng"};
  const steps=route.view==='users'?[]:moduleOverviewSteps[route.view];
  const found=steps.flatMap(step=>[step,...(step.children||[])]).find(step=>step.id===route.child);
  return translateToolbar(route.child?(overrides[route.child]||found?.title||workspaceModuleTitles[route.view]):workspaceModuleTitles[route.view],language);
}
const WorkspaceLiveContext=createContext<{activeViewers:ActiveViewer[];notificationGroups:PendingApprovalGroup[];notificationCount:number;refreshViewers:()=>Promise<void>}>({activeViewers:[],notificationGroups:[],notificationCount:0,refreshViewers:async()=>{}});
export default function Home() {
  const [identity,setIdentity]=useState<WorkspaceIdentity>({language:"vi",authenticated:false,session:null});
  const [workspaces,setWorkspaces]=useState<WorkspaceState>({overviewRoute:workspaceHome,tabs:[],active:null,nextId:1});
  const identityRef=useRef(identity);
  const [homeEpoch,setHomeEpoch]=useState(0);
  const [authorizationChanged,setAuthorizationChanged]=useState(false);
  const receiveIdentity=useCallback((next:WorkspaceIdentity)=>{
    const previous=identityRef.current;
    identityRef.current=next;
    if(workspaceIdentityKey(previous)!==workspaceIdentityKey(next)) {
      clearActionFeedback();
      clearProductionSnapshot();
      clearClientReads();
      setActiveViewers([]);setNotificationGroups([]);setNotificationCount(0);
      if(previous.authenticated){
        setWorkspaces(current=>({...current,overviewRoute:workspaceHome,tabs:[],active:null}));
        setHomeEpoch(current=>current+1);
        setAuthorizationChanged(next.authenticated&&previous.session?.login===next.session?.login&&previous.session?.kind===next.session?.kind);
      }
    }
    setIdentity(current=>current.language===next.language&&current.authenticated===next.authenticated&&current.session===next.session?current:next);
    if(!next.authenticated)setWorkspaces(current=>current.tabs.length?{...current,tabs:[],active:null}:current);
  },[]);
  const [activeViewers,setActiveViewers]=useState<ActiveViewer[]>([]);
  const [notificationGroups,setNotificationGroups]=useState<PendingApprovalGroup[]>([]);
  const [notificationCount,setNotificationCount]=useState(0);
  const viewersRefresh=useRef<()=>Promise<void>>(async()=>{});
  const refreshViewers=useCallback(()=>viewersRefresh.current(),[]);
  const accountKey=workspaceIdentityKey(identity);
  useEffect(()=>{
    if(LOCAL_TEST||!accountKey)return;
    const reader=createBackgroundRefresh({
      visible:()=>!document.hidden,
      read:async()=>{const response=await fetch('/api/site-session',{cache:'no-store'});if(!response.ok)throw Error('Không kiểm tra được phiên đăng nhập.');return response.json();},
      apply:(data:any)=>{
        if(workspaceIdentityKey(identityRef.current)!==accountKey)return;
        const current=identityRef.current;
        if(!data.authenticated)receiveIdentity({...current,authenticated:false,session:null});
        else if(data.user?.login){const fresh=restoredLoginSession(data.user);if(JSON.stringify(current.session)!==JSON.stringify(fresh))receiveIdentity({...current,session:fresh});}
      },
    });
    const verify=()=>{void reader.refresh().catch(()=>{});};
    // Login/bootstrap just validated the session. Opening a menu is not a new login.
    window.addEventListener('focus',verify);document.addEventListener('visibilitychange',verify);
    const timer=window.setInterval(verify,60_000);
    return()=>{reader.dispose();window.clearInterval(timer);window.removeEventListener('focus',verify);document.removeEventListener('visibilitychange',verify);};
  },[accountKey,receiveIdentity]);
  useEffect(()=>{
    if(!accountKey||identityRef.current.session?.kind!=="account"){setNotificationGroups([]);setNotificationCount(0);return;}
    const reader=createBackgroundRefresh({
      visible:()=>!document.hidden,
      read:async()=>{const response=await fetch('/api/pending-approvals',{cache:'reload'});if(!response.ok)throw Error('Không tải được mục chờ xác nhận.');return response.json();},
      apply:(data:any)=>{
          if(workspaceIdentityKey(identityRef.current)!==accountKey)return;
          const stored = data.storedBomChangeStatuses || {};
          const sourcePending = bomChangeHistory.filter(
            (item) =>
              item.status === "Chờ xác nhận" &&
              !Object.prototype.hasOwnProperty.call(stored, item.id),
          ).length;
          const groups = (data.groups || []) as PendingApprovalGroup[];
          const bomChangeIndex = groups.findIndex(
            (item) => item.entity === "bom_change",
          );
          if (sourcePending > 0) {
            if (bomChangeIndex >= 0)
              groups[bomChangeIndex] = {
                ...groups[bomChangeIndex],
                count: groups[bomChangeIndex].count + sourcePending,
              };
            else
              groups.push({
                entity: "bom_change",
                label: "Phiếu thay đổi BOM",
                view: "bom",
                child: "bom-change",
                count: sourcePending,
              });
          }
          groups.sort((a, b) =>
            a.label.localeCompare(b.label, "vi", { sensitivity: "base" }),
          );
          setNotificationGroups(groups);
          setNotificationCount(
            groups.reduce((sum, item) => sum + Number(item.count || 0), 0),
          );
      },
    });
    const refresh=()=>{void reader.refresh().catch(()=>{});};
    const changed=()=>{void reader.refresh({invalidate:true}).catch(()=>{});};
    refresh();window.addEventListener('onspa-approvals-changed',changed);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
    const timer=window.setInterval(refresh,60_000);
    return()=>{reader.dispose();window.clearInterval(timer);window.removeEventListener('onspa-approvals-changed',changed);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
  },[accountKey]);
  useEffect(()=>{
    if(!accountKey||LOCAL_TEST||identityRef.current.session?.kind!=="account"){setActiveViewers([]);viewersRefresh.current=async()=>{};return;}
    const controller=new AbortController();
    const reader=createBackgroundRefresh({
      visible:()=>!document.hidden&&workspaceIdentityKey(identityRef.current)===accountKey&&identityRef.current.session?.kind==="account",
      read:async()=>{const response=await fetch('/api/active-viewers',{method:'POST',cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('Không tải được người đang xem.');return response.json();},
      apply:(data:any)=>{if(workspaceIdentityKey(identityRef.current)===accountKey)setActiveViewers(Array.isArray(data.viewers)?data.viewers:[]);},
    });
    const refresh=async()=>{await reader.refresh().catch(()=>{});};
    viewersRefresh.current=refresh;
    void refresh();document.addEventListener('visibilitychange',refresh);
    const timer=window.setInterval(refresh,45_000);
    return()=>{controller.abort();reader.dispose();viewersRefresh.current=async()=>{};window.clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};
  },[accountKey]);
  const navigate=useCallback((route:WorkspaceRoute)=>{
    if(!canOpenMenu(identityRef.current.session,route.view,route.child||undefined)){notifyActionFailure("Bạn không có quyền mở chức năng này. Vui lòng liên hệ quản trị viên.");return;}
    clearActionFeedback();
    setWorkspaces(current=>openWorkspace(current,route));
  },[]);
  const select=useCallback((id:string)=>{clearActionFeedback();setWorkspaces(current=>({...current,active:id}));},[]);
  const close=useCallback((id:string)=>{clearActionFeedback();setWorkspaces(current=>closeWorkspace(current,id));},[]);
  const tabBar=<WorkspaceTabs tabs={workspaces.tabs.map(tab=>({id:tab.id,title:workspaceTitle(tab.route,identity.language)}))} active={workspaces.active} onSelect={select} onClose={close} language={identity.language}/>;
  return <WorkspaceLiveContext.Provider value={{activeViewers,notificationGroups,notificationCount,refreshViewers}}>
    {authorizationChanged&&<div role="alert" className="production-inline-message error">{identity.language==='zh'?'存取權限已變更。畫面已重新整理，並將依目前權限重新讀取資料。先前權限下未儲存的編輯不會保留。':identity.language==='en'?'Access permissions changed. The view has been reset to reload data under your current permissions. Unsaved edits from the previous permission context were not retained.':'Quyền truy cập đã thay đổi. Màn hình đã được làm mới để tải dữ liệu theo quyền hiện tại. Các thay đổi chưa lưu của phiên quyền trước không được giữ lại.'} <FeedbackActionButton type="button" onClick={()=>setAuthorizationChanged(false)}>{identity.language==='zh'?'關閉':identity.language==='en'?'Close':'Đóng'}</FeedbackActionButton></div>}
    <WorkspaceInteractions/>
    <WorkspacePinnedHeader/>
    <div hidden={workspaces.active!==null} className="workspace-session" id="workspace-home">
      <WorkspaceActivityContext.Provider value={workspaces.active===null}><WorkspaceSession key={homeEpoch} initialRoute={workspaces.overviewRoute} identity={identity} onIdentity={receiveIdentity} onNavigate={navigate} active={workspaces.active===null} scopeId="workspace-home" workspaceTabs={tabBar}/></WorkspaceActivityContext.Provider>
    </div>
    {workspaces.tabs.map(tab=><div key={tab.id} id={tab.id} hidden={tab.id!==workspaces.active} className="workspace-session" role="tabpanel" aria-labelledby={`${tab.id}-tab`}>
      <WorkspaceActivityContext.Provider value={tab.id===workspaces.active}><MenuHeadingContext.Provider value={true}><WorkspaceSession initialRoute={tab.route} identity={identity} onIdentity={receiveIdentity} onNavigate={navigate} active={tab.id===workspaces.active} scopeId={tab.id} workspaceTabs={tabBar} intent={tab.intent}/></MenuHeadingContext.Provider></WorkspaceActivityContext.Provider>
    </div>)}
  </WorkspaceLiveContext.Provider>;
}
function WorkspaceSession({initialRoute,identity,onIdentity,onNavigate,active,scopeId,workspaceTabs,intent}:{initialRoute:WorkspaceRoute;identity:WorkspaceIdentity;onIdentity:(value:WorkspaceIdentity)=>void;onNavigate:(route:WorkspaceRoute)=>void;active:boolean;scopeId:string;workspaceTabs:React.ReactNode;intent?:{sku?:string;approval?:string;sequence:number}|null}) {
  useEffect(()=>{if(active){const frame=requestAnimationFrame(()=>window.dispatchEvent(new Event("resize")));return()=>cancelAnimationFrame(frame);}},[active]);
  const linkedDataRevision = useDataRefresh(['labor_hours', 'leadtime', 'leadtime_versions', 'safety_rules', 'safety_rule_groups', 'sku']);
  const language = identity.language;
  const setLanguage = (language:Language) => onIdentity({...identity,language});
  const {authenticated,session}=identity;
  const [siteSessionLoading, setSiteSessionLoading] = useState(!LOCAL_TEST && !identity.authenticated);
  useEffect(() => {
    if (LOCAL_TEST || identity.authenticated) return;
    fetch("/api/site-session", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data.authenticated && data.user?.login) {
          onIdentity({...identity,authenticated:true,session:restoredLoginSession(data.user)});
          if(data.user.authMode === "quick_line"){updateView("production");updateActiveChild("report-work");}
        } else {
          onIdentity({...identity,authenticated:false,session:null});
        }
      })
      .catch(() => onIdentity({...identity,authenticated:false,session:null}))
      .finally(() => setSiteSessionLoading(false));
  }, []);
  const [view, updateView] = useState<MainView>(initialRoute.view);
  const [activeChild, updateActiveChild] = useState<string | null>(initialRoute.child);
  const [capacityExpanded,setCapacityExpanded]=useState(initialRoute.child === "weekly-capacity" || Boolean(initialRoute.child?.startsWith("capacity-")));
  const [productionReportExpanded, setProductionReportExpanded] = useState(initialRoute.child === "production-report" || Boolean(initialRoute.child?.startsWith("report-")));
  const [planTab, updatePlanTab] = useState<PlanningTab>(initialRoute.planTab);
  useEffect(() => {
    if (!authenticated || !active || !canOpenLegacyMenu(session, "planning", "proposal") || view!=="planning" || activeChild!=="proposal") return;
    const timer=window.setTimeout(()=>prefetchProductionEngine(),800);
    return ()=>window.clearTimeout(timer);
  }, [authenticated,active,view,activeChild,session]);
  // The active SPA route owns the notice; inactive preserved tabs must not dismiss it.
  const feedbackIdentity = workspaceIdentityKey(identity);
  useLayoutEffect(()=>{
    if(active)clearActionFeedback();
  },[active,scopeId,view,activeChild,planTab,authenticated,feedbackIdentity,initialRoute.view,initialRoute.child,initialRoute.planTab,initialRoute.report]);
  const navigateWorkspace = (route:WorkspaceRoute) => {
    // Keep denied navigation on the current screen, including its explanatory notice.
    if(canOpenMenu(session,route.view,route.child||undefined))clearActionFeedback();
    onNavigate(route);
  };
  useEffect(()=>{
    if(!isWorkspaceGroup(initialRoute) || !active)return;
    updateView(initialRoute.view);
    updateActiveChild(initialRoute.view === "planning" && initialRoute.child === "report" ? "report" : null);
    updatePlanTab(initialRoute.planTab);
  },[initialRoute.view,initialRoute.child,initialRoute.planTab,active]);
  const pendingRoute = useRef<WorkspaceRoute | null>(null);
  const queueNavigation = (patch:Partial<WorkspaceRoute>) => {
    const queued = pendingRoute.current !== null;
    pendingRoute.current = {...(pendingRoute.current || {view,child:activeChild,planTab}),...patch};
    if(!queued)queueMicrotask(()=>{const route=pendingRoute.current;pendingRoute.current=null;if(route)navigateWorkspace(route);});
  };
  const setView = (next:MainView) => queueNavigation({view:next,child:null,planTab:"base"});
  const setActiveChild = (child:string|null) => queueNavigation({child});
  const setPlanTab = (planTab:PlanningTab) => queueNavigation({planTab});
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  useEffect(() => {
    try {
      setSidebarCollapsed(
        window.localStorage.getItem("onspa-sidebar-collapsed") === "1",
      );
    } catch {}
  }, []);
  const toggleSidebar = () => {
    setSidebarCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(
          "onspa-sidebar-collapsed",
          next ? "1" : "0",
        );
      } catch {}
      return next;
    });
  };
  const allowedViews = useMemo(
    () =>
      new Set<MainView>(
        (
          [
            "users",
            "sku",
            "warehouse",
            "bom",
            "planning",
            "production",
          ] as MainView[]
        ).filter((item) => canOpenMenu(session, item)),
      ),
    [session],
  );
  const isAdmin = session?.kind === "account" && session.isAdmin === true;
  useEffect(() => {
    if (!authenticated || allowedViews.has(view)) return;
    const next = (
      ["sku", "warehouse", "bom", "planning", "production"] as MainView[]
    ).find((item) => allowedViews.has(item));
    if (next) {
      updateView(next);
      updateActiveChild(null);
    }
  }, [authenticated, allowedViews, view]);
  const [selectedPlanningReport, setSelectedPlanningReport] = useState(initialRoute.report || "");
  useEffect(()=>{if(view!=="planning"||activeChild!=="report")setSelectedPlanningReport("");},[view,activeChild]);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [skuSearchMode, setSkuSearchMode] = useState<SkuSearchMode>("sku");
  const [group, setGroup] = useState("Tất cả nhóm");
  const [line, setLine] = useState("Tất cả Line");
  const [selected, setSelected] = useState<Sku | null>(null);
  const [skuDetailOpen, setSkuDetailOpen] = useState(false);
  const [skuSearchOpen, setSkuSearchOpen] = useState(false);
  const [skuStatusFilter, setSkuStatusFilter] = useState("all");
  const [customSkus, setCustomSkus] = useState<Sku[]>(()=>skuRecordSnapshot<Sku>()?.map(record=>record.payload)||[]);
  const skuDataNeeded =
    authenticated && active && activeChild !== null && view !== "users" && view !== "production" && !(view === "sku" && activeChild === "employees");
  const skuApproval = useSkuApproval<Sku>(skuDataNeeded, setCustomSkus);
  useEffect(() => {
    setSelected(current => current
      ? customSkus.find(item => normalizeSkuCode(item.code) === normalizeSkuCode(current.code)) || null
      : null);
  }, [customSkus]);
  const [skuTransferOpen,setSkuTransferOpen]=useState(false);
  const [skuChecked, setSkuChecked] = useState<string[]>([]);
  const [skuFormDirty, setSkuFormDirty] = useState(false);
  const [skuDiscardPending, setSkuDiscardPending] = useState(false);
  const [skuDraftCode, setSkuDraftCode] = useState("");
  const [listResetRevision, setListResetRevision] = useState(0);
  const approvalCodes = skuChecked.length
    ? skuChecked
    : selected?.status === "Chờ xác nhận"
      ? [selected.code]
      : [];
  const finishReturnToSkuList = () => {
    // Closing a record preserves the applied queue/search and its table position.
    setAddingSku(false);
    setEditingSku(null);
    setSelected(null);
    setSkuChecked([]);
    setSkuDetailOpen(false);
    setSkuHistoryOpen(false);
    setSkuCreateError("");
    setSkuFormDirty(false);
    setSkuDiscardPending(false);
    setSkuDraftCode("");
  };
  const returnToSkuList = (discardSavedForm = false) => {
    if (addingSku && skuFormDirty && !discardSavedForm) {
      setSkuDiscardPending(true);
      return false;
    }
    finishReturnToSkuList();
    return true;
  };
  const loadSelectedSkuHistory = async (code: string) => {
    const response = await recordFetch(
      `/api/records?entity=sku_history&sku=${encodeURIComponent(normalizeSkuCode(code))}`,
    );
    if (response.ok)
      setSkuHistory(
        (await response.json()).records.map(
          (r: { payload: SkuHistoryVersion }) => r.payload,
        ),
      );
  };
  const confirmSelectedSkus = async () => {
    const result = await skuApproval.confirm(approvalCodes);
    if (result.length) {
      const selectedCode = selected?.code;
      returnToSkuList();
      await skuApproval.refresh().catch(() => {});
      if (selectedCode)
        await loadSelectedSkuHistory(selectedCode).catch(() => {});
    }
  };

  const [addingSku, setAddingSku] = useState(false);
  const [skuListImportOpen,setSkuListImportOpen]=useState(false);
  const [editingSku, setEditingSku] = useState<Sku | null>(null);
  const [skuHistory, setSkuHistory] = useState<SkuHistoryVersion[]>([]);
  const [skuHistoryOpen, setSkuHistoryOpen] = useState(false);
  const [skuReturnAvailable, setSkuReturnAvailable] = useState(false);
  const [skuCreateError, setSkuCreateError] = useState("");
  const [skuCreateGroup, setSkuCreateGroup] = useState("");
  const [skuSourceOverride, setSkuSourceOverride] = useState<string | null>(null);
  const [skuCreateLine, setSkuCreateLine] = useState("");
  const [skuCreateProcesses, setSkuCreateProcesses] = useState<string[]>([]);
  const [processExpanded, setProcessExpanded] = useState(false);
  const [warehouseSku, setWarehouseSku] = useState(initialRoute.focusSku || "");

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const changeLogin=session?.kind==="account"?session.login:"";
  const departmentRequests=useChangeRequests(changeLogin,active,session?.kind==="account"&&session.isAdmin);
  const changePending=departmentRequests.rows.filter(r=>r.kind==='staff-recall'?Boolean(r.canApproveRecall):session?.kind==="account"&&session.isAdmin?(r.pendingDepartments?.length||0)>0:canReplyDepartments(r,changeLogin).length>0).filter(r=>!(r.unreadReplyCount||0));
  const personnelPending=changePending.filter(r=>r.kind==='staff-recall');
  const incidentPending=changePending.filter(r=>r.kind==='production-incident');
  const ordinaryChangePending=changePending.filter(r=>!['staff-recall','production-incident'].includes(r.kind||''));
  const changeReplies=departmentRequests.rows.filter(r=>(r.unreadReplyCount||0)>0);
  const changeNotificationCount=new Set([...changePending,...changeReplies].map(r=>r.id)).size;
  const [changeFocus,setChangeFocus]=useState<string|null>(null);
  useEffect(()=>{if(intent?.approval?.startsWith("change:"))setChangeFocus(intent.approval.slice(7));},[intent?.sequence,intent?.approval]);
  const [viewersOpen, setViewersOpen] = useState(false);
  const {activeViewers,notificationCount,notificationGroups,refreshViewers}=useContext(WorkspaceLiveContext);
  const bomLoaded = useRef(false);
  const skuHistoryWasOpen = useRef(false);
  useEffect(() => {
    if (skuHistoryWasOpen.current && !skuHistoryOpen) {
      setSelected(null);
      setSkuChecked([]);
    }
    skuHistoryWasOpen.current = skuHistoryOpen;
  }, [skuHistoryOpen]);
  useEffect(() => {
    if (view !== "sku" || activeChild !== "sku-master") {
      setSelected(null);
      setSkuDetailOpen(false);
      setSkuHistoryOpen(false);
      setSkuSearchOpen(false);
      setProcessExpanded(false);
    }
  }, [view, activeChild]);
  const skuRecords = useMemo(
    () =>
      Array.from(
        new Map(
          customSkus.map((sku) => [normalizeSkuCode(sku.code), sku]),
        ).values(),
      ).filter((sku) => !(sku as Sku & { _deleted?: boolean })._deleted),
    [customSkus],
  );
  const appliedIntent = useRef<number | null>(null);
  useEffect(()=>{
    if(!intent || appliedIntent.current===intent.sequence)return;
    if(intent.approval) {
      if(intent.approval==='sku') {
        skuHistoryWasOpen.current=false;
        setAddingSku(false);setEditingSku(null);setSkuDetailOpen(false);setSkuHistoryOpen(false);
        setGroup('Tất cả nhóm');setLine('Tất cả Line');setSkuStatusFilter('Chờ xác nhận');
        setSkuSearchMode('status');setQueryInput('Chờ xác nhận');setQuery('');setSkuSearchOpen(true);setSkuChecked([]);setSelected(null);
      }
      appliedIntent.current=intent.sequence;return;
    }
    if(!intent.sku)return;
    if(view==='sku'&&activeChild==='sku-master') {
      const found=skuRecords.find(s=>s.code===intent.sku);
      if(!found)return;
      setSelected(found);setSkuDetailOpen(true);
    } else if(view==='warehouse')setWarehouseSku(intent.sku);
    appliedIntent.current=intent.sequence;
  },[intent,view,activeChild,skuRecords]);
  const [skuProductionSnapshot, setSkuProductionSnapshot] =
    useState<LeadtimeDataSnapshot>({
      leadRows: leadtimeRows,
      versions: [],
      rules: [],
    });
  const [skuLaborHours, setSkuLaborHours] = useState<Map<string, number>>(
    new Map(),
  );
  useEffect(() => {
    if (!authenticated || !active || view !== "sku" || activeChild !== "sku-master")
      return;
    Promise.all([
      loadLeadtimeDataSnapshot(),
      recordFetch("/api/records?entity=labor_hours", { cache: "no-store" }).then(
        (response) => (response.ok ? response.json() : Promise.reject()),
      ),
    ])
      .then(([snapshot, laborData]) => {
        setSkuProductionSnapshot(snapshot);
        safetyRuleSets = snapshot.rules;
        setSkuLaborHours(
          new Map(
            laborData.records.map(
              (record: { key: string; payload: { laborHour: number } }) => [
                normalizeSkuCode(record.key),
                Number(record.payload.laborHour || 0),
              ],
            ),
          ),
        );
      })
      .catch(() => {
        setSkuProductionSnapshot({
          leadRows: leadtimeRows,
          versions: [],
          rules: [],
        });
        setSkuLaborHours(new Map());
      });
  }, [authenticated, active, view, activeChild, linkedDataRevision]);
  const selectedProductionSetting = useMemo(
    () =>
      selected
        ? currentLeadtimeSettingForSku(
            skuProductionSnapshot,
            selected.code,
            new Date().toISOString(),
          )
        : null,
    [selected, skuProductionSnapshot],
  );
  useEffect(() => {
    if (!authenticated || !active || view !== "sku" || activeChild === "employees" || !canOpenLegacyMenu(session, "sku", "sku-master")) return;
    const timer = window.setTimeout(() => {
      void preloadLaborHours().catch(() => {});
    }, 150);
    return () => window.clearTimeout(timer);
  }, [authenticated, active, view, activeChild]);
  const skuCancellation = useMasterCancellation(()=>{setSkuChecked([]);setSelected(null);setSkuCreateError("");});
  const skuGroups = useMemo(
    () => Array.from(new Set(skuRecords.map((sku) => sku.group))).sort(),
    [skuRecords],
  );
  const filtered = useMemo(
    () =>
      skuRecords
        .filter((sku) => {
          const target =
            skuSearchMode === "sku"
              ? sku.code
              : skuSearchMode === "name"
                ? sku.name
                : skuSearchMode === "specification"
                  ? sku.specification
                  : skuSearchMode === "group"
                    ? sku.group
                    : skuSearchMode === "status"
                      ? ""
                      : sku.line;
          const keyword = normalizeSearchText(query);
          const normalizedTarget = normalizeSearchText(target);
          const matched =
            skuSearchMode === "sku"
              ? normalizedTarget.includes(keyword)
              : normalizedTarget.includes(keyword);
          const matchedGroup = group === "Tất cả nhóm" || sku.group === group;
          const matchedLine = line === "Tất cả Line" || sku.line === line;
          return (
            (["status","createDate"].includes(skuSearchMode) || matched) &&
            matchedGroup &&
            matchedLine &&
            skuMatchesStatus(sku, skuStatusFilter)
          );
        })
        .sort(skuSearchMode === "createDate" ? (a,b)=>newestMasterFirst(a,b)||compareGroupThenSku(a,b) : compareGroupThenSku),
    [skuRecords, query, skuSearchMode, group, line, skuStatusFilter],
  );
  const selectedProcesses = selected?.processes?.length
    ? selected.processes
    : ["A-CUT", "A-ASSY", "A-CRIMP", "A-PACKING", "A-FINAL"];
  const selectedSkuHistory = selected
    ? skuHistory
        .filter((item) => item.sku === normalizeSkuCode(selected.code))
        .sort((a, b) => b.version - a.version)
    : [];
  const processLabel = (code: string) =>
    (
      ({
        "C-MAI": "Mài",
        "C-PREP": "Chuẩn bị",
        "C-TIEN": "Tiện",
        "C-RUA": "Rửa",
        "C-GIACONG": "Gia công",
        "C-KHOAN": "Khoan",
        "C-PVC": "Đùn PVC",
        "C-CHI": "Bện chỉ",
        "C-INOX": "Bện inox",
        "C-DANHBONG": "Đánh bóng",
        "C-FINAL": "Hoàn thiện",
        "A-CUT": "Cắt",
        "A-ASSY": "Lắp ráp",
        "A-CRIMP": "Bấm đầu",
        "A-PACKING": "Đóng gói",
        "A-FINAL": "Hoàn thiện",
        "B-ASSY": "Lắp ráp",
        "B-PACKING": "Đóng gói",
        "B-FINAL": "Hoàn thiện",
      }) as Record<string, string>
    )[code] || code;
  const skuCreateGroupKey = normalizeSearchText(skuCreateGroup);
  const skuCreateSource = skuSourceOverride ?? (!skuCreateGroup.trim()
    ? ""
    : skuCreateGroupKey.includes("mua hang")
      ? "Mua ngoài"
      : skuCreateGroupKey.includes("gia cong ngoai")
        ? "Gia công"
        : "Tự chế");
  const skuCreateExternal = skuCreateSource !== "Tự chế";
  const skuCreateProcessOptions: Record<string, string[]> = {
    A: ["A-CUT", "A-ASSY", "A-CRIMP", "A-PACKING", "A-FINAL"],
    B: ["B-PHAO", "B-HCT", "B-ASSY", "B-PACKING", "B-FINAL"],
    C: [
      "C-MAI",
      "C-PREP",
      "C-TIEN",
      "C-RUA",
      "C-GIACONG",
      "C-KHOAN",
      "C-PVC",
      "C-CHI",
      "C-INOX",
      "C-DANHBONG",
      "C-FINAL",
    ],
  };

  useEffect(() => {
    if(!active)return;
    const root=document.getElementById(scopeId);if(!root)return;
    let frame=0;
    const options={subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder']};
    const observer=new MutationObserver(()=>{if(!frame)frame=requestAnimationFrame(translate);});
    function translate(){
      frame=0;observer.disconnect();
      applyLanguage(language,root!);
      if(language!=='vi')observer.observe(root!,options);
    }
    translate();
    window.dispatchEvent(new Event("onspa-language"));
    return()=>{observer.disconnect();cancelAnimationFrame(frame);};
  }, [language, authenticated,active,scopeId]);

  useEffect(() => {
    if (!authenticated || !active || view !== "bom" || !activeChild || bomLoaded.current)
      return;
    bomLoaded.current = true;
    recordFetch("/api/records?entity=bom")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => {
        const saved = new Map<string, BomCatalogRecord>(
          data.records
            .map((record: { key: string; payload: BomCatalogRecord }) => [
              record.key,
              normalizeBomIdentityDates(record.payload),
            ])
            .filter(
              ([key]: [string, BomCatalogRecord]) =>
                !purchasedSkuCodes.has(key.toUpperCase()),
            ),
        );
        bomCatalog = bomCatalog.map(
          (record) => saved.get(record.sku) || record,
        );
        for (const [key, value] of saved)
          if (!bomCatalog.some((record) => record.sku === key))
            bomCatalog.push(value);
        setCustomSkus((current) => [...current]);
      })
      .catch(() => {
        bomLoaded.current = false;
      });
  }, [authenticated, active, view, activeChild]);

  const saveNewSku = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const code = String(data.get("code") || "")
      .trim()
      .toUpperCase();
    const name = String(data.get("name") || "").trim();
    if (
      !editingSku &&
      skuRecords.some((item) => item.code.toUpperCase() === code)
    ) {
      setSkuCreateError("Mã SKU đã tồn tại trong SKU Master.");
      return;
    }
    const sourceLabel = String(data.get("mode") || "Tự chế");
    const mode =
      sourceLabel === "Mua ngoài"
        ? "Mua hàng"
        : sourceLabel === "Gia công"
          ? "Gia công"
          : "Tự sản xuất";
    const newGroup = String(data.get("group") || "").trim();
    const hasProcess = sourceLabel === "Tự chế";
    const rawProcesses = data.getAll("processes").map(String).join("/");
    const masterFields = {
      code,
      name,
      specification: String(data.get("specification") || "").trim() || "—",
      group: newGroup,
      line: hasProcess ? `Line ${String(data.get("line") || "")}` : "—",
      unit: String(data.get("unit") || "—"),
      mode,
      processes: hasProcess
        ? rawProcesses
            .split(/[,/]/)
            .map((value) => value.trim().toUpperCase())
            .filter(Boolean)
        : [],
    };
    const next: Sku = editingSku
      ? { ...editingSku, ...masterFields }
      : {
          ...masterFields,
          moq: 0,
          safetyDays: 0,
          leadTime: "Chưa thiết lập",
          standardHours: "Chưa thiết lập",
          status: "Đang sử dụng",
        };
    if (editingSku) {
      const comparable = (sku: Sku) => ({
        name: sku.name.trim(),
        specification: sku.specification || "—",
        group: sku.group.trim(),
        line: sku.line || "—",
        unit: sku.unit || "—",
        mode: sku.mode,
        processes: [...(sku.processes || [])].sort(),
      });
      if (
        JSON.stringify(comparable(editingSku)) ===
        JSON.stringify(comparable(next))
      ) {
        setSkuCreateError("Chưa có nội dung nào thay đổi.");
        return;
      }
    }
    const response = await fetch("/api/sku-request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        key: next.code,
        payload: next,
        operation: editingSku ? "update" : "create",
        expectedRevision: editingSku ? Number(editingSku.revision || 0) : 0,
        currentData:
          editingSku && editingSku.status !== "Chờ xác nhận"
            ? editingSku
            : null,
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      setSkuCreateError(result.error || "Không thể lưu yêu cầu SKU");
      return;
    }
    Object.assign(next, result.payload);
    setCustomSkus((current) => [
      ...current.filter((item) => item.code !== code),
      next,
    ]);
    returnToSkuList(true);
    await skuApproval
      .refresh()
      .catch(() =>
        setSkuCreateError(
          "Đã lưu nhưng chưa tải lại được danh sách. Hãy tải lại trang.",
        ),
      );
  };

  if (!authenticated)
    return (
      <LoginGate
        onLogin={(nextSession) => {
          onIdentity({...identity,session:nextSession,authenticated:true});
          if (nextSession.kind === "line") {
            updateView("production");
            updateActiveChild("report-work");
          } else if (!nextSession.isAdmin) {
            const next = (
              [
                "sku",
                "warehouse",
                "bom",
                "planning",
                "production",
              ] as MainView[]
            ).find((item) => canOpenMenu(nextSession, item));
            if (next) {
              updateView(next);
              updateActiveChild(null);
            }
          }
        }}
        language={language}
        onLanguage={setLanguage}
      />
    );

  const sessionLine = session?.kind === "line" ? session.line : undefined;
  return (
    <div
      className={`app-shell${sessionLine ? " line-session" : ""}${sidebarCollapsed ? " sidebar-collapsed" : ""}`}
    >
      <ApprovalNavigationContext.Provider value={intent?.approval?{entity:intent.approval,sequence:intent.sequence}:null}><ExportPermissionContext.Provider value={hasExactExportGrant(session,childGrantLabels[`${view}:${activeChild}`])}><ToolbarPermissions.Provider value={(name,label)=>{
        if(isDataExportAction(label))return hasExactExportGrant(session,childGrantLabels[`${view}:${activeChild}`]);
        if(name === "FeedbackInbox")return true;
        if(name === "DepartmentChangeRequests" || name === "DepartmentChangeEditor")return session?.kind === "account" && (session.isAdmin || !!requestDepartment(session.login));
        // These toolbars gate mutations with server-returned capabilities and state.
        // Do not reinterpret translated labels as a second, incompatible grant check.
        if(name === "WeeklyCapacity")return true;
        if(name === "ProductionProgressReview" && /^(Ẩn|Hiện) đã xác nhận báo công$/.test(label.trim()))return true;
        if(session?.kind==='account' && session.isAdmin)return true;
        if(name==='ProductionManagement' && label.trim()==='Lưu' && session?.kind==='account' && session.grants.some(grant=>normalizedGrant(grant.split('/').slice(0,-1).join('/'))===normalizedGrant('Quản lý sản xuất / Báo công sản xuất') && normalizedGrant(grant.split('/').at(-1)||'')===normalizedGrant('Lưu')))return true;
        if(/cập nhật dữ liệu|tải lại dữ liệu|làm mới/i.test(label))return true;
        let action=/hủy xác nhận/i.test(label)?'Hủy xác nhận':/mở chốt/i.test(label)?'Hủy xác nhận':/xác nhận|chốt/i.test(label)?'Xác nhận':/xóa/i.test(label)&&!/xóa lọc/i.test(label)?'Xóa':/thêm|tạo thay đổi|tải file|tải tệp|nhập file|nhập dữ liệu|chạy engine/i.test(label)?'Thêm':/sửa|lưu|đồng bộ|cập nhật|hủy phiếu|hủy lệnh|đánh dấu|áp dụng/i.test(label)?'Sửa':null;
        if(name==='DemandImageImport' && /lưu/i.test(label))action='Thêm';
        const bomMenu = ['BomLookupView','BomLookupCreate'].includes(name) ? 'Dữ liệu lượng dùng BOM' : name==='BomChangeContent' ? 'Phiếu thay đổi BOM' : null;
        if(bomMenu && ((name==='BomLookupCreate' && /lưu/i.test(label)) || /sửa hàng loạt/i.test(label))) action='Thêm';
        if(bomMenu && label.trim()==='Hủy') action='Sửa';
        const basicCancelTargets:Record<string,string>={Home:'sku',LeadtimeMasterView:'leadtime',SafetyRulesView:'safety_rule_groups',LaborHoursMaster:'labor_hours',EmployeeDirectory:'employees'};
        if(label.trim()==='Hủy' && basicCancelTargets[name])return session?.kind==='account' && canCancelMaster({login:session.login,isAdmin:session.isAdmin,grants:session.grants},basicCancelTargets[name]);
        if(name==='ProductionPlan' && ['Xác nhận','Hủy xác nhận','Sửa'].includes(action||''))return session?.kind==='account' && canPlanAction({login:session.login,isAdmin:session.isAdmin,grants:session.grants},action==='Xác nhận'?'close':action==='Hủy xác nhận'?'reopen':'save');
        if(!action)return true;
        if(session?.kind==='line')return name==='ProductionManagement' && ['Thêm','Sửa'].includes(action);
        if(!session || session.kind!=='account')return false;
        if(bomMenu) return canBomAction({login:'current',grants:session.grants}, action==='Xác nhận'?'confirm':action==='Hủy xác nhận'?'undo':'save',action==='Sửa',bomMenu);
        const targets:Record<string,string>={Home:'SKU Master',LeadtimeMasterView:'Leadtime',LaborHoursMaster:'Giờ công',SafetyRulesView:'Dữ liệu cơ bản / Quy tắc Safety Days',BomLookupView:'Dữ liệu lượng dùng BOM',BomChangeContent:'Phiếu thay đổi BOM',ProductionPlan:'Production_plan',InTransit:'In_transit',WarehouseContent:childGrantLabels[`${view}:${activeChild}`],ProductionManagement:'Quản lý sản xuất / Báo công sản xuất',ActualWorkSchedule:'Quản lý sản xuất / Lịch SX thực tế',ProductionProgressReview:'Quản lý sản xuất / Tiến độ sản xuất',DemandEventViewV3:'Demand_event',DemandImageImport:'Demand_event',PlanningView:'Base_forecast'};
        const target=targets[name]||childGrantLabels[`${view}:${activeChild}`];
        const menu=target?.includes('/')?target:Object.values(childGrantLabels).find(value=>normalizedGrant(value.split('/').at(-1)||'')===normalizedGrant(target||''));
        return hasMenuPermission(session,menu,[action]);
      }}><BusinessSkuContext.Provider value={skuRecords.filter(usableSku)}><BomSourceSkuContext.Provider value={skuRecords}>
        <AutoTablePagination
          scopeId={scopeId}
          reportKey={`${view}:${activeChild}:${planTab}:${selectedPlanningReport}`}
          exportEnabled={!["report-review","report-work","production-report"].includes(activeChild||"")&&!isWorkspaceGroup({view,child:activeChild,report:selectedPlanningReport})}
          resetKey={`${view}-${activeChild}-${planTab}-${query}-${group}-${line}-${skuRecords.length}-${listResetRevision}`}
        />
        <header className="topbar">
          <div className="brand">
            <img
              src="data:image/jpeg;base64,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"
              alt="ONSPA — Work with Passion"
            />
          </div>
          <nav>
            <p>PHÂN HỆ</p>
            <FeedbackActionButton
              className={view === "users" ? "nav-active" : ""}
              onClick={() => setView("users")}
            >
              👤 Quản trị hệ thống <i>›</i>
            </FeedbackActionButton>
            {view === "users" && (
              <div className="nav-children">
                <FeedbackActionButton className="child-active" disabled disabledExplanation="Bạn đang ở mục này.">Đăng nhập & phân quyền</FeedbackActionButton>
                <FeedbackActionButton disabled disabledExplanation="Chức năng này chưa được kết nối thao tác tại màn hình hiện tại.">Danh sách người dùng</FeedbackActionButton>
                <FeedbackActionButton disabled disabledExplanation="Chức năng này chưa được kết nối thao tác tại màn hình hiện tại.">Nhật ký thao tác</FeedbackActionButton>
              </div>
            )}
            <FeedbackActionButton
              className={view === "sku" ? "nav-active" : ""}
              onClick={() => setView("sku")}
            >
              ▦ Dữ liệu cơ bản <i>{view === "sku" ? "⌄" : "›"}</i>
            </FeedbackActionButton>
            {view === "sku" && (
              <div className="nav-children">
                <FeedbackActionButton className="child-active" disabled disabledExplanation="Bạn đang ở mục này.">SKU Master</FeedbackActionButton>
              </div>
            )}
            <FeedbackActionButton disabled disabledExplanation="Chức năng này chưa được kết nối thao tác tại màn hình hiện tại.">
              ▣ Quản lý kho <i>›</i>
            </FeedbackActionButton>
            <FeedbackActionButton
              className={view === "bom" ? "nav-active" : ""}
              onClick={() => setView("bom")}
            >
              ⌘ Cấu trúc thành phẩm <i>{view === "bom" ? "⌄" : "›"}</i>
            </FeedbackActionButton>
            {view === "bom" && (
              <div className="nav-children">
                <FeedbackActionButton className="child-active" disabled disabledExplanation="Bạn đang ở mục này.">BOM Thành phẩm</FeedbackActionButton>
                <FeedbackActionButton disabled disabledExplanation="Chức năng này chưa được kết nối thao tác tại màn hình hiện tại.">BOM BTP</FeedbackActionButton>
              </div>
            )}
            <FeedbackActionButton
              className={view === "planning" ? "nav-active" : ""}
              onClick={() => setView("planning")}
            >
              ◫ Kế hoạch sản xuất <i>{view === "planning" ? "⌄" : "›"}</i>
            </FeedbackActionButton>
            {view === "planning" && (
              <div className="nav-children planning-children">
                <FeedbackActionButton
                  className={planTab === "base" ? "child-active" : ""}
                  onClick={() => setPlanTab("base")}
                >
                  Base Forecast
                </FeedbackActionButton>
                <FeedbackActionButton
                  className={planTab === "demand" ? "child-active" : ""}
                  onClick={() => setPlanTab("demand")}
                >
                  Demand Event
                </FeedbackActionButton>
                <FeedbackActionButton
                  className={planTab === "proposal" ? "child-active" : ""}
                  onClick={() => setPlanTab("proposal")}
                >
                  Đề xuất sản xuất tuần · 05
                </FeedbackActionButton>
                <FeedbackActionButton
                  className={planTab === "plan" ? "child-active" : ""}
                  onClick={() => setPlanTab("plan")}
                >
                  Kế hoạch tuần · 06
                </FeedbackActionButton>
                <FeedbackActionButton
                  className={planTab === "tracking" ? "child-active" : ""}
                  onClick={() => setPlanTab("tracking")}
                >
                  Theo dõi lệnh · 04
                </FeedbackActionButton>
              </div>
            )}
            <FeedbackActionButton disabled disabledExplanation="Chức năng này chưa được kết nối thao tác tại màn hình hiện tại.">
              ⚙ Hệ thống báo công <i>›</i>
            </FeedbackActionButton>
          </nav>
          <TopModules
            view={view}
            sessionLine={sessionLine}
            allowedViews={allowedViews}
            onParent={(v) => {
              setView(v);
              setActiveChild(null);
            }}
          />
          <AppSidebar
            scopeId={scopeId}
            language={language}
            capacityExpanded={capacityExpanded}
            onToggleCapacity={()=>{clearActionFeedback();setCapacityExpanded(current=>!current);}}
            productionReportExpanded={productionReportExpanded}
            onToggleProductionReport={()=>{clearActionFeedback();setProductionReportExpanded(current=>!current);}}
            reportMenu={<PlanningReportMenu language={language} selected={selectedPlanningReport} onSelect={report=>navigateWorkspace({view:"planning",child:"report",planTab:"report",report})} />}
            view={view}
            child={activeChild}
            collapsed={sidebarCollapsed}
            onToggleCollapsed={toggleSidebar}
            sessionLine={sessionLine}
            allowedViews={allowedViews}
            isAdmin={isAdmin}
            canOpen={(nextView, nextChild) =>
              canOpenMenu(session, nextView, nextChild)
            }
            onParent={(v) => {
              if (!allowedViews.has(v)) { notifyActionFailure("Bạn không có quyền mở phân hệ này."); return; }
              setView(v);
              setActiveChild(null);
            }}
            onChild={async (v, c, tab) => {
              if (!canOpenMenu(session, v, c)) { notifyActionFailure("Bạn không có quyền mở chức năng này. Vui lòng liên hệ quản trị viên."); return; }
              const navigationSession=clientSessionGeneration();
              try {
              if (v === "users" && c === "users-list" && !cachedSystemUsers())
                await loadSystemUsers();
              if (v === "users" && c === "departments") await loadDepartments();
              if (
                v === "users" &&
                c === "permissions" &&
                !cachedPermissionRecords()
              )
                await loadPermissionRecords();
              } catch(error) { if(isClientSessionReadCancelled(error))return;throw error; }
              if(navigationSession!==clientSessionGeneration())return;
              setView(v);
              setActiveChild(c);
              if (tab) setPlanTab(tab);
            }}
          />
          <div className="session-user">
            <LanguageSwitch language={language} onChange={setLanguage} />
            {authenticated && (
                <FeedbackActionButton
                  className="notification-button"
                  type="button"
                  aria-label={language === "en" ? `${notificationCount+changeNotificationCount} pending notifications` : language === "zh" ? `${notificationCount+changeNotificationCount} 則待處理通知` : `${notificationCount+changeNotificationCount} thông báo chờ xử lý`}
                  title={translateToolbar("Thông báo chờ xử lý", language)}
                  onClick={() => {
                    setViewersOpen(false);
                    setNotificationsOpen((open) => !open);
                    void departmentRequests.refresh();
                  }}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M18 8a6 6 0 00-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
                  </svg>
                  <strong>{notificationCount+changeNotificationCount}</strong>
                </FeedbackActionButton>
            )}
                {!sessionLine&&<FeedbackActionButton
                  className="notification-view-button"
                  type="button"
                  aria-label={translateToolbar("Xem người đang truy cập", language)}
                  title={translateToolbar("Người đang xem", language)}
                  onClick={() => {
                    setNotificationsOpen(false);
                    setViewersOpen((open) => !open);
                    void refreshViewers();
                  }}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 12s3.5-5 9-5 9 5 9 5-3.5 5-9 5-9-5-9-5z" />
                    <circle cx="12" cy="12" r="2.5" />
                  </svg>
                </FeedbackActionButton>}
            {isAdmin && (
              <FeedbackActionButton
                className="admin-account-button"
                type="button"
                onClick={() => {
                  setView("users");
                  setActiveChild("users-list");
                  setNotificationsOpen(false);
                }}
              >
                Admin
              </FeedbackActionButton>
            )}
            <span>
              <b data-business-value="true">{session?.name || "Nhân viên mẫu 104"}</b>
              <small>{session?.detail || "KHSX · sample_user_15"}</small>
            </span>
              <FeedbackActionButton
              className="logout-button"
              type="button"
              onClick={async () => {
                const feedbackScope = actionFeedbackScope();
                try {
                  const response = await fetch(
                    LOCAL_TEST ? "/api/test-session" : "/api/auth/logout",
                    {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ logout: true }),
                    },
                  );
                  if (!response.ok) throw new Error();
                  onIdentity({...identity,authenticated:false,session:null});
                  window.location.reload();
                } catch {
                  if(feedbackScope === actionFeedbackScope())notifyActionFailure("Chưa đăng xuất được. Vui lòng thử lại.");
                }
              }}
              title="Đăng xuất"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M10 4H5v16h5M14 8l4 4-4 4M8 12h10" />
              </svg>
              <UiLabel>Thoát</UiLabel>
            </FeedbackActionButton>
            {notificationsOpen && (
              <div className="notification-popover">
                <b>Chứng từ chờ xác nhận</b>
                <span className="notification-summary">
                  {notificationCount+changeNotificationCount
                    ? `${notificationCount+changeNotificationCount} hồ sơ cần xử lý`
                    : "Không có thông báo mới."}
                </span>
                {ordinaryChangePending.length>0&&<><b>Phiếu thay đổi ({ordinaryChangePending.length})</b>{ordinaryChangePending.map(item=><FeedbackActionButton key={item.id} className="notification-item" onClick={()=>{navigateWorkspace({view:item.department==="KHSX"?"planning":"production",child:"department-changes",planTab:"base",approvalEntity:"change:"+item.id});setNotificationsOpen(false);}}><span>{item.code} · {item.kind==='staff-recall'?'Yêu cầu thu hồi nhân sự':`Thông báo từ ${item.department}`}<small>{item.messages[0]?.text.slice(0,100)}</small></span><strong>›</strong></FeedbackActionButton>)}</>}
                {incidentPending.length>0&&<><b>Phiếu báo sự cố ({incidentPending.length})</b>{incidentPending.map(item=><FeedbackActionButton key={item.id} className="notification-item" onClick={()=>{navigateWorkspace({view:"production",child:"department-changes",planTab:"base",approvalEntity:"change:"+item.id});setNotificationsOpen(false);}}><span>{item.code} · {item.incident?.status==='awaiting_qlsx'?'Chờ QLSX xác nhận':'Chờ KHSX phản hồi'}<small>{item.messages[0]?.text.slice(0,100)}</small></span><strong>›</strong></FeedbackActionButton>)}</>}
                {personnelPending.length>0&&<><b>Thu hồi nhân sự ({personnelPending.length})</b>{personnelPending.map(item=><FeedbackActionButton key={item.id} className="notification-item" onClick={()=>{navigateWorkspace({view:"production",child:"department-changes",planTab:"base",approvalEntity:"change:"+item.id});setNotificationsOpen(false);}}><span>{item.code} · Chờ đồng ý<small>{item.messages[0]?.text.slice(0,100)}</small></span><strong>›</strong></FeedbackActionButton>)}</>}
                {changeReplies.length>0&&<><b>Thông báo phản hồi ({changeReplies.length})</b>{changeReplies.map(item=><FeedbackActionButton key={'reply:'+item.id} className="notification-item" onClick={()=>{navigateWorkspace({view:item.department==="KHSX"?"planning":"production",child:"department-changes",planTab:"base",approvalEntity:"change:"+item.id});setNotificationsOpen(false);}}><span>{item.code}</span><strong>›</strong></FeedbackActionButton>)}</>}
                {notificationGroups.map((item) => (
                  <FeedbackActionButton
                    key={item.entity}
                    className="notification-item"
                    onClick={() => {
                      navigateWorkspace({view:item.view,child:item.child,planTab:'base',approvalEntity:item.entity});
                      setNotificationsOpen(false);
                    }}
                  >
                    <span>{item.label}</span>
                    <strong>{item.count}</strong>
                  </FeedbackActionButton>
                ))}
              </div>
            )}
            {viewersOpen && (
              <div className="viewer-popover">
                <b>Người đang xem</b>
                <span className="viewer-summary">
                  {activeViewers.length
                    ? `${activeViewers.length} người đang truy cập hệ thống`
                    : "Chưa ghi nhận người đang truy cập."}
                </span>
                {activeViewers.map((viewer) => (
                  <div className="viewer-item" key={viewer.login}>
                    <span className="viewer-avatar">
                      {(viewer.name || viewer.login)
                        .trim()
                        .charAt(0)
                        .toUpperCase()}
                    </span>
                    <span>
                      <b>{viewer.name || viewer.login}</b>
                      <small>
                        {[viewer.department, viewer.login]
                          .filter(Boolean)
                          .join(" · ")}
                      </small>
                    </span>
                    <i aria-label="Đang hoạt động" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </header>
        <FeedbackLauncher language={language} context={workspaceTitle({view,child:activeChild,planTab,report:selectedPlanningReport},language)} />
        {workspaceTabs}
        {skuDataNeeded&&<SkuDataStatus state={skuApproval} language={language}/>}
        {activeChild==="department-changes"&&(requestDepartment(changeLogin)||(session?.kind==="account"&&session.isAdmin)) ? <DepartmentChangeRequests originScope={view==="planning"?"KHSX":view==="production"?"QLSX":null} isAdmin={session?.kind==="account"&&session.isAdmin} rows={departmentRequests.rows} error={departmentRequests.error} refresh={departmentRequests.refresh} login={changeLogin} focusId={changeFocus} onFocusConsumed={()=>setChangeFocus(null)} /> : (!activeChild || view==="production" && isWorkspaceGroup({view,child:activeChild})) ? (
          view === "users" ? (
            <main
              className="workspace empty-workspace"
              aria-label="Chọn một menu con để hiển thị nội dung"
            />
          ) : (
            <ModuleOverview
              view={view}
              sessionLine={sessionLine}
              canOpen={(nextView, nextChild) =>
                canOpenMenu(session, nextView, nextChild)
              }
              onOpen={(id, tab) => {
                if (!canOpenMenu(session, view, id)) { notifyActionFailure("Bạn không có quyền mở chức năng này. Vui lòng liên hệ quản trị viên."); return; }
                if(view === "production" && id === "production-report") {clearActionFeedback();setProductionReportExpanded(true);return;}
                if(view === "production" && id === "weekly-capacity") {clearActionFeedback();setCapacityExpanded(true);return;}
                setActiveChild(id);
                if (tab) setPlanTab(tab);
              }}
            />
          )
        ) : view === "users" ? (
          isAdmin ? (
            <UserContent section={activeChild} />
          ) : (
            <main className="workspace">
              <section className="data-card">
                <PageTitle>Không có quyền truy cập</PageTitle>
                <p>Tài khoản không có quyền quản trị.</p>
              </section>
            </main>
          )
        ) : view === "warehouse" ? (
          <WarehouseContent
            section={activeChild}
            initialSku={warehouseSku}
            initialSkuRequest={intent?.sequence}
            operator={session?.name || "sample_user_15"}
            onOpenSku={(code) => {
              if(canOpenMenu(session,"sku","sku-master"))navigateWorkspace({view:"sku",child:"sku-master",planTab:"base",focusSku:code});
            }}
          />
        ) : view === "production" ? (
          <ProductionContent
            allocationOnly={allocationOnlySchedule(session)}
            actualScheduleAllowed={session?.kind==="account"&&(session.isAdmin||session.grants.some(grant=>["Sửa","Xác nhận"].some(action=>normalizedGrant(grant)===normalizedGrant(`Quản lý sản xuất / Lịch SX thực tế / ${action}`))))}
            confirmReportAllowed={session?.kind==="account"&&(session.isAdmin||session.grants.some(grant=>normalizedGrant(grant)===normalizedGrant("Quản lý sản xuất / Tiến độ sản xuất / Xác nhận")))}
            preferenceUser={session?.login}
            section={activeChild}
            sessionLine={sessionLine}
            operator={session?.name || "sample_user_15"}
            isManager={session?.kind === "account"}
            onNavigateSummary={() => setActiveChild("capacity-summary")}
          />
        ) : view === "sku" ? (
          activeChild === "employees" ? (
            <EmployeeDirectory />
          ) : activeChild === "leadtime" ? (
            <LeadtimeMasterView
              masterSkus={skuRecords}
              skuReadState={skuApproval}
              operator={session?.name || "sample_user_15"}
              onOpenSkuMaster={() => setActiveChild("sku-master")}
              language={language}
              onListReset={() => setListResetRevision((value) => value + 1)}
            />
          ) : activeChild === "labor-hours" ? (
            <LaborHoursMaster
              masterSkus={skuRecords}
              operator={session?.name || ""}
              language={language}
              onListReset={() => setListResetRevision((value) => value + 1)}
            />
          ) : activeChild === "safety-days" ? (
            <SafetyRulesView />
          ) : (
            <main
              className={`workspace sku-workspace ${addingSku ? "leadtime-form-only" : ""}`}
            >
              <div className="safety-rules-title">
                <PageTitle variant="menu-root">SKU Master</PageTitle>
              </div>

              {skuCancellation.dialog}
              {skuTransferOpen&&<SkuTransfer onClose={()=>setSkuTransferOpen(false)} onSaved={()=>{setSelected(null);void skuApproval.refresh(true);}}/>}
              {skuListImportOpen ? <SkuListImport onBack={()=>setSkuListImportOpen(false)} onSaved={()=>skuApproval.refresh(true)}/> : null}
              {!skuListImportOpen && <StandardToolbar name="Home" items={[toolbarConfig.group([toolbarConfig.group([toolbarConfig.action({"onClick": () => {
                        setEditingSku(null);
                        setAddingSku(true);
                        setSkuFormDirty(false);
                        setSkuDiscardPending(false);
                        setSkuDraftCode("");
                        setSkuReturnAvailable(false);
                        setSkuCreateGroup("");
                        setSkuSourceOverride(null);
                        setSkuCreateLine("");
                        setSkuCreateProcesses([]);
                        setSkuCreateError("");
                        setSkuDetailOpen(false);
                        setSkuHistoryOpen(false);
                      }},<>＋ Thêm mới
                    </>, true, "action"),
toolbarConfig.action({"disabled": !selected || isMasterCancelled(selected), disabledExplanation: !selected ? "Chọn một dòng trong bảng trước khi thực hiện thao tác." : "SKU này đã bị hủy.","onClick": () => {
                        if (!selected || isMasterCancelled(selected)) return;
                        setEditingSku(selected);
                        setAddingSku(true);
                        setSkuFormDirty(false);
                        setSkuDiscardPending(false);
                        setSkuDraftCode(selected.code);
                        setSkuReturnAvailable(false);
                        setSkuCreateGroup(selected.group);
                        setSkuSourceOverride(selected.mode === "Mua hàng" ? "Mua ngoài" : selected.mode === "Gia công" ? "Gia công" : "Tự chế");
                        setSkuCreateLine(
                          hasProductionProcess(selected)
                            ? selected.line.replace(/^Line\s+/i, "")
                            : "",
                        );
                        setSkuCreateProcesses(selected.processes || []);
                        setSkuCreateError("");
                        setSkuDetailOpen(false);
                        setSkuHistoryOpen(false);
                      }},<>✎ Sửa
                    </>, true, "action"),
toolbarConfig.action({disabled:!selected||isMasterCancelled(selected)||skuCancellation.busy, disabledExplanation: skuCancellation.busy ? "Đang xử lý dữ liệu. Vui lòng chờ hoàn tất rồi thử lại." : !selected ? "Chọn một dòng trong bảng trước khi thực hiện thao tác." : "SKU này đã bị hủy.",onClick:()=>selected&&skuCancellation.open({entity:"sku",key:selected.code,label:"SKU Master"})},"Hủy",true,"action"),
...(session?.kind==="account"&&session.isAdmin?[toolbarConfig.action({onClick:()=>setSkuTransferOpen(true)},"Đồng bộ SKU",true,"action")]:[]),
...(session?.kind==="account"&&session.isAdmin?[toolbarConfig.action({onClick:()=>{setAddingSku(false);setSkuListImportOpen(true);}},"Thêm từ danh sách",true,"action")]:[]),
toolbarConfig.action({"onClick": () => {
                        setSkuSearchOpen((open) => !open);
                        setSkuDetailOpen(false);
                        setSkuHistoryOpen(false);
                      }},<>⌕ Tra cứu
                    </>, true, "lookup"),
toolbarConfig.action({"disabled": !skuApproval.canConfirm ||
                        skuApproval.busy ||
                        !approvalCodes.length ||
                        approvalCodes.some(
                          (code) =>
                            skuRecords.find((r) => r.code === code)?.status !==
                            "Chờ xác nhận",
                        ), disabledExplanation: !skuApproval.canConfirm ? "Bạn không có quyền xác nhận SKU." : skuApproval.busy ? "Đang xử lý dữ liệu. Vui lòng chờ hoàn tất rồi thử lại." : !approvalCodes.length ? "Chọn ít nhất một SKU để xác nhận." : "Các SKU được chọn phải ở trạng thái Chờ xác nhận.","onClick": () => void confirmSelectedSkus()},<>✓ Xác nhận
                      {skuChecked.length ? ` (${skuChecked.length})` : ""}</>, true, "action"),
toolbarConfig.action({"disabled": !selected, disabledExplanation: "Chọn một dòng trong bảng trước khi thực hiện thao tác.","onClick": () => {
                        if (!selected) return;
                        setSkuHistoryOpen(true);
                        setSkuDetailOpen(false);
                        void loadSelectedSkuHistory(selected.code);
                      }},<>Lịch sử
                    </>, true, "action"),
toolbarConfig.action({"onClick": () => {
                        returnToSkuList();
                      }},<>← Quay lại danh sách
                    </>, true, "back", addingSku || (selected && (skuHistoryOpen || skuDetailOpen)) ? 'detail' : 'parent')]),
skuSearchOpen && (
                    toolbarConfig.group([toolbarConfig.field(<><span>TRA THEO</span></>,[toolbarConfig.select({"value": skuSearchMode,"onChange": (e) => {
                            setSkuSearchMode(e.target.value as SkuSearchMode);
                            setQueryInput("");
                            setQuery("");
                            setSkuStatusFilter("all");
                            setSkuChecked([]);
                            setSelected(null);
                          }},<><option value="sku">Mã SKU</option><option value="name">Tên sản phẩm</option><option value="specification">Quy cách</option><option value="group">Nhóm sản phẩm</option><option value="line">Line</option><option value="status">Trạng thái xác nhận</option><option value="createDate">Create - date</option></>)]),
toolbarConfig.field(<><span>NỘI DUNG TRA</span></>,[skuSearchMode === "createDate" ? toolbarConfig.input({value:"Thêm/sửa gần nhất",readOnly:true}) : skuSearchMode === "status" ? (
                          toolbarConfig.select({"aria-label": "Trạng thái xác nhận","value": queryInput || "all","onChange": (e) => setQueryInput(e.target.value)},<><option value="all">Tất cả</option><option>Chờ xác nhận</option><option>Đã xác nhận</option><option>Đang sử dụng</option><option>Ngừng sử dụng</option><option>Đã hủy</option></>)
                        ) : skuSearchMode === "group" ? (
                          toolbarConfig.select({"value": queryInput,"onChange": (e) => {
                              setQueryInput(e.target.value);
                              setQuery(e.target.value);
                            }},<><option value="">Tất cả nhóm</option>{skuGroups.map((item) => (
                              <option key={item}>{item}</option>
                            ))}</>)
                        ) : skuSearchMode === "line" ? (
                          toolbarConfig.select({"value": queryInput,"onChange": (e) => {
                              setQueryInput(e.target.value);
                              setQuery(e.target.value);
                            }},<><option value="">Tất cả Line</option>{Array.from(
                              new Set(skuRecords.map((sku) => sku.line)),
                            )
                              .sort()
                              .map((item) => (
                                <option key={item}>{item}</option>
                              ))}</>)
                        ) : (
                          toolbarConfig.input({"value": queryInput,"onChange": (e) => {
                              setQueryInput(e.target.value);
                              setQuery(e.target.value);
                            },"placeholder": skuSearchMode === "sku"
                                ? "Nhập mã SKU"
                                : skuSearchMode === "name"
                                  ? "Nhập tên sản phẩm"
                                  : "Nhập quy cách"})
                        )]),
toolbarConfig.group([toolbarConfig.action({"onClick": () => {
                            setQueryInput("");
                            setQuery("");
                            setSkuStatusFilter("all");
                            setSkuChecked([]);
                            setSelected(null);
                          }},<>Xóa lọc
                        </>, true, "clear"),
toolbarConfig.action({"onClick": () => {
                            setSkuStatusFilter(
                              skuSearchMode === "status"
                                ? queryInput || "all"
                                : "all",
                            );
                            setQuery(
                              skuSearchMode === "status" ? "" : queryInput,
                            );
                            setSkuChecked([]);
                            setSelected(null);
                          }},<>Tìm kiếm
                        </>, true, "search"),
toolbarConfig.action({"onClick": () => {
                            setSkuSearchMode("sku");
                            setQueryInput("");
                            setQuery("");
                            setSkuSearchOpen(false);
                            setSkuStatusFilter("all");
                            setSkuChecked([]);
                            setSelected(null);
                          }},<>Quay lại
                        </>, true, "back", 'lookup')])])
                  )])]} />}
              {skuApproval.message && (
                <div
                  className="sku-confirm-toast"
                  data-own-language
                  role="status"
                >
                  {skuApproval.message}
                  <FeedbackActionButton
                    aria-label="Đóng thông báo"
                    onClick={skuApproval.dismiss}
                  >
                    ×
                  </FeedbackActionButton>
                </div>
              )}

              {!skuApproval.canConfirm && !skuApproval.capabilityLoading && !skuApproval.capabilityError && skuStatusFilter !== "all" && (
                <p>Bạn không có quyền xác nhận SKU</p>
              )}
              {addingSku && (
                <section className="data-card leadtime-inline-panel sku-inline-create master-entry-panel">
                  <header>
                    <div>
                      <h2>
                        {editingSku
                          ? "SỬA SKU / 修改SKU"
                          : "THÊM SKU / 新增SKU"}
                      </h2>
                      <p>
                        {editingSku
                          ? `Cập nhật thông tin ${editingSku.code}`
                          : "Tạo hồ sơ sản phẩm mới"}
                      </p>
                    </div>
                    <FeedbackActionButton
                      aria-label="Đóng"
                      onClick={() => {
                        returnToSkuList();
                      }}
                    >
                      ×
                    </FeedbackActionButton>
                  </header>
                  <form
                    key={editingSku?.code || "new-sku"}
                    onSubmit={saveNewSku}
                    onChangeCapture={() => {
                      setSkuFormDirty(true);
                      setSkuDiscardPending(false);
                    }} onInvalid={() => notifyActionFailure("Thông tin bắt buộc còn thiếu hoặc chưa hợp lệ. Kiểm tra các trường được đánh dấu trước khi tiếp tục.")}
                  >
                    <div className="master-entry-body">
                      <div className="leadtime-form-grid">
                        <fieldset>
                          <legend>Thông tin sản phẩm / 產品資料</legend>
                          <div className="leadtime-readonly-grid sku-create-fields">
                            <label>
                              <span>Mã SKU / SKU *</span>
                              <input
                                name="code"
                                required
                                autoFocus
                                readOnly={!!editingSku}
                                value={skuDraftCode}
                                onChange={(event) => {
                                  const value =
                                    event.target.value.toUpperCase();
                                  setSkuDraftCode(value);
                                  const normalized = value.trim();
                                  setSkuCreateError(
                                    !editingSku &&
                                      normalized &&
                                      skuRecords.some(
                                        (item) =>
                                          normalizeSkuCode(item.code) ===
                                          normalizeSkuCode(normalized),
                                      )
                                      ? language === "zh"
                                        ? `SKU ${normalized} 已存在於 SKU Master，不能重複新增。`
                                        : `SKU ${normalized} đã tồn tại trong SKU Master, không thể thêm mới.`
                                      : "",
                                  );
                                }}
                                onBlur={() =>
                                  setSkuDraftCode((value) =>
                                    normalizeSkuCode(value),
                                  )
                                }
                                placeholder="Ví dụ: 102XS04001"
                              />
                            </label>
                            <label>
                              <span>Tên sản phẩm / 產品名稱 *</span>
                              <input
                                name="name"
                                required
                                defaultValue={editingSku?.name || ""}
                                placeholder="Nhập tên sản phẩm"
                              />
                            </label>
                            <label>
                              <span>Quy cách / 規格</span>
                              <input
                                name="specification"
                                defaultValue={
                                  editingSku?.specification === "—"
                                    ? ""
                                    : editingSku?.specification || ""
                                }
                                placeholder="Nhập quy cách"
                              />
                            </label>
                            <label>
                              <span>Nhóm sản phẩm / 產品組別 *</span>
                              <input
                                name="group"
                                list="sku-group-options"
                                required
                                value={skuCreateGroup}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  const key = normalizeSearchText(value);
                                  setSkuCreateGroup(value);
                                  if (
                                    skuSourceOverride === null && (key.includes("mua hang") ||
                                    key.includes("gia cong ngoai"))
                                  ) {
                                    setSkuCreateLine("");
                                    setSkuCreateProcesses([]);
                                  }
                                }}
                                placeholder="Chọn hoặc nhập nhóm"
                              />
                              <datalist id="sku-group-options">
                                {skuGroups.map((item) => (
                                  <option key={item} value={item} />
                                ))}
                              </datalist>
                            </label>
                          </div>
                        </fieldset>
                        <fieldset>
                          <legend>Thiết lập sản xuất / 生產設定</legend>
                          <div className="leadtime-readonly-grid sku-create-fields">
                            <label>
                              <span>Đơn vị tính / 計量單位</span>
                              <select
                                name="unit"
                                defaultValue={editingSku?.unit || "—"}
                              >
                                <option>—</option>
                                {editingSku?.unit &&
                                  ![
                                    "—",
                                    "CÁI",
                                    "BỘ",
                                    "SỢI",
                                    "KG",
                                    "TỜ",
                                  ].includes(editingSku.unit) && (
                                    <option>{editingSku.unit}</option>
                                  )}
                                <option>CÁI</option>
                                <option>BỘ</option>
                                <option>SỢI</option>
                                <option>KG</option>
                                <option>TỜ</option>
                              </select>
                            </label>
                            <label>
                              <span>Nguồn / 來源</span>
                              <select
                                name="mode"
                                required
                                value={skuCreateSource}
                                onChange={(event) => {
                                  setSkuSourceOverride(event.target.value);
                                  if (event.target.value !== "Tự chế") {
                                    setSkuCreateLine("");
                                    setSkuCreateProcesses([]);
                                  }
                                }}
                              >
                                <option value="">Chọn nguồn</option>
                                <option value="Tự chế">Tự chế</option>
                                <option value="Mua ngoài">Mua ngoài</option>
                                <option value="Gia công">Gia công ngoài</option>
                              </select>
                            </label>
                            <label>
                              <span>Line / 產線</span>
                              <select
                                name="line"
                                required={
                                  !skuCreateExternal && !!skuCreateGroup.trim()
                                }
                                value={skuCreateLine}
                                onChange={(event) => {
                                  setSkuCreateLine(event.target.value);
                                  if(event.target.value) setSkuSourceOverride("Tự chế");
                                  setSkuCreateProcesses([]);
                                }}
                              >
                                <option value="">Để trống — không có Line</option>
                                <option>A</option>
                                <option>B</option>
                                <option>C</option>
                              </select>
                            </label>
                          </div>
                          <div
                            className={`sku-process-picker ${skuCreateExternal || !skuCreateLine ? "disabled" : ""}`}
                          >
                            <span>Mã công đoạn / 工序代碼</span>
                            {skuCreateExternal ? (
                              <p>Không áp dụng</p>
                            ) : !skuCreateLine ? (
                              <p>
                                Chọn nhóm sản phẩm và Line để hiển thị công đoạn
                              </p>
                            ) : (
                              <>
                                <div className="sku-process-options">
                                  {(
                                    skuCreateProcessOptions[skuCreateLine] || []
                                  ).map((code) => (
                                    <label key={code}>
                                      <input
                                        type="checkbox"
                                        name="processes"
                                        value={code}
                                        checked={skuCreateProcesses.includes(
                                          code,
                                        )}
                                        onChange={(event) =>
                                          setSkuCreateProcesses((current) =>
                                            event.target.checked
                                              ? [...current, code]
                                              : current.filter(
                                                  (item) => item !== code,
                                                ),
                                          )
                                        }
                                      />
                                      <span>
                                        <b>{code}</b>
                                        <small>{processLabel(code)}</small>
                                      </span>
                                    </label>
                                  ))}
                                </div>
                                <label className="sku-process-result">
                                  <span>Công đoạn đã chọn / 已選工序</span>
                                  <input
                                    readOnly
                                    value={skuCreateProcesses.join(" / ")}
                                    placeholder="Chọn công đoạn phía trên"
                                  />
                                </label>
                              </>
                            )}
                          </div>
                        </fieldset>
                        <fieldset className="master-system-fields">
                          <legend>Thông tin hệ thống / 系統資料</legend>
                          <div className="leadtime-readonly-grid">
                            <label>
                              <span>Trạng thái / 狀態</span>
                              <input readOnly value="Chờ xác nhận / 待確認" />
                            </label>
                            <label>
                              <span>Người cập nhật / 更新人</span>
                              <input readOnly value={session?.name || "—"} />
                            </label>
                            <label>
                              <span>Thời gian cập nhật / 更新時間</span>
                              <input
                                readOnly
                                value="Tự ghi khi lưu / 儲存時自動記錄"
                              />
                            </label>
                          </div>
                        </fieldset>
                      </div>
                    </div>
                    {skuCreateError && (
                      <div
                        className="sku-create-error"
                        role="alert"
                        aria-live="assertive"
                      >
                        {skuCreateError}
                      </div>
                    )}
                    {skuDiscardPending && (
                      <div
                        className="form-discard-confirm"
                        role="alertdialog"
                        aria-live="assertive"
                      >
                        <span>
                          {language === "zh"
                            ? "尚未儲存的資料將會遺失。確定要離開嗎？"
                            : "Dữ liệu chưa lưu sẽ bị mất. Bạn có muốn thoát không?"}
                        </span>
                        <div className="form-discard-actions">
                          <FeedbackActionButton
                            type="button"
                            onClick={() => setSkuDiscardPending(false)}
                          >
                            {language === "zh" ? "否" : "Không"}
                          </FeedbackActionButton>
                          <FeedbackActionButton
                            type="button"
                            className="confirm-discard"
                            onClick={finishReturnToSkuList}
                          >
                            {language === "zh" ? "是" : "Có"}
                          </FeedbackActionButton>
                        </div>
                      </div>
                    )}
                    <div className="function-actions master-entry-footer">
                      <FeedbackActionButton
                        type="button"
                        className="ghost-button"
                        onClick={() => {
                          returnToSkuList();
                        }}
                      >
                        Hủy / 取消
                      </FeedbackActionButton>
                      <FeedbackActionButton type="submit" className="primary-button">
                        Lưu / 儲存
                      </FeedbackActionButton>
                    </div>
                  </form>
                </section>
              )}
              {!skuListImportOpen && (
                <section hidden={addingSku} className="data-card sku-master-card master-standard-card">
                  <div className="filters sku-master-legacy-filters">
                    <label>
                      <span>TRA THEO</span>
                      <select
                        value={skuSearchMode}
                        onChange={(e) => {
                          setSkuSearchMode(e.target.value as SkuSearchMode);
                          setQueryInput("");
                          setQuery("");
                        }}
                      >
                        <option value="sku">Mã SKU</option>
                        <option value="name">Tên sản phẩm</option>
                        <option value="specification">Quy cách</option>
                        <option value="group">Nhóm sản phẩm</option>
                        <option value="line">Line</option>
                      </select>
                    </label>
                    <label className="search">
                      <span>
                        {skuSearchMode === "sku"
                          ? "MÃ SKU"
                          : skuSearchMode === "name"
                            ? "TÊN SẢN PHẨM"
                            : skuSearchMode === "specification"
                              ? "QUY CÁCH"
                              : skuSearchMode === "group"
                                ? "NHÓM SẢN PHẨM"
                                : "LINE"}
                      </span>
                      {skuSearchMode === "group" ? (
                        <select
                          value={queryInput}
                          onChange={(e) => {
                            setQueryInput(e.target.value);
                            setQuery(e.target.value);
                          }}
                        >
                          <option value="">Tất cả nhóm</option>
                          {skuGroups.map((item) => (
                            <option key={item}>{item}</option>
                          ))}
                        </select>
                      ) : skuSearchMode === "line" ? (
                        <select
                          value={queryInput}
                          onChange={(e) => {
                            setQueryInput(e.target.value);
                            setQuery(e.target.value);
                          }}
                        >
                          <option value="">Tất cả Line</option>
                          <option>Line A</option>
                          <option>Line B</option>
                          <option>Line C</option>
                          <option>—</option>
                        </select>
                      ) : (
                        <div>
                          ⌕
                          <input
                            value={queryInput}
                            onChange={(e) => {
                              setQueryInput(e.target.value);
                              setQuery(e.target.value);
                            }}
                            placeholder={
                              skuSearchMode === "sku"
                                ? "Nhập mã SKU"
                                : skuSearchMode === "name"
                                  ? "Nhập tên sản phẩm"
                                  : "Nhập quy cách"
                            }
                          />
                        </div>
                      )}
                    </label>
                    <div className="sku-search-actions">
                      <FeedbackActionButton
                        className="ghost-button"
                        onClick={() => {
                          setQueryInput("");
                          setQuery("");
                          setGroup("Tất cả nhóm");
                          setLine("Tất cả Line");
                        }}
                      >
                        Xóa bộ lọc
                      </FeedbackActionButton>
                    </div>
                  </div>
                  <div className="result-bar">
                    <SkuResultCount count={filtered.length} hasData={skuApproval.hasData} error={skuApproval.error} language={language}/>{" "}
                    <span>Nhấp một lần để chọn; nhấp đúp để mở chi tiết →</span>
                  </div>
                  <DataTable className="table-wrap">
                    <table data-page-size="25" data-compact-pagination="true">
                      <thead>
                        <tr>
                          <th>NHÓM SẢN PHẨM</th>
                          <th>SKU</th>
                          <th>TÊN SẢN PHẨM</th>
                          <th>QUY CÁCH</th>
                          <th>LINE / CÔNG ĐOẠN</th>
                          <th>TRẠNG THÁI</th>
                          <th>NGƯỜI XÁC NHẬN</th>
                          <th>THỜI GIAN XÁC NHẬN</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((sku) => (
                          <tr
                            key={sku.code}
                            className={
                              selected?.code === sku.code ||
                              skuChecked.includes(sku.code)
                                ? "selected"
                                : ""
                            }
                            onClick={() => {
                              setSelected(sku);
                              setSkuChecked([]);
                              setSkuDetailOpen(false);
                              setSkuHistoryOpen(false);
                              setProcessExpanded(false);
                            }}
                            onDoubleClick={() => {
                              setSelected(sku);
                              setSkuDetailOpen(true);
                              setProcessExpanded(false);
                            }}
                          >
                            <DataCell kind="code">
                              <span className="tag">{sku.group}</span>
                            </DataCell>
                            <DataCell kind="code">
                              <FeedbackActionButton
                                className="sku-link"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelected(sku);
                                  setSkuChecked([]);
                                  setSkuDetailOpen(false);
                                }}
                                onDoubleClick={(event) => {
                                  event.stopPropagation();
                                  setSelected(sku);
                                  setSkuDetailOpen(true);
                                }}
                              >
                                {sku.code}
                              </FeedbackActionButton>
                            </DataCell>
                            <DataCell className="product-name">{sku.name}</DataCell>
                            <DataCell>{sku.specification}</DataCell>
                            <DataCell>
                              {!hasProductionProcess(sku) ? (
                                <span className="no-process">
                                  Không áp dụng
                                </span>
                              ) : (
                                <>
                                  <span className="line-dot" />
                                  {sku.line}
                                </>
                              )}
                            </DataCell>
                            <DataCell>
                              <span
                                className={
                                  sku.status === "Đã xác nhận"
                                    ? "status-good"
                                    : "status-warning"
                                }
                              >
                                {confirmationStatus(sku)}
                              </span>
                              <small> · {usageStatus(sku)}</small>
                            </DataCell>
                            <DataCell>{sku.confirmedBy || "—"}</DataCell>
                            <DataCell>{approvalTime(sku.confirmedAt)}</DataCell>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </DataTable>
                </section>
              )}
            </main>
          )
        ) : view === "bom" ? (
          activeChild === "bom-change" ? (
            <BomChangeContent
              operator={
                session?.kind === "account"
                  ? session.login
                  : session?.name || "sample_user_15"
              }
            />
          ) : (
            <BomLookupView
              canReconcile={isAdmin}
              operator={
                session?.kind === "account"
                  ? session.login
                  : session?.name || "sample_user_15"
              }
            />
          )
        ) : planTab === "tracking" ? (
          <InTransit language={language} operator={session?.login || ""} />
        ) : planTab === "report" ? (
          selectedPlanningReport ? <PlanningReports key={selectedPlanningReport} language={language} reportType={selectedPlanningReport} onClose={()=>navigateWorkspace({view:"planning",child:"report",planTab:"report"})} /> : <main className="workspace" />
        ) : planTab === "plan" ? (
          <ProductionPlan
            language={language}
            initialWeek={planningSessionCache?.engineWeek || ""}
          />
        ) : (
          <PlanningView
            tab={planTab}
            operator={session?.name || ""}
            masterRows={skuRecords}
          />
        )}
        {view === "sku" &&
          activeChild === "sku-master" &&
          selected &&
          !addingSku &&
          skuHistoryOpen && (
            <>
              <FeedbackActionButton
                className="overlay"
                aria-label="Đóng lịch sử SKU"
                onClick={() => setSkuHistoryOpen(false)}
              />
              <aside className="detail-panel sku-history-panel">
                <div className="detail-header">
                  <div>
                    <p>LỊCH SỬ SKU</p>
                    <h2>{selected.code}</h2>
                    <span>{selected.name}</span>
                  </div>
                  <FeedbackActionButton onClick={() => setSkuHistoryOpen(false)}>×</FeedbackActionButton>
                </div>
                <div className="detail-scroll">
                  <section>
                    <h3>Chi tiết thay đổi</h3>
                    <div className="sku-history-list">
                      {selectedSkuHistory.length ? (
                        selectedSkuHistory.map((item) => (
                          <article key={item.id}>
                            <header>
                              <b>
                                Phiên bản{" "}
                                {String(item.version).padStart(2, "0")}
                              </b>
                              <span
                                className={!item.validTo ? "status-good" : ""}
                              >
                                {item.validTo
                                  ? "Hết hiệu lực"
                                  : "Đang hiệu lực"}
                              </span>
                            </header>
                            <dl>
                              <div>
                                <dt>Ngày hiệu lực</dt>
                                <dd>
                                  {item.validFrom
                                    ? formatDateTimeDisplay(item.validFrom)
                                    : "Dữ liệu gốc"}
                                </dd>
                              </div>
                              <div>
                                <dt>Ngày hết hiệu lực</dt>
                                <dd>
                                  {item.validTo
                                    ? formatDateTimeDisplay(item.validTo)
                                    : "—"}
                                </dd>
                              </div>
                              <div>
                                <dt>Tên sản phẩm</dt>
                                <dd>{item.data.name}</dd>
                              </div>
                              <div>
                                <dt>Quy cách</dt>
                                <dd>{item.data.specification}</dd>
                              </div>
                              <div>
                                <dt>Nhóm sản phẩm</dt>
                                <dd>{item.data.group}</dd>
                              </div>
                              <div>
                                <dt>Đơn vị tính</dt>
                                <dd>{item.data.unit}</dd>
                              </div>
                              <div>
                                <dt>Nguồn</dt>
                                <dd>
                                  {item.data.mode === "Mua hàng"
                                    ? "Mua ngoài"
                                    : item.data.mode === "Tự sản xuất"
                                      ? "Tự chế"
                                      : item.data.mode}
                                </dd>
                              </div>
                              <div>
                                <dt>Line</dt>
                                <dd>{item.data.line}</dd>
                              </div>
                              <div className="full">
                                <dt>Mã công đoạn</dt>
                                <dd>
                                  {item.data.processes?.join(" / ") || "—"}
                                </dd>
                              </div>
                              <div className="full">
                                <dt>Người thay đổi</dt>
                                <dd>
                                  {item.changedBy} ·{" "}
                                  {formatDateTimeDisplay(item.changedAt)}
                                </dd>
                              </div>
                            </dl>
                          </article>
                        ))
                      ) : (
                        <article>
                          <header>
                            <b>Dữ liệu hiện tại</b>
                            <span className="status-good">Đang hiệu lực</span>
                          </header>
                          <dl>
                            <div>
                              <dt>Ngày hiệu lực</dt>
                              <dd>Dữ liệu gốc</dd>
                            </div>
                            <div>
                              <dt>Ngày hết hiệu lực</dt>
                              <dd>—</dd>
                            </div>
                            <div>
                              <dt>Tên sản phẩm</dt>
                              <dd>{selected.name}</dd>
                            </div>
                            <div>
                              <dt>Quy cách</dt>
                              <dd>{selected.specification}</dd>
                            </div>
                            <div>
                              <dt>Nhóm sản phẩm</dt>
                              <dd>{selected.group}</dd>
                            </div>
                            <div>
                              <dt>Đơn vị tính</dt>
                              <dd>{selected.unit}</dd>
                            </div>
                            <div>
                              <dt>Nguồn</dt>
                              <dd>
                                {selected.mode === "Mua hàng"
                                  ? "Mua ngoài"
                                  : selected.mode === "Tự sản xuất"
                                    ? "Tự chế"
                                    : selected.mode}
                              </dd>
                            </div>
                            <div>
                              <dt>Line</dt>
                              <dd>{selected.line}</dd>
                            </div>
                            <div className="full">
                              <dt>Mã công đoạn</dt>
                              <dd>{selected.processes?.join(" / ") || "—"}</dd>
                            </div>
                          </dl>
                        </article>
                      )}
                    </div>
                  </section>
                </div>
              </aside>
            </>
          )}
        {view === "sku" &&
          activeChild === "sku-master" &&
          selected &&
          !addingSku &&
          skuDetailOpen && (
            <>
              <FeedbackActionButton
                className="overlay sku-detail-overlay"
                aria-label="Đóng"
                onClick={() => {
                  returnToSkuList();
                }}
              />
              <aside
                className="detail-panel sku-detail-panel"
                onDoubleClick={() => {
                  setSkuDetailOpen(false);
                }}
              >
                <div className="detail-header">
                  <div>
                    <p>HỒ SƠ SKU</p>
                    <h2>{selected.code}</h2>
                    <span>{selected.name}</span>
                  </div>
                  <FeedbackActionButton
                    onClick={() => {
                      returnToSkuList();
                    }}
                  >
                    ×
                  </FeedbackActionButton>
                </div>
                <div className="detail-scroll">
                  <div className="detail-status">
                    <span>
                      <i /> {confirmationStatus(selected)} ·{" "}
                      {usageStatus(selected)}
                    </span>
                    <FeedbackActionButton
                      onClick={() => {
                        setEditingSku(selected);
                        setAddingSku(true);
                        setSkuFormDirty(false);
                        setSkuDiscardPending(false);
                        setSkuDraftCode(selected.code);
                        setSkuCreateGroup(selected.group);
                        setSkuSourceOverride(selected.mode === "Mua hàng" ? "Mua ngoài" : selected.mode === "Gia công" ? "Gia công" : "Tự chế");
                        setSkuCreateLine(
                          hasProductionProcess(selected)
                            ? selected.line.replace(/^Line\s+/i, "")
                            : "",
                        );
                        setSkuCreateProcesses(selected.processes || []);
                        setSkuCreateError("");
                        setSkuDetailOpen(false);
                      }}
                    >
                      Chỉnh sửa
                    </FeedbackActionButton>
                  </div>
                  <section>
                    <h3>Thông tin cơ bản</h3>
                    <p>
                      Người xác nhận:{" "}
                      {selected.confirmed_by || selected.confirmedBy || "—"} ·{" "}
                      {approvalTime(
                        selected.confirmed_at || selected.confirmedAt,
                      )}{" "}
                      · {selected.confirmation_source || ""}
                    </p>
                    <dl>
                      <div>
                        <dt>Tên sản phẩm</dt>
                        <dd>{selected.name}</dd>
                      </div>
                      <div>
                        <dt>Quy cách</dt>
                        <dd>{selected.specification}</dd>
                      </div>
                      <div>
                        <dt>Nhóm sản phẩm</dt>
                        <dd>{selected.group}</dd>
                      </div>
                      <div>
                        <dt title="Unit of Measure">Đơn vị tính</dt>
                        <dd>{selected.unit}</dd>
                      </div>
                    </dl>
                  </section>
                  <SkuStock key={selected.code} code={selected.code} onOpenWarehouse={()=>{if(canOpenMenu(session,"warehouse","inventory"))navigateWorkspace({view:"warehouse",child:"inventory",planTab:"base",focusSku:selected.code});}} />
                  <section>
                    <h3>Thiết lập sản xuất</h3>
                    <dl className="two-col">
                      <div>
                        <dt>Line</dt>
                        <dd>
                          {hasProductionProcess(selected)
                            ? selected.line
                            : "Không áp dụng"}
                        </dd>
                      </div>
                      <div>
                        <dt>MOQ</dt>
                        <dd>{selected.moq.toLocaleString("vi-VN")}</dd>
                      </div>
                      <div>
                        <dt>Nguồn</dt>
                        <dd>
                          {selected.mode === "Mua hàng"
                            ? "Mua ngoài"
                            : selected.mode === "Tự sản xuất"
                              ? "Tự chế"
                              : selected.mode}
                        </dd>
                      </div>
                      <div>
                        <dt>Safety Days</dt>
                        <dd>
                          {selectedProductionSetting?.safety.total || 0} ngày
                        </dd>
                      </div>
                      <div>
                        <dt>Lead time</dt>
                        <dd>
                          {selectedProductionSetting?.leadTime
                            ? `${selectedProductionSetting.leadTime} ngày`
                            : "Chưa thiết lập"}
                        </dd>
                      </div>
                      <div>
                        <dt>Giờ công chuẩn</dt>
                        <dd>
                          {(
                            skuLaborHours.get(
                              normalizeSkuCode(selected.code),
                            ) ?? 0
                          ).toFixed(3)}{" "}
                          giờ/SP
                        </dd>
                      </div>
                    </dl>
                  </section>
                  {hasProductionProcess(selected) && (
                    <section className="sku-process-section">
                      <FeedbackActionButton
                        className="section-toggle"
                        onClick={() => setProcessExpanded((v) => !v)}
                      >
                        <span>
                          <b>Quy trình sản xuất</b>
                          <small>
                            {selected.line} · {selectedProcesses.length} công
                            đoạn
                          </small>
                        </span>
                        <em>
                          {processExpanded ? "Thu gọn" : "Xem chi tiết"}{" "}
                          {processExpanded ? "⌃" : "⌄"}
                        </em>
                      </FeedbackActionButton>
                      <div className="process-flow">
                        {selectedProcesses.slice(0, 3).map((code, i) => (
                          <span key={code}>
                            {i > 0 && <i>›</i>}
                            <em>{code}</em>
                          </span>
                        ))}
                        {selectedProcesses.length > 3 && (
                          <b>+{selectedProcesses.length - 3}</b>
                        )}
                      </div>
                      {processExpanded && (
                        <div className="process-list">
                          {selectedProcesses.map((code, i) => (
                            <div key={code}>
                              <em>{i + 1}</em>
                              <span>
                                <b>{code}</b>
                                <small>{processLabel(code)}</small>
                              </span>
                              <i>Đang áp dụng</i>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  )}
                  <section className="usage">
                    <h3>Được sử dụng tại</h3>
                    <div>
                      <span>KHSX</span>
                      <span>Quản lý sản xuất</span>
                      <span>Kho</span>
                    </div>
                  </section>
                </div>
              </aside>
            </>
          )}
      </BomSourceSkuContext.Provider></BusinessSkuContext.Provider></ToolbarPermissions.Provider></ExportPermissionContext.Provider></ApprovalNavigationContext.Provider>
    </div>
  );
}
