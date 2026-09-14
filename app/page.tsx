"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import bomData from "./bom-data.json";
import skuExtraData from "./sku-extra-data.json";
import skuProcessData from "./sku-process-data.json";
import skuTpData from "./sku-tp-data.json";
import baseForecastData from "./base-forecast-data.json";
import demandEventData from "./demand-event-data.json";
import leadtimeData from "./leadtime-data.json";
import inventoryErpData from "./inventory-erp-data.json";

type Language = "vi" | "zh";
type SkuSearchMode = "sku" | "name" | "specification" | "group" | "line";
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
  | "totalSafetyDays";

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
  a.group.localeCompare(b.group, "vi", { numeric: true, sensitivity: "base" }) ||
  (a.code || a.sku || "").localeCompare(b.code || b.sku || "", "vi", {
    numeric: true,
    sensitivity: "base",
  });

const zhTerms: Record<string, string> = {
  "Quản trị hệ thống": "系統管理",
  "Dữ liệu cơ bản": "基礎資料",
  "Quản lý kho": "倉庫管理",
  "Cấu trúc thành phẩm": "產品結構",
  "Kế hoạch sản xuất": "生產計畫",
  "Quản lý sản xuất": "生產管理",
  "MENU CHỨC NĂNG": "功能選單",
  "Quản lý người dùng": "使用者管理",
  "Phân quyền": "權限管理",
  "Nhật ký thao tác": "操作日誌",
  "Quản lý phiên bản": "版本管理",
  "Tình trạng dữ liệu": "資料狀態",
  "Sao lưu và khôi phục": "備份與還原",
  "Giám sát chỉ đọc; không cho phép sửa dữ liệu gốc tại màn hình này.":
    "唯讀監控；此畫面不允許修改原始資料。",
  "Xuất báo cáo lỗi": "匯出錯誤報告",
  "Làm mới": "重新整理",
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
  "NGUỒN": "來源",
  "SỐ BẢN GHI": "資料筆數",
  "TRẠNG THÁI": "狀態",
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
  "Đơn vị tính": "單位",
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
  "Quy trình sản xuất": "生產流程",
  "công đoạn": "工序",
  Cắt: "裁切",
  "Lắp ráp": "組裝",
  "Bấm đầu": "壓接",
  "Đóng gói": "包裝",
  "Hoàn thiện": "完工",
  "Đang áp dụng": "生效中",
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
  "Người xác nhận": "確認人",
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
  "Hủy xác nhận": "取消確認",
  "Hủy phiếu": "取消單據",
  "Chờ AI đọc": "等待AI辨識",
  "Chờ kiểm tra": "等待檢查",
  "Chờ xác nhận cập nhật": "等待確認更新",
  "Chờ kho nhận": "等待倉庫接收",
  "Đã cập nhật kho": "庫存已更新",
  "Có chênh lệch": "存在差異",
  "Có lỗi dữ liệu": "資料錯誤",
  "Đã hủy xác nhận": "已取消確認",
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
  "Lead Time theo SKU": "各 SKU 交期",
  "各 SKU 交期": "各 SKU 交期",
  "Sửa": "修改",
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
  "Đóng": "關閉",
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

const viTerms = Object.fromEntries(
  Object.entries(zhTerms).map(([vi, zh]) => [zh, vi]),
);

function applyLanguage(language: Language) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = language === "zh" ? "zh-TW" : "vi";
  const map = language === "zh" ? zhTerms : viTerms;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const raw = node.nodeValue || "";
    const trimmed = raw.trim();
    if (!trimmed) continue;
    let next = map[trimmed];
    if (!next) {
      next = trimmed;
      for (const [from, to] of Object.entries(map).sort(
        (a, b) => b[0].length - a[0].length,
      ))
        if (next.includes(from)) next = next.split(from).join(to);
    }
    next = next.replace(/\b(\d{4})-(\d{2})-(\d{2})(?![\dT])/g, "$3/$2/$1");
    if (next !== trimmed) node.nodeValue = raw.replace(trimmed, next);
  }
  document
    .querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      "input[placeholder], textarea[placeholder]",
    )
    .forEach((el) => {
      const p = el.placeholder;
      let next = map[p];
      if (!next) {
        next = p;
        for (const [from, to] of Object.entries(map))
          next = next.split(from).join(to);
      }
      if (next !== p) el.placeholder = next;
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
      <button
        className={language === "vi" ? "active" : ""}
        onClick={() => onChange("vi")}
      >
        VI
      </button>
      <button
        className={language === "zh" ? "active" : ""}
        onClick={() => onChange("zh")}
      >
        繁體中文
      </button>
    </div>
  );
}

function AutoTablePagination({ resetKey }: { resetKey: string }) {
  useEffect(() => {
    const cleanups: Array<() => void> = [];
    const setup = () => {
      document
        .querySelectorAll<HTMLElement>(".table-pagination")
        .forEach((pager) => {
          if (!pager.previousElementSibling?.classList.contains("table-wrap"))
            pager.remove();
        });
      document
        .querySelectorAll<HTMLTableElement>(".app-shell .table-wrap > table")
        .forEach((table) => {
          if (table.dataset.noPagination === "true") return;
          const body = table.tBodies[0];
          if (!body) return;
          const rows = Array.from(body.rows);
          const signature = rows
            .map((row) => row.textContent?.replace(/\s+/g, " ").trim() || "")
            .join("|");
          if (
            table.dataset.paginationReady === "true" &&
            table.dataset.paginationSignature === signature
          )
            return;
          if (table.dataset.paginationReady === "true") {
            rows.forEach((row) => (row.hidden = false));
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
          if (rows.length <= pageSize) return;
          table.dataset.paginationReady = "true";
          const wrap = table.parentElement!;
          const old = wrap.nextElementSibling;
          if (old?.classList.contains("warehouse-pagination"))
            old.classList.add("legacy-pagination");
          const pager = document.createElement("div");
          pager.className = "table-pagination";
          const info = document.createElement("span");
          const nav = document.createElement("div");
          pager.append(info, nav);
          wrap.insertAdjacentElement("afterend", pager);
          let page = 1;
          const total = Math.ceil(rows.length / pageSize);
          const render = () => {
            const start = (page - 1) * pageSize;
            rows.forEach(
              (row, index) =>
                (row.hidden = index < start || index >= start + pageSize),
            );
            info.textContent = `Hiển thị ${start + 1}–${Math.min(start + pageSize, rows.length)} / ${rows.length} dòng`;
            nav.replaceChildren();
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
              button.onclick = () => {
                page = target;
                render();
                wrap.scrollIntoView({ behavior: "smooth", block: "start" });
              };
              nav.append(button);
            };
            addButton("‹", Math.max(1, page - 1), false, page === 1);
            const pages = Array.from(
              new Set(
                [1, total, page - 2, page - 1, page, page + 1, page + 2].filter(
                  (n) => n >= 1 && n <= total,
                ),
              ),
            ).sort((a, b) => a - b);
            pages.forEach((n, index) => {
              if (index > 0 && n - pages[index - 1] > 1) {
                const dots = document.createElement("span");
                dots.className = "pagination-ellipsis";
                dots.textContent = "…";
                nav.append(dots);
              }
              addButton(String(n), n, n === page);
            });
            addButton("›", Math.min(total, page + 1), false, page === total);
          };
          render();
          cleanups.push(() => {
            rows.forEach((row) => (row.hidden = false));
            delete table.dataset.paginationReady;
            delete table.dataset.paginationSignature;
            pager.remove();
            old?.classList.remove("legacy-pagination");
          });
        });
    };
    const frame = requestAnimationFrame(setup);
    const observer = new MutationObserver(() => requestAnimationFrame(setup));
    observer.observe(document.body, { subtree: true, childList: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [resetKey]);
  return null;
}

type Sku = {
  code: string;
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
const safetyDaysFromLeadTime = (days: number) =>
  days <= 0
    ? 0
    : days <= 7
      ? 7
      : days <= 14
        ? 9
        : days <= 21
          ? 11
          : days <= 30
            ? 15
            : days <= 45
              ? 25
              : 35;
const browserId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const defaultSafetyRuleSet: SafetyRuleSet = {
  id: "SDR-20260101-V1",
  code: "SDR-20260101",
  name: "Quy tắc Safety Days chuẩn",
  version: "V1",
  effectiveFrom: "2026-01-01",
  effectiveTo: "",
  status: "Đã xác nhận",
  leadTimeRules: [
    { from: 1, to: 7, days: 7, status: "Đang áp dụng", note: "" },
    { from: 8, to: 14, days: 9, status: "Đang áp dụng", note: "" },
    { from: 15, to: 21, days: 11, status: "Đang áp dụng", note: "" },
    { from: 22, to: 30, days: 15, status: "Đang áp dụng", note: "" },
    { from: 31, to: 45, days: 25, status: "Đang áp dụng", note: "" },
    {
      from: 46,
      to: null,
      days: 35,
      status: "Đang áp dụng",
      note: "Không giới hạn",
    },
  ],
  forecastRules: [
    {
      from: 90,
      to: null,
      days: 0,
      status: "Chưa áp dụng",
      note: "Từ 90% trở lên",
    },
    {
      from: 80,
      to: 90,
      days: 2,
      status: "Chưa áp dụng",
      note: "Từ 80% đến dưới 90%",
    },
    {
      from: 70,
      to: 80,
      days: 4,
      status: "Chưa áp dụng",
      note: "Từ 70% đến dưới 80%",
    },
    { from: null, to: 70, days: 7, status: "Chưa áp dụng", note: "Dưới 70%" },
  ],
  situationRules: [
    {
      code: "NORMAL",
      name: "Không có hoạt động đặc biệt",
      days: 0,
      status: "Chưa áp dụng",
      note: "",
    },
    {
      code: "SMALL",
      name: "Hoạt động nhỏ hoặc khách hàng nhỏ tăng lấy hàng",
      days: 2,
      status: "Chưa áp dụng",
      note: "",
    },
    {
      code: "PEAK",
      name: "Khuyến mãi lớn, mùa cao điểm hoặc khách hàng lớn tăng lấy hàng",
      days: 5,
      status: "Chưa áp dụng",
      note: "",
    },
  ],
  createdBy: "vthduyen",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedBy: "vthduyen",
  updatedAt: "2026-01-01T00:00:00.000Z",
  confirmedBy: "admin",
  confirmedAt: "2026-01-01T00:00:00.000Z",
  changeReason: "Khởi tạo quy tắc chuẩn",
};
let safetyRuleSets: SafetyRuleSet[] = [defaultSafetyRuleSet];
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
  const leadTimeDays = lead?.days ?? safetyDaysFromLeadTime(leadTime);
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
    activeSafetyRuleFor(new Date().toISOString().slice(0, 10)),
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
  items: InventorySnapshotItem[];
};
const weekKeyOf = (value: string) => {
  const d = mondayOf(new Date(`${value}T00:00:00`));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const snapshotStockMap = (snapshot?: InventorySnapshot) =>
  new Map((snapshot?.items || []).map((item) => [item.sku, item.totalQty]));
const loadInventorySnapshots = async (): Promise<InventorySnapshot[]> => {
  const response = await fetch("/api/records?entity=inventory_snapshot");
  if (!response.ok) throw new Error("Không thể tải lịch sử chốt tồn");
  const data = await response.json();
  return data.records.map(
    (record: { payload: InventorySnapshot }) => record.payload,
  );
};
const saveInventorySnapshot = async (
  snapshot: InventorySnapshot,
  updatedBy: string,
) => {
  const response = await fetch("/api/records", {
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
};

const skuDetailOverrides: Record<string, Partial<Sku>> = {
  "103S110103": {
    moq: 72,
    mode: "MTO",
    safetyDays: 7,
    leadTime: "3 ngày",
    standardHours: "0.082 giờ/SP",
    unit: "Bộ",
  },
  "103S111101": {
    moq: 24,
    mode: "MTS",
    safetyDays: 7,
    leadTime: "4 ngày",
    standardHours: "0.095 giờ/SP",
    unit: "Bộ",
  },
  "103S205201": {
    moq: 100,
    mode: "MTS",
    safetyDays: 7,
    leadTime: "5 ngày",
    standardHours: "0.104 giờ/SP",
    unit: "Bộ",
  },
  "103S209201": {
    moq: 120,
    mode: "MTS",
    safetyDays: 7,
    leadTime: "5 ngày",
    standardHours: "0.102 giờ/SP",
    unit: "Bộ",
  },
  "103SM00004": {
    moq: 1,
    mode: "MTO",
    safetyDays: 7,
    leadTime: "6 ngày",
    standardHours: "0.115 giờ/SP",
    unit: "Bộ",
  },
};

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
const inHouseProcessingSkus = new Set([
  "3100101",
  "3100811",
  "3100812",
  "3100102",
  "3100822",
  "3100103",
  "3050307B",
  "3040401B",
  "3040305B",
  "3040403B",
]);
const btpAssemblySkus = new Set([
  "102XT06001",
  "102XX04004",
  "3030901",
  "3030902",
  "3040101",
]);
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
      activeSafetyRuleFor(new Date().toISOString().slice(0, 10)),
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
const purchasedSkuCodes = new Set(
  skus
    .filter((item) => item.mode === "Mua hàng")
    .map((item) => item.code.toUpperCase()),
);
const hasProductionProcess = (sku: Sku) =>
  sku.mode !== "Mua hàng" && sku.group !== "GIA CÔNG NGOÀI";

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

const finishedBom: BomItem[] = [
  {
    stt: "0010",
    code: "3020111",
    name: "ZOONG TAY SEN ABS",
    spec: "17*2.2mm, NBR-701",
    waste: "0.000%",
    qty: "1",
    unit: "CÁI",
    source: "Mua",
  },
  {
    stt: "0020",
    code: "3030101",
    name: "DÂY SEN 16mm",
    spec: "10mm Inner hose",
    waste: "0.770%",
    qty: "0.17",
    unit: "KG",
    source: "Tự chế",
  },
  {
    stt: "0030",
    code: "3030204",
    name: "ĐẦU ABS TRẮNG",
    spec: "CTY",
    waste: "0.000%",
    qty: "1",
    unit: "CÁI",
    source: "Mua",
  },
  {
    stt: "0040",
    code: "3030303",
    name: "MÓC PVC TRẮNG",
    spec: "",
    waste: "0.000%",
    qty: "1",
    unit: "CÁI",
    source: "Mua",
  },
  {
    stt: "0050",
    code: "3030402",
    name: "6 GÓC HOA SEN (LOGO)",
    spec: "",
    waste: "0.000%",
    qty: "1",
    unit: "CÁI",
    source: "Tự chế",
  },
  {
    stt: "0060",
    code: "3030602",
    name: "CHỤP HOA SEN INOX",
    spec: "",
    waste: "0.000%",
    qty: "2",
    unit: "CÁI",
    source: "Mua",
  },
  {
    stt: "0070",
    code: "3030701",
    name: "ZOONG 2 LỚP ĐL",
    spec: "",
    waste: "0.000%",
    qty: "1",
    unit: "CÁI",
    source: "Mua",
  },
  {
    stt: "0080",
    code: "3030501",
    name: "ỐC ĐỒNG 1",
    spec: "10.7mm",
    waste: "0.000%",
    qty: "1",
    unit: "CÁI",
    source: "Tự chế",
  },
  {
    stt: "0090",
    code: "3030502",
    name: "ỐC ĐỒNG 2",
    spec: "18mm",
    waste: "0.000%",
    qty: "1",
    unit: "CÁI",
    source: "Tự chế",
  },
  {
    stt: "0100",
    code: "3030914",
    name: "ĐẦU PS M3",
    spec: "",
    waste: "0.000%",
    qty: "1",
    unit: "CÁI",
    source: "Mua",
  },
  {
    stt: "0110",
    code: "3040801",
    name: "ZOONG 14MM VN",
    spec: "2mm (PVC màu trắng)",
    waste: "0.000%",
    qty: "1",
    unit: "CÁI",
    source: "Mua",
  },
  {
    stt: "0120",
    code: "3990102",
    name: "O VÊ 3 LY VN",
    spec: "",
    waste: "0.000%",
    qty: "7",
    unit: "CÁI",
    source: "Mua",
  },
];

const btpBom: Record<string, BomItem[]> = {
  "3030101": [
    {
      stt: "0010",
      code: "202PV016",
      name: "TRẮNG TRONG ABLO1",
      spec: "60%",
      waste: "0.500%",
      qty: "0.46",
      unit: "KG",
      source: "Mua",
    },
    {
      stt: "0020",
      code: "202PV017",
      name: "TRẮNG ĐỤC BW01",
      spec: "55%",
      waste: "0.500%",
      qty: "0.56",
      unit: "KG",
      source: "Mua",
    },
    {
      stt: "0030",
      code: "202FL001",
      name: "CHỈ FILAMENT 630",
      spec: "",
      waste: "0.200%",
      qty: "1",
      unit: "KG",
      source: "Mua",
    },
    {
      stt: "0040",
      code: "203FL006",
      name: "CHỈ FILAMENT 750",
      spec: "",
      waste: "0.200%",
      qty: "0.02",
      unit: "KG",
      source: "Mua",
    },
  ],
  "3030402": [
    {
      stt: "0010",
      code: "3030402B",
      name: "BTP 6 GÓC HOA SEN",
      spec: "Chưa xi",
      waste: "0.000%",
      qty: "1",
      unit: "CÁI",
      source: "Tự chế",
    },
  ],
  "3030501": [
    {
      stt: "0010",
      code: "201TR019",
      name: "TRÒN Φ16 VN",
      spec: "ỐC ĐỒNG 9.5",
      waste: "0.000%",
      qty: "1",
      unit: "CÁI",
      source: "Tự chế",
    },
  ],
  "3030502": [
    {
      stt: "0010",
      code: "201TR020",
      name: "TRÒN Φ17 VN",
      spec: "ỐC ĐỒNG HS 1",
      waste: "0.000%",
      qty: "1",
      unit: "CÁI",
      source: "Tự chế",
    },
  ],
};

function BomView() {
  const [tab, setTab] = useState<"finished" | "btp">("finished");
  const [btpCode, setBtpCode] = useState("3030101");
  const items = tab === "finished" ? finishedBom : (btpBom[btpCode] ?? []);
  const openBtp = (code: string) => {
    setBtpCode(code);
    setTab("btp");
  };
  return (
    <main className="workspace bom-workspace">
      <div className="page-heading bom-heading">
        <div>
          <p className="eyebrow">CẤU TRÚC THÀNH PHẨM / BOM</p>
          <h1>Định mức BOM</h1>
          <p>
            Quản lý vật tư trực tiếp của thành phẩm và BOM riêng cho bán thành
            phẩm tự chế.
          </p>
        </div>
        <button className="primary-button">＋ Tạo BOM</button>
      </div>
      <div className="bom-tabs">
        <button
          className={tab === "finished" ? "active" : ""}
          onClick={() => setTab("finished")}
        >
          BOM Thành phẩm
        </button>
        <button
          className={tab === "btp" ? "active" : ""}
          onClick={() => setTab("btp")}
        >
          BOM BTP
        </button>
      </div>
      <section className="bom-summary bom-summary-expanded">
        <div className="bom-identity">
          <span>{tab === "finished" ? "THÀNH PHẨM" : "BÁN THÀNH PHẨM"}</span>
          <strong>{tab === "finished" ? "103SM31201" : btpCode}</strong>
          <h2>
            {tab === "finished"
              ? "BỘ SEN PS M3"
              : btpCode === "3030101"
                ? "DÂY SEN 16mm"
                : finishedBom.find((x) => x.code === btpCode)?.name}
          </h2>
          <p>
            Quy cách:{" "}
            {tab === "finished"
              ? "LĐ-1.5m"
              : btpCode === "3030101"
                ? "10mm Inner hose"
                : "—"}
          </p>
          <span className="bom-confirmed">● Đã xác nhận</span>
        </div>
        <div className="bom-info-grid">
          <div className="bom-info-group">
            <h3>Thông tin sản xuất</h3>
            <dl>
              <div>
                <dt>Đơn vị</dt>
                <dd>{tab === "finished" ? "BỘ" : "CÁI"}</dd>
              </div>
              <div>
                <dt>Đơn vị nhỏ</dt>
                <dd>—</dd>
              </div>
              <div>
                <dt>Tình trạng</dt>
                <dd>{tab === "finished" ? "M · Tự chế" : "M · Tự chế"}</dd>
              </div>
              <div>
                <dt>Lượng SX ít nhất</dt>
                <dd>1</dd>
              </div>
              <div>
                <dt>Lệnh sản xuất</dt>
                <dd>—</dd>
              </div>
              <div>
                <dt>Ghi chú</dt>
                <dd>—</dd>
              </div>
            </dl>
          </div>
          <div className="bom-info-group">
            <h3>Thiết lập và xác nhận</h3>
            <dl>
              <div>
                <dt>Ngày thay đổi</dt>
                <dd>—</dd>
              </div>
              <div>
                <dt>Ngày thiết lập</dt>
                <dd>22/01/2026</dd>
              </div>
              <div>
                <dt>Ngày chỉnh sửa</dt>
                <dd>22/01/2026</dd>
              </div>
              <div>
                <dt>Ngày xác nhận</dt>
                <dd>22/01/2026</dd>
              </div>
              <div>
                <dt>Người xác nhận</dt>
                <dd>vthduyen</dd>
              </div>
              <div>
                <dt>Trạng thái ký duyệt</dt>
                <dd>Không tiến hành ký duyệt</dd>
              </div>
            </dl>
          </div>
          <div className="bom-info-group compact">
            <h3>Phiên bản</h3>
            <dl>
              <div>
                <dt>Phiên bản</dt>
                <dd>0000</dd>
              </div>
              <div>
                <dt>Số lần in</dt>
                <dd>0</dd>
              </div>
              <div>
                <dt>Số lần chuyển</dt>
                <dd>0</dd>
              </div>
              <div>
                <dt>Mã phiếu đổi</dt>
                <dd>—</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>
      {tab === "btp" && (
        <div className="btp-picker">
          <span>Chọn BOM BTP:</span>
          {Object.keys(btpBom).map((code) => (
            <button
              className={code === btpCode ? "active" : ""}
              key={code}
              onClick={() => setBtpCode(code)}
            >
              {code}
            </button>
          ))}
        </div>
      )}
      <section className="data-card bom-card">
        <div className="result-bar">
          <strong>{items.length}</strong> dòng nguyên vật liệu{" "}
          <span>
            {tab === "finished"
              ? "Mã tự chế có thể mở BOM BTP →"
              : "BOM riêng của bán thành phẩm"}
          </span>
        </div>
        <div className="table-wrap">
          <table className="bom-table">
            <thead>
              <tr>
                <th>STT</th>
                <th>MÃ NVL/BTP</th>
                <th>TÊN</th>
                <th>QUY CÁCH</th>
                <th>HAO HỤT</th>
                <th>LƯỢNG DÙNG</th>
                <th>MẪU SỐ</th>
                <th>NGÀY CÓ HIỆU LỰC</th>
                <th>NGÀY HẾT HIỆU LỰC</th>
                <th>ĐƠN VỊ</th>
                <th>NGUỒN</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={`${item.stt}-${item.code}`}
                  onDoubleClick={() => {
                    if (item.source === "Tự chế" && btpBom[item.code]) openBtp(item.code);
                  }}
                >
                  <td>{item.stt}</td>
                  <td>
                    <button className="sku-link">{item.code}</button>
                  </td>
                  <td className="product-name">{item.name}</td>
                  <td>{item.spec || "—"}</td>
                  <td>{item.waste}</td>
                  <td className="qty-cell">{item.qty}</td>
                  <td>{item.denominator ?? "1"}</td>
                  <td>{item.effective ?? "22/01/2026"}</td>
                  <td>{item.expiry ?? "—"}</td>
                  <td>{item.unit}</td>
                  <td>
                    <span
                      className={`source-badge ${item.source === "Tự chế" ? "make" : "buy"}`}
                    >
                      {item.source === "Tự chế" ? "M · Tự chế" : "P · Mua"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

type BomCatalogRecord = {
  sku: string;
  name: string;
  spec: string;
  unit: string;
  version: string;
  status: string;
  category: string;
  itemType: string;
  setup?: string;
  items: BomItem[];
};
const legacyBomCatalog: Omit<BomCatalogRecord, "category" | "itemType">[] = [
  {
    sku: "102XS02001",
    name: "DÂY XẢ INOX SỌC",
    spec: "14MM 20cm",
    unit: "SỢI",
    version: "2026.01",
    status: "Đang áp dụng",
    items: [
      {
        stt: ".1",
        code: "404XX001",
        name: "TEM BẢO HÀNH 1 NĂM (D)",
        spec: "",
        waste: "—",
        qty: "1",
        unit: "TỜ",
        source: "Mua",
      },
      {
        stt: ".1",
        code: "3060301",
        name: "6 GÓC DÂY XẢ CÓ CHỮ - 37100 NSF",
        spec: "TN GF00102 & NPF00102",
        waste: "—",
        qty: "2",
        unit: "CÁI",
        source: "Mua",
      },
      {
        stt: ".1",
        code: "3060501",
        name: "ỐC ĐỒNG 9.5 (14MM)",
        spec: "",
        waste: "—",
        qty: "2",
        unit: "CÁI",
        source: "Tự chế",
      },
      {
        stt: ".1",
        code: "3060701",
        name: "Zoong EPDM 2mm (EP-701)",
        spec: "TN GF00102 & NPF00102",
        waste: "—",
        qty: "2",
        unit: "CÁI",
        source: "Mua",
      },
      {
        stt: ".1",
        code: "3060105",
        name: "DÂY SỌC 14MM KG",
        spec: "",
        waste: "—",
        qty: "0,027351",
        unit: "KG",
        source: "Tự chế",
      },
      {
        stt: "..2",
        code: "3060202",
        name: "RUỘT DÂY ĐEN 14MM",
        spec: "10mm Inner hose",
        waste: "—",
        qty: "0,01355319",
        unit: "KG",
        source: "Tự chế",
      },
    ],
  },
  {
    sku: "102XS03001",
    name: "DÂY XẢ INOX SỌC",
    spec: "14MM 30cm",
    unit: "SỢI",
    version: "2026.01",
    status: "Đang áp dụng",
    items: [
      {
        stt: ".1",
        code: "404XX001",
        name: "TEM BẢO HÀNH 1 NĂM (D)",
        spec: "",
        waste: "—",
        qty: "1",
        unit: "TỜ",
        source: "Mua",
      },
      {
        stt: ".1",
        code: "3060301",
        name: "6 GÓC DÂY XẢ CÓ CHỮ - 37100 NSF",
        spec: "TN GF00102 & NPF00102",
        waste: "—",
        qty: "2",
        unit: "CÁI",
        source: "Mua",
      },
      {
        stt: ".1",
        code: "407DX001",
        name: "TÚI 30 (7*44)",
        spec: "",
        waste: "—",
        qty: "0,004",
        unit: "KG",
        source: "Mua",
      },
      {
        stt: ".1",
        code: "3060105",
        name: "DÂY SỌC 14MM KG",
        spec: "",
        waste: "—",
        qty: "0,044572",
        unit: "KG",
        source: "Tự chế",
      },
      {
        stt: "..2",
        code: "3060202",
        name: "RUỘT DÂY ĐEN 14MM",
        spec: "10mm Inner hose",
        waste: "—",
        qty: "0,02208668",
        unit: "KG",
        source: "Tự chế",
      },
      {
        stt: "..2",
        code: "203SS001",
        name: "INOX ĐL",
        spec: "",
        waste: "—",
        qty: "0,02026464",
        unit: "KG",
        source: "Mua",
      },
    ],
  },
  {
    sku: "102XS04001",
    name: "DÂY XẢ INOX SỌC",
    spec: "14MM 40cm",
    unit: "SỢI",
    version: "2026.01",
    status: "Đang áp dụng",
    items: [
      {
        stt: ".1",
        code: "404XX001",
        name: "TEM BẢO HÀNH 1 NĂM (D)",
        spec: "",
        waste: "—",
        qty: "1",
        unit: "TỜ",
        source: "Mua",
      },
      {
        stt: ".1",
        code: "3060301",
        name: "6 GÓC DÂY XẢ CÓ CHỮ - 37100 NSF",
        spec: "TN GF00102 & NPF00102",
        waste: "—",
        qty: "2",
        unit: "CÁI",
        source: "Mua",
      },
      {
        stt: ".1",
        code: "403DX004",
        name: "NHÃN DÂY XẢ 40cm",
        spec: "",
        waste: "—",
        qty: "1",
        unit: "TỜ",
        source: "Mua",
      },
      {
        stt: ".1",
        code: "3060105",
        name: "DÂY SỌC 14MM KG",
        spec: "",
        waste: "—",
        qty: "0,06078",
        unit: "KG",
        source: "Tự chế",
      },
      {
        stt: "..2",
        code: "3060202",
        name: "RUỘT DÂY ĐEN 14MM",
        spec: "10mm Inner hose",
        waste: "—",
        qty: "0,0301182",
        unit: "KG",
        source: "Tự chế",
      },
      {
        stt: "..2",
        code: "203SS001",
        name: "INOX ĐL",
        spec: "",
        waste: "—",
        qty: "0,0276336",
        unit: "KG",
        source: "Mua",
      },
    ],
  },
  {
    sku: "102XS05001",
    name: "DÂY XẢ INOX SỌC",
    spec: "14MM 50cm",
    unit: "SỢI",
    version: "2026.01",
    status: "Đang áp dụng",
    items: [
      {
        stt: ".1",
        code: "404XX001",
        name: "TEM BẢO HÀNH 1 NĂM (D)",
        spec: "",
        waste: "—",
        qty: "1",
        unit: "TỜ",
        source: "Mua",
      },
      {
        stt: ".1",
        code: "407DX003",
        name: "TÚI 50 (7*62)",
        spec: "",
        waste: "—",
        qty: "0,0057",
        unit: "KG",
        source: "Mua",
      },
      {
        stt: ".1",
        code: "401DX009",
        name: "THÙNG DÂY XẢ 60mm 2013",
        spec: "",
        waste: "—",
        qty: "0,005",
        unit: "CÁI",
        source: "Mua",
      },
      {
        stt: ".1",
        code: "3060105",
        name: "DÂY SỌC 14MM KG",
        spec: "",
        waste: "—",
        qty: "0,075975",
        unit: "KG",
        source: "Tự chế",
      },
      {
        stt: "..2",
        code: "3060202",
        name: "RUỘT DÂY ĐEN 14MM",
        spec: "10mm Inner hose",
        waste: "—",
        qty: "0,03764775",
        unit: "KG",
        source: "Tự chế",
      },
      {
        stt: "..2",
        code: "203CU001",
        name: "CHỈ CU VÀNG",
        spec: "",
        waste: "—",
        qty: "0,003636",
        unit: "KG",
        source: "Mua",
      },
    ],
  },
  {
    sku: "102XS06001",
    name: "DÂY XẢ INOX SỌC",
    spec: "14MM 60cm",
    unit: "SỢI",
    version: "2026.01",
    status: "Đang áp dụng",
    items: [
      {
        stt: ".1",
        code: "404XX001",
        name: "TEM BẢO HÀNH 1 NĂM (D)",
        spec: "",
        waste: "—",
        qty: "1",
        unit: "TỜ",
        source: "Mua",
      },
      {
        stt: ".1",
        code: "3060301",
        name: "6 GÓC DÂY XẢ CÓ CHỮ - 37100 NSF",
        spec: "TN GF00102 & NPF00102",
        waste: "—",
        qty: "2",
        unit: "CÁI",
        source: "Mua",
      },
      {
        stt: ".1",
        code: "407DX004",
        name: "TÚI 60 (7*72)",
        spec: "",
        waste: "—",
        qty: "0,0071",
        unit: "KG",
        source: "Mua",
      },
      {
        stt: ".1",
        code: "3060105",
        name: "DÂY SỌC 14MM KG",
        spec: "",
        waste: "—",
        qty: "0,09117",
        unit: "KG",
        source: "Tự chế",
      },
      {
        stt: "..2",
        code: "3060202",
        name: "RUỘT DÂY ĐEN 14MM",
        spec: "10mm Inner hose",
        waste: "—",
        qty: "0,0451773",
        unit: "KG",
        source: "Tự chế",
      },
      {
        stt: "..2",
        code: "203SS001",
        name: "INOX ĐL",
        spec: "",
        waste: "—",
        qty: "0,0414504",
        unit: "KG",
        source: "Mua",
      },
    ],
  },
];

let bomCatalog = (bomData as BomCatalogRecord[])
  .filter((row) => !purchasedSkuCodes.has(row.sku.toUpperCase()))
  .map((row) => ({
    ...row,
    status: "Đã xác nhận",
  }));
const bomMasterOptions = Array.from(
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

function BomLookupView() {
  const setupDateDisplay = new Date().toLocaleDateString("en-GB", { timeZone: "Asia/Ho_Chi_Minh" });
  const [query, setQuery] = useState("");
  const [searchMode, setSearchMode] = useState<
    "parentSku" | "parentName" | "componentSku"
  >("parentSku");
  const [selected, setSelected] = useState<BomCatalogRecord | null>(null);
  const [mode, setMode] = useState<"view" | "edit" | "create">("view");
  const [confirmed, setConfirmed] = useState(true);
  const [notice, setNotice] = useState("");
  const [showMeta, setShowMeta] = useState(true);
  const [confirmedBy, setConfirmedBy] = useState("vthduyen");
  const [suggestRow, setSuggestRow] = useState<number | null>(null);
  const [parentSuggestOpen, setParentSuggestOpen] = useState(false);
  const [parentSkuError, setParentSkuError] = useState("");
  const [editingBomSku, setEditingBomSku] = useState("");
  const [highlighted, setHighlighted] = useState<BomCatalogRecord | null>(null);
  const [statusFilter, setStatusFilter] = useState("Tất cả");
  const [searchOpen, setSearchOpen] = useState(false);
  const [pendingChangeSkus, setPendingChangeSkus] = useState<Set<string>>(new Set());
  useEffect(() => {
    fetch("/api/records?entity=bom_change")
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => setPendingChangeSkus(new Set(data.records
        .map((record: { payload: BomChangeHistory }) => record.payload)
        .filter((record: BomChangeHistory) => record.status === "Nháp" || record.status === "Chờ xác nhận")
        .map((record: BomChangeHistory) => record.sku))))
      .catch(() => {});
  }, []);
  const displayStatus = (record: BomCatalogRecord) => pendingChangeSkus.has(record.sku)
    ? "Có thay đổi chờ xác nhận"
    : record.status;
  const filtered = bomCatalog.filter((x) => {
    const keyword = query.trim().toLowerCase();
    const matchesStatus = statusFilter === "Tất cả" || displayStatus(x) === statusFilter;
    if (!matchesStatus) return false;
    if (searchMode === "parentSku") return x.sku.toLowerCase().startsWith(keyword);
    if (searchMode === "parentName") return x.name.toLowerCase().includes(keyword);
    return x.items.some((item) => item.code.toLowerCase().startsWith(keyword));
  }).sort((a, b) => a.category.localeCompare(b.category, "vi", { numeric: true }) || a.sku.localeCompare(b.sku, "vi", { numeric: true }));
  const openBom = (record: BomCatalogRecord) => {
    setSelected(record);
    setSearchOpen(false);
    setQuery("");
    setMode("view");
    const isConfirmed = record.status === "Đã xác nhận";
    setConfirmed(isConfirmed);
    setConfirmedBy(isConfirmed ? "vthduyen" : "");
    setNotice("");
    setShowMeta(true);
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
          qty: "1",
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
    const validationError = getParentSkuError(selected?.sku || "");
    if (validationError) {
      setParentSkuError(validationError);
      return;
    }
    if (!selected?.sku || !selected?.name) {
      setNotice("Vui lòng nhập Mã SKU và Tên thành phẩm trước khi gửi xác nhận.");
      return;
    }
    if (purchasedSkuCodes.has(selected.sku.toUpperCase())) {
      setNotice("SKU mua hàng không được phép thiết lập BOM.");
      return;
    }
    const saved = { ...selected, status: "Chờ xác nhận" };
    const response = await fetch("/api/records", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entity: "bom",
        key: saved.sku,
        payload: saved,
        updatedBy: "vthduyen",
      }),
    });
    if (!response.ok) {
      setNotice("Không thể lưu BOM vào dữ liệu dùng chung. Vui lòng thử lại.");
      return;
    }
    bomCatalog = bomCatalog.some((item) => item.sku === saved.sku)
      ? bomCatalog.map((item) => (item.sku === saved.sku ? saved : item))
      : [...bomCatalog, saved];
    setSelected(saved);
    setConfirmed(false);
    setConfirmedBy("");
    setMode("view");
    setNotice("BOM đã được gửi xác nhận. Dữ liệu chưa được áp dụng cho đến khi người có quyền xác nhận trên thanh công cụ.");
  };
  const unconfirmBom = () => {
    setConfirmed(false);
    setConfirmedBy("");
    setNotice("Đã hủy xác nhận để có thể điều chỉnh BOM.");
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
                qty: "1",
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
                  category: found.group,
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
          .querySelector<HTMLInputElement>(`[data-bom-code-row="${index + 1}"]`)
          ?.focus(),
      0,
    );
  };
  const toolbar = (detail = false) => {
    const actionRecord = selected || highlighted;
    const actionStatus = actionRecord ? displayStatus(actionRecord) : "";
    return (
    <div className="bom-commandbar" aria-label="Thao tác BOM">
      <button className="bom-command create" onClick={createBom}>
        <span>＋</span>Thêm mới
      </button>
      <button
        className="bom-command"
        disabled={!actionRecord || mode === "create"}
        onClick={() => {
          if (!actionRecord) return;
          setSelected(actionRecord);
          setConfirmed(actionRecord.status === "Đã xác nhận");
          setEditingBomSku(
            actionRecord.status === "Đã xác nhận" ? "" : actionRecord.sku,
          );
          setParentSkuError("");
          setMode(actionRecord.status === "Đã xác nhận" ? "edit" : "create");
        }}
      ><span>✎</span>Sửa</button>
      <button className="bom-command" onClick={() => {
        setSelected(null);
        setHighlighted(null);
        setMode("view");
        setQuery("");
        setNotice("");
        setSearchOpen(true);
      }}>
        <span>⌕</span>Tra cứu
      </button>
      <button className="bom-command confirm" disabled={!actionRecord || !["Chờ xác nhận", "Có thay đổi chờ xác nhận"].includes(actionStatus)}>
        <span>✓</span>Xác nhận
      </button>
      <button className="bom-command cancel-confirm" disabled={!actionRecord || actionRecord.status !== "Đã xác nhận"}>
        <span>↶</span>Hủy xác nhận
      </button>
      <i />
      {detail && mode !== "create" ? (
        <span className="bom-readonly-rule">
          Chọn Sửa để lập Phiếu thay đổi BOM ngay tại đây
        </span>
      ) : null}
    </div>
  )};
  const searchBar = (detail = false) => (
    <section
      className={`data-card bom-search-card${detail ? " in-detail" : ""}`}
    >
      <div className="bom-searchbar">
        <label className="bom-search-mode">
          <span>TRA THEO</span>
          <select
            value={searchMode}
            onChange={(e) =>
              setSearchMode(
                e.target.value as "parentSku" | "parentName" | "componentSku",
              )
            }
          >
            <option value="parentSku">SKU thành phẩm / BTP</option>
            <option value="parentName">Tên thành phẩm / BTP</option>
            <option value="componentSku">SKU linh kiện trong BOM</option>
          </select>
        </label>
        <label>
          <span>
            {searchMode === "parentSku"
              ? "SKU THÀNH PHẨM / BTP"
              : searchMode === "parentName"
                ? "TÊN THÀNH PHẨM / BTP"
                : "SKU LINH KIỆN"}
          </span>
          <div>
            ⌕
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  openSearchedBom();
                }
              }}
              placeholder={
                searchMode === "parentSku"
                  ? "Nhập SKU thành phẩm / BTP"
                  : searchMode === "parentName"
                    ? "Nhập tên thành phẩm / BTP"
                    : "Nhập SKU linh kiện"
              }
            />
          </div>
        </label>
        <label className="bom-status-filter">
          <span>TRẠNG THÁI BOM</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option>Tất cả</option><option>Đã xác nhận</option><option>Chờ xác nhận</option><option>Nháp</option><option>Có thay đổi chờ xác nhận</option><option>Cần kiểm tra</option>
          </select>
        </label>
        <span>
          {query.trim()
            ? `${filtered.length} BOM phù hợp`
            : `${bomCatalog.length} BOM`}
        </span>
      </div>
      {detail && query.trim() && (
        <div className="table-wrap bom-search-results">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>TÊN SẢN PHẨM / BTP</th>
                <th>QUY CÁCH</th>
                <th>PHÂN LOẠI</th>
                <th>ĐƠN VỊ</th>
                <th>LINH KIỆN KHỚP</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 20).map((row) => (
                <tr key={row.sku} onClick={() => openBom(row)}>
                  <td>
                    <button type="button" className="sku-link">
                      {row.sku}
                    </button>
                  </td>
                  <td>{row.name}</td>
                  <td>{row.spec || "—"}</td>
                  <td>{row.category}</td>
                  <td>{row.unit}</td>
                  <td>
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="bom-no-result">Không tìm thấy BOM phù hợp.</p>
          )}
        </div>
      )}
    </section>
  );
  if (selected && !searchOpen && mode === "edit")
    return <BomChangeContent initialSku={selected.sku} embedded onClose={(savedStatus) => { if (savedStatus) setPendingChangeSkus((current) => new Set(current).add(selected.sku)); setMode("view"); setSelected(null); }} />;
  if (selected && !searchOpen)
    return (
      <main
        key="bom-detail"
        className="workspace bom-workspace"
      >
        <button className="bom-back-button" onClick={() => { setSelected(null); setMode("view"); setNotice(""); }}>← Trở về danh sách BOM</button>
        {mode !== "create" && toolbar(true)}
        {mode !== "create" && searchOpen && searchBar(true)}
        <section className="bom-detail-information">
        {mode === "create" && <section className="bom-detail-head">
          <div className="bom-code-entry bom-parent-entry">
            <span>SKU</span>
            {mode === "create" ? (
              <>
                <input
                  value={selected.sku}
                  onFocus={() => setParentSuggestOpen(true)}
                  onBlur={() => setTimeout(() => {
                    setParentSuggestOpen(false);
                    validateParentSku(selected.sku);
                  }, 150)}
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
                      .filter((item) => `${item.code} ${item.name}`.toLowerCase().includes(selected.sku.trim().toLowerCase()))
                      .slice(0, 8)
                      .map((item) => (
                        <button
                          type="button"
                          key={item.code}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            selectParentSku(item.code);
                            setParentSuggestOpen(false);
                            validateParentSku(item.code);
                          }}
                        >
                          <b>{item.code}</b><span>{item.name}</span><small>{item.specification || "—"}</small>
                        </button>
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
              <select
                value={selected.unit}
                disabled
              >
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
          <div>
            <span>TRẠNG THÁI</span>
            <strong
              className={confirmed ? "status-confirmed" : "status-unconfirmed"}
            >
              {confirmed ? "Đã xác nhận" : selected.status}
            </strong>
          </div>
        </section>}
        {mode === "create" && parentSkuError && (
          <div className="bom-parent-error">{parentSkuError}</div>
        )}
        {notice && <div className={`bom-action-notice ${mode}`}>{notice}</div>}
        {showMeta && (
          <section className="bom-summary bom-summary-expanded bom-meta-panel">
            <div className="bom-info-grid">
              {mode !== "create" && (
                <div className="bom-info-group bom-basic-info">
                  <h3>Thông tin BOM</h3>
                  <dl>
                    <div><dt>SKU</dt><dd className="master-sku">{selected.sku}</dd></div>
                    <div><dt>Tên sản phẩm / BTP</dt><dd>{selected.name}</dd></div>
                    <div><dt>Quy cách</dt><dd>{selected.spec || "—"}</dd></div>
                    <div><dt>Nhóm sản phẩm</dt><dd>{selected.category || "—"}</dd></div>
                    <div><dt>Đơn vị</dt><dd>{selected.unit}</dd></div>
                    <div><dt>Trạng thái</dt><dd className={confirmed ? "status-confirmed" : "status-unconfirmed"}>{confirmed ? "Đã xác nhận" : selected.status}</dd></div>
                  </dl>
                </div>
              )}
              <div className="bom-info-group">
                <h3>Thông tin sản xuất</h3>
                <dl>
                  <div>
                    <dt>Đơn vị</dt>
                    <dd>{selected.unit}</dd>
                  </div>
                  <div>
                    <dt>Đơn vị nhỏ</dt>
                    <dd>—</dd>
                  </div>
                  <div>
                    <dt>Tình trạng</dt>
                    <dd>{selected.itemType}</dd>
                  </div>
                  <div>
                    <dt>Lượng SX ít nhất</dt>
                    <dd>1</dd>
                  </div>
                  <div>
                    <dt>Lệnh sản xuất</dt>
                    <dd>—</dd>
                  </div>
                  <div>
                    <dt>Ghi chú</dt>
                    <dd>
                      {selected.status === "Cần kiểm tra"
                        ? "Có định mức chênh lệch cần duyệt"
                        : "Dữ liệu tách từ BOM tổng hợp"}
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="bom-info-group">
                <h3>Thiết lập và xác nhận</h3>
                <dl>
                  <div>
                    <dt>Ngày thay đổi</dt>
                    <dd>—</dd>
                  </div>
                  <div>
                    <dt>Ngày thiết lập</dt>
                    <dd>{selected.setup || "05/09/2026"}</dd>
                  </div>
                  <div>
                    <dt>Ngày chỉnh sửa</dt>
                    <dd>{selected.setup || "05/09/2026"}</dd>
                  </div>
                  <div>
                    <dt>Ngày xác nhận</dt>
                    <dd>{confirmed ? "05/09/2026" : "—"}</dd>
                  </div>
                  <div>
                    <dt>Người xác nhận</dt>
                    <dd>{confirmed ? confirmedBy : "—"}</dd>
                  </div>
                  <div>
                    <dt>Trạng thái ký duyệt</dt>
                    <dd>{confirmed ? "Đã xác nhận" : "Chưa xác nhận"}</dd>
                  </div>
                </dl>
              </div>
              <div className="bom-info-group compact">
                <h3>Phiên bản</h3>
                <dl>
                  <div>
                    <dt>Phiên bản</dt>
                    <dd>{selected.version}</dd>
                  </div>
                  <div>
                    <dt>Số lần in</dt>
                    <dd>0</dd>
                  </div>
                  <div>
                    <dt>Số lần chuyển</dt>
                    <dd>0</dd>
                  </div>
                  <div>
                    <dt>Mã phiếu đổi</dt>
                    <dd>—</dd>
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
          <div className="table-wrap">
            <table className="bom-table" data-page-size="20">
              <thead>
                <tr>
                  <th>STT</th>
                  <th>MÃ NVL/BTP</th>
                  <th>TÊN</th>
                  <th>QUY CÁCH</th>
                  <th>HAO HỤT</th>
                  <th>LƯỢNG DÙNG</th>
                  <th>MẪU SỐ</th>
                  <th>{mode === "create" ? "NGÀY THIẾT LẬP" : "NGÀY CÓ HIỆU LỰC"}</th>
                  <th>NGÀY HẾT HIỆU LỰC</th>
                  <th>ĐƠN VỊ</th>
                  <th>NGUỒN</th>
                  {mode === "create" && <th></th>}
                </tr>
              </thead>
              <tbody>
                {selected.items.map((item, i) => {
                  const editable = mode === "create" || mode === "edit";
                  return (
                    <tr
                      key={`${item.stt}-${i}`}
                      onDoubleClick={() => {
                        const next = bomCatalog.find((x) => x.sku === item.code);
                        if (!editable && next) openBom(next);
                      }}
                    >
                      <td>{item.stt}</td>
                      <td>
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
                                      <button
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
                                      </button>
                                    ))}
                                </div>
                              )}
                          </div>
                        ) : (
                          <button className="sku-link">{item.code}</button>
                        )}
                      </td>
                      <td className="product-name">
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
                      </td>
                      <td>
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
                      </td>
                      <td>
                        {editable ? (
                          <input className="bom-cell-input number" value={item.waste === "—" ? "" : item.waste} onChange={(e) => updateItem(i, "waste", e.target.value)} placeholder="Có thể để trống" />
                        ) : (item.waste || "—")}
                      </td>
                      <td className="qty-cell">
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
                      </td>
                      <td>
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
                      </td>
                      <td>
                        {editable ? (
                          <input
                            className="bom-cell-input date"
                            value={item.setup ?? setupDateDisplay}
                            readOnly
                          />
                        ) : (
                          (item.effective ?? "—")
                        )}
                      </td>
                      <td>{item.expiry ?? "—"}</td>
                      <td>{item.unit}</td>
                      <td>
                        {item.source ? (
                          <span className={`source-badge ${item.source === "Tự chế" ? "make" : item.source === "Ủy thác" ? "outsourced" : "buy"}`}>
                            {item.source === "Tự chế" ? "M · Tự chế" : item.source === "Ủy thác" ? "O · Ủy thác" : "P · Mua"}
                          </span>
                        ) : "—"}
                      </td>
                      {editable && (
                        <td>
                          <button className="bom-remove-row" onClick={() => removeItem(i)}>×</button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {mode === "create" && (
            <div className="document-footer-actions bom-create-footer">
              <button className="outline-button" onClick={cancelAction}>Hủy</button>
              <button className="primary-button" disabled={Boolean(parentSkuError)} onClick={confirmBom}>Lưu</button>
            </div>
          )}
        </section>
      </main>
    );
  return (
    <main key="bom-lookup" className="workspace bom-workspace">
      {toolbar(false)}
      <section className="data-card bom-lookup-card">
        {searchOpen && searchBar()}
        <div className="table-wrap">
          <table className="bom-catalog-table" data-page-size="20">
            <thead>
              <tr>
                <th>SKU</th>
                <th>TÊN SẢN PHẨM / BTP</th>
                <th>PHÂN LOẠI</th>
                <th>QUY CÁCH</th>
                <th>ĐƠN VỊ</th>
                <th>PHIÊN BẢN</th>
                <th>TRẠNG THÁI</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.sku} className={highlighted?.sku === row.sku ? "selected-row" : ""} onClick={() => setHighlighted(row)} onDoubleClick={() => openBom(row)}>
                  <td>
                    <button className="sku-link">{row.sku}</button>
                  </td>
                  <td>{row.name}</td>
                  <td>{row.category}</td>
                  <td>{row.spec}</td>
                  <td>{row.unit}</td>
                  <td>{row.version}</td>
                  <td>
                    <span
                      className={
                        displayStatus(row) === "Cần kiểm tra"
                          ? "change-badge"
                          : "pending-badge"
                      }
                    >
                      {displayStatus(row)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

type PlanRow = {
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
};

type EngineMetric = {
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
) {
  const weekStart = mondayOf(new Date(`${weekValue}T00:00:00`));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const thursday = new Date(weekStart);
  thursday.setDate(thursday.getDate() + 3);
  const month = `${String(thursday.getMonth() + 1).padStart(2, "0")}/${thursday.getFullYear()}`;
  const master = new Map(skus.map((s) => [s.code.toUpperCase(), s]));
  const metrics = new Map<string, EngineMetric>();
  const rows: PlanRow[] = [];
  forecasts
    .filter((f) => f.month === month && master.has(f.sku.toUpperCase()))
    .forEach((f, index) => {
      const sku = f.sku.toUpperCase();
      const item = master.get(sku)!;
      const relevant = events.filter(
        (e) =>
          e.sku.toUpperCase() === sku &&
          e.status.toUpperCase() === "CHƯA LẬP KẾ HOẠCH",
      );
      const eventQty = relevant
        .filter((e) => {
          if (e.type !== "Phát sinh") return false;
          const d = parseViDate(e.delivery);
          return !!d && d >= weekStart && d <= weekEnd;
        })
        .reduce((s, e) => s + Number(e.qty || 0), 0);
      const fillQty = relevant
        .filter((e) => e.type === "Bù tải")
        .reduce((s, e) => s + Number(e.qty || 0), 0);
      const eventWeek = eventQty + fillQty;
      const legacy = forecastData[sku];
      const stock = stockBySku.get(sku) || 0;
      const inTransit = legacy?.wip || 0;
      const savedLead = leadtimeBySku.get(sku);
      const leadTime =
        savedLead?.leadTime ??
        (Number.parseFloat(item.leadTime) || legacy?.lead || 0);
      const safety = safetyBreakdown(leadTime, rule);
      const safetyDays = safety.total;
      const moq = savedLead?.moq ?? (Number(item.moq) || legacy?.moq || 0);
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
        group: f.group || item.group,
        suggested: Math.round(afterMoq * 100) / 100,
        plan: Math.round(afterMoq * 100) / 100,
        line: f.line || item.line,
        start: formatViDate(weekStart),
        end: formatViDate(weekEnd),
        priority,
        type: "Tuần chính",
        status:
          priority === "KHÔNG BỔ SUNG"
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
        reason,
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
    metrics,
    month,
    weekLabel: `${formatViDate(weekStart)}–${formatViDate(weekEnd)}`,
  };
}

const proposalRows: PlanRow[] = [
  {
    id: "PL-20260831-001",
    sku: "102XS04001",
    name: "DÂY XẢ INOX SỌC",
    spec: "14MM 40cm",
    group: "DÂY INOX SỌC",
    suggested: 2000,
    plan: 2000,
    line: "A",
    start: "31/08/2026",
    end: "01/09/2026",
    priority: "Cao – ROP",
    type: "Tuần chính",
    status: "Chưa đưa vào kế hoạch",
  },
  {
    id: "PL-20260831-002",
    sku: "102XT08001",
    name: "DÂY XẢ PVC TRẮNG",
    spec: "LN 80CM",
    group: "DÂY XẢ PVC",
    suggested: 1500,
    plan: 1500,
    line: "A",
    start: "01/09/2026",
    end: "02/09/2026",
    priority: "Cao – Event",
    type: "Tuần chính",
    status: "Chưa đưa vào kế hoạch",
  },
  {
    id: "PL-20260831-003",
    sku: "103SM00102",
    name: "BỘ SEN PS M1 INOX",
    spec: "1.5m",
    group: "BỘ SEN",
    suggested: 600,
    plan: 600,
    line: "A",
    start: "02/09/2026",
    end: "03/09/2026",
    priority: "Bù tải",
    type: "Gối đầu",
    status: "Chưa đưa vào kế hoạch",
  },
  {
    id: "PL-20260831-004",
    sku: "107P5127",
    name: "VAN PHAO NHỰA (ngang) - nổi",
    spec: '3/4"',
    group: "VP TM",
    suggested: 4800,
    plan: 4800,
    line: "B",
    start: "31/08/2026",
    end: "03/09/2026",
    priority: "Khẩn – Event",
    type: "Tuần chính",
    status: "Chưa đưa vào kế hoạch",
  },
  {
    id: "PL-20260831-005",
    sku: "107N03402",
    name: "VAN NHỰA ONSPA TAY INOX",
    spec: '1 1/4"',
    group: "THÀNH PHẨM KHÁC",
    suggested: 0,
    plan: 0,
    line: "B",
    start: "",
    end: "",
    priority: "KHÔNG BỔ SUNG",
    type: "Tuần chính",
    status: "Không bổ sung",
  },
];

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
> = {
  "102XS04001": {
    f30: 12000,
    f60: 28000,
    f90: 40500,
    d30: 545,
    d60: 636,
    d90: 614,
    used: 636,
    event: 0,
    stock: 4000,
    wip: 2000,
    lead: 5,
    safety: 7,
    moq: 500,
    rop: 7632,
    hours: 0.045,
    warning: "60D tăng 16,7%",
  },
  "102XT08001": {
    f30: 9000,
    f60: 21600,
    f90: 31500,
    d30: 409,
    d60: 491,
    d90: 477,
    used: 491,
    event: 1500,
    stock: 2500,
    wip: 1000,
    lead: 4,
    safety: 7,
    moq: 500,
    rop: 5401,
    hours: 0.052,
    warning: "Có Event 60D",
  },
  "103SM00102": {
    f30: 4800,
    f60: 9200,
    f90: 13200,
    d30: 218,
    d60: 209,
    d90: 200,
    used: 218,
    event: 600,
    stock: 2300,
    wip: 0,
    lead: 6,
    safety: 7,
    moq: 200,
    rop: 2834,
    hours: 0.115,
    warning: "Ổn định",
  },
  "107P5127": {
    f30: 19200,
    f60: 38400,
    f90: 57600,
    d30: 873,
    d60: 873,
    d90: 873,
    used: 873,
    event: 4800,
    stock: 6200,
    wip: 4800,
    lead: 7,
    safety: 7,
    moq: 1200,
    rop: 12222,
    hours: 0.028,
    warning: "Đơn phát sinh gấp",
  },
  "107N03402": {
    f30: 0,
    f60: 0,
    f90: 0,
    d30: 0,
    d60: 0,
    d90: 0,
    used: 0,
    event: 0,
    stock: 739,
    wip: 0,
    lead: 3,
    safety: 7,
    moq: 1,
    rop: 0,
    hours: 0.02,
    warning: "Ổn định",
  },
};

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
      <div className="plan-toolbar">
        <div>
          <strong>
            05_PRODUCTION_ENGINE · Đề xuất bổ sung sản xuất theo tuần
          </strong>
          <span>Tuần 24/08–30/08/2026 · Forecast áp dụng 08/2026</span>
        </div>
        <div className="metric">
          <b>4</b>
          <small>Cần bổ sung</small>
        </div>
        <div className="metric">
          <b>8.900</b>
          <small>SL sau MOQ</small>
        </div>
      </div>
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
      <div className="table-wrap">
        <table className="engine-table">
          <thead>
            <tr>
              <th>TUẦN KẾ HOẠCH</th>
              <th>MONTH</th>
              <th>SKU</th>
              <th>TÊN SẢN PHẨM</th>
              <th>QUY CÁCH</th>
              <th>NHÓM SP</th>
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
              <th>ƯU TIÊN</th>
              <th>LÝ DO</th>
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
                  <td>24/08/2026</td>
                  <td>08/2026</td>
                  <td>
                    <button
                      className="plan-sku calc-link"
                      onClick={() => onCalc(r.sku)}
                    >
                      {r.sku}
                    </button>
                  </td>
                  <td>
                    <strong>{r.name}</strong>
                  </td>
                  <td>{r.spec}</td>
                  <td>{r.group}</td>
                  <td>{r.line}</td>
                  <td className="number engine-demand">
                    {f.used.toLocaleString("vi-VN")}
                  </td>
                  <td className="number">{f.event.toLocaleString("vi-VN")}</td>
                  <td className="number engine-supply">
                    {f.stock.toLocaleString("vi-VN")}
                  </td>
                  <td className="number engine-supply">
                    {f.wip.toLocaleString("vi-VN")}
                  </td>
                  <td className="number">{f.lead.toFixed(2)}</td>
                  <td className="number">{f.safety.toFixed(2)}</td>
                  <td className="number engine-rop">
                    {f.rop.toLocaleString("vi-VN")}
                  </td>
                  <td>
                    <span className="need-yes">YES</span>
                  </td>
                  <td className="number">
                    {r.suggested.toLocaleString("vi-VN")}
                  </td>
                  <td className="number">{f.moq.toLocaleString("vi-VN")}</td>
                  <td className="number engine-result">
                    {r.suggested.toLocaleString("vi-VN")}
                  </td>
                  <td>
                    <span
                      className={`priority ${r.priority.includes("Khẩn") ? "urgent" : r.priority === "Bù tải" ? "load" : ""}`}
                    >
                      {r.priority.toUpperCase()}
                    </span>
                  </td>
                  <td className="reason-cell" title={reason}>
                    {reason}
                  </td>
                  <td>
                    <div className="proposal-actions">
                      <button
                        className="calc-button"
                        onClick={() => onCalc(r.sku)}
                      >
                        Xem cách tính
                      </button>
                      <button
                        className="row-action"
                        disabled={r.status !== "Chưa đưa vào kế hoạch"}
                        onClick={() => onMove(r.id)}
                      >
                        Đưa vào 06 →
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="engine-footnote">
        <b>Đúng theo Sheet 05:</b> Forecast chi tiết nằm ở trang Base Forecast;
        05 chỉ lấy Daily Demand để tính cùng Demand Event, tồn ERP, đang đi,
        Lead Time, Safety Days, ROP và MOQ.
      </div>
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
  safetyRule,
}: {
  rows: PlanRow[];
  metrics: Map<string, EngineMetric>;
  week: string;
  onWeekChange: (value: string) => void;
  onCalc: (sku: string) => void;
  onMove: (id: string) => void;
  snapshot?: InventorySnapshot;
  snapshotsLoaded: boolean;
  safetyRule?: SafetyRuleSet;
}) {
  const [draftWeek, setDraftWeek] = useState(week);
  const [skuQuery, setSkuQuery] = useState("");
  const visibleRows = rows.filter((r) =>
    `${r.sku} ${r.name} ${r.spec}`
      .toLocaleLowerCase("vi")
      .includes(skuQuery.trim().toLocaleLowerCase("vi")),
  );
  const locked = !snapshotsLoaded || !snapshot;
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
  const draftStart = mondayOf(new Date(`${draftWeek}T00:00:00`));
  const draftEnd = new Date(draftStart);
  draftEnd.setDate(draftEnd.getDate() + 6);
  const updateWeek = () => {
    const normalized = `${draftStart.getFullYear()}-${String(draftStart.getMonth() + 1).padStart(2, "0")}-${String(draftStart.getDate()).padStart(2, "0")}`;
    setDraftWeek(normalized);
    onWeekChange(normalized);
  };
  const toggle = (id: string) =>
    setSelected((v) =>
      v.includes(id) ? v.filter((x) => x !== id) : [...v, id],
    );
  const moveBulk = () => {
    selected.forEach(onMove);
    setSelected([]);
  };
  const selectedQty = rows
    .filter((r) => selected.includes(r.id))
    .reduce((s, r) => s + r.suggested, 0);
  return (
    <section className="data-card engine-view bulk-engine">
      <div className="engine-update-bar">
        <label>
          <span>NGÀY BẮT ĐẦU TUẦN (THỨ HAI)</span>
          <input
            type="date"
            value={draftWeek}
            onChange={(e) => setDraftWeek(e.target.value)}
          />
        </label>
        <div>
          <span>NGÀY KẾT THÚC TUẦN (CHỦ NHẬT)</span>
          <b>{formatViDate(draftEnd)}</b>
        </div>
        <button
          className="primary-button"
          disabled={!draftWeek || !snapshotsLoaded}
          onClick={updateWeek}
        >
          ↻ Cập nhật dữ liệu tuần
        </button>
        <label className="engine-sku-search">
          <span>TRA SKU</span>
          <div>
            ⌕
            <input
              value={skuQuery}
              onChange={(e) => setSkuQuery(e.target.value)}
              placeholder="Nhập mã SKU, tên hoặc quy cách..."
            />
          </div>
        </label>
      </div>
      {!snapshotsLoaded ? (
        <div className="snapshot-engine-alert">
          Đang kiểm tra dữ liệu tồn kho chốt của tuần...
        </div>
      ) : !snapshot ? (
        <div className="snapshot-engine-alert error">
          Chưa có dữ liệu tồn kho chốt cho tuần {formatViDate(draftStart)}–
          {formatViDate(draftEnd)}. Vui lòng yêu cầu Kho chốt tồn trước khi cập
          nhật Production_engine.
        </div>
      ) : (
        <div className="snapshot-engine-info">
          <span>
            <small>MÃ CHỐT TỒN</small>
            <b>{snapshot.code}</b>
          </span>
          <span>
            <small>THỜI ĐIỂM CHỐT</small>
            <b>{formatDateTimeDisplay(snapshot.snapshotAt)}</b>
          </span>
          <span>
            <small>NGƯỜI CHỐT</small>
            <b>{snapshot.createdBy}</b>
          </span>
          <span>
            <small>TRẠNG THÁI</small>
            <b>{snapshot.status}</b>
          </span>
        </div>
      )}
      <div className="plan-toolbar">
        <div>
          <strong>
            05_PRODUCTION_ENGINE · Đề xuất bổ sung sản xuất theo tuần
          </strong>
          <span>
            Tuần{" "}
            {rows[0] ? metrics.get(rows[0].id)?.weekLabel : "chưa có dữ liệu"} ·
            Forecast lấy theo tháng chứa ngày thứ Năm của tuần
          </span>
        </div>
        <div className="metric">
          <b>{eligible.length}</b>
          <small>Đủ điều kiện</small>
        </div>
        <div className="metric">
          <b>{selected.length}</b>
          <small>Đang chọn</small>
        </div>
      </div>
      <div className="bulk-bar">
        <label>
          <input
            type="checkbox"
            checked={selected.length === eligible.length && eligible.length > 0}
            onChange={(e) =>
              setSelected(e.target.checked ? eligible.map((r) => r.id) : [])
            }
          />
          <span>Chọn tất cả dòng đủ điều kiện</span>
        </label>
        <div>
          <span>
            Đã chọn <b>{selected.length}</b> dòng · Tổng SL sau MOQ{" "}
            <b>{selectedQty.toLocaleString("vi-VN")}</b>
          </span>
          <button disabled={locked || !selected.length} onClick={moveBulk}>
            Đưa hàng loạt sang 06 →
          </button>
        </div>
      </div>
      <div className="table-wrap">
        <table className="engine-table bulk-table">
          <thead>
            <tr>
              <th>CHỌN</th>
              <th>TUẦN KẾ HOẠCH</th>
              <th>MONTH</th>
              <th>SKU</th>
              <th>TÊN SẢN PHẨM</th>
              <th>QUY CÁCH</th>
              <th>NHÓM SP</th>
              <th>LINE</th>
              <th>DAILY DEMAND</th>
              <th>DEMAND EVENT TUẦN</th>
              <th>TỒN KHO CHỐT</th>
              <th>ĐANG ĐI</th>
              <th>LEAD TIME</th>
              <th>TỔNG SAFETY DAYS</th>
              <th>PHIÊN BẢN QUY TẮC</th>
              <th>ROP</th>
              <th>CẦN BỔ SUNG?</th>
              <th>SL CẦN BỔ SUNG</th>
              <th>MOQ</th>
              <th>SL SAU MOQ</th>
              <th>ƯU TIÊN</th>
              <th>LÝ DO</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
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
                    <td className="select-cell">
                      <input
                        type="checkbox"
                        disabled={!canSelect}
                        checked={selected.includes(r.id)}
                        onChange={() => toggle(r.id)}
                      />
                    </td>
                    <td>{f.weekLabel}</td>
                    <td>{f.month}</td>
                    <td>
                      <button
                        className="plan-sku calc-link"
                        onClick={() => onCalc(r.sku)}
                      >
                        {r.sku}
                      </button>
                    </td>
                    <td>
                      <strong>{r.name}</strong>
                    </td>
                    <td>{r.spec}</td>
                    <td>{r.group}</td>
                    <td>{r.line}</td>
                    <td className="number engine-demand">
                      {f.dailyDemand.toLocaleString("vi-VN")}
                    </td>
                    <td className="number">
                      {f.eventWeek.toLocaleString("vi-VN")}
                    </td>
                    <td className="number engine-supply">
                      {f.stock.toLocaleString("vi-VN")}
                    </td>
                    <td className="number engine-supply">
                      {f.inTransit.toLocaleString("vi-VN")}
                    </td>
                    <td className="number">{f.leadTime.toFixed(2)}</td>
                    <td className="number">{f.safetyDays.toFixed(2)}</td>
                    <td className="engine-rule-version">
                      {safetyRule
                        ? `${safetyRule.code} · ${safetyRule.version}`
                        : "Chưa có"}
                    </td>
                    <td className="number engine-rop">
                      {f.rop.toLocaleString("vi-VN", {
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td>
                      <span className={canSelect ? "need-yes" : "need-no"}>
                        {canSelect ? "YES" : "NO"}
                      </span>
                    </td>
                    <td className="number">
                      {f.replenish.toLocaleString("vi-VN", {
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="number">{f.moq.toLocaleString("vi-VN")}</td>
                    <td className="number engine-result">
                      {r.suggested.toLocaleString("vi-VN")}
                    </td>
                    <td>
                      <span
                        className={`priority ${r.priority.includes("Khẩn") ? "urgent" : r.priority === "Bù tải" ? "load" : r.priority === "KHÔNG BỔ SUNG" ? "no-add" : ""}`}
                      >
                        {r.priority.toUpperCase()}
                      </span>
                    </td>
                    <td className="reason-cell">{reason}</td>
                    <td>
                      <button
                        className="calc-button"
                        onClick={() => onCalc(r.sku)}
                      >
                        Xem cách tính
                      </button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      <div className="engine-footnote">
        <b>Quy tắc chuyển 05 → 06:</b> chỉ những dòng có mức ưu tiên hợp lệ mới
        được chọn. “KHÔNG BỔ SUNG” luôn bị loại, kể cả khi người dùng chọn tất
        cả.
      </div>
    </section>
  );
}

function UserSystemView() {
  const [logged, setLogged] = useState(false);
  return (
    <main className="workspace user-workspace">
      <div className="page-heading">
        <div>
          <p className="eyebrow">QUẢN TRỊ HỆ THỐNG</p>
          <h1>Đăng nhập và phân quyền</h1>
          <p>
            Mỗi người dùng đăng nhập bằng ID và mật khẩu để hệ thống xác định bộ
            phận, vai trò và chức năng được phép thao tác.
          </p>
        </div>
      </div>
      <div className="user-grid">
        <section className="login-card">
          <div className="login-mark">👤</div>
          <h2>{logged ? "Đăng nhập thành công" : "Đăng nhập hệ thống"}</h2>
          {!logged ? (
            <>
              <label>
                <span>ID NGƯỜI DÙNG</span>
                <input defaultValue="vthduyen" placeholder="Nhập ID" />
              </label>
              <label>
                <span>MẬT KHẨU</span>
                <input
                  type="password"
                  defaultValue="12345678"
                  placeholder="Nhập mật khẩu"
                />
              </label>
              <button
                className="primary-button"
                onClick={() => setLogged(true)}
              >
                Đăng nhập
              </button>
              <small>Dữ liệu mô phỏng – không lưu mật khẩu thật.</small>
            </>
          ) : (
            <div className="login-success">
              <b>Vũ Thị Hương Duyên</b>
              <span>ID: vthduyen · Bộ phận KHSX</span>
              <span>Vai trò: Quản lý kế hoạch</span>
              <button
                className="outline-button"
                onClick={() => setLogged(false)}
              >
                Đăng xuất
              </button>
            </div>
          )}
        </section>
        <section className="permission-card">
          <div className="permission-head">
            <div>
              <h2>Quyền theo vai trò</h2>
              <p>
                Chức năng hiển thị và thao tác được kiểm soát theo tài khoản.
              </p>
            </div>
            <button className="outline-button">＋ Thêm người dùng</button>
          </div>
          <table>
            <thead>
              <tr>
                <th>VAI TRÒ</th>
                <th>BỘ PHẬN</th>
                <th>QUYỀN CHÍNH</th>
                <th>TRẠNG THÁI</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <b>KHSX</b>
                </td>
                <td>Kế hoạch sản xuất</td>
                <td>
                  Xem Forecast · Nhập Demand Event · Chạy 05 · Chỉnh 06 · Mở LSX
                </td>
                <td>
                  <span className="done-badge">Hoạt động</span>
                </td>
              </tr>
              <tr>
                <td>
                  <b>Sản xuất</b>
                </td>
                <td>SX Line A/B/C</td>
                <td>Nhận LSX · Báo công · Trả tiến độ · Báo sự cố</td>
                <td>
                  <span className="done-badge">Hoạt động</span>
                </td>
              </tr>
              <tr>
                <td>
                  <b>Kho</b>
                </td>
                <td>Kho TP/BTP/NVL</td>
                <td>Cập nhật tồn · Nhập kho · Xuất kho · Xác nhận chứng từ</td>
                <td>
                  <span className="done-badge">Hoạt động</span>
                </td>
              </tr>
              <tr>
                <td>
                  <b>Quản trị</b>
                </td>
                <td>Hệ thống</td>
                <td>Người dùng · Phân quyền · Nhật ký · Thiết lập chung</td>
                <td>
                  <span className="done-badge">Hoạt động</span>
                </td>
              </tr>
            </tbody>
          </table>
          <div className="security-note">
            <b>Quy tắc:</b> mật khẩu phải được mã hóa; mọi thao tác ghi nhận ID
            người dùng, thời gian, giá trị cũ–mới và không cho người dùng thường
            xóa nhật ký.
          </div>
        </section>
      </div>
    </main>
  );
}

function DemandEventView() {
  const [added, setAdded] = useState(false);
  return (
    <section className="data-card demand-view">
      <div className="plan-toolbar">
        <div>
          <strong>Demand Event · Nhu cầu bổ sung của KHSX</strong>
          <span>
            Ghi nhận đơn phát sinh sau Forecast hoặc Bù tải khi Line còn năng
            lực
          </span>
        </div>
        <button className="primary-button" onClick={() => setAdded(true)}>
          ＋ Thêm Demand Event
        </button>
      </div>
      {added && (
        <div className="event-form">
          <label>
            <span>LOẠI NHU CẦU</span>
            <select>
              <option>Phát sinh</option>
              <option>Bù tải</option>
            </select>
          </label>
          <label>
            <span>SKU</span>
            <input defaultValue="102XT08001" />
          </label>
          <label>
            <span>SỐ LƯỢNG</span>
            <input type="number" defaultValue="1500" />
          </label>
          <label>
            <span>NGÀY GIAO DỰ KIẾN</span>
            <input defaultValue="03/09/2026" />
          </label>
          <label>
            <span>MỨC ƯU TIÊN</span>
            <select>
              <option>Gấp</option>
              <option>Thường</option>
            </select>
          </label>
          <label>
            <span>GHI CHÚ</span>
            <input defaultValue="Đơn phát sinh sau Forecast" />
          </label>
          <button className="row-action" onClick={() => setAdded(false)}>
            Lưu Demand Event
          </button>
        </div>
      )}
      <div className="event-summary">
        <div>
          <span>Chưa lập kế hoạch</span>
          <b>2</b>
        </div>
        <div>
          <span>Phát sinh</span>
          <b>1.500</b>
        </div>
        <div>
          <span>Bù tải</span>
          <b>600</b>
        </div>
        <div>
          <span>Đã đưa vào 05</span>
          <b>3</b>
        </div>
      </div>
      <div className="table-wrap">
        <table className="event-table">
          <thead>
            <tr>
              <th>NGÀY YÊU CẦU</th>
              <th>LOẠI</th>
              <th>SKU</th>
              <th>TÊN SẢN PHẨM</th>
              <th>QUY CÁCH</th>
              <th>SL PHÁT SINH</th>
              <th>NGÀY GIAO</th>
              <th>ƯU TIÊN</th>
              <th>KHÁCH HÀNG/ĐƠN</th>
              <th>NGƯỜI CẬP NHẬT</th>
              <th>TRẠNG THÁI</th>
              <th>TUẦN ĐÃ LẬP KH</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>27/08/2026</td>
              <td>
                <span className="event-type urgent">Phát sinh</span>
              </td>
              <td>
                <b className="plan-sku">102XT08001</b>
              </td>
              <td>
                <strong>DÂY XẢ PVC TRẮNG</strong>
              </td>
              <td>LN 80CM</td>
              <td className="number">1.500</td>
              <td>03/09/2026</td>
              <td>Gấp</td>
              <td>SO-260827-18</td>
              <td>
                vthduyen
                <br />
                <small>27/08 09:20</small>
              </td>
              <td>
                <span className="pending-badge">Chưa lập kế hoạch</span>
              </td>
              <td>—</td>
            </tr>
            <tr>
              <td>27/08/2026</td>
              <td>
                <span className="event-type load">Bù tải</span>
              </td>
              <td>
                <b className="plan-sku">103SM00102</b>
              </td>
              <td>
                <strong>BỘ SEN PS M1 INOX</strong>
              </td>
              <td>1.5m</td>
              <td className="number">600</td>
              <td>—</td>
              <td>Thường</td>
              <td>—</td>
              <td>
                vthduyen
                <br />
                <small>27/08 09:25</small>
              </td>
              <td>
                <span className="pending-badge">Chưa lập kế hoạch</span>
              </td>
              <td>—</td>
            </tr>
            <tr>
              <td>25/08/2026</td>
              <td>
                <span className="event-type urgent">Phát sinh</span>
              </td>
              <td>
                <b className="plan-sku">107P5127</b>
              </td>
              <td>
                <strong>VAN PHAO NHỰA</strong>
              </td>
              <td>3/4&quot;</td>
              <td className="number">4.800</td>
              <td>31/08/2026</td>
              <td>Gấp</td>
              <td>SO-260825-06</td>
              <td>
                khsx01
                <br />
                <small>25/08 15:10</small>
              </td>
              <td>
                <span className="done-badge">Đã lập kế hoạch</span>
              </td>
              <td>24/08–30/08</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="source-note">
        <b>Chống trùng:</b> Demand Event đã lập kế hoạch sẽ được đánh dấu và
        Sheet 05 không sử dụng lại trong lần chạy sau.
      </div>
    </section>
  );
}

function DemandEventViewV2() {
  const [added, setAdded] = useState(false);
  const [skuQuery, setSkuQuery] = useState("");
  const [selectedSku, setSelectedSku] = useState<PlanRow | null>(null);
  const suggestions =
    selectedSku || skuQuery.trim().length < 2
      ? []
      : proposalRows
          .filter((row) =>
            `${row.sku} ${row.name} ${row.spec}`
              .toLowerCase()
              .includes(skuQuery.trim().toLowerCase()),
          )
          .slice(0, 6);
  const selectSku = (row: PlanRow) => {
    setSelectedSku(row);
    setSkuQuery(row.sku);
  };
  useEffect(() => {
    if (!added) {
      setSkuQuery("");
      setSelectedSku(null);
      return;
    }
    document
      .querySelectorAll<HTMLInputElement>(
        ".demand-event-form label:not(.sku-autocomplete) input",
      )
      .forEach((input) => {
        input.value = "";
      });
  }, [added]);
  return (
    <section className="data-card demand-view demand-compact-view">
      <div className="demand-actionbar">
        <button className="primary-button" onClick={() => setAdded((v) => !v)}>
          {added ? "× Đóng" : "＋ Thêm Demand Event"}
        </button>
      </div>
      {added && (
        <div className="event-form demand-event-form">
          <label>
            <span>LOẠI NHU CẦU</span>
            <select>
              <option>Phát sinh</option>
              <option>Bù tải</option>
            </select>
          </label>
          <label className="sku-autocomplete">
            <span>SKU</span>
            <input
              value={skuQuery}
              onChange={(e) => {
                setSkuQuery(e.target.value);
                setSelectedSku(null);
              }}
              placeholder="Nhập mã SKU, ví dụ 102..."
              autoComplete="off"
            />
            {suggestions.length > 0 && (
              <div className="sku-suggestions">
                {suggestions.map((row) => (
                  <button
                    type="button"
                    key={row.sku}
                    onClick={() => selectSku(row)}
                  >
                    <b>{row.sku}</b>
                    <span>{row.name}</span>
                    <small>
                      {row.spec} · Line {row.line}
                    </small>
                  </button>
                ))}
              </div>
            )}
          </label>
          <label>
            <span>SỐ LƯỢNG</span>
            <input type="number" defaultValue="1500" />
          </label>
          <label>
            <span>NGÀY GIAO DỰ KIẾN</span>
            <input defaultValue="03/09/2026" />
          </label>
          <label>
            <span>MỨC ƯU TIÊN</span>
            <select>
              <option>Gấp</option>
              <option>Thường</option>
            </select>
          </label>
          <label>
            <span>GHI CHÚ</span>
            <input defaultValue="Đơn phát sinh sau Forecast" />
          </label>
          {selectedSku && (
            <div className="selected-sku">
              <span>SKU đã chọn</span>
              <b>
                {selectedSku.sku} · {selectedSku.name}
              </b>
              <small>
                {selectedSku.spec} · Nhóm {selectedSku.group} · Line{" "}
                {selectedSku.line}
              </small>
            </div>
          )}
          <button
            className="row-action"
            disabled={!selectedSku}
            onClick={() => setAdded(false)}
          >
            Lưu Demand Event
          </button>
        </div>
      )}
      <div className="event-summary">
        <div>
          <span>Chưa lập kế hoạch</span>
          <b>2</b>
        </div>
        <div>
          <span>Phát sinh</span>
          <b>1.500</b>
        </div>
        <div>
          <span>Bù tải</span>
          <b>600</b>
        </div>
        <div>
          <span>Đã đưa vào 05</span>
          <b>3</b>
        </div>
      </div>
      <div className="table-wrap">
        <table className="event-table">
          <thead>
            <tr>
              <th>NGÀY YÊU CẦU</th>
              <th>LOẠI</th>
              <th>SKU</th>
              <th>TÊN SẢN PHẨM</th>
              <th>QUY CÁCH</th>
              <th>SL PHÁT SINH</th>
              <th>NGÀY GIAO</th>
              <th>ƯU TIÊN</th>
              <th>KHÁCH HÀNG/ĐƠN</th>
              <th>NGƯỜI CẬP NHẬT</th>
              <th>TRẠNG THÁI</th>
              <th>TUẦN ĐÃ LẬP KH</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>27/08/2026</td>
              <td>
                <span className="event-type urgent">Phát sinh</span>
              </td>
              <td>
                <b className="plan-sku">102XT08001</b>
              </td>
              <td>
                <strong>DÂY XẢ PVC TRẮNG</strong>
              </td>
              <td>LN 80CM</td>
              <td className="number">1.500</td>
              <td>03/09/2026</td>
              <td>Gấp</td>
              <td>SO-260827-18</td>
              <td>
                vthduyen
                <br />
                <small>27/08 09:20</small>
              </td>
              <td>
                <span className="pending-badge">Chưa lập kế hoạch</span>
              </td>
              <td>—</td>
            </tr>
            <tr>
              <td>27/08/2026</td>
              <td>
                <span className="event-type load">Bù tải</span>
              </td>
              <td>
                <b className="plan-sku">103SM00102</b>
              </td>
              <td>
                <strong>BỘ SEN PS M1 INOX</strong>
              </td>
              <td>1.5m</td>
              <td className="number">600</td>
              <td>—</td>
              <td>Thường</td>
              <td>—</td>
              <td>
                vthduyen
                <br />
                <small>27/08 09:25</small>
              </td>
              <td>
                <span className="pending-badge">Chưa lập kế hoạch</span>
              </td>
              <td>—</td>
            </tr>
            <tr>
              <td>25/08/2026</td>
              <td>
                <span className="event-type urgent">Phát sinh</span>
              </td>
              <td>
                <b className="plan-sku">107P5127</b>
              </td>
              <td>
                <strong>VAN PHAO NHỰA</strong>
              </td>
              <td>3/4&quot;</td>
              <td className="number">4.800</td>
              <td>31/08/2026</td>
              <td>Gấp</td>
              <td>SO-260825-06</td>
              <td>
                khsx01
                <br />
                <small>25/08 15:10</small>
              </td>
              <td>
                <span className="done-badge">Đã lập kế hoạch</span>
              </td>
              <td>24/08–30/08</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="source-note">
        <b>Chống trùng:</b> Demand Event đã lập kế hoạch sẽ được đánh dấu và
        không sử dụng lại trong lần chạy 05 sau.
      </div>
    </section>
  );
}

type DemandRow = {
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
  updatedBy: string;
  updatedAt: string;
};

let demandEventSessionCache: DemandRow[] | null = null;

function DemandEventViewV3() {
  const currentWeek = "31/08/2026–06/09/2026";
  const [events, setEvents] = useState<DemandRow[]>(
    () => demandEventSessionCache || (demandEventData as DemandRow[]),
  );
  /* const legacyEvents: DemandRow[] = [
    {
      id: "DE-001",
      requestDate: "27/08/2026",
      type: "Phát sinh",
      sku: "102XT08001",
      name: "DÂY XẢ PVC TRẮNG",
      spec: "LN 80CM",
      qty: 1500,
      delivery: "03/09/2026",
      priority: "Gấp",
      order: "SO-260827-18",
      status: "Chưa lập kế hoạch",
      plannedWeek: currentWeek,
      updatedBy: "vthduyen",
      updatedAt: "27/08 09:20",
    },
    {
      id: "DE-002",
      requestDate: "27/08/2026",
      type: "Bù tải",
      sku: "103SM00102",
      name: "BỘ SEN PS M1 INOX",
      spec: "1.5m",
      qty: 600,
      delivery: "—",
      priority: "Thường",
      order: "—",
      status: "Chưa lập kế hoạch",
      plannedWeek: currentWeek,
      updatedBy: "vthduyen",
      updatedAt: "27/08 09:25",
    },
    {
      id: "DE-003",
      requestDate: "25/08/2026",
      type: "Phát sinh",
      sku: "107P5127",
      name: "VAN PHAO NHỰA",
      spec: '3/4"',
      qty: 4800,
      delivery: "31/08/2026",
      priority: "Gấp",
      order: "SO-260825-06",
      status: "Đã lập kế hoạch",
      plannedWeek: currentWeek,
      updatedBy: "khsx01",
      updatedAt: "25/08 15:10",
    },
  ]; */
  const [added, setAdded] = useState(false);
  const [skuQuery, setSkuQuery] = useState("");
  const [selectedSku, setSelectedSku] = useState<Sku | null>(null);
  const [eventType, setEventType] = useState("");
  const [qty, setQty] = useState("");
  const [delivery, setDelivery] = useState("");
  const [priority, setPriority] = useState("");
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [saveMessage, setSaveMessage] = useState("");
  const weekRows = events;
  const selectable = weekRows.filter(
    (row) => row.status === "Chưa lập kế hoạch",
  );
  const suggestions =
    selectedSku || skuQuery.trim().length < 2
      ? []
      : skus
          .filter((row) =>
            `${row.code} ${row.name} ${row.specification}`
              .toLowerCase()
              .includes(skuQuery.trim().toLowerCase()),
          )
          .slice(0, 6);
  useEffect(() => {
    fetch("/api/records?entity=demand_event")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => {
        const saved = data.records.map(
          (record: { payload: DemandRow }) => record.payload,
        );
        if (saved.length)
          setEvents((current) => {
            const next = [
              ...saved,
              ...current.filter(
                (row) => !saved.some((item: DemandRow) => item.id === row.id),
              ),
            ];
            demandEventSessionCache = next;
            return next;
          });
      })
      .catch(() => {});
  }, []);
  const resetForm = () => {
    setSkuQuery("");
    setSelectedSku(null);
    setEventType("");
    setQty("");
    setDelivery("");
    setPriority("");
    setNote("");
  };
  const closeForm = () => {
    setAdded(false);
    resetForm();
  };
  const markPlanned = async () => {
    const changed = events
      .filter((row) => selected.includes(row.id))
      .map((row) => ({
        ...row,
        status: "Đã lập kế hoạch" as const,
        plannedWeek: currentWeek,
      }));
    await Promise.all(
      changed.map((row) =>
        fetch("/api/records", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            entity: "demand_event",
            key: row.id,
            payload: row,
            updatedBy: "vthduyen",
          }),
        }),
      ),
    );
    setEvents((rows) => {
      const next = rows.map(
        (row) => changed.find((item) => item.id === row.id) || row,
      );
      demandEventSessionCache = next;
      return next;
    });
    setSelected([]);
  };
  const canSave = Boolean(
    selectedSku && eventType && qty && delivery && priority,
  );
  const saveEvent = async () => {
    if (!selectedSku || !canSave) return;
    const now = new Date();
    const formatDate = (date: Date) =>
      `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
    const row: DemandRow = {
      id: `DE-${Date.now()}`,
      requestDate: formatDate(now),
      type: eventType as DemandRow["type"],
      sku: selectedSku.code,
      name: selectedSku.name,
      spec: selectedSku.specification,
      qty: Number(qty),
      delivery: delivery.split("-").reverse().join("/"),
      priority,
      order: note || "—",
      status: "Chưa lập kế hoạch",
      plannedWeek: currentWeek,
      updatedBy: "vthduyen",
      updatedAt: `${formatDate(now)} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
    };
    const response = await fetch("/api/records", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entity: "demand_event",
        key: row.id,
        payload: row,
        updatedBy: "vthduyen",
      }),
    });
    if (!response.ok) {
      setSaveMessage("Không thể lưu Demand Event. Vui lòng thử lại.");
      return;
    }
    setEvents((current) => {
      const next = [row, ...current];
      demandEventSessionCache = next;
      return next;
    });
    setSaveMessage(`Đã lưu Demand Event ${row.sku}.`);
    closeForm();
  };
  return (
    <section className="data-card demand-view demand-compact-view">
      <div className="demand-weekbar">
        <div>
          <span>Dữ liệu Demand Event</span>
          <b>{events.length.toLocaleString("vi-VN")} dòng</b>
        </div>
        <button
          className="primary-button"
          onClick={() => (added ? closeForm() : setAdded(true))}
        >
          {added ? "× Đóng" : "＋ Thêm Demand Event"}
        </button>
      </div>
      {added && (
        <div className="event-form demand-event-form">
          <label>
            <span>LOẠI NHU CẦU</span>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
            >
              <option value="">Chọn loại nhu cầu</option>
              <option>Phát sinh</option>
              <option>Bù tải</option>
            </select>
          </label>
          <label className="sku-autocomplete">
            <span>SKU</span>
            <input
              value={skuQuery}
              onChange={(e) => {
                setSkuQuery(e.target.value);
                setSelectedSku(null);
              }}
              placeholder="Nhập mã SKU, ví dụ 102..."
              autoComplete="off"
            />
            {suggestions.length > 0 && (
              <div className="sku-suggestions">
                {suggestions.map((row) => (
                  <button
                    type="button"
                    key={row.code}
                    onClick={() => {
                      setSelectedSku(row);
                      setSkuQuery(row.code);
                    }}
                  >
                    <b>{row.code}</b>
                    <span>{row.name}</span>
                    <small>
                      {row.specification} · {row.line}
                    </small>
                  </button>
                ))}
              </div>
            )}
          </label>
          <label>
            <span>SỐ LƯỢNG</span>
            <input
              type="number"
              min="1"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="Nhập số lượng"
            />
          </label>
          <label>
            <span>NGÀY GIAO DỰ KIẾN</span>
            <input
              type="date"
              value={delivery}
              onChange={(e) => setDelivery(e.target.value)}
            />
          </label>
          <label>
            <span>MỨC ƯU TIÊN</span>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="">Chọn mức ưu tiên</option>
              <option>Gấp</option>
              <option>Thường</option>
            </select>
          </label>
          <label>
            <span>GHI CHÚ</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Nhập ghi chú nếu có"
            />
          </label>
          <button
            className="row-action"
            disabled={!canSave}
            onClick={saveEvent}
          >
            Lưu Demand Event
          </button>
        </div>
      )}
      {saveMessage && (
        <div className="plan-notice">
          ✓ {saveMessage}
          <button onClick={() => setSaveMessage("")}>×</button>
        </div>
      )}
      <div className="event-summary">
        <div>
          <span>Chưa lập kế hoạch</span>
          <b>
            {
              weekRows.filter((row) => row.status === "Chưa lập kế hoạch")
                .length
            }
          </b>
        </div>
        <div>
          <span>Phát sinh</span>
          <b>
            {weekRows
              .filter((row) => row.type === "Phát sinh")
              .reduce((sum, row) => sum + row.qty, 0)
              .toLocaleString("vi-VN")}
          </b>
        </div>
        <div>
          <span>Bù tải</span>
          <b>
            {weekRows
              .filter((row) => row.type === "Bù tải")
              .reduce((sum, row) => sum + row.qty, 0)
              .toLocaleString("vi-VN")}
          </b>
        </div>
        <div>
          <span>Đã lập kế hoạch</span>
          <b>
            {weekRows.filter((row) => row.status === "Đã lập kế hoạch").length}
          </b>
        </div>
      </div>
      <div className="demand-bulkbar">
        <label>
          <input
            type="checkbox"
            checked={
              selected.length === selectable.length && selectable.length > 0
            }
            onChange={(e) =>
              setSelected(
                e.target.checked ? selectable.map((row) => row.id) : [],
              )
            }
          />
          <span>Chọn tất cả dòng chưa lập kế hoạch</span>
        </label>
        <button disabled={!selected.length} onClick={markPlanned}>
          ✓ Đánh dấu đã lập kế hoạch ({selected.length})
        </button>
      </div>
      <div className="table-wrap">
        <table className="event-table demand-event-table" data-page-size="25">
          <thead>
            <tr>
              <th>CHỌN</th>
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
              <th>TUẦN ĐÃ LẬP KH</th>
              <th>NGƯỜI CẬP NHẬT</th>
            </tr>
          </thead>
          <tbody>
            {weekRows.map((row) => (
              <tr key={row.id}>
                <td className="select-cell">
                  <input
                    type="checkbox"
                    disabled={row.status === "Đã lập kế hoạch"}
                    checked={selected.includes(row.id)}
                    onChange={() =>
                      setSelected((ids) =>
                        ids.includes(row.id)
                          ? ids.filter((id) => id !== row.id)
                          : [...ids, row.id],
                      )
                    }
                  />
                </td>
                <td>{row.requestDate}</td>
                <td>
                  <span
                    className={`event-type ${row.type === "Phát sinh" ? "urgent" : "load"}`}
                  >
                    {row.type}
                  </span>
                </td>
                <td>
                  <b className="plan-sku">{row.sku}</b>
                </td>
                <td>
                  <strong>{row.name}</strong>
                </td>
                <td>{row.spec}</td>
                <td className="number">{row.qty.toLocaleString("vi-VN")}</td>
                <td>{row.delivery}</td>
                <td>{row.priority}</td>
                <td>{row.order}</td>
                <td>
                  <span
                    className={
                      row.status === "Đã lập kế hoạch"
                        ? "done-badge"
                        : "pending-badge"
                    }
                  >
                    {row.status}
                  </span>
                </td>
                <td>
                  {row.status === "Đã lập kế hoạch" ? row.plannedWeek : "—"}
                </td>
                <td>
                  {row.updatedBy}
                  <br />
                  <small>{row.updatedAt}</small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="source-note">
        <b>Phạm vi tổng hợp:</b> Các chỉ số phía trên tính trên toàn bộ Demand
        Event. Event đã đánh dấu lập kế hoạch sẽ không được sử dụng lại khi chạy
        05.
      </div>
    </section>
  );
}

function PlanFinalView({
  rows,
  onUpdate,
  onFinalize,
}: {
  rows: PlanRow[];
  onUpdate: (id: string, key: keyof PlanRow, value: string | number) => void;
  onFinalize: () => void;
}) {
  const [filter, setFilter] = useState<
    "Tất cả" | "Dự kiến" | "Đã chốt" | "Hoãn"
  >("Tất cả");
  const capacities: Record<string, number> = { A: 540, B: 460, C: 380 };
  const orderHours = (r: PlanRow) => r.plan * (forecastData[r.sku]?.hours || 0);
  const visible = rows.filter(
    (r) => filter === "Tất cả" || r.status === filter,
  );
  const activeRows = rows.filter((r) => r.status !== "Hoãn");
  const confirmedHours = rows
    .filter((r) => r.status === "Đã chốt")
    .reduce((s, r) => s + orderHours(r), 0);
  const projectedHours = rows
    .filter((r) => r.status === "Dự kiến")
    .reduce((s, r) => s + orderHours(r), 0);
  const deferredHours = rows
    .filter((r) => r.status === "Hoãn")
    .reduce((s, r) => s + orderHours(r), 0);
  const usedLines = ["A", "B"].map((line) => {
    const available = capacities[line];
    const confirmed = rows
      .filter((r) => r.line === line && r.status === "Đã chốt")
      .reduce((s, r) => s + orderHours(r), 0);
    const projected = rows
      .filter((r) => r.line === line && r.status === "Dự kiến")
      .reduce((s, r) => s + orderHours(r), 0);
    return {
      line,
      available,
      confirmed,
      projected,
      total: confirmed + projected,
    };
  });
  return (
    <section className="data-card plan-new capacity-plan">
      <div className="plan-week-bar">
        <div>
          <span>Tuần kế hoạch</span>
          <b>36</b>
        </div>
        <div>
          <span>Tuần bắt đầu</span>
          <b>31/08/2026</b>
        </div>
        <div>
          <span>Tuần kết thúc</span>
          <b>06/09/2026</b>
        </div>
        <button
          className="primary-button"
          disabled={!activeRows.length}
          onClick={onFinalize}
        >
          Chốt kế hoạch & chuyển sang 04 →
        </button>
      </div>
      <div className="capacity-overview">
        {usedLines.map((x) => {
          const balance = x.available - x.total;
          const overload = balance < 0;
          return (
            <article key={x.line} className={overload ? "overload" : ""}>
              <div>
                <span>LINE {x.line}</span>
                <strong
                  className={`capacity-state ${overload ? "over" : "available"}`}
                >
                  {overload ? "QUÁ TẢI" : "CÒN TẢI"}
                </strong>
              </div>
              <div className="capacity-main">
                <b>
                  {x.total.toLocaleString("vi-VN", {
                    maximumFractionDigits: 1,
                  })}{" "}
                  / {x.available} giờ
                </b>
                <em>
                  Tải{" "}
                  {((x.total / x.available) * 100).toLocaleString("vi-VN", {
                    maximumFractionDigits: 1,
                  })}
                  %
                </em>
              </div>
              <div className="capacity-bar">
                <i
                  style={{
                    width: `${Math.min(100, (x.total / x.available) * 100)}%`,
                  }}
                />
              </div>
              <footer>
                <span>
                  Đã chốt:{" "}
                  {x.confirmed.toLocaleString("vi-VN", {
                    maximumFractionDigits: 1,
                  })}
                  h
                </span>
                <span>
                  Dự kiến:{" "}
                  {x.projected.toLocaleString("vi-VN", {
                    maximumFractionDigits: 1,
                  })}
                  h
                </span>
                <strong>
                  {overload ? "Thiếu" : "Còn"}:{" "}
                  {Math.abs(balance).toLocaleString("vi-VN", {
                    maximumFractionDigits: 1,
                  })}
                  h
                </strong>
              </footer>
            </article>
          );
        })}
        <article className="capacity-total">
          <div>
            <span>TỔNG KẾ HOẠCH</span>
            <b>
              {(confirmedHours + projectedHours).toLocaleString("vi-VN", {
                maximumFractionDigits: 1,
              })}{" "}
              giờ
            </b>
          </div>
          <footer>
            <span>
              Đã chốt{" "}
              {confirmedHours.toLocaleString("vi-VN", {
                maximumFractionDigits: 1,
              })}
              h
            </span>
            <span>
              Dự kiến{" "}
              {projectedHours.toLocaleString("vi-VN", {
                maximumFractionDigits: 1,
              })}
              h
            </span>
            <span>
              Hoãn{" "}
              {deferredHours.toLocaleString("vi-VN", {
                maximumFractionDigits: 1,
              })}
              h
            </span>
          </footer>
        </article>
      </div>
      <div className="plan-status-filter">
        <span>XEM THEO TRẠNG THÁI</span>
        {(["Tất cả", "Dự kiến", "Đã chốt", "Hoãn"] as const).map((x) => (
          <button
            key={x}
            className={filter === x ? "active" : ""}
            onClick={() => setFilter(x)}
          >
            {x}
            <b>
              {x === "Tất cả"
                ? rows.length
                : rows.filter((r) => r.status === x).length}
            </b>
          </button>
        ))}
      </div>
      {!rows.length ? (
        <div className="empty-plan">
          <b>Chưa có dòng kế hoạch</b>
          <span>
            Qua Đề xuất sản xuất tuần · 05 và đưa các dòng ưu tiên sang 06.
          </span>
        </div>
      ) : !visible.length ? (
        <div className="empty-plan compact">
          <b>Không có đơn ở trạng thái {filter}</b>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="plan-final-table capacity-table">
            <thead>
              <tr>
                <th>NHÓM SP</th>
                <th>SKU</th>
                <th>TÊN SẢN PHẨM</th>
                <th>QUY CÁCH</th>
                <th>SL ĐỀ XUẤT</th>
                <th>SL KẾ HOẠCH</th>
                <th>TỔNG GIỜ CÔNG</th>
                <th>LINE</th>
                <th>NGÀY BẮT ĐẦU</th>
                <th>NGÀY HT DỰ KIẾN</th>
                <th>LOẠI KẾ HOẠCH</th>
                <th>TRẠNG THÁI</th>
                <th>PLAN ID</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr
                  key={r.id}
                  className={r.status === "Hoãn" ? "deferred-row" : ""}
                >
                  <td>
                    <span className="group-chip">{r.group}</span>
                  </td>
                  <td>
                    <b className="plan-sku">{r.sku}</b>
                  </td>
                  <td>
                    <strong>{r.name}</strong>
                  </td>
                  <td>{r.spec}</td>
                  <td className="number">
                    {r.suggested.toLocaleString("vi-VN")}
                  </td>
                  <td>
                    <input
                      className="editable"
                      type="number"
                      value={r.plan}
                      disabled={r.status === "Đã chốt"}
                      onChange={(e) =>
                        onUpdate(r.id, "plan", Number(e.target.value))
                      }
                    />
                  </td>
                  <td className="number order-hours">
                    {orderHours(r).toLocaleString("vi-VN", {
                      maximumFractionDigits: 1,
                    })}
                    h
                  </td>
                  <td>
                    <select
                      className="editable"
                      value={r.line}
                      disabled={r.status === "Đã chốt"}
                      onChange={(e) => onUpdate(r.id, "line", e.target.value)}
                    >
                      <option>A</option>
                      <option>B</option>
                      <option>C</option>
                    </select>
                  </td>
                  <td>
                    <input
                      className="editable date-input"
                      value={r.start}
                      disabled={r.status === "Đã chốt"}
                      onChange={(e) => onUpdate(r.id, "start", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      className="editable date-input"
                      value={r.end}
                      disabled={r.status === "Đã chốt"}
                      onChange={(e) => onUpdate(r.id, "end", e.target.value)}
                    />
                  </td>
                  <td>
                    <select
                      className="editable"
                      value={r.type}
                      disabled={r.status === "Đã chốt"}
                      onChange={(e) => onUpdate(r.id, "type", e.target.value)}
                    >
                      <option>Tuần chính</option>
                      <option>Gối đầu</option>
                    </select>
                  </td>
                  <td>
                    <select
                      className={`plan-state ${r.status === "Đã chốt" ? "confirmed" : r.status === "Hoãn" ? "deferred" : ""}`}
                      value={r.status}
                      onChange={(e) => onUpdate(r.id, "status", e.target.value)}
                    >
                      <option>Dự kiến</option>
                      <option>Đã chốt</option>
                      <option>Hoãn</option>
                    </select>
                  </td>
                  <td>
                    <b className="plan-sku plan-id-end">{r.id}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="preserve-rule">
        <b>Công thức:</b> Tổng giờ công đơn = Số lượng kế hoạch × Giờ công
        chuẩn/SP. Giờ chuẩn/SP vẫn được dùng để tính nhưng ẩn khỏi bảng cho gọn.
        Đơn Hoãn không tính vào tải tuần; sau khi chốt, dữ liệu được chuyển sang
        04 và giữ nguyên giờ công tại thời điểm chốt.
      </div>
    </section>
  );
}

function TrackingFinalView({ rows }: { rows: PlanRow[] }) {
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [sent, setSent] = useState<string[]>([]);
  return (
    <section className="data-card tracking-new">
      <div className="plan-toolbar">
        <div>
          <strong>Theo dõi lệnh sản xuất · 04_IN_TRANSIT</strong>
          <span>
            Kế hoạch đã chốt từ 06 · KHSX nhập Mã LSX trước khi gửi Sản xuất
          </span>
        </div>
      </div>
      {!rows.length ? (
        <div className="empty-plan">
          <b>Chưa có kế hoạch được chốt</b>
          <span>Chốt kế hoạch tại 06 để dữ liệu tự động chuyển sang đây.</span>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="tracking-final-table">
            <thead>
              <tr>
                <th>PLAN ID</th>
                <th>SKU</th>
                <th>TÊN SẢN PHẨM</th>
                <th>QUY CÁCH</th>
                <th>LINE</th>
                <th>SL KẾ HOẠCH</th>
                <th>NGÀY BẮT ĐẦU</th>
                <th>NGÀY HT DỰ KIẾN</th>
                <th>MÃ LSX – KHSX NHẬP</th>
                <th>TRẠNG THÁI GỬI SX</th>
                <th>NGƯỜI CẬP NHẬT</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isSent = sent.includes(r.id);
                return (
                  <tr key={r.id}>
                    <td>
                      <b className="plan-sku">{r.id}</b>
                    </td>
                    <td>
                      <b className="plan-sku">{r.sku}</b>
                    </td>
                    <td>
                      <strong>{r.name}</strong>
                    </td>
                    <td>{r.spec}</td>
                    <td>Line {r.line}</td>
                    <td className="number">{r.plan.toLocaleString("vi-VN")}</td>
                    <td>{r.start}</td>
                    <td>{r.end}</td>
                    <td>
                      <input
                        className="lsx-input"
                        value={codes[r.id] || ""}
                        disabled={isSent}
                        onChange={(e) =>
                          setCodes((v) => ({ ...v, [r.id]: e.target.value }))
                        }
                        placeholder="VD: 510-26083101"
                      />
                    </td>
                    <td>
                      <span className={isSent ? "done-badge" : "pending-badge"}>
                        {isSent ? "Đã gửi SX" : "Chờ nhập Mã LSX"}
                      </span>
                    </td>
                    <td>
                      {isSent ? (
                        <>
                          vthduyen
                          <br />
                          <small>27/08/2026 14:20</small>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <button
                        className="row-action"
                        disabled={!codes[r.id]?.trim() || isSent}
                        onClick={() => setSent((v) => [...v, r.id])}
                      >
                        {isSent ? "Đã gửi" : "Lưu mã & gửi SX"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="audit-strip">
        <b>Kiểm soát:</b>
        <span>
          Không cho gửi SX khi chưa nhập Mã LSX. Sau khi gửi, Mã LSX bị khóa;
          muốn sửa phải dùng nghiệp vụ điều chỉnh có lý do và lưu lịch sử.
        </span>
      </div>
    </section>
  );
}

type PlanningTab =
  "base" | "demand" | "proposal" | "rules" | "plan" | "tracking" | "report";

type ForecastRow = {
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
const FORECAST_DATA_RESET_AT = "2026-09-05T08:08:59.000Z";

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

async function readForecastPdf(file: File): Promise<ForecastRow[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
  }).promise;
  const chunks: Array<{ month: string; cells: string[] }> = [];
  const allocationRows: ForecastRow[] = [];
  let reportMonth = "";
  let reportGroup = "";
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const cells = (content.items as Array<{ str?: string }>)
      .map((item) => item.str?.trim() || "")
      .filter(Boolean);
    for (let i = 0; i < cells.length; i += 1) {
      if (!/^\d{2}\/\d{4}$/.test(cells[i])) continue;
      const month = cells[i];
      const row: string[] = [];
      let j = i + 1;
      while (
        j < cells.length &&
        !/^\d{2}\/\d{4}$/.test(cells[j]) &&
        cells[j] !== "Month"
      )
        row.push(cells[j++]);
      chunks.push({ month, cells: row });
      i = j - 1;
    }
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
      if (
        items.some((item) => item.text.includes("Tháng báo cáo")) &&
        monthCell
      )
        reportMonth = nextForecastMonth(monthCell.text);
      const groupCell = items.find((item) => item.text.startsWith("NHÓM:"));
      if (groupCell) {
        reportGroup = groupCell.text.replace(/^NHÓM:\s*/, "").trim();
        continue;
      }
      const sku = items[0]?.text || "";
      if (!/^[A-Z0-9]{7,12}$/.test(sku) || !reportMonth || !reportGroup)
        continue;
      const numericCells = items.filter(
        (item) => item.x >= 500 && /^-?[\d.,]+$/.test(item.text),
      );
      if (numericCells.length < 4) continue;
      const numberValue = (value: string) =>
        Number(value.replace(/\./g, "").replace(",", "."));
      const forecasts = numericCells
        .slice(-3)
        .map((item) => numberValue(item.text));
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
          month: reportMonth,
          group: reportGroup,
          sku,
          name,
          spec,
          line,
          f30: forecasts[0],
          f60: forecasts[1],
          f90: forecasts[2],
          d30: 0,
          d60: 0,
          used: 0,
          d90: 0,
          warning: "",
        }),
      );
    }
  }
  if (allocationRows.length)
    return [
      ...new Map(
        allocationRows.map((row) => [`${row.month}-${row.sku}`, row]),
      ).values(),
    ];
  const result = new Map<string, ForecastRow>();
  for (const chunk of chunks) {
    const skuIndex = chunk.cells.findIndex(
      (cell) => /^[A-Z0-9]{7,12}$/.test(cell) || /\s[A-Z0-9]{7,12}$/.test(cell),
    );
    if (skuIndex < 0) continue;
    const skuMatch = chunk.cells[skuIndex].match(/([A-Z0-9]{7,12})$/);
    if (!skuMatch) continue;
    const sku = skuMatch[1];
    const group = [
      ...chunk.cells.slice(0, skuIndex),
      chunk.cells[skuIndex].slice(0, -sku.length).trim(),
    ]
      .filter(Boolean)
      .join(" ");
    const parts = chunk.cells.slice(skuIndex + 1);
    const start = parts.findIndex(
      (part, index) =>
        index > 0 &&
        parts.length - index >= 7 &&
        parts
          .slice(index, index + 7)
          .every((value) => /^-?[\d,.]+$/.test(value)),
    );
    if (start < 1) continue;
    const before = parts.slice(0, start);
    const values = parts
      .slice(start, start + 7)
      .map((value) => Number(value.replace(/,/g, "")));
    let lineCode = "";
    if (/^(A|B|C|NK)$/.test(before.at(-1) || "")) lineCode = before.pop() || "";
    const row = {
      month: chunk.month,
      group,
      sku,
      name: before.shift() || "",
      spec: before.join(" "),
      line: lineCode,
      f30: values[0],
      f60: values[1],
      f90: values[2],
      d30: values[3],
      d60: values[4],
      used: values[5],
      d90: values[6],
      warning: parts.slice(start + 7).join(" "),
    };
    result.set(`${row.month}-${row.sku}`, calculateForecastDemand(row));
  }
  return [...result.values()];
}

function PlanningLookupBar({
  tab,
  onForecastImported,
}: {
  tab: PlanningTab;
  onForecastImported?: (rows: ForecastRow[]) => void;
}) {
  const isMonth = tab === "base";
  const proposalWeek = tab === "proposal";
  const [from, setFrom] = useState(proposalWeek ? "2026-08-24" : "2026-08-31");
  const [to, setTo] = useState(proposalWeek ? "2026-08-30" : "2026-09-06");
  const [fileName, setFileName] = useState("");
  const [message, setMessage] = useState("");
  const search = () =>
    setMessage(
      `Đang hiển thị tuần từ ${from.split("-").reverse().join("/")} đến ${to.split("-").reverse().join("/")}`,
    );
  const importPdf = async (file?: File) => {
    if (!file) return;
    setFileName(file.name);
    setMessage("Đang đọc dữ liệu PDF...");
    try {
      const imported = await readForecastPdf(file);
      if (!imported.length) throw new Error("empty");
      const months = Array.from(new Set(imported.map((row) => row.month)));
      const responses = await Promise.all(
        months.map((month) =>
          fetch("/api/records", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              entity: "forecast",
              key: month,
              payload: imported.filter((row) => row.month === month),
              updatedBy: "vthduyen",
            }),
          }),
        ),
      );
      if (responses.some((response) => !response.ok)) throw new Error("save");
      onForecastImported?.(imported);
      setMessage(
        `Đã cập nhật ${imported.length.toLocaleString("vi-VN")} SKU cho ${months.join(", ")}.`,
      );
    } catch {
      setMessage(
        "Không đọc được cấu trúc PDF này. Vui lòng dùng đúng mẫu Base Forecast từ Kinh doanh.",
      );
    }
  };
  if (isMonth)
    return (
      <section className="planning-lookup forecast-import-only">
        <div className="forecast-upload">
          <label className="upload-pdf-button">
            ⇧ Chọn PDF Base Forecast từ Kinh doanh
            <input
              type="file"
              accept="application/pdf"
              onChange={(event) => importPdf(event.target.files?.[0])}
            />
          </label>
          {fileName && <span title={fileName}>{fileName}</span>}
        </div>
        {message && <div className="lookup-message">{message}</div>}
      </section>
    );
  return (
    <section className="planning-lookup">
      <div className="lookup-fields">
        <>
          <label>
            <span>TỪ NGÀY</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            <span>ĐẾN NGÀY</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </>
        <button className="outline-button" onClick={search}>
          ⌕ Tra dữ liệu
        </button>
      </div>
      {message && <div className="lookup-message">✓ {message}</div>}
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
      <div className="sku-master-toolbar">
        <span>
          <b>Quy tắc áp dụng Production_engine</b>
          <small>
            Dùng để kiểm tra tuần Forecast và thứ tự ưu tiên trước khi tạo dữ
            liệu
          </small>
        </span>
      </div>
      <section className="data-card rule-card">
        <div className="section-title">
          <div>
            <h2>Quy định tuần kế hoạch và tháng Forecast</h2>
            <p>
              Tháng Forecast luôn được xác định theo ngày thứ Năm trong tuần.
            </p>
          </div>
        </div>
        <div className="table-wrap">
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
                <td>Ngày nhập</td>
                <td>
                  Người dùng chọn ngày thuộc tuần cần lập kế hoạch; hệ thống tự
                  đưa về thứ Hai.
                </td>
                <td>Chọn 05/08/2026</td>
                <td>Tuần bắt đầu 03/08/2026</td>
              </tr>
              <tr>
                <td>Phạm vi tuần</td>
                <td>Tính từ thứ Hai đến Chủ nhật, tổng cộng 7 ngày.</td>
                <td>03/08–09/08</td>
                <td>Tuần 03/08–09/08/2026</td>
              </tr>
              <tr>
                <td>Tháng Forecast</td>
                <td>
                  Không lấy theo tháng của ngày thứ Hai; lấy tháng chứa ngày thứ
                  Năm.
                </td>
                <td>Tuần 31/08–06/09</td>
                <td>Dùng Forecast 09/2026</td>
              </tr>
              <tr>
                <td>Tuần giao tháng</td>
                <td>
                  Ngày thứ Năm đại diện cho tháng chiếm phần lớn thời gian của
                  tuần.
                </td>
                <td>Tuần 30/11–06/12</td>
                <td>Thứ Năm 03/12 → Forecast 12/2026</td>
              </tr>
              <tr>
                <td>Tuần chủ yếu thuộc tháng cũ</td>
                <td>
                  Nếu ngày thứ Năm vẫn thuộc tháng cũ thì tiếp tục dùng Forecast
                  tháng cũ.
                </td>
                <td>Tuần 27/07–02/08</td>
                <td>Thứ Năm 30/07 → Forecast 07/2026</td>
              </tr>
              <tr>
                <td>Mục đích</td>
                <td>
                  Tránh chọn sai tháng khi tuần bắt đầu ngày 30 hoặc 31 nhưng
                  phần lớn tuần nằm trong tháng sau.
                </td>
                <td>—</td>
                <td>Forecast phù hợp với tuần sản xuất</td>
              </tr>
            </tbody>
          </table>
        </div>
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
        <div className="table-wrap">
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
                  <td className="rule-order">{row[0]}</td>
                  <td>
                    <span className={`priority-rule p${row[0]}`}>{row[1]}</span>
                  </td>
                  <td>{row[2]}</td>
                  <td>{row[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
  baseRows: ForecastRow[];
  baseMonth: string;
  engineEvents: DemandRow[];
  engineWeek: string;
  snapshots: InventorySnapshot[];
  snapshotsLoaded: boolean;
};

let planningSessionCache: PlanningSessionCache | null = null;

const updatePlanningSessionCache = (next: Partial<PlanningSessionCache>) => {
  const defaults: PlanningSessionCache = {
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
}: {
  tab: PlanningTab;
  operator: string;
}) {
  const [rows, setRows] = useState(proposalRows);
  const [engineEvents, setEngineEvents] = useState<DemandRow[]>(
    () =>
      planningSessionCache?.engineEvents ||
      demandEventSessionCache ||
      (demandEventData as DemandRow[]),
  );
  const [engineWeek, setEngineWeek] = useState(
    () => planningSessionCache?.engineWeek || "2026-08-31",
  );
  const [baseRows, setBaseRows] = useState<ForecastRow[]>(
    () =>
      planningSessionCache?.baseRows ||
      (baseForecastData as ForecastRow[]).map(calculateForecastDemand),
  );
  const baseMonths = Array.from(
    new Set(baseRows.map((row) => row.month)),
  ).sort();
  const [baseMonth, setBaseMonth] = useState(
    () => planningSessionCache?.baseMonth || baseMonths.at(-1) || "",
  );
  const visibleBaseRows = baseRows.filter((row) => row.month === baseMonth);
  const baseTotals = visibleBaseRows.reduce(
    (sum, row) => ({
      f30: sum.f30 + row.f30,
      f60: sum.f60 + row.f60,
      f90: sum.f90 + row.f90,
    }),
    { f30: 0, f60: 0, f90: 0 },
  );
  const [notice, setNotice] = useState("");
  const [fullView, setFullView] = useState(false);
  const [calcSku, setCalcSku] = useState<string | null>(null);
  const [finalizedIds, setFinalizedIds] = useState<string[]>([]);
  const [inventorySnapshots, setInventorySnapshots] = useState<
    InventorySnapshot[]
  >(() => planningSessionCache?.snapshots || []);
  const [snapshotsLoaded, setSnapshotsLoaded] = useState(
    () => planningSessionCache?.snapshotsLoaded || false,
  );
  const [masterRuleRevision, setMasterRuleRevision] = useState(0);
  useEffect(() => {
    Promise.all([
      fetch("/api/records?entity=leadtime"),
      fetch("/api/records?entity=leadtime_versions"),
      fetch("/api/records?entity=safety_rules"),
    ])
      .then(async ([leadResponse, versionResponse, ruleResponse]) => {
        const leadSaved = leadResponse.ok
          ? (await leadResponse.json()).records.map(
              (item: { payload: LeadtimeRow }) => item.payload,
            )
          : [];
        const leadVersions = versionResponse.ok
          ? (await versionResponse.json()).records.map(
              (item: { payload: LeadTimeVersion }) => item.payload,
            )
          : [];
        const savedRules = ruleResponse.ok
          ? (await ruleResponse.json()).records
              .map((item: { payload: SafetyRuleSet }) => item.payload)
              .filter((item: SafetyRuleSet) => !item._deleted)
          : [];
        leadSaved.forEach((row: LeadtimeRow) =>
          row._deleted
            ? leadtimeBySku.delete(row.sku.toUpperCase())
            : leadtimeBySku.set(row.sku.toUpperCase(), row),
        );
        const calculationAt = `${engineWeek}T00:00:00+07:00`;
        new Set(leadVersions.map((item: LeadTimeVersion) => item.sku)).forEach(
          (sku) => {
            const version = activeLeadTimeAt(leadVersions, sku, calculationAt);
            const master = skus.find((item) => normalizeSkuCode(item.code) === sku);
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
        safetyRuleSets = savedRules.length
          ? savedRules
          : [defaultSafetyRuleSet];
        setMasterRuleRevision((value) => value + 1);
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    fetch("/api/records?entity=forecast")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => {
        const saved = data.records
          .filter(
            (record: { key: string; updatedAt: string }) =>
              !(
                ["07/2026", "08/2026"].includes(record.key) &&
                record.updatedAt <= FORECAST_DATA_RESET_AT
              ),
          )
          .flatMap((record: { payload: ForecastRow[] }) => record.payload)
          .map(calculateForecastDemand);
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
    fetch("/api/records?entity=demand_event")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => {
        const saved = data.records.map(
          (record: { payload: DemandRow }) => record.payload,
        );
        if (saved.length)
          setEngineEvents((current) => {
            const next = [
              ...saved,
              ...current.filter(
                (row) => !saved.some((item: DemandRow) => item.id === row.id),
              ),
            ];
            demandEventSessionCache = next;
            updatePlanningSessionCache({ engineEvents: next });
            return next;
          });
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    Promise.all([
      fetch("/api/records?entity=production_engine")
        .then((response) => (response.ok ? response.json() : Promise.reject()))
        .catch(() => ({ records: [] })),
      loadInventorySnapshots().catch(
        () => planningSessionCache?.snapshots || [],
      ),
    ]).then(([data, items]) => {
      const latest = data.records?.[0]?.payload?.week;
      const nextWeek = /^\d{4}-\d{2}-\d{2}$/.test(latest || "")
        ? latest
        : engineWeek;
      setEngineWeek(nextWeek);
      setInventorySnapshots(items);
      setSnapshotsLoaded(true);
      updatePlanningSessionCache({
        engineWeek: nextWeek,
        snapshots: items,
        snapshotsLoaded: true,
      });
    });
  }, []);
  useEffect(() => {
    updatePlanningSessionCache({
      baseRows,
      baseMonth,
      engineEvents,
      engineWeek,
      snapshots: inventorySnapshots,
      snapshotsLoaded,
    });
  }, [
    baseRows,
    baseMonth,
    engineEvents,
    engineWeek,
    inventorySnapshots,
    snapshotsLoaded,
  ]);
  const activeSnapshot = inventorySnapshots.find(
    (item) =>
      item.weekKey === weekKeyOf(engineWeek) &&
      ["Đã chốt", "Đã được Production_engine sử dụng"].includes(item.status),
  );
  const activeSafetyRule = activeSafetyRuleFor(weekKeyOf(engineWeek));
  const engineResult = useMemo(
    () =>
      buildProductionEngine(
        baseRows,
        engineEvents,
        engineWeek,
        snapshotStockMap(activeSnapshot),
        activeSafetyRule,
      ),
    [
      baseRows,
      engineEvents,
      engineWeek,
      activeSnapshot,
      activeSafetyRule,
      masterRuleRevision,
    ],
  );
  if (tab === "report")
    return (
      <main className="workspace">
        <div className="page-heading">
          <div>
            <p className="eyebrow">KẾ HOẠCH SẢN XUẤT</p>
            <h1>Report</h1>
            <p>Khung báo cáo kế hoạch sản xuất.</p>
          </div>
        </div>
        <section className="data-card module-placeholder">
          <span>Nội dung sẽ được triển khai sau khi duyệt giao diện.</span>
        </section>
      </main>
    );
  if (tab === "rules") return <ProductionEngineRules />;
  const planned = rows.filter((r) =>
    ["Dự kiến", "Đã chốt", "Hoãn"].includes(r.status),
  );
  const moveToPlan = (id: string) => {
    setRows((v) =>
      v.map((r) => (r.id === id ? { ...r, status: "Dự kiến" } : r)),
    );
    setNotice(
      "Đã tạo dòng kế hoạch dự kiến tại 06. Các điều chỉnh tại 06 sẽ được giữ khi chạy lại đề xuất.",
    );
  };
  const update = (id: string, key: keyof PlanRow, value: string | number) =>
    setRows((v) => v.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
  return (
    <main
      className={`workspace planning-workspace ${tab === "base" ? "base-compact" : tab === "demand" ? "demand-compact" : tab === "proposal" ? "proposal-compact" : ""}`}
    >
      {tab !== "proposal" && (
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
              <h1>Điều hành kế hoạch tuần</h1>
              <p>
                Tính đề xuất tự động, KHSX điều chỉnh kế hoạch và theo dõi lệnh
                đã gửi Sản xuất.
              </p>
            </div>
            <button
              className="primary-button"
              onClick={() =>
                setNotice(
                  "Đã tạo phiên tính RUN-20260827-001 từ Forecast, Demand Event, tồn kho, Lead time, Safety Days và MOQ.",
                )
              }
            >
              ↻ Tính lại đề xuất 05
            </button>
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
              <button onClick={() => setNotice("")}>×</button>
            </div>
          )}
        </>
      )}
      {tab === "demand" && <DemandEventViewV3 />}
      {tab === "proposal" && (
        <>
          <div
            className={`safety-rule-engine-banner ${activeSafetyRule ? "ok" : "error"}`}
          >
            {activeSafetyRule ? (
              <>
                <span>QUY TẮC SAFETY DAYS</span>
                <b>
                  {activeSafetyRule.code} · {activeSafetyRule.version}
                </b>
                <small>
                  Hiệu lực {activeSafetyRule.effectiveFrom}
                  {activeSafetyRule.effectiveTo
                    ? ` đến ${activeSafetyRule.effectiveTo}`
                    : " · không giới hạn"}{" "}
                  · chọn theo ngày bắt đầu tuần kế hoạch
                </small>
              </>
            ) : (
              <>
                <b>Chưa có Quy tắc Safety Days đã xác nhận cho tuần này.</b>
                <small>
                  Vui lòng chọn tuần kế hoạch để xác định phiên bản Quy tắc
                  Safety Days phù hợp.
                </small>
              </>
            )}
          </div>
          <BulkEngineView
            rows={engineResult.rows}
            metrics={engineResult.metrics}
            week={engineWeek}
            snapshot={activeSnapshot}
            snapshotsLoaded={snapshotsLoaded}
            safetyRule={activeSafetyRule}
            onWeekChange={async (value) => {
              setEngineWeek(value);
              const matched = inventorySnapshots.find(
                (item) =>
                  item.weekKey === weekKeyOf(value) &&
                  ["Đã chốt", "Đã được Production_engine sử dụng"].includes(
                    item.status,
                  ),
              );
              if (!matched) {
                setNotice(
                  `Chưa có dữ liệu tồn kho chốt cho tuần ${formatViDate(mondayOf(new Date(`${value}T00:00:00`)))}. Vui lòng yêu cầu Kho chốt tồn trước khi cập nhật Production_engine.`,
                );
                return;
              }
              const matchedRule = activeSafetyRuleFor(weekKeyOf(value));
              if (!matchedRule) {
                setNotice(
                  "Vui lòng chọn tuần kế hoạch để xác định phiên bản Quy tắc Safety Days phù hợp.",
                );
                return;
              }
              const result = buildProductionEngine(
                baseRows,
                engineEvents,
                value,
                snapshotStockMap(matched),
                matchedRule,
              );
              const now = new Date().toISOString();
              const enginePayload = {
                week: value,
                weekKey: weekKeyOf(value),
                snapshotId: matched.id,
                snapshotCode: matched.code,
                snapshotAt: matched.snapshotAt,
                generatedAt: now,
                generatedBy: operator,
                ruleId: matchedRule.id,
                ruleCode: matchedRule.code,
                ruleVersion: matchedRule.version,
                ruleEffectiveFrom: matchedRule.effectiveFrom,
                ruleEffectiveTo: matchedRule.effectiveTo,
                rows: result.rows,
                metrics: Array.from(result.metrics.entries()),
              };
              const response = await fetch("/api/records", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  entity: "production_engine",
                  key: `${value}:${matched.id}:${now}`,
                  payload: enginePayload,
                  updatedBy: operator,
                }),
              });
              if (response.ok)
                await fetch("/api/records", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({
                    entity: "production_engine_snapshot",
                    key: `${value}:${now}`,
                    payload: enginePayload,
                    updatedBy: operator,
                  }),
                });
              if (response.ok && matched.status === "Đã chốt") {
                const used = {
                  ...matched,
                  status: "Đã được Production_engine sử dụng" as const,
                  usedByEngineAt: now,
                };
                await saveInventorySnapshot(used, operator);
                setInventorySnapshots((current) =>
                  current.map((item) => (item.id === used.id ? used : item)),
                );
              }
              setNotice(
                response.ok
                  ? `Đã tạo Production_engine tuần ${result.weekLabel} bằng bản chốt ${matched.code}.`
                  : "Không thể lưu dữ liệu tuần. Vui lòng thử lại.",
              );
            }}
            onCalc={setCalcSku}
            onMove={(id) => {
              if (!activeSnapshot) {
                setNotice("Chưa có bản chốt tồn hợp lệ cho tuần này.");
                return;
              }
              const selected = engineResult.rows.find((row) => row.id === id);
              if (!selected) return;
              setRows((current) =>
                current.some((row) => row.id === id)
                  ? current.map((row) =>
                      row.id === id ? { ...row, status: "Dự kiến" } : row,
                    )
                  : [...current, { ...selected, status: "Dự kiến" }],
              );
              setNotice(
                "Đã tạo dòng kế hoạch dự kiến tại 06 từ kết quả Production Engine.",
              );
            }}
          />
        </>
      )}
      {tab === "plan" && (
        <PlanFinalView
          rows={planned}
          onUpdate={update}
          onFinalize={() => {
            const closing = planned.filter((r) => r.status !== "Hoãn");
            setRows((v) =>
              v.map((r) =>
                closing.some((x) => x.id === r.id)
                  ? { ...r, status: "Đã chốt" }
                  : r,
              ),
            );
            setFinalizedIds(closing.map((r) => r.id));
            setNotice(
              `Đã chốt ${closing.length} dòng và chuyển sang 04. Đơn Hoãn được giữ lại tại 06.`,
            );
          }}
        />
      )}
      {tab === "tracking" && (
        <TrackingFinalView
          rows={planned.filter((r) => finalizedIds.includes(r.id))}
        />
      )}
      {tab === "base" && (
        <section className="data-card">
          <div className="plan-toolbar">
            <div>
              <strong>Base Forecast · Dữ liệu Kinh doanh đã chốt</strong>
              <span>Tháng áp dụng 08/2026 · KHSX chỉ xem, không chỉnh sửa</span>
            </div>
            <span className="locked-pill">🔒 Dữ liệu nguồn</span>
          </div>
          <div className="base-month-toolbar">
            <label>
              <span>THÁNG FORECAST</span>
              <select
                value={baseMonth}
                onChange={(event) => {
                  setBaseMonth(event.target.value);
                  updatePlanningSessionCache({ baseMonth: event.target.value });
                }}
              >
                {baseMonths.map((month) => (
                  <option key={month}>{month}</option>
                ))}
              </select>
            </label>
            <span>
              {visibleBaseRows.length.toLocaleString("vi-VN")} SKU trong tháng{" "}
              {baseMonth}
            </span>
          </div>
          <div className="base-summary">
            <div>
              <span>Tổng Forecast 30D</span>
              <b>{baseTotals.f30.toLocaleString("vi-VN")}</b>
            </div>
            <div>
              <span>Tổng Forecast 60D</span>
              <b>{baseTotals.f60.toLocaleString("vi-VN")}</b>
            </div>
            <div>
              <span>Tổng Forecast 90D</span>
              <b>{baseTotals.f90.toLocaleString("vi-VN")}</b>
            </div>
            <div>
              <span>Phiên bản</span>
              <b>FORECAST-SX-{baseMonth.replace("/", "")}</b>
            </div>
            <div>
              <span>Kinh doanh chốt</span>
              <b>Dữ liệu từ PDF Kinh doanh</b>
            </div>
          </div>
          <div className="table-wrap">
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
                {visibleBaseRows.map((r) => {
                  return (
                    <tr key={`${r.month}-${r.sku}`}>
                      <td>{r.month}</td>
                      <td>{r.group}</td>
                      <td>
                        <b className="plan-sku">{r.sku}</b>
                      </td>
                      <td>
                        <strong>{r.name}</strong>
                      </td>
                      <td>{r.spec}</td>
                      <td>
                        {r.line
                          ? `${r.line === "NK" ? "NK" : `Line ${r.line}`}`
                          : "—"}
                      </td>
                      <td className="number">
                        {r.f30.toLocaleString("vi-VN")}
                      </td>
                      <td className="number">
                        {r.f60.toLocaleString("vi-VN")}
                      </td>
                      <td className="number">
                        {r.f90.toLocaleString("vi-VN")}
                      </td>
                      <td className="number">
                        {r.d30.toLocaleString("vi-VN")}
                      </td>
                      <td className="number">
                        {r.d60.toLocaleString("vi-VN")}
                      </td>
                      <td className="number demand-used">
                        {r.used.toLocaleString("vi-VN")}
                      </td>
                      <td className="number">
                        {r.d90.toLocaleString("vi-VN")}
                      </td>
                      <td>
                        {r.warning ? (
                          <span className="change-badge" title={r.warning}>
                            NVL/MOQ
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="source-note">
            <b>Nguồn dữ liệu:</b> Forecast Kinh doanh chuyển sang KHSX. Khi Kinh
            doanh cập nhật, hệ thống tạo phiên bản mới và giữ lịch sử phiên bản
            cũ.
          </div>
        </section>
      )}
      {tab === "proposal" && (
        <section className="data-card">
          <div className="plan-toolbar">
            <div>
              <strong>Tuần 36 · 31/08–06/09/2026</strong>
              <span>
                Forecast áp dụng: 09/2026 · Phiên tính RUN-20260827-001
              </span>
            </div>
            <div className="view-toggle">
              <button
                className={!fullView ? "active" : ""}
                onClick={() => setFullView(false)}
              >
                Tổng hợp
              </button>
              <button
                className={fullView ? "active" : ""}
                onClick={() => setFullView(true)}
              >
                Đầy đủ như Google Sheets
              </button>
            </div>
            <div className="metric">
              <b>4</b>
              <small>SKU đề xuất</small>
            </div>
            <div className="metric">
              <b>8.900</b>
              <small>Tổng SL</small>
            </div>
          </div>
          <div className="forecast-legend">
            <span className="forecast-key">Forecast & Daily Demand</span>
            <span className="event-key">Demand Event</span>
            <span className="supply-key">Tồn kho & nguồn cung</span>
            <span className="policy-key">Lead time, Safety, MOQ</span>
            <span className="result-key">Kết quả đề xuất</span>
          </div>
          <div className="table-wrap">
            <table
              className={`plan-table forecast-table ${fullView ? "full" : "summary"}`}
            >
              <thead>
                <tr>
                  <th className="sticky-col priority-col">ƯU TIÊN</th>
                  <th className="sticky-col product-col">SKU / SẢN PHẨM</th>
                  <th>LINE</th>
                  <th className="forecast-head">FORECAST 30D</th>
                  <th className="forecast-head">FORECAST 60D</th>
                  {fullView && (
                    <>
                      <th className="forecast-head">FORECAST 90D</th>
                      <th className="forecast-head">DAILY 30D</th>
                      <th className="forecast-head">DAILY 60D</th>
                      <th className="forecast-head">DAILY 90D</th>
                    </>
                  )}
                  <th className="forecast-head">DEMAND DÙNG CHO SX</th>
                  {fullView && (
                    <>
                      <th className="event-head">DEMAND EVENT</th>
                      <th className="supply-head">TỒN ERP</th>
                      <th className="supply-head">ĐANG SX / ĐANG ĐI</th>
                      <th className="supply-head">NGUỒN CUNG</th>
                      <th className="policy-head">LEAD TIME</th>
                      <th className="policy-head">SAFETY DAYS</th>
                      <th className="policy-head">MOQ</th>
                    </>
                  )}
                  <th className="result-head">ROP</th>
                  <th className="result-head">SL ĐỀ XUẤT</th>
                  <th className="result-head">TỔNG GIỜ CÔNG</th>
                  {fullView && <th className="result-head">CẢNH BÁO 90D</th>}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const f = forecastData[r.sku];
                  return (
                    <tr key={r.id}>
                      <td className="sticky-col priority-col">
                        <span
                          className={`priority ${r.priority.includes("Khẩn") ? "urgent" : r.priority === "Bù tải" ? "load" : ""}`}
                        >
                          {r.priority}
                        </span>
                      </td>
                      <td className="sticky-col product-col">
                        <button
                          className="plan-sku calc-link"
                          onClick={() => setCalcSku(r.sku)}
                        >
                          {r.sku}
                        </button>
                        <strong>{r.name}</strong>
                        <small>
                          {r.spec} · {r.group}
                        </small>
                      </td>
                      <td>Line {r.line}</td>
                      <td className="forecast-cell number">
                        {f.f30.toLocaleString("vi-VN")}
                      </td>
                      <td className="forecast-cell number">
                        {f.f60.toLocaleString("vi-VN")}
                      </td>
                      {fullView && (
                        <>
                          <td className="forecast-cell number">
                            {f.f90.toLocaleString("vi-VN")}
                          </td>
                          <td className="forecast-cell number">
                            {f.d30.toLocaleString("vi-VN")}
                          </td>
                          <td className="forecast-cell number">
                            {f.d60.toLocaleString("vi-VN")}
                          </td>
                          <td className="forecast-cell number">
                            {f.d90.toLocaleString("vi-VN")}
                          </td>
                        </>
                      )}
                      <td className="forecast-cell demand-used number">
                        {f.used.toLocaleString("vi-VN")}
                      </td>
                      {fullView && (
                        <>
                          <td className="event-cell number">
                            {f.event.toLocaleString("vi-VN")}
                          </td>
                          <td className="supply-cell number">
                            {f.stock.toLocaleString("vi-VN")}
                          </td>
                          <td className="supply-cell number">
                            {f.wip.toLocaleString("vi-VN")}
                          </td>
                          <td className="supply-cell number">
                            {(f.stock + f.wip).toLocaleString("vi-VN")}
                          </td>
                          <td className="policy-cell number">{f.lead} ngày</td>
                          <td className="policy-cell number">
                            {f.safety} ngày
                          </td>
                          <td className="policy-cell number">
                            {f.moq.toLocaleString("vi-VN")}
                          </td>
                        </>
                      )}
                      <td className="result-cell number">
                        {f.rop.toLocaleString("vi-VN")}
                      </td>
                      <td className="result-cell number suggested-number">
                        {r.suggested.toLocaleString("vi-VN")}
                      </td>
                      <td className="result-cell number">
                        {(r.suggested * f.hours).toLocaleString("vi-VN", {
                          maximumFractionDigits: 1,
                        })}
                      </td>
                      {fullView && (
                        <td className="result-cell">
                          <span
                            className={
                              f.warning === "Ổn định"
                                ? "done-badge"
                                : "change-badge"
                            }
                          >
                            {f.warning}
                          </span>
                        </td>
                      )}
                      <td>
                        <div className="proposal-actions">
                          <button
                            className="calc-button"
                            onClick={() => setCalcSku(r.sku)}
                          >
                            Xem cách tính
                          </button>
                          <button
                            className="row-action"
                            disabled={r.status !== "Chưa đưa vào kế hoạch"}
                            onClick={() => moveToPlan(r.id)}
                          >
                            Đưa vào 06 →
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="material-hint">
            <b>Chuẩn bị vật tư 30D/60D:</b>
            <span>
              Forecast được giữ ngay trên màn hình 05 để KHSX nhận biết nhu cầu
              sắp tới. Khi BOM được kết nối, hệ thống sẽ phân rã thành nhu cầu
              NVL/BTP và cảnh báo ngày cần chuẩn bị.
            </span>
          </div>
        </section>
      )}
      {tab === "tracking" && (
        <section className="data-card">
          <div className="plan-toolbar">
            <div>
              <strong>Theo dõi giao nhận lệnh và tiến độ</strong>
              <span>Vai trò của Sheet 04 · mọi thao tác được lưu nhật ký</span>
            </div>
          </div>
          <div className="table-wrap">
            <table className="plan-table">
              <thead>
                <tr>
                  <th>MÃ LSX</th>
                  <th>SKU / SẢN PHẨM</th>
                  <th>SL LSX</th>
                  <th>TIẾN ĐỘ</th>
                  <th>TRẠNG THÁI LSX</th>
                  <th>ĐỒNG BỘ</th>
                  <th>LẦN SX NHẬN GẦN NHẤT</th>
                  <th>NGƯỜI CẬP NHẬT</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <b className="plan-sku">510-26083101</b>
                  </td>
                  <td>
                    <b className="plan-sku">102XS04001</b>
                    <strong>DÂY XẢ INOX SỌC</strong>
                    <small>14MM 40cm · Line A</small>
                  </td>
                  <td className="number">2.000</td>
                  <td>
                    <div className="progress">
                      <i style={{ width: "62%" }} />
                      <span>62%</span>
                    </div>
                  </td>
                  <td>
                    <span className="status-running">Đang sản xuất</span>
                  </td>
                  <td>
                    <span className="done-badge">Đã đồng bộ</span>
                  </td>
                  <td>
                    31/08/2026 08:12
                    <br />
                    <small>Lần nhận: 2</small>
                  </td>
                  <td>
                    sanxuat@onspa.com
                    <br />
                    <small>31/08/2026 10:35</small>
                  </td>
                </tr>
                <tr>
                  <td>
                    <b className="plan-sku">510-26083102</b>
                  </td>
                  <td>
                    <b className="plan-sku">107P5127</b>
                    <strong>VAN PHAO NHỰA</strong>
                    <small>3/4&quot; · Line B</small>
                  </td>
                  <td className="number">4.800</td>
                  <td>
                    <div className="progress">
                      <i style={{ width: "100%" }} />
                      <span>100%</span>
                    </div>
                  </td>
                  <td>
                    <span className="done-badge">Hoàn thành</span>
                  </td>
                  <td>
                    <span className="change-badge">Có thay đổi</span>
                  </td>
                  <td>
                    31/08/2026 08:20
                    <br />
                    <small>Lần nhận: 3</small>
                  </td>
                  <td>
                    khsx@onspa.com
                    <br />
                    <small>02/09/2026 15:10</small>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="audit-strip">
            <b>Nhật ký gần nhất</b>
            <span>
              02/09 15:10 · KHSX đổi ngày HT dự kiến 03/09 → 04/09 · Lý do: ưu
              tiên đơn gấp · SX đã nhận thay đổi
            </span>
            <button>Xem toàn bộ nhật ký</button>
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
              <button
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
                  <button onClick={() => setCalcSku(null)}>×</button>
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
                      <dd>
                        MAX({f.d30}; {f.d60}) = {f.used}
                      </dd>
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

type OverviewStep = { id: string; tab?: PlanningTab; title: string; note: string; children?: Array<{ id: string; tab?: PlanningTab; title: string }> };
const moduleOverviewSteps: Record<Exclude<MainView, "users">, OverviewStep[]> = {
  sku: [
    { id: "sku-master", title: "SKU Master", note: "Tạo nguồn dữ liệu gốc của sản phẩm" },
    { id: "leadtime", title: "Lead Time theo SKU", note: "Thiết lập và xác nhận thời gian sản xuất" },
    { id: "safety-days", title: "Quy tắc Safety Days", note: "Tính ngày an toàn theo Lead Time" },
  ],
  bom: [
    { id: "bom-data", title: "Dữ liệu lượng dùng BOM", note: "Tạo BOM mới từ SKU Master" },
    { id: "bom-change", title: "Phiếu thay đổi BOM", note: "Sửa cấu trúc và gửi chờ xác nhận" },
  ],
  planning: [
    { id: "base", tab: "base", title: "Base Forecast", note: "Nhận nhu cầu cơ sở từ kinh doanh" },
    { id: "demand", tab: "demand", title: "Demand Event", note: "Ghi nhận nhu cầu phát sinh và bù tải" },
    { id: "proposal", tab: "proposal", title: "Production Engine", note: "Tính ROP và đề xuất bổ sung" },
    { id: "plan", tab: "plan", title: "Production Plan", note: "Điều chỉnh, chốt và mở lệnh sản xuất" },
    { id: "tracking", tab: "tracking", title: "In Transit", note: "Theo dõi tiến độ lệnh đang sản xuất" },
    { id: "report", tab: "report", title: "Report", note: "Tổng hợp kết quả kế hoạch" },
  ],
  production: [
    { id: "production-report", title: "Báo công sản xuất", note: "Thao tác trực tiếp trên lệnh sản xuất", children: [
      { id: "report-station", title: "Nhập trạm" }, { id: "report-pause", title: "Tạm ngưng" }, { id: "report-incident", title: "Báo sự cố (tự tạm ngưng)" }, { id: "report-resume", title: "Tiếp tục" }, { id: "report-labor", title: "Điều chỉnh nhân lực" }, { id: "report-time", title: "Điều chỉnh thời gian" }, { id: "report-complete", title: "Báo công hoàn thành" },
    ] },
    { id: "labor-adjustment", title: "Điều chỉnh nhân lực", note: "Điều chuyển nhân lực giữa các Line", children: [{ id: "labor-add", title: "Bổ sung nhân lực" }, { id: "labor-reduce", title: "Giảm nhân lực" }] },
    { id: "weekly-capacity", title: "Capacity tuần", note: "Theo dõi năng lực và giờ khả dụng" },
    { id: "data-recovery", title: "Khôi phục dữ liệu", note: "Phục hồi dữ liệu thao tác khi có sự cố" },
  ],
  warehouse: [
    { id: "warehouse-overview", title: "Tổng quan", note: "Theo dõi trạng thái kho thành phẩm" },
    { id: "warehouse-in", title: "Nhập kho", note: "Tiếp nhận và xác nhận số lượng thực nhập" },
    { id: "inventory", title: "Tồn kho ERP", note: "Kiểm tra tồn theo SKU, kho và vị trí" },
    { id: "warehouse-transfer", title: "Chuyển kho", note: "Điều chuyển và xác nhận kho nhận" },
    { id: "warehouse-out", title: "Xuất kho", note: "Xác nhận xuất và cập nhật tồn" },
    { id: "warehouse-docs", title: "Phiếu kho", note: "Quản lý trạng thái chứng từ kho" },
    { id: "warehouse-count", title: "Kiểm kê", note: "Đối chiếu và xử lý chênh lệch" },
    { id: "warehouse-report", title: "Báo cáo", note: "Tra cứu lịch sử giao dịch" },
  ],
};

function ModuleOverview({ view, onOpen, sessionLine }: { view: Exclude<MainView, "users">; onOpen: (id: string, tab?: PlanningTab) => void; sessionLine?: "A" | "B" }) {
  const titles: Record<Exclude<MainView, "users">, string> = { sku: "Dữ liệu cơ bản", warehouse: "Quản lý kho", bom: "Cấu trúc thành phẩm", planning: "Kế hoạch sản xuất", production: "Quản lý sản xuất" };
  return <main className="workspace module-overview"><div className="module-overview-heading"><span>QUY TRÌNH NGHIỆP VỤ</span><h1>{titles[view]}</h1><p>{view === "planning" ? "Dữ liệu đi lần lượt theo chiều mũi tên từ Forecast đến báo cáo" : view === "production" ? "Thực hiện báo công theo thứ tự từ nhập trạm đến hoàn thành" : "Chọn một bước để mở màn hình thao tác"}</p></div><section className={`process-map process-map-${view}`}>{moduleOverviewSteps[view].map((step, index) => { const restricted = Boolean(view === "production" && sessionLine && ["weekly-capacity", "data-recovery"].includes(step.id)); return <article className={`process-stage ${step.children?.length ? "has-branches" : ""}`} key={step.id}><div className="process-stage-number">{String(index + 1).padStart(2, "0")}</div><button className="process-stage-main" disabled={restricted} onClick={() => onOpen(step.id, step.tab)}><b>{step.title}</b><span>{restricted ? `Không áp dụng cho thiết bị Line ${sessionLine}` : step.note}</span><em>Mở nghiệp vụ</em></button>{step.children && <div className={`process-branches ${step.id === "production-report" ? "report-flow" : ""}`}>{step.children.map((child, childIndex) => <button key={child.id} onClick={() => onOpen(child.id, child.tab)}><small>{String(childIndex + 1).padStart(2, "0")}</small><b>{child.title}</b></button>)}</div>}{index < moduleOverviewSteps[view].length - 1 && <span className="process-flow-line" aria-hidden="true" />}</article>; })}</section></main>;
}

function TopModules({
  view,
  onParent,
  sessionLine,
}: {
  view: MainView;
  onParent: (v: MainView) => void;
  sessionLine?: "A" | "B";
}) {
  const moduleButton = (key: MainView, label: string) => {
    const restricted = Boolean(sessionLine && key !== "production");
    return (
      <button
        className={`${view === key ? "active " : ""}${restricted ? "permission-disabled" : ""}`}
        disabled={restricted}
        title={
          restricted
            ? `Thiết bị Line ${sessionLine} không có quyền thao tác phân hệ này`
            : undefined
        }
        onClick={() => onParent(key)}
      >
        {label}
        {restricted && <span className="permission-lock">⌁</span>}
      </button>
    );
  };
  return (
    <div className="top-modules">
      {moduleButton("users", "Quản trị hệ thống")}
      {moduleButton("sku", "Dữ liệu cơ bản")}
      {moduleButton("warehouse", "Quản lý kho")}
      {moduleButton("bom", "Cấu trúc thành phẩm")}
      {moduleButton("planning", "Kế hoạch sản xuất")}
      {moduleButton("production", "Quản lý sản xuất")}
    </div>
  );
}

function AppSidebar({
  view,
  child,
  onParent,
  onChild,
  sessionLine,
}: {
  view: MainView;
  child: string | null;
  onParent: (v: MainView) => void;
  onChild: (v: MainView, c: string, tab?: PlanningTab) => void;
  sessionLine?: "A" | "B";
}) {
  return (
    <aside className="app-sidebar">
      <p>PHÂN HỆ</p>
      <button
        className={view === "users" ? "active" : ""}
        onClick={() => onParent("users")}
      >
        👤 Quản trị hệ thống <i>{view === "users" ? "⌄" : "›"}</i>
      </button>
      {view === "users" && (
        <div className="sidebar-children">
          <button
            className={child === "users-list" ? "active" : ""}
            onClick={() => onChild("users", "users-list")}
          >
            <span className="menu-icon">♟</span>Quản lý người dùng
          </button>
          <button
            className={child === "permissions" ? "active" : ""}
            onClick={() => onChild("users", "permissions")}
          >
            <span className="menu-icon">◆</span>Phân quyền
          </button>
          <button
            className={child === "audit" ? "active" : ""}
            onClick={() => onChild("users", "audit")}
          >
            <span className="menu-icon">◷</span>Nhật ký thao tác
          </button>
          <button
            className={child === "versions" ? "active" : ""}
            onClick={() => onChild("users", "versions")}
          >
            <span className="menu-icon">▤</span>Quản lý phiên bản
          </button>
          <button
            className={child === "data-status" ? "active" : ""}
            onClick={() => onChild("users", "data-status")}
          >
            <span className="menu-icon">◉</span>Tình trạng dữ liệu
          </button>
          <button
            className={child === "backup-restore" ? "active" : ""}
            onClick={() => onChild("users", "backup-restore")}
          >
            <span className="menu-icon">⛁</span>Sao lưu và khôi phục
          </button>
        </div>
      )}
      <button
        className={view === "sku" ? "active" : ""}
        onClick={() => onParent("sku")}
      >
        ▦ Dữ liệu cơ bản <i>{view === "sku" ? "⌄" : "›"}</i>
      </button>
      {view === "sku" && (
        <div className="sidebar-children">
          <button
            className={child === "sku-master" ? "active" : ""}
            onClick={() => onChild("sku", "sku-master")}
          >
            <span className="menu-icon">▦</span>SKU Master
          </button>
          <button
            className={child === "leadtime" ? "active" : ""}
            onClick={() => onChild("sku", "leadtime")}
          >
            <span className="menu-icon">◷</span>Lead Time theo SKU
          </button>
          <button
            className={child === "safety-days" ? "active" : ""}
            onClick={() => onChild("sku", "safety-days")}
          >
            <span className="menu-icon">◇</span>Quy tắc Safety Days
          </button>
        </div>
      )}
      <button
        className={view === "warehouse" ? "active" : ""}
        onClick={() => onParent("warehouse")}
      >
        ▣ Quản lý kho <i>{view === "warehouse" ? "⌄" : "›"}</i>
      </button>
      {view === "warehouse" && (
        <div className="sidebar-children warehouse-children">
          <button
            className={child === "warehouse-overview" ? "active" : ""}
            onClick={() => onChild("warehouse", "warehouse-overview")}
          >
            <span className="menu-icon">⌂</span>Tổng quan
          </button>
          <button
            className={child === "inventory" ? "active" : ""}
            onClick={() => onChild("warehouse", "inventory")}
          >
            <span className="menu-icon">▤</span>Tồn kho ERP
          </button>
          <button
            className={child === "warehouse-in" ? "active" : ""}
            onClick={() => onChild("warehouse", "warehouse-in")}
          >
            <span className="menu-icon">⇥</span>Nhập kho
          </button>
          <button
            className={child === "warehouse-out" ? "active" : ""}
            onClick={() => onChild("warehouse", "warehouse-out")}
          >
            <span className="menu-icon">⇤</span>Xuất kho
          </button>
          <button
            className={child === "warehouse-transfer" ? "active" : ""}
            onClick={() => onChild("warehouse", "warehouse-transfer")}
          >
            <span className="menu-icon">⇄</span>Chuyển kho
          </button>
          <button
            className={child === "warehouse-docs" ? "active" : ""}
            onClick={() => onChild("warehouse", "warehouse-docs")}
          >
            <span className="menu-icon">▧</span>Phiếu kho
          </button>
          <button
            className={child === "warehouse-count" ? "active" : ""}
            onClick={() => onChild("warehouse", "warehouse-count")}
          >
            <span className="menu-icon">✓</span>Kiểm kê
          </button>
          <button
            className={child === "warehouse-report" ? "active" : ""}
            onClick={() => onChild("warehouse", "warehouse-report")}
          >
            <span className="menu-icon">▥</span>Báo cáo
          </button>
        </div>
      )}
      <button
        className={view === "bom" ? "active" : ""}
        onClick={() => onParent("bom")}
      >
        ⌘ Cấu trúc thành phẩm <i>{view === "bom" ? "⌄" : "›"}</i>
      </button>
      {view === "bom" && (
        <div className="sidebar-children">
          <button
            className={child === "bom-data" ? "active" : ""}
            onClick={() => onChild("bom", "bom-data")}
          >
            <span className="menu-icon">⌘</span>Dữ liệu lượng dùng BOM
          </button>
          <button
            className={child === "bom-change" ? "active" : ""}
            onClick={() => onChild("bom", "bom-change")}
          >
            <span className="menu-icon">✎</span>Phiếu thay đổi BOM
          </button>
        </div>
      )}
      <button
        className={view === "planning" ? "active" : ""}
        onClick={() => onParent("planning")}
      >
        ◫ Kế hoạch sản xuất <i>{view === "planning" ? "⌄" : "›"}</i>
      </button>
      {view === "planning" && (
        <div className="sidebar-children">
          <button
            className={child === "base" ? "active" : ""}
            onClick={() => onChild("planning", "base", "base")}
          >
            <span className="menu-icon">▦</span>Base_forecast
          </button>
          <button
            className={child === "demand" ? "active" : ""}
            onClick={() => onChild("planning", "demand", "demand")}
          >
            <span className="menu-icon">＋</span>Demand_event
          </button>
          <button
            className={child === "proposal" ? "active" : ""}
            onClick={() => onChild("planning", "proposal", "proposal")}
          >
            <span className="menu-icon">⚙</span>Production_engine
          </button>
          <button
            className={`engine-rule-menu ${child === "rules" ? "active" : ""}`}
            onClick={() => onChild("planning", "rules", "rules")}
          >
            <span className="menu-icon">↳</span>Quy tắc áp dụng
          </button>
          <button
            className={child === "plan" ? "active" : ""}
            onClick={() => onChild("planning", "plan", "plan")}
          >
            <span className="menu-icon">▣</span>Production_plan
          </button>
          <button
            className={child === "tracking" ? "active" : ""}
            onClick={() => onChild("planning", "tracking", "tracking")}
          >
            <span className="menu-icon">⇄</span>In_transit
          </button>
          <button
            className={child === "report" ? "active" : ""}
            onClick={() => onChild("planning", "report", "report")}
          >
            <span className="menu-icon">▥</span>Report
          </button>
        </div>
      )}
      {view === "production" && (
        <div className="sidebar-children">
          <button
            className={
              child === "production-report" || child?.startsWith("report-")
                ? "active"
                : ""
            }
            onClick={() => onChild("production", "production-report")}
          >
            <span className="menu-icon">▶</span>Báo công sản xuất{" "}
            <i>
              {child === "production-report" || child?.startsWith("report-")
                ? "⌄"
                : "›"}
            </i>
          </button>
          {(child === "production-report" || child?.startsWith("report-")) && (
            <div className="production-report-actions">
              <button
                className={child === "report-station" ? "active" : ""}
                onClick={() => onChild("production", "report-station")}
              >
                <span>↧</span>Nhập trạm dòng đang chọn
              </button>
              <button
                className={child === "report-pause" ? "active" : ""}
                onClick={() => onChild("production", "report-pause")}
              >
                <span>Ⅱ</span>Tạm ngưng dòng đang chọn
              </button>
              <button
                className={child === "report-resume" ? "active" : ""}
                onClick={() => onChild("production", "report-resume")}
              >
                <span>▶</span>Tiếp tục dòng đang chọn
              </button>
              <button
                className={child === "report-complete" ? "active" : ""}
                onClick={() => onChild("production", "report-complete")}
              >
                <span>✓</span>Báo công dòng đang chọn
              </button>
              <button
                className={child === "report-incident" ? "active" : ""}
                onClick={() => onChild("production", "report-incident")}
              >
                <span>!</span>Báo sự cố dòng đang chọn
              </button>
              <button
                className={child === "report-labor" ? "active" : ""}
                onClick={() => onChild("production", "report-labor")}
              >
                <span>♟</span>Điều chỉnh nhân lực báo công
              </button>
              <button
                className={child === "report-time" ? "active" : ""}
                onClick={() => onChild("production", "report-time")}
              >
                <span>◷</span>Điều chỉnh thời gian sản xuất
              </button>
            </div>
          )}
          <button
            className={
              child === "labor-adjustment" || child?.startsWith("labor-")
                ? "active"
                : ""
            }
            title={
              sessionLine
                ? `Điều chỉnh nhân lực của Line ${sessionLine}`
                : undefined
            }
            onClick={() => onChild("production", "labor-adjustment")}
          >
            <span className="menu-icon">♟</span>Điều chỉnh nhân lực{" "}
            <i>
              {child === "labor-adjustment" || child?.startsWith("labor-")
                ? "⌄"
                : "›"}
            </i>
          </button>
          {(child === "labor-adjustment" || child?.startsWith("labor-")) && (
            <div className="labor-actions">
              <button
                className={child === "labor-add" ? "active" : ""}
                onClick={() => onChild("production", "labor-add")}
              >
                <span className="menu-icon">＋</span>Bổ sung nhân lực
              </button>
              <button
                className={child === "labor-reduce" ? "active" : ""}
                onClick={() => onChild("production", "labor-reduce")}
              >
                <span className="menu-icon">−</span>Giảm nhân lực
              </button>
            </div>
          )}
          <button
            className={`${child === "data-recovery" ? "active " : ""}${sessionLine ? "permission-disabled" : ""}`}
            disabled={Boolean(sessionLine)}
            title={
              sessionLine
                ? "Tài khoản hiện trường không có quyền khôi phục dữ liệu"
                : undefined
            }
            onClick={() => onChild("production", "data-recovery")}
          >
            <span className="menu-icon">↺</span>Khôi phục dữ liệu
          </button>
          <button
            className={`${child === "weekly-capacity" ? "active " : ""}${sessionLine ? "permission-disabled" : ""}`}
            disabled={Boolean(sessionLine)}
            title={
              sessionLine
                ? "Tài khoản hiện trường chỉ được xem nghiệp vụ báo công theo Line"
                : undefined
            }
            onClick={() => onChild("production", "weekly-capacity")}
          >
            <span className="menu-icon">▥</span>Capacity tuần
          </button>
        </div>
      )}
      <button>
        ⚙ Quản lý sản xuất <i>›</i>
      </button>
    </aside>
  );
}

type SystemUser = {
  company: string;
  department: string;
  login: string;
  name: string;
  phone: string;
  mobile: string;
  active: boolean;
};
const initialSystemUsers: SystemUser[] = [
  {
    company: "",
    department: "",
    login: "gbthanh",
    name: "Giam Bình Thành",
    phone: "",
    mobile: "",
    active: true,
  },
  {
    company: "",
    department: "",
    login: "test003",
    name: "test003",
    phone: "",
    mobile: "",
    active: true,
  },
  {
    company: "SHINTUNG",
    department: "SHINTUNG",
    login: "chhoang",
    name: "Chung Huệ Hoang",
    phone: "",
    mobile: "",
    active: true,
  },
  {
    company: "SHINTUNG",
    department: "SHINTUNG",
    login: "frank",
    name: "Frank",
    phone: "",
    mobile: "",
    active: true,
  },
  {
    company: "SHINTUNG",
    department: "SHINTUNG",
    login: "haquyen",
    name: "Hà Ái Quyên",
    phone: "",
    mobile: "",
    active: true,
  },
  {
    company: "SHINTUNG",
    department: "SHINTUNG",
    login: "halan",
    name: "Hồng A Lan",
    phone: "",
    mobile: "",
    active: true,
  },
  {
    company: "SHINTUNG",
    department: "SHINTUNG",
    login: "lthgam",
    name: "Lê Thị Hồng Gấm",
    phone: "",
    mobile: "",
    active: true,
  },
  {
    company: "SHINTUNG",
    department: "SHINTUNG",
    login: "ltthu",
    name: "Lê Thị Thu",
    phone: "",
    mobile: "",
    active: true,
  },
  {
    company: "SHINTUNG",
    department: "SHINTUNG",
    login: "ntynhi",
    name: "Nguyễn Thị Yến Nhi",
    phone: "",
    mobile: "",
    active: true,
  },
  {
    company: "SHINTUNG",
    department: "SHINTUNG",
    login: "ntythanh",
    name: "Nguyễn Thị Ý Thanh",
    phone: "",
    mobile: "",
    active: true,
  },
  {
    company: "SHINTUNG",
    department: "SHINTUNG",
    login: "tsnhi",
    name: "SƯƠNG NHI TRƯƠNG",
    phone: "",
    mobile: "",
    active: true,
  },
  {
    company: "SHINTUNG",
    department: "SHINTUNG",
    login: "ttxuan",
    name: "TANG LE XUAN",
    phone: "",
    mobile: "",
    active: true,
  },
  {
    company: "SHINTUNG",
    department: "SHINTUNG",
    login: "tctuyet",
    name: "Trương Cẩm Tuyết",
    phone: "",
    mobile: "",
    active: true,
  },
  {
    company: "SHINTUNG",
    department: "SHINTUNG",
    login: "ttlai",
    name: "Trương Tuyết Lai",
    phone: "",
    mobile: "",
    active: true,
  },
  {
    company: "SHINTUNG",
    department: "SHINTUNG",
    login: "vthduyen",
    name: "Vũ Thị Hương Duyên",
    phone: "",
    mobile: "",
    active: true,
  },
  {
    company: "SHINTUNG",
    department: "SHINTUNG",
    login: "admin",
    name: "系統管理員admin",
    phone: "867511",
    mobile: "12345678",
    active: true,
  },
  {
    company: "SHINTUNG",
    department: "KHO",
    login: "httai",
    name: "Hồng Thanh Tài",
    phone: "",
    mobile: "",
    active: true,
  },
  {
    company: "SHINTUNG",
    department: "KHO",
    login: "httung",
    name: "Hồng Thanh Tùng",
    phone: "",
    mobile: "",
    active: true,
  },
  {
    company: "SHINTUNG",
    department: "KHO",
    login: "ltphong",
    name: "Lê Thanh Phong",
    phone: "",
    mobile: "",
    active: true,
  },
  {
    company: "SHINTUNG",
    department: "KHO",
    login: "Ttlinh",
    name: "Linh",
    phone: "",
    mobile: "",
    active: true,
  },
  {
    company: "SHINTUNG",
    department: "KHO",
    login: "tpnhi",
    name: "Trương Phụng Nhi",
    phone: "",
    mobile: "",
    active: true,
  },
  {
    company: "SHINTUNG",
    department: "SX",
    login: "cnphuong",
    name: "CHIENG NGOC PHUONG",
    phone: "",
    mobile: "",
    active: true,
  },
  {
    company: "SHINTUNG",
    department: "SX",
    login: "htndiem",
    name: "HO THI NGOC DIEM",
    phone: "",
    mobile: "",
    active: true,
  },
  {
    company: "SHINTUNG",
    department: "SX",
    login: "ntnphung",
    name: "NGUYEN THI NGOC PHUNG",
    phone: "",
    mobile: "",
    active: true,
  },
  {
    company: "SHINTUNG",
    department: "SX",
    login: "nttvy",
    name: "NGUYEN THUY THANH VY",
    phone: "",
    mobile: "",
    active: true,
  },
  {
    company: "SHINTUNG",
    department: "SX",
    login: "ncvinh",
    name: "Ngô Chí Vinh",
    phone: "",
    mobile: "",
    active: true,
  },
  {
    company: "SHINTUNG",
    department: "QC",
    login: "lcnguyen",
    name: "Lê Chí Nguyên",
    phone: "",
    mobile: "",
    active: true,
  },
  {
    company: "SHINTUNG",
    department: "QC",
    login: "ltloi",
    name: "Lưu Lâm Thắng Lợi",
    phone: "",
    mobile: "",
    active: true,
  },
  {
    company: "SHINTUNG",
    department: "QC",
    login: "npthao",
    name: "Nguyễn Phương Thảo",
    phone: "",
    mobile: "",
    active: true,
  },
  {
    company: "SHINTUNG",
    department: "QC",
    login: "ttnien",
    name: "Trần Thanh Niên",
    phone: "",
    mobile: "",
    active: true,
  },
];

let systemUsersCache: SystemUser[] | null = null;
let systemUsersPromise: Promise<SystemUser[]> | null = null;

function rememberSystemUsers(users: SystemUser[]) {
  systemUsersCache = users;
  if (typeof window !== "undefined")
    localStorage.setItem("onspa-system-users", JSON.stringify(users));
  return users;
}

function cachedSystemUsers() {
  if (systemUsersCache) return systemUsersCache;
  if (typeof window === "undefined") return null;
  try {
    const saved = JSON.parse(
      localStorage.getItem("onspa-system-users") || "null",
    );
    if (Array.isArray(saved)) systemUsersCache = saved;
  } catch {}
  return systemUsersCache;
}

function loadSystemUsers() {
  if (systemUsersPromise) return systemUsersPromise;
  systemUsersPromise = fetch("/api/records?entity=users")
    .then((response) => (response.ok ? response.json() : Promise.reject()))
    .then((data) => {
      const saved = new Map<string, SystemUser & { _deleted?: boolean }>(
        data.records.map(
          (record: {
            key: string;
            payload: SystemUser & { _deleted?: boolean };
          }) => [record.key, record.payload],
        ),
      );
      const merged = initialSystemUsers
        .filter((user) => !saved.get(user.login)?._deleted)
        .map((user) => saved.get(user.login) || user);
      for (const [key, user] of saved)
        if (!user._deleted && !merged.some((item) => item.login === key))
          merged.push(user);
      return rememberSystemUsers(merged);
    })
    .catch(() => cachedSystemUsers() || initialSystemUsers)
    .finally(() => {
      systemUsersPromise = null;
    });
  return systemUsersPromise;
}

function UserManagementV2() {
  const [users, setUsers] = useState<SystemUser[]>(
    () => cachedSystemUsers() || initialSystemUsers,
  );
  const [page, setPage] = useState(1);
  const [companyFilter, setCompanyFilter] = useState("Tất cả công ty");
  const [departmentFilter, setDepartmentFilter] = useState("Tất cả bộ phận");
  const [userQuery, setUserQuery] = useState("");
  const [editing, setEditing] = useState<SystemUser | null>(null);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
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
    department: "SHINTUNG",
    login: "",
    name: "",
    phone: "",
    mobile: "",
    active: true,
  };
  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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
      phone: String(fd.get("phone")),
      mobile: String(fd.get("mobile")),
      active: fd.get("active") === "true",
    };
    setSaving(true);
    const response = await fetch("/api/records", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entity: "users",
        key: u.login,
        payload: u,
        updatedBy: "vthduyen",
      }),
    });
    setSaving(false);
    if (!response.ok) {
      setNotice("Không thể lưu người dùng. Vui lòng thử lại.");
      return;
    }
    setUsers((p) => {
      const next = editing
        ? p.map((x) => (x.login === editing.login ? u : x))
        : [...p.filter((x) => x.login !== u.login), u];
      rememberSystemUsers(next);
      return next;
    });
    setNotice(
      editing ? "Đã lưu thay đổi người dùng." : "Đã thêm người dùng mới.",
    );
    setEditing(null);
    setAdding(false);
  };
  const remove = async () => {
    if (!editing) return;
    if (confirm(`Xóa người dùng ${editing.login}?`)) {
      setSaving(true);
      const response = await fetch("/api/records", {
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
          updatedBy: "vthduyen",
        }),
      });
      setSaving(false);
      if (!response.ok) {
        setNotice("Không thể xóa người dùng. Vui lòng thử lại.");
        return;
      }
      setUsers((p) => {
        const next = p.filter((x) => x.login !== editing.login);
        rememberSystemUsers(next);
        return next;
      });
      setNotice(
        "Đã xóa người dùng. Dữ liệu xóa vẫn được lưu để có thể khôi phục.",
      );
      setEditing(null);
    }
  };
  return (
    <main className="workspace">
      <div className="page-heading">
        <div>
          <p className="eyebrow">QUẢN TRỊ HỆ THỐNG</p>
          <h1>Quản lý người dùng</h1>
          <p>
            Quản lý tài khoản, thông tin liên hệ, mật khẩu và trạng thái đăng
            nhập.
          </p>
        </div>
        <button className="primary-button" onClick={() => setAdding(true)}>
          ＋ Thêm người dùng
        </button>
      </div>
      {notice && <div className="save-notice">{notice}</div>}
      <section className="data-card">
        <div className="user-list-toolbar">
          <div>
            <label>
              <span>CÔNG TY LỆ THUỘC</span>
              <select
                value={companyFilter}
                onChange={(event) => setCompanyFilter(event.target.value)}
              >
                <option>Tất cả công ty</option>
                <option>SHINTUNG</option>
              </select>
            </label>
            <label>
              <span>BỘ PHẬN LỆ THUỘC</span>
              <select
                value={departmentFilter}
                onChange={(event) => setDepartmentFilter(event.target.value)}
              >
                <option>Tất cả bộ phận</option>
                <option>SHINTUNG</option>
                <option>KHO</option>
                <option>SX</option>
                <option>QC</option>
              </select>
            </label>
            <label>
              <span>TÌM KIẾM</span>
              <input
                value={userQuery}
                onChange={(event) => setUserQuery(event.target.value)}
                placeholder="Tên đăng nhập hoặc họ tên"
              />
            </label>
          </div>
          <span>{filteredUsers.length} người dùng</span>
        </div>
        <div className="table-wrap">
          <table className="system-user-table" data-no-pagination="true">
            <thead>
              <tr>
                <th>CÔNG TY LỆ THUỘC</th>
                <th>BỘ PHẬN LỆ THUỘC</th>
                <th>TÊN ĐĂNG NHẬP</th>
                <th>TÊN</th>
                <th>ĐIỆN THOẠI</th>
                <th>ĐIỆN THOẠI DI ĐỘNG</th>
                <th>HOẠT ĐỘNG</th>
              </tr>
            </thead>
            <tbody>
              {pagedUsers.map((u) => (
                <tr key={u.login}>
                  <td>{u.company || "—"}</td>
                  <td>{u.department || "—"}</td>
                  <td className="user-login">{u.login}</td>
                  <td>{u.name}</td>
                  <td>{u.phone || "—"}</td>
                  <td>{u.mobile || "—"}</td>
                  <td>
                    <button
                      className="edit-user-link"
                      onClick={() => setEditing(u)}
                    >
                      Sửa đổi
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="warehouse-pagination">
          <span>
            {filteredUsers.length
              ? `Hiển thị ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filteredUsers.length)} / ${filteredUsers.length} người dùng`
              : "Không tìm thấy người dùng"}
          </span>
          <div>
            <button
              disabled={page === 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              ‹
            </button>
            {Array.from({ length: totalPages }, (_, index) => index + 1).map(
              (value) => (
                <button
                  key={value}
                  className={page === value ? "active" : ""}
                  onClick={() => setPage(value)}
                >
                  {value}
                </button>
              ),
            )}
            <button
              disabled={page === totalPages}
              onClick={() =>
                setPage((value) => Math.min(totalPages, value + 1))
              }
            >
              ›
            </button>
          </div>
        </div>
      </section>
      {(editing || adding) && (
        <>
          <button
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
                <p>{editing ? "CẬP NHẬT NGƯỜI DÙNG" : "THÊM NGƯỜI DÙNG"}</p>
                <h2>{editing ? editing.login : "Tài khoản mới"}</h2>
                <span>
                  {editing ? editing.name : "Nhập đầy đủ thông tin bên dưới"}
                </span>
              </div>
              <button
                onClick={() => {
                  setEditing(null);
                  setAdding(false);
                }}
              >
                ×
              </button>
            </div>
            <form className="edit-user-form" onSubmit={save}>
              <label>
                <span>Công ty lệ thuộc</span>
                <input name="company" defaultValue={formUser.company} />
              </label>
              <label>
                <span>Bộ phận lệ thuộc</span>
                <select name="department" defaultValue={formUser.department}>
                  <option>SHINTUNG</option>
                  <option>KHO</option>
                  <option>SX</option>
                  <option>QC</option>
                  <option>KHSX</option>
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
                <span>Điện thoại</span>
                <input name="phone" defaultValue={formUser.phone} />
              </label>
              <label>
                <span>Điện thoại di động</span>
                <input name="mobile" defaultValue={formUser.mobile} />
              </label>
              <label>
                <span>{editing ? "Đặt/bổ sung mật khẩu" : "Mật khẩu *"}</span>
                <input
                  name="password"
                  type="password"
                  required={!editing}
                  placeholder={
                    editing
                      ? "Để trống nếu không đổi mật khẩu"
                      : "Tối thiểu 8 ký tự"
                  }
                />
              </label>
              <label>
                <span>Nhập lại mật khẩu</span>
                <input
                  name="confirmPassword"
                  type="password"
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
                {editing && (
                  <button
                    type="button"
                    className="delete-user-button"
                    onClick={remove}
                  >
                    Xóa người dùng
                  </button>
                )}
                <span />
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => {
                    setEditing(null);
                    setAdding(false);
                  }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={saving}
                >
                  {saving ? "Đang lưu..." : "Lưu lại"}
                </button>
              </div>
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
  active: boolean;
};
function temporaryPermissions(user: SystemUser) {
  const make = (group: string, menus: string[], actions: string[]) =>
    menus.flatMap((menu) =>
      actions.map((action) => `${group} / ${menu} / ${action}`),
    );
  if (user.login === "admin" || user.login === "vthduyen")
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
      "Phân quyền",
      "Nhật ký thao tác",
      "Quản lý phiên bản",
    ],
  },
  {
    group: "Dữ liệu cơ bản",
    menus: ["SKU Master", "Lead Time theo SKU", "Quy tắc Safety Days"],
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
      "Điều chỉnh nhân lực",
      "Khôi phục dữ liệu",
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
  "Xuất dữ liệu",
];
const initialPermissionRecords: PermissionRecord[] = initialSystemUsers.map(
  (user) => ({
    company: user.company || "SHINTUNG",
    department: user.department || "SHINTUNG",
    login: user.login,
    name: user.name,
    phone: user.phone,
    mobile: user.mobile,
    permissions: temporaryPermissions(user),
    active: user.active,
  }),
);

let permissionRecordsCache: PermissionRecord[] | null = null;
let permissionRecordsPromise: Promise<PermissionRecord[]> | null = null;

function rememberPermissionRecords(records: PermissionRecord[]) {
  permissionRecordsCache = records;
  if (typeof window !== "undefined")
    localStorage.setItem("onspa-permission-records", JSON.stringify(records));
  return records;
}

function cachedPermissionRecords() {
  if (permissionRecordsCache) return permissionRecordsCache;
  if (typeof window === "undefined") return null;
  try {
    const saved = JSON.parse(
      localStorage.getItem("onspa-permission-records") || "null",
    );
    if (Array.isArray(saved)) permissionRecordsCache = saved;
  } catch {}
  return permissionRecordsCache;
}

function loadPermissionRecords() {
  if (permissionRecordsPromise) return permissionRecordsPromise;
  permissionRecordsPromise = Promise.all([
    fetch("/api/records?entity=users").then((response) =>
      response.ok ? response.json() : Promise.reject(),
    ),
    fetch("/api/records?entity=permissions").then((response) =>
      response.ok ? response.json() : Promise.reject(),
    ),
  ])
    .then(([userData, permissionData]) => {
      const savedUsers = new Map<string, SystemUser & { _deleted?: boolean }>(
        userData.records.map(
          (record: {
            key: string;
            payload: SystemUser & { _deleted?: boolean };
          }) => [record.key, record.payload],
        ),
      );
      const users = initialSystemUsers
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
        permissions: temporaryPermissions(user),
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
        .filter((record) => !saved.get(record.login)?._deleted)
        .map((record) =>
          saved.has(record.login)
            ? { ...record, ...saved.get(record.login)! }
            : record,
        );
      for (const [key, record] of saved)
        if (!record._deleted && !merged.some((item) => item.login === key))
          merged.push(record);
      return rememberPermissionRecords(merged);
    })
    .catch(() => cachedPermissionRecords() || initialPermissionRecords)
    .finally(() => {
      permissionRecordsPromise = null;
    });
  return permissionRecordsPromise;
}

function PermissionManagement() {
  const [records, setRecords] = useState<PermissionRecord[]>(
    () => cachedPermissionRecords() || initialPermissionRecords,
  );
  const loadingRecords = false;
  const [departmentFilter, setDepartmentFilter] = useState("Tất cả bộ phận");
  const [permissionQuery, setPermissionQuery] = useState("");
  const [editing, setEditing] = useState<PermissionRecord | null>(null);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
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
    if (editing)
      setSelectedPermissions(
        editing.permissions ? editing.permissions.split(" · ") : [],
      );
    else if (adding) setSelectedPermissions([]);
  }, [editing, adding]);
  const formRecord = editing || {
    company: "SHINTUNG",
    department: "Kế hoạch sản xuất",
    login: "",
    name: "",
    phone: "",
    mobile: "",
    permissions: "",
    active: true,
  };
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const record: PermissionRecord = {
      company: String(data.get("company")),
      department: String(data.get("department")),
      login: String(data.get("login")).trim(),
      name: String(data.get("name")).trim(),
      phone: formRecord.phone || "",
      mobile: formRecord.mobile || "",
      permissions: selectedPermissions.join(" · "),
      active: data.get("active") === "true",
    };
    if (!record.permissions) {
      setNotice("Vui lòng chọn ít nhất một quyền thao tác.");
      return;
    }
    setSaving(true);
    const response = await fetch("/api/records", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entity: "permissions",
        key: record.login,
        payload: record,
        updatedBy: "vthduyen",
      }),
    });
    setSaving(false);
    if (!response.ok) {
      setNotice("Không thể lưu phân quyền. Vui lòng thử lại.");
      return;
    }
    setRecords((current) => {
      const next = editing
        ? current.map((item) => (item.login === editing.login ? record : item))
        : [...current.filter((item) => item.login !== record.login), record];
      rememberPermissionRecords(next);
      return next;
    });
    setNotice(editing ? "Đã cập nhật phân quyền." : "Đã thêm phân quyền mới.");
    setEditing(null);
    setAdding(false);
  };
  const remove = async () => {
    if (!editing || !confirm(`Xóa phân quyền của ${editing.login}?`)) return;
    setSaving(true);
    const response = await fetch("/api/records", {
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
        updatedBy: "vthduyen",
      }),
    });
    setSaving(false);
    if (!response.ok) {
      setNotice("Không thể xóa phân quyền. Vui lòng thử lại.");
      return;
    }
    setRecords((current) => {
      const next = current.filter((item) => item.login !== editing.login);
      rememberPermissionRecords(next);
      return next;
    });
    setEditing(null);
    setNotice("Đã xóa phân quyền.");
  };
  return (
    <main className="workspace">
      <div className="page-heading">
        <div>
          <p className="eyebrow">QUẢN TRỊ HỆ THỐNG</p>
          <h1>Phân quyền người dùng</h1>
          <p>Thiết lập phạm vi thao tác theo từng tài khoản.</p>
        </div>
        <button className="primary-button" onClick={() => setAdding(true)}>
          ＋ Thêm phân quyền
        </button>
      </div>
      {notice && <div className="save-notice">{notice}</div>}
      <section className="data-card user-content-card">
        <div className="user-list-toolbar">
          <div>
            <label>
              <span>BỘ PHẬN</span>
              <select
                value={departmentFilter}
                onChange={(event) => setDepartmentFilter(event.target.value)}
              >
                <option>Tất cả bộ phận</option>
                <option>Kế hoạch sản xuất</option>
                <option>Sản xuất</option>
                <option>Kho</option>
                <option>QC</option>
              </select>
            </label>
            <label>
              <span>TÌM KIẾM</span>
              <input
                value={permissionQuery}
                onChange={(event) => setPermissionQuery(event.target.value)}
                placeholder="ID hoặc họ tên người dùng"
              />
            </label>
          </div>
          <span>
            {loadingRecords
              ? "Đang tải dữ liệu..."
              : `${filteredRecords.length} phân quyền`}
          </span>
        </div>
        <div className="table-wrap">
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
                <tr>
                  <td colSpan={7} className="permission-loading">
                    Đang tải dữ liệu phân quyền đã lưu...
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => (
                  <tr key={record.login}>
                    <td>{record.company}</td>
                    <td>{record.department}</td>
                    <td className="user-login">{record.login}</td>
                    <td>{record.name}</td>
                    <td>
                      <details className="permission-summary">
                        <summary>
                          {record.permissions
                            ? `${record.permissions.split(" · ").length} quyền được cấp`
                            : "Chưa cấp quyền"}
                        </summary>
                        <div>
                          {record.permissions
                            .split(" · ")
                            .filter(Boolean)
                            .map((permission) => (
                              <span key={permission}>{permission}</span>
                            ))}
                        </div>
                      </details>
                    </td>
                    <td>
                      <span
                        className={record.active ? "done-badge" : "version-old"}
                      >
                        {record.active ? "Hoạt động" : "Ngưng"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="edit-user-link"
                        onClick={() => setEditing(record)}
                      >
                        Sửa đổi
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      {(editing || adding) && (
        <>
          <button
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
              <button
                onClick={() => {
                  setEditing(null);
                  setAdding(false);
                }}
              >
                ×
              </button>
            </div>
            <form className="edit-user-form" onSubmit={save}>
              <label>
                <span>Công ty</span>
                <select name="company" defaultValue={formRecord.company}>
                  <option>SHINTUNG</option>
                </select>
              </label>
              <label>
                <span>Bộ phận</span>
                <select name="department" defaultValue={formRecord.department}>
                  <option>Kế hoạch sản xuất</option>
                  <option>Sản xuất</option>
                  <option>Kho</option>
                  <option>QC</option>
                  <option>SHINTUNG</option>
                </select>
              </label>
              <label>
                <span>ID đăng nhập *</span>
                <input
                  name="login"
                  required
                  readOnly={!!editing}
                  defaultValue={formRecord.login}
                />
              </label>
              <label>
                <span>Họ và tên *</span>
                <input name="name" required defaultValue={formRecord.name} />
              </label>
              <div className="permission-field">
                <span>QUYỀN ĐƯỢC CẤP *</span>
                <div className="permission-tree">
                  {permissionMenuGroups.map((group) => {
                    const groupKeys = group.menus.flatMap((menu) =>
                      permissionActions.map(
                        (action) => `${group.group} / ${menu} / ${action}`,
                      ),
                    );
                    const groupChecked = groupKeys.every((key) =>
                      selectedPermissions.includes(key),
                    );
                    return (
                      <details key={group.group} open>
                        <summary>
                          <label>
                            <input
                              type="checkbox"
                              checked={groupChecked}
                              onChange={(event) =>
                                setSelectedPermissions((current) =>
                                  event.target.checked
                                    ? Array.from(
                                        new Set([...current, ...groupKeys]),
                                      )
                                    : current.filter(
                                        (key) => !groupKeys.includes(key),
                                      ),
                                )
                              }
                            />
                            {group.group}
                          </label>
                        </summary>
                        {group.menus.map((menu) => {
                          const menuKeys = permissionActions.map(
                            (action) => `${group.group} / ${menu} / ${action}`,
                          );
                          const menuChecked = menuKeys.every((key) =>
                            selectedPermissions.includes(key),
                          );
                          return (
                            <details key={menu}>
                              <summary>
                                <label>
                                  <input
                                    type="checkbox"
                                    checked={menuChecked}
                                    onChange={(event) =>
                                      setSelectedPermissions((current) =>
                                        event.target.checked
                                          ? Array.from(
                                              new Set([
                                                ...current,
                                                ...menuKeys,
                                              ]),
                                            )
                                          : current.filter(
                                              (key) => !menuKeys.includes(key),
                                            ),
                                      )
                                    }
                                  />
                                  {menu}
                                </label>
                              </summary>
                              <div className="permission-actions">
                                {permissionActions.map((action) => {
                                  const key = `${group.group} / ${menu} / ${action}`;
                                  return (
                                    <label key={key}>
                                      <input
                                        type="checkbox"
                                        checked={selectedPermissions.includes(
                                          key,
                                        )}
                                        onChange={(event) =>
                                          setSelectedPermissions((current) =>
                                            event.target.checked
                                              ? [...current, key]
                                              : current.filter(
                                                  (item) => item !== key,
                                                ),
                                          )
                                        }
                                      />
                                      {action}
                                    </label>
                                  );
                                })}
                              </div>
                            </details>
                          );
                        })}
                      </details>
                    );
                  })}
                </div>
                <small>
                  Đã chọn {selectedPermissions.length} quyền thao tác
                </small>
              </div>
              <label>
                <span>Trạng thái</span>
                <select name="active" defaultValue={String(formRecord.active)}>
                  <option value="true">Hoạt động</option>
                  <option value="false">Ngưng</option>
                </select>
              </label>
              <div className="edit-user-actions">
                {editing && (
                  <button
                    type="button"
                    className="delete-user-button"
                    onClick={remove}
                  >
                    Xóa phân quyền
                  </button>
                )}
                <span />
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => {
                    setEditing(null);
                    setAdding(false);
                  }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={saving}
                >
                  {saving ? "Đang lưu..." : "Lưu lại"}
                </button>
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
    ["permissions", "Phân quyền"],
    ["sku", "SKU Master bổ sung trên web"],
    ["leadtime_versions", "Phiên bản Lead Time"],
    ["safety_rules", "Bộ quy tắc Safety Days"],
    ["safety_rule_groups", "Nhóm quy tắc Safety Days"],
    ["forecast", "Base Forecast đã lưu"],
    ["demand_event", "Demand Event đã lưu"],
    ["production_engine", "Production Engine đã lưu"],
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
  const missingLine = skus.filter((sku) => !sku.line || sku.line === "—").length;
  const missingLeadTime = skus.filter(
    (sku) => !leadtimeBySku.has(normalizeSkuCode(sku.code)),
  ).length;

  const refresh = async () => {
    setChecking(true);
    setLastError("");
    const results = await Promise.allSettled(
      monitored.map(async ([entity]) => {
        const response = await fetch(`/api/records?entity=${entity}`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`${entity}: HTTP ${response.status}`);
        const data = await response.json();
        return [entity, Array.isArray(data.records) ? data.records.length : 0] as const;
      }),
    );
    const next: DataStatusCounts = {};
    const errors: string[] = [];
    results.forEach((result, index) => {
      if (result.status === "fulfilled") next[result.value[0]] = result.value[1];
      else errors.push(monitored[index][1]);
    });
    setCounts(next);
    setConnected(results.some((result) => result.status === "fulfilled"));
    setLastError(errors.length ? `Không đọc được: ${errors.join(", ")}` : "");
    setCheckedAt(new Date().toISOString());
    setChecking(false);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const exportIssues = () => {
    const rows = [
      ["Hạng mục", "Số lượng", "Trạng thái"],
      ["SKU thiếu Line", String(missingLine), missingLine ? "Cần kiểm tra" : "Tốt"],
      ["SKU thiếu Lead Time", String(missingLeadTime), missingLeadTime ? "Cần kiểm tra" : "Tốt"],
      ["Bản sao lưu D1 đã kiểm chứng", "0", "Chưa thiết lập"],
      ["R2", "0", "Chưa cấu hình"],
      ["Migration nền", "1", "Đã nhận diện"],
    ];
    const csv = `\uFEFF${rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `ONSPA-tinh-trang-du-lieu-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="workspace data-status-workspace">
      <div className="page-heading compact-heading">
        <div><p className="eyebrow">QUẢN TRỊ HỆ THỐNG</p><h1>Tình trạng dữ liệu</h1><p>Giám sát chỉ đọc; không cho phép sửa dữ liệu gốc tại màn hình này.</p></div>
        <div className="data-status-actions"><button className="outline-button" onClick={exportIssues}>Xuất báo cáo lỗi</button><button className="primary-button" disabled={checking} onClick={() => void refresh()}>{checking ? "Đang kiểm tra..." : "Làm mới"}</button></div>
      </div>
      <section className="data-status-summary">
        <article><span>KẾT NỐI CƠ SỞ DỮ LIỆU</span><b className={connected ? "status-good" : "status-error"}>{checking ? "Đang kiểm tra" : connected ? "D1 đang kết nối" : "Mất kết nối"}</b><small>Kiểm tra thông qua API phía máy chủ</small></article>
        <article><span>MÔI TRƯỜNG HIỆN TẠI</span><b className="status-warning">DEVELOPMENT / TEST</b><small>Website đang trong giai đoạn điều chỉnh</small></article>
        <article><span>KIỂM TRA GẦN NHẤT</span><b>{checkedAt ? formatDateTimeDisplay(checkedAt) : "—"}</b><small>{lastError || "Không phát hiện lỗi đọc API"}</small></article>
        <article><span>SAO LƯU D1 GẦN NHẤT</span><b className="status-warning">Chưa thiết lập</b><small>Chưa có bản sao D1 được kiểm chứng</small></article>
      </section>
      <section className="data-card data-status-card"><div className="section-title"><div><h2>Số lượng bản ghi trên máy chủ</h2><p>Số lượng bên dưới chỉ phản ánh dữ liệu đang có trong D1; dữ liệu JSON được báo riêng.</p></div></div><div className="table-wrap"><table data-no-pagination="true"><thead><tr><th>PHÂN HỆ</th><th>NGUỒN</th><th>SỐ BẢN GHI</th><th>TRẠNG THÁI</th></tr></thead><tbody>{monitored.map(([entity, label]) => <tr key={entity}><td>{label}</td><td>D1 · app_records</td><td>{checking ? "…" : counts[entity] ?? "Lỗi"}</td><td><span className={counts[entity] === undefined && !checking ? "data-status-bad" : "data-status-ok"}>{counts[entity] === undefined && !checking ? "Không đọc được" : "Đã kiểm tra"}</span></td></tr>)}</tbody></table></div></section>
      <section className="data-status-grid"><article><h2>Dữ liệu đóng gói cùng website</h2><dl><div><dt>SKU Master JSON</dt><dd>{skus.length}</dd></div><div><dt>Lead Time JSON</dt><dd>{leadtimeRows.length}</dd></div><div><dt>Tồn kho ERP JSON</dt><dd>{inventoryErpRows.length}</dd></div><div><dt>BOM JSON</dt><dd>{bomCatalog.length}</dd></div></dl><p>Dữ liệu này chưa phải dữ liệu trung tâm hoàn chỉnh.</p></article><article><h2>Cảnh báo chất lượng dữ liệu</h2><dl><div><dt>SKU thiếu Line</dt><dd className={missingLine ? "status-warning" : "status-good"}>{missingLine}</dd></div><div><dt>SKU thiếu Lead Time</dt><dd className={missingLeadTime ? "status-warning" : "status-good"}>{missingLeadTime}</dd></div><div><dt>R2 lưu file</dt><dd className="status-warning">Chưa cấu hình</dd></div><div><dt>Migration</dt><dd>1 migration nền</dd></div></dl><p>Chưa có bảng system_errors và chưa có kiểm tra snapshot kế hoạch đầy đủ.</p></article></section>
    </main>
  );
}

function UserContent({ section }: { section: string }) {
  if (section === "users-list") return <UserManagementV2 />;
  if (section === "permissions") return <PermissionManagement />;
  if (section === "versions") return <VersionManagement />;
  if (section === "data-status") return <DataStatusView />;
  if (section === "backup-restore") return <BackupRestorePreparation />;
  const [adding, setAdding] = useState(false);
  const [saved, setSaved] = useState(false);
  const title =
    section === "users-list"
      ? "Quản lý người dùng"
      : section === "permissions"
        ? "Phân quyền người dùng"
        : "Nhật ký thao tác";
  if (section === "audit")
    return (
      <main className="workspace">
        <div className="page-heading">
          <div>
            <p className="eyebrow">QUẢN TRỊ HỆ THỐNG</p>
            <h1>{title}</h1>
          </div>
        </div>
        <section className="data-card user-content-card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>THỜI GIAN</th>
                  <th>NGƯỜI THAO TÁC</th>
                  <th>CHỨC NĂNG</th>
                  <th>NỘI DUNG THAY ĐỔI</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>27/08/2026 09:15</td>
                  <td>vthduyen</td>
                  <td>Kế hoạch tuần · 06</td>
                  <td>Điều chỉnh số lượng kế hoạch 1.000 → 1.200</td>
                </tr>
                <tr>
                  <td>27/08/2026 09:02</td>
                  <td>vthduyen</td>
                  <td>Theo dõi lệnh · 04</td>
                  <td>Nhập mã LSX 510-26083101</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </main>
    );
  return (
    <main className="workspace">
      <div className="page-heading">
        <div>
          <p className="eyebrow">QUẢN TRỊ HỆ THỐNG</p>
          <h1>{title}</h1>
          <p>Quản lý tài khoản và quyền thao tác theo từng bộ phận.</p>
        </div>
        {section === "users-list" && (
          <button className="primary-button" onClick={() => setAdding(true)}>
            ＋ Thêm người dùng
          </button>
        )}
      </div>
      {adding && section === "users-list" && (
        <section className="data-card add-user-card">
          <div className="form-title">
            <div>
              <h2>Thêm người dùng</h2>
              <p>Nhập thông tin tài khoản mới, sau đó bấm Lưu lại.</p>
            </div>
            <button onClick={() => setAdding(false)}>×</button>
          </div>
          <form
            className="user-form"
            onSubmit={(e) => {
              e.preventDefault();
              setSaved(true);
              setAdding(false);
            }}
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
              <input type="email" placeholder="email@onspa.com" />
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
              <button
                type="button"
                className="ghost-button"
                onClick={() => setAdding(false)}
              >
                Hủy
              </button>
              <button type="submit" className="primary-button">
                Lưu lại
              </button>
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
        <div className="user-list-toolbar">
          <div>
            <label>
              <span>BỘ PHẬN</span>
              <select>
                <option>Tất cả bộ phận</option>
                <option>Kế hoạch sản xuất</option>
                <option>Sản xuất</option>
                <option>Kho</option>
              </select>
            </label>
            <label>
              <span>TÌM KIẾM</span>
              <input placeholder="ID hoặc họ tên người dùng" />
            </label>
          </div>
          <span>{saved ? "3" : "2"} người dùng</span>
        </div>
        <div className="table-wrap">
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
                <td>SHINTUNG</td>
                <td>Kế hoạch sản xuất</td>
                <td>vthduyen</td>
                <td>Vũ Hương Duyên</td>
                <td>
                  {section === "permissions"
                    ? "Forecast · Demand Event · 05 · 06 · Mở LSX"
                    : "KHSX"}
                </td>
                <td>
                  <span className="done-badge">Hoạt động</span>
                </td>
                <td>
                  <button className="calc-button">Sửa đổi</button>
                </td>
              </tr>
              <tr>
                <td>SHINTUNG</td>
                <td>Sản xuất</td>
                <td>sanxuat01</td>
                <td>Người dùng Sản xuất</td>
                <td>
                  {section === "permissions"
                    ? "Nhận LSX · Báo công · Trả tiến độ"
                    : "Sản xuất"}
                </td>
                <td>
                  <span className="done-badge">Hoạt động</span>
                </td>
                <td>
                  <button className="calc-button">Sửa đổi</button>
                </td>
              </tr>
              {saved && (
                <tr>
                  <td>SHINTUNG</td>
                  <td>Kế hoạch sản xuất</td>
                  <td>nguoidungmoi</td>
                  <td>Người dùng mới</td>
                  <td>KHSX</td>
                  <td>
                    <span className="done-badge">Hoạt động</span>
                  </td>
                  <td>
                    <button className="calc-button">Sửa đổi</button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
          <h1>Sao lưu và khôi phục</h1>
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
          <span>BỘ CÔNG CỤ WINDOWS</span>
          <h2>Kiểm tra sao lưu và khôi phục cục bộ</h2>
          <p>
            Kiểm tra ổ F, quyền ghi, dung lượng, ZIP, manifest, SHA-256, log,
            chạy bù và khóa chống chạy trùng. Gói test không chứa dữ liệu D1
            thật.
          </p>
        </div>
        <a
          className="primary-button backup-download"
          href="/windows-backup/ONSPA-Windows-Backup-Test-Kit.zip"
          download
        >
          Tải bộ test Windows
        </a>
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
        <div className="table-wrap">
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
                  <td>
                    <b>{item}</b>
                  </td>
                  <td>
                    <span className="backup-waiting">{status}</span>
                  </td>
                  <td>{next}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
            <button className="outline-button" disabled title={unavailable}>
              Quét lại
            </button>
            <button className="primary-button" disabled title={unavailable}>
              Sao lưu ngay
            </button>
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
  ["Quản trị hệ thống", "Phân quyền", "PERM"],
  ["Quản trị hệ thống", "Nhật ký thao tác", "AUD"],
  ["Quản trị hệ thống", "Quản lý phiên bản", "VER"],
  ["Quản trị hệ thống", "Tình trạng dữ liệu", "DATA"],
  ["Quản trị hệ thống", "Sao lưu và khôi phục", "BKP"],
  ["Dữ liệu cơ bản", "SKU Master", "SKU"],
  ["Dữ liệu cơ bản", "Lead Time theo SKU", "LT"],
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
const moduleVersionHistory: ModuleVersion[] = [
  ...currentModuleVersions.map(([group, menu, code]) => ({
    group,
    menu,
    code,
    version:
      code === "SDR"
        ? "SDR-20260909-01"
        : code === "PE"
          ? "PE-20260909-01"
          : code === "LT"
            ? "LT-20260909-01"
            : code === "BKP"
              ? "BKP-20260908-02"
              : code === "STK"
                ? "STK-20260907-01"
                : code === "INV"
                  ? "INV-20260907-03"
                  : code === "USR"
                    ? "USR-20260907-02"
                    : code === "PERM"
                      ? "PERM-20260907-02"
                      : `${code}-20260905-01`,
    date: ["SDR", "PE", "LT"].includes(code)
      ? "09/09/2026 10:00"
      : code === "BKP"
        ? "08/09/2026 16:30"
        : ["STK", "INV", "USR", "PERM"].includes(code)
          ? "07/09/2026 17:50"
          : "05/09/2026 16:25",
    status: "Đang sử dụng" as const,
    user: "Vũ Hương Duyên",
    previous:
      code === "SDR"
        ? "SD-20260908-01"
        : code === "PE"
          ? "PE-20260907-01"
          : code === "LT"
            ? "LT-20260908-01"
            : code === "BKP"
              ? "BKP-20260907-01"
              : "—",
    change:
      code === "SDR"
        ? "Thay Safety Days theo SKU bằng bộ quy tắc có phiên bản, ngày hiệu lực, xác nhận, lịch sử và ba nhóm tính."
        : code === "PE"
          ? "Chọn Quy tắc Safety Days theo ngày bắt đầu tuần và lưu snapshot các thành phần tính."
          : code === "LT"
            ? "Safety Days chuyển thành dữ liệu tự tính chỉ đọc; chỉ cho sửa Lead Time theo SKU."
            : code === "BKP"
              ? "Bổ sung bộ PowerShell TEST_LOCAL cho F:\\CompanyBackups."
              : "Giữ nguyên chức năng hiện tại.",
    impact: ["SDR", "PE", "LT"].includes(code)
      ? "Kế hoạch cũ giữ snapshot; lần tính mới dùng đúng phiên bản quy tắc có hiệu lực."
      : "Không thay đổi dữ liệu nghiệp vụ hiện có.",
  })),
  {
    group: "Quản lý kho",
    menu: "Tồn kho ERP",
    code: "INV",
    version: "INV-20260907-02",
    date: "07/09/2026 17:30",
    status: "Phiên bản cũ",
    user: "Vũ Hương Duyên",
    previous: "INV-20260907-01",
    change:
      "Bổ sung thanh trạng thái và thao tác chốt tồn tuần phía trên bộ lọc tồn kho ERP.",
    impact: "Không thay đổi dữ liệu nghiệp vụ hiện có.",
  },
  {
    group: "Quản trị hệ thống",
    menu: "Phân quyền",
    code: "PERM",
    version: "PERM-20260907-01",
    date: "07/09/2026 16:30",
    status: "Phiên bản cũ",
    user: "Vũ Hương Duyên",
    previous: "PERM-20260905-01",
    change:
      "Cho phép thêm mới, sửa, xóa và lưu dùng chung dữ liệu phân quyền người dùng.",
    impact: "Không thay đổi dữ liệu nghiệp vụ hiện có.",
  },
  {
    group: "Quản trị hệ thống",
    menu: "Phân quyền",
    code: "PERM",
    version: "PERM-20260905-01",
    date: "05/09/2026 16:25",
    status: "Phiên bản cũ",
    user: "Vũ Hương Duyên",
    previous: "—",
    change: "Khởi tạo giao diện phân quyền người dùng.",
    impact: "Không thay đổi dữ liệu nghiệp vụ hiện có.",
  },
  {
    group: "Quản trị hệ thống",
    menu: "Quản lý người dùng",
    code: "USR",
    version: "USR-20260907-01",
    date: "07/09/2026 15:30",
    status: "Phiên bản cũ",
    user: "Vũ Hương Duyên",
    previous: "USR-20260905-01",
    change:
      "Cho phép thêm, sửa và xóa mềm người dùng; dữ liệu được lưu dùng chung sau khi tải lại trang.",
    impact: "Không thay đổi dữ liệu nghiệp vụ hiện có.",
  },
  {
    group: "Quản trị hệ thống",
    menu: "Quản lý người dùng",
    code: "USR",
    version: "USR-20260905-01",
    date: "05/09/2026 16:25",
    status: "Phiên bản cũ",
    user: "Vũ Hương Duyên",
    previous: "—",
    change: "Khởi tạo giao diện quản lý người dùng.",
    impact: "Không thay đổi dữ liệu nghiệp vụ hiện có.",
  },
  {
    group: "Quản lý kho",
    menu: "Tồn kho ERP",
    code: "INV",
    version: "INV-20260905-03",
    date: "05/09/2026 17:15",
    status: "Phiên bản cũ",
    user: "Vũ Hương Duyên",
    previous: "INV-20260905-02",
    change:
      "Mở rộng vùng bảng tồn kho theo toàn bộ chiều cao màn hình để hiển thị nhiều dữ liệu hơn.",
    impact: "Không thay đổi dữ liệu nghiệp vụ hiện có.",
  },
  {
    group: "Quản lý kho",
    menu: "Tồn kho ERP",
    code: "INV",
    version: "INV-20260905-02",
    date: "05/09/2026 17:05",
    status: "Phiên bản cũ",
    user: "Vũ Hương Duyên",
    previous: "INV-20260905-01",
    change:
      "Loại bỏ phần giới thiệu và tra cứu tồn theo thời điểm; đưa bộ lọc và dữ liệu tồn kho lên đầu trang.",
    impact: "Không thay đổi dữ liệu nghiệp vụ hiện có.",
  },
  {
    group: "Quản lý kho",
    menu: "Tồn kho ERP",
    code: "INV",
    version: "INV-20260905-01",
    date: "05/09/2026 16:25",
    status: "Phiên bản cũ",
    user: "Vũ Hương Duyên",
    previous: "—",
    change: "Khởi tạo giao diện tồn kho ERP.",
    impact: "Không thay đổi dữ liệu nghiệp vụ hiện có.",
  },
  {
    group: "Kế hoạch sản xuất",
    menu: "Production_engine",
    code: "PE",
    version: "PE-20260905-00",
    date: "05/09/2026 09:20",
    status: "Phiên bản cũ",
    user: "Vũ Hương Duyên",
    previous: "—",
    change: "Bổ sung quy tắc tuần giao tháng và thứ tự ưu tiên sản xuất.",
    impact: "Giữ nguyên dữ liệu các tuần đã lưu.",
  },
  {
    group: "Cấu trúc thành phẩm",
    menu: "Dữ liệu lượng dùng BOM",
    code: "BOM",
    version: "BOM-20260904-01",
    date: "04/09/2026 15:10",
    status: "Phiên bản cũ",
    user: "Vũ Hương Duyên",
    previous: "—",
    change: "Khóa chỉnh sửa trực tiếp BOM đã xác nhận; thay đổi qua phiếu.",
    impact: "BOM đã xác nhận chỉ được xem.",
  },
];
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
          <h1>Quản lý phiên bản</h1>
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
        <div className="table-wrap version-table-wrap">
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
                    <td>{r.group}</td>
                    <td>
                      <b>{r.menu}</b>
                    </td>
                    <td className="version-code">{r.code}</td>
                    <td className="version-number">{r.version}</td>
                    <td>{r.date}</td>
                    <td>
                      <span
                        className={
                          r.status === "Đang sử dụng"
                            ? "version-current"
                            : "version-old"
                        }
                      >
                        {r.status}
                      </span>
                    </td>
                    <td>{r.user}</td>
                    <td>
                      <button
                        className="table-link"
                        onClick={() =>
                          setOpenVersion(
                            openVersion === r.version ? null : r.version,
                          )
                        }
                      >
                        {openVersion === r.version ? "Thu gọn" : "Xem thay đổi"}
                      </button>
                    </td>
                  </tr>
                  {openVersion === r.version && (
                    <tr className="version-detail-row">
                      <td colSpan={8}>
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
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
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
  updated: row.snapshotAt,
  age: 0,
}));
const stockRows: StockRow[] = [
  {
    sku: "102XS04001",
    name: "DÂY XẢ INOX SỌC",
    spec: "14MM 40cm",
    unit: "SỢI",
    warehouse: "KHO TP",
    location: "A01-02",
    lot: "LOT-260822-01",
    onHand: 4000,
    inTransit: 500,
    updated: "28/08/2026 14:35:18",
    age: 6,
  },
  {
    sku: "103SM31201",
    name: "BỘ SEN PS M3",
    spec: "LĐ-1.5m",
    unit: "BỘ",
    warehouse: "KHO TP",
    location: "A03-01",
    lot: "LOT-260813-03",
    onHand: 1440,
    inTransit: 0,
    updated: "28/08/2026 13:42:07",
    age: 15,
  },
  {
    sku: "107P5127",
    name: "VAN PHAO NHỰA",
    spec: '3/4"',
    unit: "CÁI",
    warehouse: "KHO TP",
    location: "B02-04",
    lot: "LOT-260811-02",
    onHand: 4800,
    inTransit: 1200,
    updated: "28/08/2026 11:20:44",
    age: 17,
  },
  {
    sku: "103S205201",
    name: "BỘ SEN DÂY INOX L105",
    spec: "4 NẤC 1m5",
    unit: "BỘ",
    warehouse: "KHO KD",
    location: "KD-01-06",
    lot: "LOT-260520-01",
    onHand: 600,
    inTransit: 0,
    updated: "28/08/2026 09:15:33",
    age: 100,
  },
  {
    sku: "104A4X101",
    name: "BỘ XỊT VS- PVC C114X",
    spec: "LN 1m2",
    unit: "BỘ",
    warehouse: "KHO TP",
    location: "A05-03",
    lot: "LOT-260812-01",
    onHand: 73,
    inTransit: 0,
    updated: "28/08/2026 08:48:12",
    age: 16,
  },
];
const warehouseTransactions = [
  {
    id: "ERP-NK-260828-018",
    time: "28/08/2026 14:35:18",
    type: "Nhập từ sản xuất",
    from: "SX Line A",
    to: "KHO TP",
    items: 2,
    qty: 2000,
    status: "Đã cập nhật kho",
    user: "httung",
  },
  {
    id: "ERP-CK-260828-006",
    time: "28/08/2026 13:42:07",
    type: "Chuyển kho",
    from: "KHO TP",
    to: "KHO KD",
    items: 3,
    qty: 1200,
    status: "Chờ kho nhận",
    user: "ltphong",
  },
  {
    id: "ERP-XK-260828-011",
    time: "28/08/2026 11:20:44",
    type: "Xuất kho",
    from: "KHO TP",
    to: "Khách hàng",
    items: 4,
    qty: 860,
    status: "Đã cập nhật kho",
    user: "httai",
  },
  {
    id: "ERP-NK-260828-014",
    time: "28/08/2026 09:15:33",
    type: "Nhập ERP",
    from: "Xưởng",
    to: "KHO TP",
    items: 1,
    qty: 600,
    status: "Có chênh lệch",
    user: "Ttlinh",
  },
];
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
      <button className="row-action">Tra cứu</button>
    </div>
  );
}

function WarehouseContent({
  section,
  onOpenSku,
  initialSku,
  operator,
}: {
  section: string;
  onOpenSku: (code: string) => void;
  initialSku?: string;
  operator: string;
}) {
  const [query, setQuery] = useState(initialSku || "");
  const [receiveTab, setReceiveTab] = useState<"production" | "erp">(
    "production",
  );
  const [notice, setNotice] = useState("");
  const [snapshots, setSnapshots] = useState<InventorySnapshot[]>([]);
  const [snapshotsLoaded, setSnapshotsLoaded] = useState(false);
  const [snapshotWeek, setSnapshotWeek] = useState(() =>
    weekKeyOf(new Date().toISOString().slice(0, 10)),
  );
  const [showSnapshotHistory, setShowSnapshotHistory] = useState(false);
  const [showSnapshotConfirm, setShowSnapshotConfirm] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] =
    useState<InventorySnapshot | null>(null);
  const [reopening, setReopening] = useState<InventorySnapshot | null>(null);
  const [savingSnapshot, setSavingSnapshot] = useState(false);
  useEffect(() => {
    if (section !== "inventory") return;
    loadInventorySnapshots()
      .then(setSnapshots)
      .catch(() => setNotice("Không thể tải lịch sử chốt tồn."))
      .finally(() => setSnapshotsLoaded(true));
  }, [section]);
  const selectedWeekKey = weekKeyOf(snapshotWeek);
  const selectedWeekStart = mondayOf(new Date(`${selectedWeekKey}T00:00:00`));
  const selectedWeekEnd = new Date(selectedWeekStart);
  selectedWeekEnd.setDate(selectedWeekEnd.getDate() + 6);
  const activeWeekSnapshot = snapshots.find(
    (item) =>
      item.weekKey === selectedWeekKey &&
      ["Đã chốt", "Đã được Production_engine sử dụng"].includes(item.status),
  );
  const createSnapshot = async () => {
    if (activeWeekSnapshot) return;
    setSavingSnapshot(true);
    try {
      const grouped = new Map<string, InventorySnapshotItem>();
      for (const row of inventoryErpRows) {
        const current = grouped.get(row.sku) || {
          sku: row.sku,
          name: row.name,
          spec: row.spec || "—",
          unit: row.unit || "—",
          tpQty: 0,
          kdQty: 0,
          totalQty: 0,
          sourceUpdatedAt: row.snapshotAt,
        };
        if (row.warehouse === "TP") current.tpQty += Number(row.qty || 0);
        else current.kdQty += Number(row.qty || 0);
        current.totalQty = current.tpQty + current.kdQty;
        grouped.set(row.sku, current);
      }
      const items = Array.from(grouped.values()).sort((a, b) =>
        a.sku.localeCompare(b.sku),
      );
      const now = new Date();
      const day = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Ho_Chi_Minh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
        .format(now)
        .replaceAll("-", "");
      const serial = String(
        snapshots.filter((item) => item.code.startsWith(`TON-${day}`)).length +
          1,
      ).padStart(3, "0");
      const prior = snapshots.find(
        (item) =>
          item.weekKey === selectedWeekKey && item.status === "Đã mở chốt",
      );
      const next: InventorySnapshot = {
        id: crypto.randomUUID(),
        code: `TON-${day}-${serial}`,
        weekKey: selectedWeekKey,
        weekStart: formatViDate(selectedWeekStart),
        weekEnd: formatViDate(selectedWeekEnd),
        snapshotAt: now.toISOString(),
        skuCount: items.length,
        totalTp: items.reduce((sum, item) => sum + item.tpQty, 0),
        totalKd: items.reduce((sum, item) => sum + item.kdQty, 0),
        totalStock: items.reduce((sum, item) => sum + item.totalQty, 0),
        createdBy: operator,
        status: "Đã chốt",
        replacesSnapshotId: prior?.id,
        items,
      };
      await saveInventorySnapshot(next, operator);
      let updated = snapshots;
      if (prior) {
        const old = {
          ...prior,
          status: "Đã thay thế bằng phiên bản mới" as const,
          replacedBySnapshotId: next.id,
        };
        await saveInventorySnapshot(old, operator);
        updated = updated.map((item) => (item.id === old.id ? old : item));
      }
      setSnapshots([next, ...updated]);
      setShowSnapshotConfirm(false);
      setNotice(
        `Đã chốt tồn tuần ${next.weekStart}–${next.weekEnd}. Mã chốt ${next.code}.`,
      );
    } catch {
      setNotice("Không thể chốt tồn kho. Vui lòng thử lại.");
    } finally {
      setSavingSnapshot(false);
    }
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
      setSnapshots((current) =>
        current.map((item) => (item.id === opened.id ? opened : item)),
      );
      setReopening(null);
      setNotice(
        `Đã mở bản chốt ${opened.code}. Bản cũ được giữ nguyên trong lịch sử; Kho có thể chốt lại tuần này.`,
      );
    } catch {
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
  const filteredStock = erpDisplayRows.filter((r) =>
    `${r.sku} ${r.name} ${r.spec}`.toLowerCase().includes(query.toLowerCase()),
  );
  const heading = (
    <div className="page-heading">
      <div>
        <p className="eyebrow">QUẢN LÝ KHO / KHO THÀNH PHẨM</p>
        <h1>{titles[section]}</h1>
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
          <div className="table-wrap">
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
                    <td>
                      <button className="sku-link">{t.id}</button>
                    </td>
                    <td>{t.time}</td>
                    <td>{t.type}</td>
                    <td>{t.from}</td>
                    <td>{t.to}</td>
                    <td className="number">{t.items}</td>
                    <td className="number">{t.qty.toLocaleString("vi-VN")}</td>
                    <td>{warehouseStatus(t.status)}</td>
                    <td>{t.user}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    );
  if (section === "inventory")
    return (
      <main className="workspace warehouse-workspace inventory-workspace">
        <section className="data-card">
          <div className="snapshot-toolbar">
            <label>
              <span>TUẦN KẾ HOẠCH</span>
              <input
                type="date"
                value={snapshotWeek}
                onChange={(e) => setSnapshotWeek(weekKeyOf(e.target.value))}
              />
            </label>
            <div>
              <small>TRẠNG THÁI CHỐT</small>
              <b
                className={
                  activeWeekSnapshot ? "snapshot-ok" : "snapshot-missing"
                }
              >
                {!snapshotsLoaded
                  ? "Đang kiểm tra..."
                  : activeWeekSnapshot
                    ? activeWeekSnapshot.status
                    : "Chưa chốt"}
              </b>
              {activeWeekSnapshot && <em>{activeWeekSnapshot.code}</em>}
            </div>
            <span />
            <button
              className="outline-button"
              onClick={() => setShowSnapshotHistory(true)}
            >
              Lịch sử chốt tồn
            </button>
            {activeWeekSnapshot ? (
              <button
                className="primary-button snapshot-open"
                onClick={() => setReopening(activeWeekSnapshot)}
              >
                Mở chốt
              </button>
            ) : (
              <button
                className="primary-button"
                disabled={!snapshotsLoaded}
                onClick={() => setShowSnapshotConfirm(true)}
              >
                Chốt tồn cho kế hoạch tuần
              </button>
            )}
          </div>
          <div className="inventory-filter-grid">
            <label>
              <span>MÃ HOẶC TÊN SKU</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Mã SKU hoặc tên sản phẩm"
              />
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
              <span>VỊ TRÍ</span>
              <input placeholder="Vị trí" />
            </label>
            <label>
              <span>SỐ LÔ</span>
              <input placeholder="Số lô" />
            </label>
            <label>
              <span>ĐƠN VỊ</span>
              <select>
                <option>Tất cả</option>
                <option>SỢI</option>
                <option>BỘ</option>
                <option>CÁI</option>
              </select>
            </label>
            <label className="check-filter">
              <input type="checkbox" /> Tồn dưới mức an toàn
            </label>
            <label className="check-filter">
              <input type="checkbox" /> Tồn trên 90 ngày
            </label>
            <button className="row-action">Lọc dữ liệu</button>
            <button
              className="outline-button"
              onClick={() =>
                setNotice(
                  "Đã chuẩn bị file Excel tồn kho theo bộ lọc hiện tại.",
                )
              }
            >
              ⇩ Xuất Excel
            </button>
          </div>
          {notice && <div className="save-notice">{notice}</div>}
          <div className="table-wrap">
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
                {filteredStock.map((r) => (
                  <tr key={r.sku + r.lot}>
                    <td>
                      <button
                        className="sku-link"
                        onClick={() => onOpenSku(r.sku)}
                      >
                        {r.sku}
                      </button>
                    </td>
                    <td className="product-name">{r.name}</td>
                    <td>{r.spec}</td>
                    <td>{r.unit}</td>
                    <td>{r.warehouse}</td>
                    <td>{r.location}</td>
                    <td>{r.lot}</td>
                    <td className="number">
                      {r.onHand.toLocaleString("vi-VN")}
                    </td>
                    <td>{r.updated}</td>
                    <td>
                      <button className="calc-button">Lịch sử biến động</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="warehouse-pagination">
            <span>
              Hiển thị 1–{filteredStock.length} / {filteredStock.length} dòng
            </span>
            <button>‹</button>
            <button className="active">1</button>
            <button>›</button>
          </div>
        </section>
        {showSnapshotConfirm && (
          <>
            <button
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
                <button onClick={() => setShowSnapshotConfirm(false)}>×</button>
              </div>
              <div className="snapshot-confirm-body">
                <dl>
                  <div>
                    <dt>Tuần kế hoạch</dt>
                    <dd>
                      {formatViDate(selectedWeekStart)}–
                      {formatViDate(selectedWeekEnd)}
                    </dd>
                  </div>
                  <div>
                    <dt>Nguồn tồn</dt>
                    <dd>Kho TP + Kho KD</dd>
                  </div>
                  <div>
                    <dt>Tổng SKU</dt>
                    <dd>
                      {new Set(
                        inventoryErpRows.map((row) => row.sku),
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
                  <button
                    className="ghost-button"
                    onClick={() => setShowSnapshotConfirm(false)}
                  >
                    Hủy
                  </button>
                  <button
                    className="primary-button"
                    disabled={savingSnapshot}
                    onClick={createSnapshot}
                  >
                    {savingSnapshot ? "Đang chốt..." : "Xác nhận chốt tồn"}
                  </button>
                </div>
              </div>
            </aside>
          </>
        )}
        {showSnapshotHistory && (
          <>
            <button
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
                <button onClick={() => setShowSnapshotHistory(false)}>×</button>
              </div>
              <div className="table-wrap">
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
                    {snapshots.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <button
                            className="sku-link"
                            onClick={() => setSelectedSnapshot(item)}
                          >
                            {item.code}
                          </button>
                        </td>
                        <td>
                          {item.weekStart}–{item.weekEnd}
                        </td>
                        <td>{formatDateTimeDisplay(item.snapshotAt)}</td>
                        <td className="number">{item.skuCount}</td>
                        <td className="number">
                          {item.totalTp.toLocaleString("vi-VN")}
                        </td>
                        <td className="number">
                          {item.totalKd.toLocaleString("vi-VN")}
                        </td>
                        <td className="number engine-rop">
                          {item.totalStock.toLocaleString("vi-VN")}
                        </td>
                        <td>{item.createdBy}</td>
                        <td>{warehouseStatus(item.status)}</td>
                        <td>
                          <button
                            className="calc-button"
                            onClick={() => setSelectedSnapshot(item)}
                          >
                            Chi tiết
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </aside>
          </>
        )}
        {selectedSnapshot && (
          <>
            <button
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
                <button onClick={() => setSelectedSnapshot(null)}>×</button>
              </div>
              <div className="snapshot-detail-summary">
                Tuần {selectedSnapshot.weekStart}–{selectedSnapshot.weekEnd} ·{" "}
                {selectedSnapshot.createdBy} · {selectedSnapshot.status}
              </div>
              <div className="table-wrap">
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
                        <td>{item.sku}</td>
                        <td>{item.name}</td>
                        <td>{item.spec}</td>
                        <td>{item.unit}</td>
                        <td className="number">
                          {item.tpQty.toLocaleString("vi-VN")}
                        </td>
                        <td className="number">
                          {item.kdQty.toLocaleString("vi-VN")}
                        </td>
                        <td className="number engine-rop">
                          {item.totalQty.toLocaleString("vi-VN")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </aside>
          </>
        )}
        {reopening && (
          <>
            <button
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
                <button onClick={() => setReopening(null)}>×</button>
              </div>
              <form className="snapshot-confirm-body" onSubmit={reopenSnapshot}>
                <p>
                  Bản chốt cũ và dữ liệu Production_engine đã sử dụng sẽ không
                  bị thay đổi. Sau khi mở, Kho phải tạo bản chốt mới và KHSX chủ
                  động cập nhật lại dữ liệu tuần.
                </p>
                <label>
                  <span>LÝ DO MỞ CHỐT *</span>
                  <textarea
                    name="reason"
                    required
                    placeholder="Nhập rõ nguyên nhân dữ liệu cần chốt lại"
                  />
                </label>
                <div className="snapshot-actions">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => setReopening(null)}
                  >
                    Hủy
                  </button>
                  <button
                    className="primary-button snapshot-open"
                    disabled={savingSnapshot}
                  >
                    {savingSnapshot ? "Đang xử lý..." : "Xác nhận mở chốt"}
                  </button>
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
        {heading}
        <div className="warehouse-tabs">
          <button
            className={receiveTab === "production" ? "active" : ""}
            onClick={() => setReceiveTab("production")}
          >
            Nhập từ Sản xuất báo công
          </button>
          <button
            className={receiveTab === "erp" ? "active" : ""}
            onClick={() => setReceiveTab("erp")}
          >
            Tự nhập bằng phiếu ERP
          </button>
        </div>
        {receiveTab === "production" ? (
          <section className="data-card">
            <div className="warehouse-flow">
              <span>Sản xuất báo công</span>
              <i>→</i>
              <span>Kho kiểm tra thực nhận</span>
              <i>→</i>
              <span>Kho xác nhận nhập</span>
              <i>→</i>
              <span>Cập nhật tồn</span>
            </div>
            <WarehouseFilters />
            <div className="table-wrap">
              <table className="warehouse-receive-table">
                <thead>
                  <tr>
                    <th>MÃ PHIẾU BÁO CÔNG</th>
                    <th>LỆNH SẢN XUẤT</th>
                    <th>MÃ THÀNH PHẨM</th>
                    <th>TÊN THÀNH PHẨM</th>
                    <th>SỐ LÔ</th>
                    <th>SL BÁO CÔNG</th>
                    <th>SL THỰC NHẬN</th>
                    <th>KHO NHẬN</th>
                    <th>VỊ TRÍ NHẬN</th>
                    <th>THỜI GIAN CHUYỂN</th>
                    <th>NGƯỜI BÀN GIAO</th>
                    <th>TRẠNG THÁI</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>BC-260828-041</td>
                    <td>510-26082804</td>
                    <td>
                      <button
                        className="sku-link"
                        onClick={() => onOpenSku("102XS04001")}
                      >
                        102XS04001
                      </button>
                    </td>
                    <td>DÂY XẢ INOX SỌC</td>
                    <td>LOT-260828-04</td>
                    <td className="number">2.000</td>
                    <td>
                      <input className="editable" defaultValue="2000" />
                    </td>
                    <td>KHO TP</td>
                    <td>
                      <select className="editable">
                        <option>A01-02</option>
                      </select>
                    </td>
                    <td>28/08/2026 14:22:16</td>
                    <td>sxlinea01</td>
                    <td>{warehouseStatus("Chờ xác nhận cập nhật")}</td>
                    <td>
                      <button className="primary-button compact-button">
                        Xác nhận nhập
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
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
                <label className="primary-button file-button">
                  Chọn ảnh hoặc PDF
                  <input type="file" accept="image/*,.pdf" />
                </label>
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
        {heading}
        <section className="data-card">
          <WarehouseFilters />
          <div className="table-wrap">
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
                  <td>ERP-XK-260828-011</td>
                  <td>28/08/2026 11:20:44</td>
                  <td>
                    <span className="event-type urgent">Xuất kho</span>
                  </td>
                  <td>
                    <button
                      className="sku-link"
                      onClick={() => onOpenSku("102XS04001")}
                    >
                      102XS04001
                    </button>
                  </td>
                  <td>DÂY XẢ INOX SỌC</td>
                  <td>LOT-260822-01</td>
                  <td>KHO TP</td>
                  <td>Khách hàng</td>
                  <td className="number">860</td>
                  <td>{warehouseStatus("Đã cập nhật kho")}</td>
                  <td>httai</td>
                </tr>
                <tr>
                  <td>ERP-CK-260828-006</td>
                  <td>28/08/2026 13:42:07</td>
                  <td>
                    <span className="event-type load">Chuyển kho</span>
                  </td>
                  <td>
                    <button
                      className="sku-link"
                      onClick={() => onOpenSku("107P5127")}
                    >
                      107P5127
                    </button>
                  </td>
                  <td>VAN PHAO NHỰA</td>
                  <td>LOT-260811-02</td>
                  <td>KHO TP</td>
                  <td>KHO KD</td>
                  <td className="number">1.200</td>
                  <td>{warehouseStatus("Chờ kho nhận")}</td>
                  <td>ltphong</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </main>
    );
  if (section === "warehouse-transfer")
    return (
      <main className="workspace warehouse-workspace">
        {heading}
        <section className="data-card transfer-document">
          <div className="document-toolbar">
            <div>
              <button className="outline-button">⌕ Tra phiếu</button>
              <button className="outline-button">↶ Hủy xác nhận</button>
              <button className="outline-button danger-action">
                × Hủy phiếu
              </button>
            </div>
            <span>{warehouseStatus("Đang chuyển")}</span>
          </div>
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
              <b>ltphong</b>
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
          <div className="table-wrap">
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
                  <td>
                    <button
                      className="sku-link"
                      onClick={() => onOpenSku("107P5127")}
                    >
                      107P5127
                    </button>
                  </td>
                  <td>VAN PHAO NHỰA</td>
                  <td>3/4&quot;</td>
                  <td className="number">1.200</td>
                  <td>CÁI</td>
                  <td>LOT-260811-02</td>
                  <td className="number">24</td>
                  <td>THÙNG</td>
                  <td>KHO TP</td>
                  <td>B02-04</td>
                  <td>KHO KD</td>
                  <td>KD-02-01</td>
                </tr>
              </tbody>
            </table>
          </div>
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
        {heading}
        <section className="data-card">
          <WarehouseFilters />
          <div className="table-wrap">
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
                    <td>
                      <button className="sku-link">{t.id}</button>
                    </td>
                    <td>{t.type}</td>
                    <td>{t.time}</td>
                    <td>{t.from}</td>
                    <td>{t.to}</td>
                    <td>{warehouseStatus(t.status)}</td>
                    <td>{t.user}</td>
                    <td>
                      <div className="document-actions">
                        <button>Hủy xác nhận</button>
                        <button>Hủy phiếu</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
        {heading}
        <section className="data-card">
          <div className="section-title">
            <div>
              <h2>Đợt kiểm kê tháng 08/2026</h2>
              <p>So sánh tồn hệ thống và số lượng kiểm đếm thực tế.</p>
            </div>
            <button className="primary-button">＋ Tạo phiếu kiểm kê</button>
          </div>
          <div className="table-wrap">
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
                  <td>KK-260828-01</td>
                  <td>KHO TP</td>
                  <td>Khu A</td>
                  <td>28/08/2026 08:00:00</td>
                  <td className="number">42</td>
                  <td className="number">−2</td>
                  <td>{warehouseStatus("Có chênh lệch")}</td>
                  <td>httung</td>
                  <td>
                    <button className="calc-button">Xem chi tiết</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="document-footer-actions">
            <button className="outline-button">Hủy xác nhận</button>
            <button className="outline-button danger-action">Hủy phiếu</button>
          </div>
        </section>
      </main>
    );
  return (
    <main className="workspace warehouse-workspace">
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
          <button className="outline-button">⇩ Xuất Excel</button>
        </div>
        <div className="report-options">
          <button>Tồn kho theo thời điểm</button>
          <button>Nhập – xuất – tồn</button>
          <button>Lịch sử giao dịch SKU</button>
          <button>Tồn theo kho / vị trí / lô</button>
          <button>Tồn trên 90 ngày</button>
          <button>Phiếu có chênh lệch</button>
          <button>Nhật ký hủy xác nhận</button>
          <button>Nhật ký hệ thống</button>
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
  oldVersion: string;
  newVersion: string;
  setup?: string;
  effective: string;
  user: string;
  reason: string;
  status: string;
  lines: BomChangeLine[];
};
let bomChangeHistory: BomChangeHistory[] = [
  {
    id: "BOM-DC-20260905-001",
    sku: "101CTP010",
    oldVersion: "0000",
    newVersion: "0001",
    setup: "05/09/2026",
    effective: "05/09/2026",
    user: "vthduyen",
    reason: "Thiết lập BOM ban đầu",
    status: "Đã xác nhận",
    lines: [
      {
        code: "3010109",
        name: "HỘP CÔNG TẮC",
        spec: "STC-2021",
        action: "Thêm mới",
        oldQty: "—",
        newQty: "1",
        denominator: "1",
        note: "Dòng BOM ban đầu",
      },
    ],
  },
];

function BomChangeContent({ initialSku = "", embedded = false, onClose }: { initialSku?: string; embedded?: boolean; onClose?: (savedStatus?: string) => void } = {}) {
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
  const [message, setMessage] = useState("");
  const [rows, setRows] = useState([emptyRow]);
  const [parentSku, setParentSku] = useState(initialSku);
  const [setupDate, setSetupDate] = useState(() => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }));
  const [reason, setReason] = useState("");
  const [suggestRow, setSuggestRow] = useState<number | null>(null);
  const [replacementSuggestRow, setReplacementSuggestRow] = useState<
    number | null
  >(null);
  const [history, setHistory] = useState<BomChangeHistory[]>(
    () => bomChangeHistory,
  );
  const [selectedHistory, setSelectedHistory] =
    useState<BomChangeHistory | null>(null);
  const [editingId, setEditingId] = useState("");
  const [changeError, setChangeError] = useState("");
  const [changeSearchOpen, setChangeSearchOpen] = useState(false);
  const [changeQuery, setChangeQuery] = useState("");
  const [changeSearchFocused, setChangeSearchFocused] = useState(false);
  useEffect(() => {
    fetch("/api/records?entity=bom_change")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => {
        const saved = data.records.map(
          (record: { payload: BomChangeHistory }) => record.payload,
        );
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
  }, []);
  const updateRow = (index: number, key: string, value: string) =>
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, [key]: value } : row)),
    );
  const filteredChangeHistory = history.filter((record) =>
    `${record.id} ${record.sku} ${record.status}`
      .toLowerCase()
      .includes(changeQuery.trim().toLowerCase()),
  );
  const selectChangeMaterial = (index: number, value: string) => {
    const code = value.toUpperCase();
    const found = bomMasterOptions.find((item) => item.code === code);
    const currentItem = bomCatalog
      .find((item) => item.sku === parentSku)
      ?.items.find(
        (item) => item.code === code && (!item.expiry || item.expiry === "—"),
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
            `[data-change-code-row="${index + 1}"]`,
          )
          ?.focus(),
      0,
    );
  };
  const pendingForSku = (sku: string) => history.find((record) =>
    record.sku === sku && record.id !== editingId && record.status === "Chờ xác nhận");
  const validateChangeSku = (sku: string) => {
    const duplicate = pendingForSku(sku.trim().toUpperCase());
    const error = duplicate
      ? `Không thể tạo phiếu mới. SKU ${sku.trim().toUpperCase()} đang có phiếu ${duplicate.id} chờ xác nhận. Vui lòng xác nhận hoặc hủy phiếu trước.`
      : "";
    setChangeError(error);
    return error;
  };
  const startEdit = (record: BomChangeHistory) => {
    if (record.status !== "Chờ xác nhận") return;
    setEditingId(record.id);
    setParentSku(record.sku);
    setReason(record.reason);
    const [day, month, year] = (record.setup || "").split("/");
    if (year && month && day) setSetupDate(`${year}-${month}-${day}`);
    setRows(record.lines.map((line) => ({ ...emptyRow, ...line })));
    setSelectedHistory(null);
    setChangeError("");
    setCreating(true);
  };
  const updateChangeStatus = async (record: BomChangeHistory, status: string) => {
    const next = {
      ...record,
      status,
      effective: status === "Đã xác nhận"
        ? new Date().toLocaleDateString("en-GB", { timeZone: "Asia/Ho_Chi_Minh" })
        : "—",
    };
    const response = await fetch("/api/records", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entity: "bom_change", key: next.id, payload: next, updatedBy: "vthduyen" }),
    });
    if (!response.ok) { setMessage("Không thể cập nhật trạng thái phiếu."); return; }
    bomChangeHistory = bomChangeHistory.map((item) => item.id === next.id ? next : item);
    setHistory(bomChangeHistory);
    setSelectedHistory(next);
    setMessage(`Phiếu ${next.id}: ${status}.`);
  };
  const submitChange = async (status: "Nháp" | "Chờ xác nhận") => {
    const base = bomCatalog.find((item) => item.sku === parentSku);
    if (!base || !reason.trim()) {
      setMessage("Vui lòng chọn đúng SKU BOM và nhập lý do thay đổi.");
      return;
    }
    if (validateChangeSku(parentSku)) return;
    const setup = setupDate.split("-").reverse().join("/");
    let items = [...base.items];
    const applied: BomChangeLine[] = [];
    rows
      .filter((row) => row.code)
      .forEach((row) => {
        const master = bomMasterOptions.find((item) => item.code === row.code);
        const before = items.find((item) => item.code === row.code);
        if (row.action === "Ngừng sử dụng")
          items = items.map((item) =>
            item.code === row.code ? { ...item, expiry: "—" } : item,
          );
        else if (
          row.action === "Thay đổi" &&
          row.newCode &&
          row.newCode !== row.code
        ) {
          const replacement = bomMasterOptions.find(
            (item) => item.code === row.newCode,
          );
          items = items.map((item) =>
            item.code === row.code ? { ...item, expiry: "—" } : item,
          );
          if (replacement)
            items.push({
              stt: String((items.length + 1) * 10).padStart(4, "0"),
              code: replacement.code,
              name: replacement.name,
              spec: replacement.spec,
              waste: "—",
              qty: row.newQty || before?.qty || "1",
              denominator: row.denominator,
              waste: row.waste || "",
              setup,
              effective: "—",
              expiry: "—",
              unit: replacement.unit,
              source: replacement.source,
              check: "Khớp",
            });
        } else if (row.action === "Thay đổi")
          items = items.map((item) =>
            item.code === row.code
              ? {
                  ...item,
                  qty: row.newQty || item.qty,
                  denominator: row.denominator,
                  waste: row.waste || item.waste,
                  setup,
                  effective: "—",
                }
              : item,
          );
        else if (master && !before)
          items.push({
            stt: String((items.length + 1) * 10).padStart(4, "0"),
            code: master.code,
            name: master.name,
            spec: master.spec,
            waste: "—",
            qty: row.newQty || "1",
            denominator: row.denominator,
            waste: row.waste || "",
            setup,
            effective: "—",
            expiry: "—",
            unit: master.unit,
            source: master.source,
            check: "Khớp",
          });
        applied.push({
          ...row,
          name: row.name || master?.name || before?.name || "—",
          spec: row.spec || master?.spec || before?.spec || "—",
          oldQty: before?.qty || row.oldQty || "—",
          newCode: row.newCode,
          newQty:
            row.action === "Ngừng sử dụng"
              ? "—"
              : row.newQty || before?.qty || "1",
        });
      });
    const newVersion = String(Number(base.version || 0) + 1).padStart(4, "0");
    const record: BomChangeHistory = {
      id: editingId || `BOM-DC-20260905-${String(history.length + 1).padStart(3, "0")}`,
      sku: parentSku,
      oldVersion: base.version,
      newVersion,
      setup,
      effective: "—",
      user: "vthduyen (người lập)",
      reason,
      status,
      lines: applied,
    };
    const saved = await Promise.all([
      fetch("/api/records", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          entity: "bom_change",
          key: record.id,
          payload: record,
          updatedBy: "vthduyen",
        }),
      }),
    ]);
    if (saved.some((response) => !response.ok)) {
      setMessage(
        "Không thể lưu phiếu vào dữ liệu dùng chung. BOM chưa được cập nhật.",
      );
      return;
    }
    bomChangeHistory = [record, ...bomChangeHistory.filter((item) => item.id !== record.id)];
    setHistory(bomChangeHistory);
    setSelectedHistory(record);
    setCreating(false);
    setMessage(status === "Nháp"
      ? `Đã lưu nháp phiếu ${record.id}. BOM đang áp dụng không thay đổi.`
      : `Đã gửi phiếu ${record.id} chờ xác nhận. BOM ${parentSku} chưa thay đổi cho đến khi người có quyền xác nhận.`);
    onClose?.(status);
  };
  return (
    <main className={`workspace warehouse-workspace${embedded ? " bom-change-embedded" : ""}`}>
      {embedded && <button className="bom-back-button" onClick={() => onClose?.()}>← Trở về danh sách BOM</button>}
      <div className="page-heading bom-change-title">
        <div>
          <h1>Phiếu thay đổi BOM</h1>
        </div>
      </div>
      {!creating && (
        <div className="bom-commandbar bom-change-commandbar">
          <button className="bom-command" onClick={() => {
            setSelectedHistory(null);
            setMessage("");
            setChangeQuery("");
            setChangeSearchOpen(true);
          }}><span>⌕</span>Tra cứu</button>
          <button className="bom-command" disabled={!selectedHistory || selectedHistory.status !== "Chờ xác nhận"} onClick={() => selectedHistory && startEdit(selectedHistory)}><span>✎</span>Sửa</button>
          <button className="bom-command cancel-confirm" disabled={!selectedHistory || selectedHistory.status !== "Chờ xác nhận"} onClick={() => selectedHistory && updateChangeStatus(selectedHistory, "Đã hủy")}><span>×</span>Hủy</button>
          <button className="bom-command confirm" disabled={!selectedHistory || selectedHistory.status !== "Chờ xác nhận"} onClick={() => selectedHistory && updateChangeStatus(selectedHistory, "Đã xác nhận")}><span>✓</span>Xác nhận</button>
          <button className="bom-command cancel-confirm" disabled={!selectedHistory || selectedHistory.status !== "Đã xác nhận"} onClick={() => selectedHistory && updateChangeStatus(selectedHistory, "Đã hủy xác nhận")}><span>↶</span>Hủy xác nhận</button>
          <i />
          {selectedHistory && <button className="bom-command" onClick={() => setSelectedHistory(null)}><span>←</span>Quay lại</button>}
        </div>
      )}
      {!creating && changeSearchOpen && (
        <div className="bom-change-search bom-code-entry">
          <input
            value={changeQuery}
            onFocus={() => setChangeSearchFocused(true)}
            onBlur={() => setTimeout(() => setChangeSearchFocused(false), 150)}
            onChange={(event) => { setChangeQuery(event.target.value); setSelectedHistory(null); setChangeSearchFocused(true); }}
            placeholder="Tra theo mã phiếu, SKU hoặc trạng thái"
            autoComplete="off"
          />
          {changeSearchFocused && changeQuery.trim() && filteredChangeHistory.length > 0 && (
            <div className="bom-change-suggestions">
              {filteredChangeHistory.slice(0, 7).map((record) => (
                <button type="button" key={record.id} onMouseDown={(event) => event.preventDefault()} onClick={() => { setChangeQuery(record.sku); setSelectedHistory(null); setChangeSearchFocused(false); }}>
                  <b>{record.sku}</b><span>{record.id}</span><small>{record.status}</small>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {creating ? (
        <section className="data-card bom-change-form">
          <div className="bom-change-head">
            <label>
              <span>MÃ PHIẾU THAY ĐỔI</span>
              <input value={editingId || `BOM-DC-20260905-${String(history.length + 1).padStart(3, "0")}`} readOnly />
            </label>
            <label className="bom-code-entry">
              <span>SKU THÀNH PHẨM / BTP</span>
              <input
                value={parentSku}
                onChange={(e) => { setParentSku(e.target.value.toUpperCase()); setChangeError(""); }}
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
                      <button
                        type="button"
                        key={x.sku}
                        onClick={() => setParentSku(x.sku)}
                      >
                        <b>{x.sku}</b>
                        <span>{x.name}</span>
                        <small>{x.spec || "—"}</small>
                      </button>
                    ))}
                </div>
              )}
            </label>
            {changeError && <div className="bom-change-error">{changeError}</div>}
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
              <input
                type="date"
                value={setupDate}
                readOnly
              />
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
          <div className="table-wrap">
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
                  <th>HAO HỤT</th>
                  <th>GHI CHÚ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const suggestions =
                    row.code &&
                    !bomMasterOptions.some((x) => x.code === row.code)
                      ? bomMasterOptions
                          .filter((x) =>
                            `${x.code} ${x.name}`
                              .toLowerCase()
                              .includes(row.code.toLowerCase()),
                          )
                          .slice(0, 5)
                      : [];
                  const replacementSuggestions =
                    row.newCode &&
                    !bomMasterOptions.some((x) => x.code === row.newCode)
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
                      <td>
                        <div className="bom-code-entry">
                          <input
                            data-change-code-row={i}
                            value={row.code}
                            onFocus={() => setSuggestRow(i)}
                            onBlur={() =>
                              setTimeout(() => setSuggestRow(null), 120)
                            }
                            onChange={(e) => {
                              selectChangeMaterial(i, e.target.value);
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
                          {suggestRow === i && suggestions.length > 0 && (
                            <div className="bom-compact-suggestions">
                              {suggestions.map((option) => (
                                <button
                                  type="button"
                                  key={option.code}
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    selectChangeMaterial(i, option.code);
                                    setSuggestRow(null);
                                  }}
                                >
                                  <b>{option.code}</b>
                                  <span>{option.name}</span>
                                  <small>{option.spec || "—"}</small>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <input className="autofill" value={row.name} readOnly />
                      </td>
                      <td>
                        <input className="autofill" value={row.spec} readOnly />
                      </td>
                      <td>
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
                      </td>
                      <td>
                        <div className="bom-code-entry">
                          <input
                            value={row.newCode}
                            disabled={row.action !== "Thay đổi"}
                            onFocus={() => setReplacementSuggestRow(i)}
                            onBlur={() =>
                              setTimeout(
                                () => setReplacementSuggestRow(null),
                                120,
                              )
                            }
                            onChange={(e) => {
                              selectReplacementMaterial(i, e.target.value);
                              setReplacementSuggestRow(i);
                            }}
                            placeholder={
                              row.action === "Thay đổi"
                                ? "Nhập mã thay thế (nếu có)"
                                : "—"
                            }
                          />
                          {replacementSuggestRow === i &&
                            replacementSuggestions.length > 0 && (
                              <div className="bom-compact-suggestions">
                                {replacementSuggestions.map((option) => (
                                  <button
                                    type="button"
                                    key={option.code}
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                      selectReplacementMaterial(i, option.code);
                                      setReplacementSuggestRow(null);
                                    }}
                                  >
                                    <b>{option.code}</b>
                                    <span>{option.name}</span>
                                    <small>{option.spec || "—"}</small>
                                  </button>
                                ))}
                              </div>
                            )}
                        </div>
                      </td>
                      <td>
                        <input
                          value={row.oldQty}
                          onChange={(e) =>
                            updateRow(i, "oldQty", e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          value={row.newQty}
                          onChange={(e) =>
                            updateRow(i, "newQty", e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          value={row.denominator}
                          onChange={(e) =>
                            updateRow(i, "denominator", e.target.value)
                          }
                        />
                      </td>
                      <td><input value={row.waste || ""} onChange={(e) => updateRow(i, "waste", e.target.value)} placeholder="Có thể để trống" /></td>
                      <td>
                        <input
                          value={row.note}
                          onChange={(e) => updateRow(i, "note", e.target.value)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="document-footer-actions">
            <button
              className="outline-button"
              onClick={() => onClose ? onClose() : setCreating(false)}
            >
              Hủy
            </button>
            <button className="primary-button" onClick={() => submitChange("Chờ xác nhận")}>
              Lưu
            </button>
          </div>
          {message && <div className="save-notice">{message}</div>}
        </section>
      ) : (
        <>
          {message && (
            <div className="save-notice bom-history-notice">{message}</div>
          )}
          <section className="data-card">
            <div className="section-title">
              <div>
                <h2>Lịch sử phiếu thay đổi</h2>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>MÃ PHIẾU</th>
                    <th>SKU</th>
                    <th>PHIÊN BẢN CŨ</th>
                    <th>PHIÊN BẢN MỚI</th>
                    <th>NGÀY THIẾT LẬP</th>
                    <th>NGÀY HIỆU LỰC</th>
                    <th>NGƯỜI XÁC NHẬN</th>
                    <th>TRẠNG THÁI</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredChangeHistory.map((record) => (
                    <tr
                      key={record.id}
                      className="history-row"
                      onClick={() => setSelectedHistory(record)}
                      onDoubleClick={() => startEdit(record)}
                    >
                      <td>
                        <button className="sku-link">{record.id}</button>
                      </td>
                      <td>{record.sku}</td>
                      <td>{record.oldVersion}</td>
                      <td>{record.newVersion}</td>
                      <td>{record.setup || "—"}</td>
                      <td>{record.effective}</td>
                      <td>{record.user}</td>
                      <td>
                        <span className="done-badge">{record.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          {selectedHistory && (
            <section className="data-card bom-history-detail">
              <div className="section-title">
                <div>
                  <h2>Nội dung thay đổi · {selectedHistory.id}</h2>
                </div>
                <button
                  className="outline-button"
                  onClick={() => setSelectedHistory(null)}
                >
                  Đóng
                </button>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>MÃ LK/NVL CŨ → MỚI</th>
                      <th>TÊN LK/NVL</th>
                      <th>QUY CÁCH</th>
                      <th>LOẠI THAY ĐỔI</th>
                      <th>LƯỢNG DÙNG CŨ</th>
                      <th>LƯỢNG DÙNG MỚI</th>
                      <th>MẪU SỐ</th>
                      <th>HAO HỤT</th>
                      <th>GHI CHÚ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedHistory.lines.map((line, i) => (
                      <tr key={`${line.code}-${i}`}>
                        <td>
                          {line.newCode
                            ? `${line.code} → ${line.newCode}`
                            : line.code}
                        </td>
                        <td>{line.name}</td>
                        <td>{line.spec || "—"}</td>
                        <td>
                          <span className="change-badge">{line.action}</span>
                        </td>
                        <td>{line.oldQty}</td>
                        <td>{line.newQty}</td>
                        <td>{line.denominator}</td>
                        <td>{line.waste || "—"}</td>
                        <td>{line.note || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}

function ProductionContent({
  section,
  sessionLine,
}: {
  section: string;
  sessionLine?: "A" | "B";
}) {
  if (section === "production-report" || section === "labor-adjustment")
    return (
      <main
        className="workspace empty-workspace"
        aria-label="Chọn một thao tác để hiển thị nội dung"
      />
    );
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
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            QUẢN LÝ SẢN XUẤT{sessionLine ? ` / LINE ${sessionLine}` : ""}
          </p>
          <h1>{titles[section]}</h1>
          <p>
            {sessionLine
              ? `Phiên đăng nhập nhanh chỉ hiển thị lệnh và nghiệp vụ thuộc Line ${sessionLine}.`
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
            ? `Dữ liệu Line ${sessionLine} đã được khóa theo phiên đăng nhập; không thể báo công nhầm Line.`
            : "Chức năng đã được đưa vào đúng cấu trúc menu."}
        </span>
      </section>
    </main>
  );
}

type LoginSession =
  | { kind: "account"; name: string; detail: string }
  | { kind: "line"; line: "A" | "B"; name: string; detail: string };

function LoginGate({
  onLogin,
  language,
  onLanguage,
}: {
  onLogin: (session: LoginSession) => void;
  language: Language;
  onLanguage: (language: Language) => void;
}) {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId.trim() || !password.trim()) {
      setError("Vui lòng nhập đầy đủ ID và mật khẩu.");
      return;
    }
    setError("");
    onLogin({
      kind: "account",
      name: "Vũ Hương Duyên",
      detail: "KHSX · vthduyen",
    });
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
          <h1>ONSPA Production</h1>
          <span>Kế hoạch · Sản xuất · Kho · Dữ liệu dùng chung</span>
        </div>
        <form className="login-box" onSubmit={submit}>
          <div className="login-box-head">
            <img src="/logo-onspa.jpg" alt="ONSPA" />
          </div>
          <h2>Đăng nhập</h2>
          <p>
            Chọn nhanh Line tại hiện trường hoặc sử dụng tài khoản được cấp.
          </p>
          <div className="quick-line-login">
            <span>ĐĂNG NHẬP NHANH TẠI HIỆN TRƯỜNG</span>
            <div>
              <button
                type="button"
                onClick={() =>
                  onLogin({
                    kind: "line",
                    line: "A",
                    name: "Thiết bị Line A",
                    detail: "Sản xuất · Line A",
                  })
                }
              >
                <b>A</b>
                <em>Vào Line A</em>
                <small>Chỉ báo công Line A</small>
              </button>
              <button
                type="button"
                onClick={() =>
                  onLogin({
                    kind: "line",
                    line: "B",
                    name: "Thiết bị Line B",
                    detail: "Sản xuất · Line B",
                  })
                }
              >
                <b>B</b>
                <em>Vào Line B</em>
                <small>Chỉ báo công Line B</small>
              </button>
            </div>
          </div>
          <div className="login-divider">
            <span>hoặc đăng nhập bằng tài khoản</span>
          </div>
          <label>
            <span>ID đăng nhập</span>
            <input
              autoFocus
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Nhập ID người dùng"
            />
          </label>
          <label>
            <span>Mật khẩu</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu"
            />
          </label>
          <label className="remember-login">
            <input type="checkbox" defaultChecked />
            <span>Nhớ tôi trên thiết bị này</span>
          </label>
          {error && <div className="login-error">{error}</div>}
          <button type="submit">Đăng nhập</button>
          <small className="preview-account">
            Không lưu ID hoặc mật khẩu trên màn hình đăng nhập.
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
  const [rules, setRules] = useState<SafetyRuleSet[]>([defaultSafetyRuleSet]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Tất cả trạng thái");
  const [editing, setEditing] = useState<SafetyRuleSet | null>(null);
  const [notice, setNotice] = useState("");
  const [history, setHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const operator = "vthduyen";
  useEffect(() => {
    fetch("/api/records?entity=safety_rules")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(async (data) => {
        const saved = data.records
          .map((x: { payload: SafetyRuleSet }) => x.payload)
          .filter((x: SafetyRuleSet) => !x._deleted);
        const next = saved.length ? saved : [defaultSafetyRuleSet];
        safetyRuleSets = next;
        setRules(next);
        if (!saved.length)
          await fetch("/api/records", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              entity: "safety_rules",
              key: defaultSafetyRuleSet.id,
              payload: defaultSafetyRuleSet,
              updatedBy: "vthduyen",
            }),
          });
      })
      .catch(() => setNotice("Không thể tải bộ quy tắc đã lưu."));
  }, []);
  const selected = rules.find((x) => x.id === selectedId) || null;
  const filtered = rules.filter(
    (x) =>
      (status === "Tất cả trạng thái" || x.status === status) &&
      (!query ||
        `${x.code} ${x.name} ${x.version} ${x.createdBy} ${x.confirmedBy || ""}`
          .toLowerCase()
          .includes(query.toLowerCase())),
  );
  const saveAudit = async (
    action: string,
    before: SafetyRuleSet | null,
    after: SafetyRuleSet | null,
    reason: string,
  ) =>
    fetch("/api/records", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entity: "safety_rule_audit",
        key: `${after?.id || before?.id}:${Date.now()}`,
        payload: {
          action,
          ruleId: after?.id || before?.id,
          before,
          after,
          reason,
          operator,
          at: new Date().toISOString(),
        },
        updatedBy: operator,
      }),
    });
  const persist = async (
    next: SafetyRuleSet,
    before: SafetyRuleSet | null,
    action: string,
  ) => {
    setSaving(true);
    const response = await fetch("/api/records", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entity: "safety_rules",
        key: next.id,
        payload: next,
        updatedBy: operator,
      }),
    });
    if (response.ok) {
      await saveAudit(action, before, next, next.changeReason);
      const list = [next, ...rules.filter((x) => x.id !== next.id)];
      setRules(list);
      safetyRuleSets = list;
      setSelectedId(next.id);
      setEditing(null);
      setNotice(`Đã ${action.toLowerCase()} ${next.code} · ${next.version}.`);
    } else setNotice("Không thể lưu bộ quy tắc.");
    setSaving(false);
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
    setSaving(true);
    const response = await fetch("/api/records", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entity: "safety_rules",
        key: rule.id,
        payload: next,
        updatedBy: operator,
      }),
    });
    if (response.ok) {
      await saveAudit("Xóa", rule, next, "Xóa bản nháp");
      const list = rules.filter((x) => x.id !== rule.id);
      setRules(list);
      safetyRuleSets = list;
      setSelectedId(null);
      setNotice("Đã xóa mềm bản nháp và giữ lịch sử.");
    }
    setSaving(false);
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
      <div className="sku-master-toolbar rule-toolbar">
        <span>
          <b>Quy tắc Safety Days</b>
          <small>
            Safety Days được tự động chọn theo ngày bắt đầu tuần kế hoạch
          </small>
        </span>
        <div>
          <button className="primary-button" onClick={() => openNew()}>
            ＋ Thêm mới
          </button>
          <button
            className="outline-button"
            disabled={!selected}
            onClick={() => selected && openNew(selected)}
          >
            Sao chép phiên bản
          </button>
          <button className="outline-button" onClick={exportRules}>
            Xuất Excel
          </button>
        </div>
      </div>
      {notice && (
        <div className="save-notice master-save-notice">
          {notice}
          <button onClick={() => setNotice("")}>×</button>
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
          <div className="table-wrap">
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
                    <td className="master-sku">{rule.code}</td>
                    <td>{rule.name}</td>
                    <td>{rule.version}</td>
                    <td>{rule.effectiveFrom || "—"}</td>
                    <td>{rule.effectiveTo || "Không giới hạn"}</td>
                    <td>
                      <span
                        className={`rule-status ${safetyRuleStatusClass(rule.status)}`}
                      >
                        {rule.status}
                      </span>
                    </td>
                    <td className="number">
                      {
                        [
                          rule.leadTimeRules,
                          rule.forecastRules,
                          rule.situationRules,
                        ].filter((g) =>
                          g.some((x) => x.status === "Đang áp dụng"),
                        ).length
                      }
                    </td>
                    <td>{rule.createdBy}</td>
                    <td>{rule.updatedBy}</td>
                    <td>{rule.confirmedBy || "—"}</td>
                    <td>
                      {rule.confirmedAt
                        ? formatDateTimeDisplay(rule.confirmedAt)
                        : "—"}
                    </td>
                    <td>{rule.changeReason || "—"}</td>
                    <td>
                      <div className="master-row-actions">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditing(structuredClone(rule));
                          }}
                          disabled={
                            !["Nháp", "Đã hủy xác nhận"].includes(rule.status)
                          }
                        >
                          Sửa
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            confirmRule(rule);
                          }}
                        >
                          Xác nhận
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            unconfirm(rule);
                          }}
                        >
                          Hủy xác nhận
                        </button>
                        <button
                          className="delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            remove(rule);
                          }}
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="rule-pagination">
            <span>{filtered.length} bộ quy tắc</span>
            <button>‹</button>
            <b>1</b>
            <button>›</button>
            <button onClick={() => setHistory(true)}>Xem lịch sử</button>
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
          <button className="overlay" onClick={() => setHistory(false)} />
          <aside className="drawer rule-history">
            <div className="drawer-title">
              <div>
                <span>QUY TẮC SAFETY DAYS</span>
                <h2>Lịch sử phiên bản</h2>
              </div>
              <button onClick={() => setHistory(false)}>×</button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>PHIÊN BẢN</th>
                    <th>NGÀY HIỆU LỰC</th>
                    <th>TRẠNG THÁI</th>
                    <th>LÝ DO</th>
                    <th>NGƯỜI THAY ĐỔI</th>
                    <th>KẾ HOẠCH ĐÃ DÙNG</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((x) => (
                    <tr key={x.id}>
                      <td>
                        {x.code} · {x.version}
                      </td>
                      <td>
                        {x.effectiveFrom} – {x.effectiveTo || "Không giới hạn"}
                      </td>
                      <td>{x.status}</td>
                      <td>{x.changeReason}</td>
                      <td>{x.updatedBy}</td>
                      <td>{x.usedByPlans?.join(", ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
              <td>{i + 1}</td>
              <td>{x.from}</td>
              <td>{x.to ?? "Không giới hạn"}</td>
              <td>{x.days}</td>
              <td>{x.status}</td>
              <td>{x.note || "—"}</td>
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
              <td>{x.from ?? "0"}%</td>
              <td>{x.to ?? "Không giới hạn"}</td>
              <td>{x.days}</td>
              <td>{x.status}</td>
              <td>{x.note}</td>
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
              <td>{x.code}</td>
              <td>{x.name}</td>
              <td>{x.days}</td>
              <td>{x.status}</td>
              <td>{x.note || "—"}</td>
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
      <button className="overlay" onClick={onClose} />
      <aside className="detail-panel safety-rule-editor">
        <div className="detail-header">
          <div>
            <p>DỮ LIỆU CƠ BẢN</p>
            <h2>
              {value.effectiveFrom ? "Sửa" : "Thêm"} bộ Quy tắc Safety Days
            </h2>
            <span>Chỉ bản Nháp mới được chỉnh sửa.</span>
          </div>
          <button onClick={onClose}>×</button>
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
                    <td>
                      <input
                        type="number"
                        min="1"
                        value={x.from}
                        onChange={(e) =>
                          updateRange(i, "from", Number(e.target.value))
                        }
                      />
                    </td>
                    <td>
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
                    </td>
                    <td>
                      <input
                        type="number"
                        min="1"
                        value={x.days}
                        onChange={(e) =>
                          updateRange(i, "days", Number(e.target.value))
                        }
                      />
                    </td>
                    <td>
                      <input
                        value={x.note}
                        onChange={(e) => updateRange(i, "note", e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="form-actions full">
            <button className="ghost-button" onClick={onClose}>
              Hủy
            </button>
            <button
              className="primary-button"
              disabled={
                saving || !draft.effectiveFrom || !draft.changeReason.trim()
              }
              onClick={() => onSave(draft)}
            >
              {saving ? "Đang lưu..." : "Lưu bản nháp"}
            </button>
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
const defaultSafetyGroups: SafetyGroupVersion[] = [
  {
    id: "SD-LT-V1",
    group: "leadtime",
    code: "SD-LT",
    version: "V1",
    effectiveFrom: "2026-01-01",
    effectiveTo: "",
    status: "Đang áp dụng",
    rows: structuredClone(defaultSafetyRuleSet.leadTimeRules),
    reason: "Quy tắc chuẩn theo Lead Time",
    note: "",
    createdBy: "vthduyen",
    createdAt: "2026-01-01T00:00:00.000Z",
    confirmedBy: "admin",
    confirmedAt: "2026-01-01T00:00:00.000Z",
    updatedBy: "vthduyen",
    updatedAt: "2026-01-01T00:00:00.000Z",
    usedByPlans: [],
  },
  {
    id: "SD-FA-V1",
    group: "forecast",
    code: "SD-FA",
    version: "V1",
    effectiveFrom: "2026-01-01",
    effectiveTo: "",
    status: "Đã hủy",
    rows: structuredClone(defaultSafetyRuleSet.forecastRules),
    reason: "Lưu sẵn, chưa áp dụng",
    note: "Chưa tham gia tính Safety Days",
    createdBy: "vthduyen",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedBy: "vthduyen",
    updatedAt: "2026-01-01T00:00:00.000Z",
    usedByPlans: [],
  },
  {
    id: "SD-DS-V1",
    group: "situation",
    code: "SD-DS",
    version: "V1",
    effectiveFrom: "2026-01-01",
    effectiveTo: "",
    status: "Đã hủy",
    rows: structuredClone(defaultSafetyRuleSet.situationRules),
    reason: "Lưu sẵn, chưa áp dụng",
    note: "Chưa tham gia tính Safety Days",
    createdBy: "vthduyen",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedBy: "vthduyen",
    updatedAt: "2026-01-01T00:00:00.000Z",
    usedByPlans: [],
  },
];
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
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const operator = "vthduyen";
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
    fetch("/api/records?entity=safety_rule_groups")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(async (data) => {
        const saved = data.records
          .map((x: { payload: SafetyGroupVersion }) => x.payload)
          .filter((x: SafetyGroupVersion) => !x._deleted);
        if (saved.length) {
          setVersions(saved);
          setSelectedId(null);
          return;
        }
        await Promise.all(
          defaultSafetyGroups.map((x) =>
            fetch("/api/records", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                entity: "safety_rule_groups",
                key: x.id,
                payload: x,
                updatedBy: operator,
              }),
            }),
          ),
        );
      })
      .catch(() =>
        setNotice("Không thể tải dữ liệu đã lưu; đang hiển thị dữ liệu chuẩn."),
      );
  }, []);
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
      b.version.localeCompare(a.version, undefined, { numeric: true }),
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
        setNotice(
          "Nhóm quy tắc này hiện chỉ dùng để tra cứu và xem lịch sử; chưa tham gia tính Safety Days.",
        );
        return;
      }
      if (next !== "add" && !selected) {
        setNotice(
          "Vui lòng chọn một phiên bản trong bảng trước khi thực hiện thao tác này.",
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
  const audit = async (
    type: string,
    before: SafetyGroupVersion | null,
    after: SafetyGroupVersion | null,
    reason: string,
  ) =>
    fetch("/api/records", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entity: "safety_rule_audit",
        key: `${after?.id || before?.id}:${Date.now()}`,
        payload: {
          group: tab,
          type,
          before,
          after,
          reason,
          operator,
          at: new Date().toISOString(),
        },
        updatedBy: operator,
      }),
    });
  const persist = async (
    next: SafetyGroupVersion,
    before: SafetyGroupVersion | null,
    type: string,
  ) => {
    setSaving(true);
    try {
      const response = await fetch("/api/records", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          entity: "safety_rule_groups",
          key: next.id,
          payload: next,
          updatedBy: operator,
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await audit(type, before, next, next.reason);
      setVersions((v) => [next, ...v.filter((x) => x.id !== next.id)]);
      setSelectedId(next.id);
      setAction(null);
      setDirty(false);
      setNotice(`Đã ${type.toLowerCase()} ${next.code} · ${next.version}.`);
    } catch {
      setNotice(
        `Không thể ${type.toLowerCase()} dữ liệu. Dữ liệu chưa được lưu; vui lòng kiểm tra kết nối và thử lại.`,
      );
    } finally {
      setSaving(false);
    }
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
    await persist(next, selected, label);
    if (kind === "confirm" && tab === "leadtime") {
      const previous =
        versions.find((x) => x.id === selected.sourceId) ||
        versions.find(
          (x) =>
            x.group === selected.group &&
            x.id !== selected.id &&
            x.status === "Đang áp dụng",
        );
      if (previous) {
        const closedPrevious: SafetyGroupVersion = {
          ...previous,
          effectiveTo: next.effectiveFrom,
          status: "Hết hiệu lực",
          updatedBy: operator,
          updatedAt: now,
        };
        const response = await fetch("/api/records", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            entity: "safety_rule_groups",
            key: closedPrevious.id,
            payload: closedPrevious,
            updatedBy: operator,
          }),
        });
        if (response.ok) {
          await audit(
            "Tự động kết thúc phiên bản cũ",
            previous,
            closedPrevious,
            `Phiên bản ${selected.version} được xác nhận và có hiệu lực từ ${next.effectiveFrom}`,
          );
          setVersions((current) =>
            current.map((item) =>
              item.id === closedPrevious.id ? closedPrevious : item,
            ),
          );
          const previousLinked =
            safetyRuleSets.find((item) => item.id === previous.id) ||
            defaultSafetyRuleSet;
          const closedLinked: SafetyRuleSet = {
            ...previousLinked,
            id: previous.id,
            code: previous.code,
            version: previous.version,
            effectiveFrom: previous.effectiveFrom,
            effectiveTo: next.effectiveFrom,
            status: "Hết hiệu lực",
            leadTimeRules: previous.rows as SafetyRuleRange[],
            updatedBy: operator,
            updatedAt: now,
          };
          await fetch("/api/records", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              entity: "safety_rules",
              key: closedLinked.id,
              payload: closedLinked,
              updatedBy: operator,
            }),
          });
          safetyRuleSets = [
            closedLinked,
            ...safetyRuleSets.filter((item) => item.id !== closedLinked.id),
          ];
        } else {
          setNotice(
            "Phiên bản mới đã được xác nhận nhưng chưa thể cập nhật ngày hết hiệu lực của phiên bản cũ. Vui lòng báo quản trị viên.",
          );
        }
      }
      const linked: SafetyRuleSet = {
        ...defaultSafetyRuleSet,
        id: next.id,
        code: next.code,
        version: next.version,
        effectiveFrom: next.effectiveFrom,
        effectiveTo: next.effectiveTo,
        status: "Đang áp dụng",
        leadTimeRules: next.rows as SafetyRuleRange[],
        createdBy: next.createdBy,
        createdAt: next.createdAt,
        updatedBy: operator,
        updatedAt: now,
        confirmedBy: operator,
        confirmedAt: now,
        changeReason: next.reason,
        usedByPlans: next.usedByPlans,
      };
      await fetch("/api/records", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          entity: "safety_rules",
          key: linked.id,
          payload: linked,
          updatedBy: operator,
        }),
      });
      safetyRuleSets = [
        linked,
        ...safetyRuleSets.filter((x) => x.id !== linked.id),
      ];
    }
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
        <h1>Quy tắc Safety Days</h1>
        <p>
          Mỗi nhóm quy tắc có phiên bản, thời gian hiệu lực và quy trình xác
          nhận riêng.
        </p>
      </header>
      <section className="safety-command-bar">
        <b>CHỨC NĂNG</b>
        <div className="command-groups">
          <fieldset>
            <legend>Thao tác dữ liệu</legend>
            <button disabled={!enabled.add} onClick={() => open("add")}>
              ＋ Thêm mới
            </button>
            <button disabled={!enabled.change} onClick={() => open("change")}>
              Tạo thay đổi
            </button>
            <button disabled={!enabled.edit} onClick={() => open("edit")}>
              Sửa bản Nháp
            </button>
            <button disabled={!enabled.delete} onClick={removeDraft}>
              Xóa bản Nháp
            </button>
          </fieldset>
          <fieldset>
            <legend>Xác nhận và áp dụng</legend>
            <button disabled={!enabled.confirm} onClick={() => open("confirm")}>
              Xác nhận
            </button>
            <button disabled={!enabled.reject} onClick={() => open("reject")}>
              Từ chối
            </button>
            <button
              disabled={!enabled.withdraw}
              onClick={() => open("withdraw")}
            >
              Thu hồi yêu cầu
            </button>
            <button
              disabled={!enabled.cancel}
              onClick={() => open("cancel-confirm")}
            >
              Hủy xác nhận
            </button>
          </fieldset>
          <fieldset>
            <legend>Tra cứu và lịch sử</legend>
            <button onClick={() => open("search")}>Tra cứu</button>
            <button onClick={() => open("history")}>Xem lịch sử</button>
          </fieldset>
        </div>
      </section>
      {notice && (
        <div
          className={`save-notice master-save-notice safety-global-notice ${noticeIsSuccess ? "success" : "error"}`}
          role={noticeIsSuccess ? "status" : "alert"}
        >
          <span>
            <strong>{notice}</strong>
            <small>Hướng dẫn: {noticeGuidance}</small>
          </span>
          <button onClick={() => setNotice("")}>×</button>
        </div>
      )}
      {action && (
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
      {!action && (
        <>
          <nav className="safety-rule-tabs">
            {(["leadtime", "forecast", "situation"] as SafetyRuleGroup[]).map(
              (key) => (
                <button
                  key={key}
                  className={tab === key ? "active" : ""}
                  onClick={() => switchTab(key)}
                >
                  {groupLabels[key]}
                  <small>
                    {key === "leadtime" ? "Đang áp dụng" : "Chưa áp dụng"}
                  </small>
                </button>
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
            <div className="table-wrap">
              <table className="safety-version-table">
                <thead>
                  <tr>
                    <th>MÃ QUY TẮC</th>
                    <th>PHIÊN BẢN</th>
                    <th>NGÀY HIỆU LỰC</th>
                    <th>NGÀY HẾT HIỆU LỰC</th>
                    <th>TRẠNG THÁI</th>
                    <th>LÝ DO</th>
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
                      <td className="master-sku">{item.code}</td>
                      <td>{item.version}</td>
                      <td>{item.effectiveFrom}</td>
                      <td>{item.effectiveTo || "Không giới hạn"}</td>
                      <td>
                        <span
                          className={`rule-status ${item.status === "Đang áp dụng" ? "active" : item.status === "Chờ xác nhận" ? "pending" : item.status === "Nháp" ? "draft" : "expired"}`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td>{item.reason}</td>
                      <td>{item.createdBy}</td>
                      <td>{item.submittedBy || "—"}</td>
                      <td>{item.confirmedBy || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
      <div className="table-wrap">
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
                    <td>{i + 1}</td>
                    <td>{x.from}</td>
                    <td>{x.to ?? "Không giới hạn"}</td>
                    <td>{x.days}</td>
                    <td>{x.note || "—"}</td>
                  </tr>
                ))
              : group === "forecast"
                ? (item.rows as ForecastAccuracyRule[]).map((x, i) => (
                    <tr key={i}>
                      <td>{x.from ?? 0}%</td>
                      <td>{x.to ?? "Không giới hạn"}</td>
                      <td>{x.days}</td>
                      <td>{x.note}</td>
                    </tr>
                  ))
                : (item.rows as DemandSituationRule[]).map((x) => (
                    <tr key={x.code}>
                      <td>{x.code}</td>
                      <td>{x.name}</td>
                      <td>{x.days}</td>
                      <td>{x.note || "—"}</td>
                    </tr>
                  ))}
          </tbody>
        </table>
      </div>
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
  const base =
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
              ? [{ from: Number.NaN, to: null, days: Number.NaN, note: "" }]
              : [],
        }
      : selected || defaultGroup;
  const [draft, setDraft] = useState(() => structuredClone(base));
  const [reason, setReason] = useState(
    action === "change" || action === "add" ? "" : base.reason || "",
  );
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
          rows: [{ from: 1, to: null, days: 0, note: "" }],
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
          <button onClick={onClose}>×</button>
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
          <button
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
          </button>
          <button
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
          </button>
          <button className="outline-button" onClick={onClose}>
            Đóng tra cứu
          </button>
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
          <button onClick={onClose}>×</button>
        </header>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>MÃ</th>
                <th>PHIÊN BẢN</th>
                <th>LOẠI YÊU CẦU</th>
                <th>TRẠNG THÁI</th>
                <th>LÝ DO</th>
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
                  <td>{x.code}</td>
                  <td>{x.version}</td>
                  <td>{x.requestType || "Khởi tạo"}</td>
                  <td>{x.status}</td>
                  <td>{x.reason}</td>
                  <td>{x.createdBy}</td>
                  <td>{x.confirmedBy || "—"}</td>
                  <td>{formatDateTimeDisplay(x.updatedAt)}</td>
                  <td>{x.usedByPlans?.join(", ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
          <button onClick={onClose}>×</button>
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
        <div className="table-wrap">
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
                  <td>
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
                  </td>
                  <td>
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
                  </td>
                  <td>
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
                  </td>
                  <td>
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
                  </td>
                  <td className="safety-row-action">
                    <button
                      type="button"
                      className="danger-link-button"
                      onClick={() => removeLeadTimeRow(i)}
                    >
                      Xóa dòng
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="function-actions">
          <button className="ghost-button" onClick={onClose}>
            Hủy thao tác
          </button>
          <button
            className="outline-button"
            disabled={saving || (action !== "add" && !reason.trim())}
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
          </button>
          <button
            className="primary-button"
            disabled={saving || (action !== "add" && !reason.trim())}
            onClick={() => {
              if (action === "edit")
                onSaveDraft({
                  ...draft,
                  reason,
                  status: "Chờ xác nhận",
                  submittedBy: "vthduyen",
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
          </button>
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
        <button onClick={onClose}>×</button>
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
        <button className="ghost-button" onClick={onClose}>
          Hủy thao tác
        </button>
        <button
          className="primary-button"
          disabled={saving || !reason.trim() || (action === "stop" && !date)}
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
        </button>
      </div>
    </section>
  );
}

function LeadtimeMasterViewLegacy({ mode }: { mode: "leadtime" | "safety" }) {
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
      fetch("/api/records?entity=leadtime"),
      fetch("/api/records?entity=safety_days"),
    ])
      .then(async ([leadResponse, safetyResponse]) => {
        const leadSaved = leadResponse.ok
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
  }, []);
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
              safetyDays: safetyDaysFromLeadTime(row.leadTime),
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
        updatedBy: "vthduyen",
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
    const response = await fetch("/api/records", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entity,
        key: sku,
        payload: row,
        updatedBy: "vthduyen",
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
      deletedBy: "vthduyen",
    };
    const response = await fetch("/api/records", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entity,
        key: deleting.sku,
        payload,
        updatedBy: "vthduyen",
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
      <div className="sku-master-toolbar master-crud-toolbar">
        <span>
          <b>{mode === "leadtime" ? "Lead Time theo SKU" : "Safety Days"}</b>
          <small>
            {displayRows.length} SKU · {unset} SKU chưa thiết lập · Safety Days
            chỉ đọc, tự tính theo bộ quy tắc
          </small>
        </span>
        <button className="primary-button" onClick={openCreate}>
          ＋ Thêm mới
        </button>
      </div>
      {notice && (
        <div className="save-notice master-save-notice">
          {notice}
          <button onClick={() => setNotice("")}>×</button>
        </div>
      )}
      <section className="data-card master-data-card">
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
        <div className="table-wrap">
          <table className="leadtime-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>TÊN SẢN PHẨM</th>
                <th>QUY CÁCH</th>
                <th>NHÓM SP</th>
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
                  new Date().toISOString().slice(0, 10),
                );
                const safety = safetyBreakdown(lead.leadTime, rule);
                return (
                  <tr key={row.sku}>
                    <td className="master-sku">{row.sku}</td>
                    <td>{row.name}</td>
                    <td>{row.spec || "—"}</td>
                    <td>
                      <span className="tag">{row.group}</span>
                    </td>
                    <td>{row.line || "—"}</td>
                    <td className="number">
                      {lead.leadTime > 0 ? (
                        lead.leadTime
                      ) : (
                        <span className="data-error">
                          Chưa thiết lập Lead Time
                        </span>
                      )}
                    </td>
                    <td className="number">
                      {lead.leadTime > 0 ? safety.leadTimeDays : "—"}
                    </td>
                    <td className="number">{safety.forecastDays}</td>
                    <td className="number">{safety.situationDays}</td>
                    <td className="number master-total">
                      {lead.leadTime > 0 ? safety.total : "—"}
                    </td>
                    <td>{rule?.code || "Chưa có"}</td>
                    <td>{rule?.version || "—"}</td>
                    <td>{lead.leadTime > 0 ? "Hợp lệ" : "Lỗi dữ liệu"}</td>
                    <td>{lead.updatedBy || "Dữ liệu gốc"}</td>
                    <td>
                      {lead.updatedAt
                        ? formatDateTimeDisplay(lead.updatedAt)
                        : "—"}
                    </td>
                    <td>
                      <div className="master-row-actions">
                        <button onClick={() => openEdit(row)}>Sửa</button>
                        <button
                          className="delete"
                          onClick={() => setDeleting(row)}
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="source-note">
          <b>Quy tắc:</b> Người dùng chỉ nhập Lead Time theo SKU. Safety Days và
          các thành phần được tự động tính, không cho nhập hoặc sửa trực tiếp.
        </div>
      </section>
      {creating && (
        <>
          <button className="overlay" aria-label="Đóng" onClick={closeForm} />
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
              <button onClick={closeForm}>×</button>
            </div>
            <form
              className="edit-user-form master-edit-form"
              onSubmit={saveRow}
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
                <button
                  type="button"
                  className="ghost-button"
                  onClick={closeForm}
                >
                  Hủy
                </button>
                <button className="primary-button" disabled={saving}>
                  {saving ? "Đang lưu..." : "Lưu dữ liệu"}
                </button>
              </div>
            </form>
          </aside>
        </>
      )}
      {deleting && (
        <>
          <button
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
              <button
                className="ghost-button"
                onClick={() => setDeleting(null)}
              >
                Hủy
              </button>
              <button
                className="danger-button"
                disabled={saving}
                onClick={confirmDelete}
              >
                {saving ? "Đang xóa..." : "Xác nhận xóa"}
              </button>
            </div>
          </aside>
        </>
      )}
    </main>
  );
}

type LeadTimeStatus = "Nháp" | "Chờ xác nhận" | "Đang áp dụng" | "Hết hiệu lực" | "Đã hủy xác nhận" | "Không hợp lệ";
type LeadTimeVersion = {
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
type LeadTimePanel = "create" | "edit" | "search" | "confirm" | "cancel" | "detail" | null;

const normalizeSkuCode = (value: string) => value.trim().toUpperCase();
const skuStableId = (sku: Sku) => `sku:${normalizeSkuCode(sku.code)}`;
const leadTimeVersionNumber = (versions: LeadTimeVersion[], sku: string) =>
  `V${versions.filter((item) => item.sku === sku).length + 1}`;
const activeLeadTimeAt = (versions: LeadTimeVersion[], sku: string, at: string) =>
  versions
    .filter((item) => item.sku === sku && item.status === "Đang áp dụng" && !!item.validFrom && item.validFrom <= at && (!item.validTo || at < item.validTo))
    .sort((a, b) => (b.validFrom || "").localeCompare(a.validFrom || ""))[0];

function LeadtimeMasterView({
  masterSkus,
  operator,
  onOpenSkuMaster,
}: {
  masterSkus: Sku[];
  operator: string;
  onOpenSkuMaster: () => void;
}) {
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
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const now = new Date().toISOString();

  useEffect(() => {
    fetch("/api/records?entity=leadtime_versions")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => setVersions(data.records.map((record: { payload: LeadTimeVersion }) => record.payload)))
      .catch(() => setError("Không thể tải lịch sử Lead Time. Vui lòng thử lại."));
  }, []);

  const masterMap = useMemo(() => new Map(masterSkus.map((sku) => [normalizeSkuCode(sku.code), sku])), [masterSkus]);
  const activeRows = useMemo(() => masterSkus.map((master) => {
    const sku = normalizeSkuCode(master.code);
    const saved = activeLeadTimeAt(versions, sku, now);
    const pending = versions
      .filter((item) => item.sku === sku && item.status === "Chờ xác nhận")
      .sort((a, b) => b.setupAt.localeCompare(a.setupAt))[0];
    const legacy = leadtimeBySku.get(sku);
    const version = pending ?? saved;
    const leadTime = version?.leadTime ?? legacy?.leadTime ?? 0;
    return { master, version, leadTime, safety: safetyBreakdown(leadTime, activeSafetyRuleFor(now.slice(0, 10))) };
  }).filter((item) => item.leadTime > 0 || item.version?.status === "Chờ xác nhận"), [masterSkus, versions, now]);
  const leadTimeGroups = useMemo(
    () => Array.from(new Set(activeRows.map(({ master }) => master.group))).sort((a, b) => a.localeCompare(b, "vi", { numeric: true, sensitivity: "base" })),
    [activeRows],
  );
  const leadTimeLines = useMemo(
    () => Array.from(new Set(activeRows.map(({ master }) => master.line))).sort((a, b) => a.localeCompare(b, "vi", { numeric: true, sensitivity: "base" })),
    [activeRows],
  );
  const filteredRows = useMemo(
    () =>
      activeRows
        .filter(({ master, version }) => {
          const key = normalizeSearchText(query);
          const safety = safetyBreakdown(
            version?.leadTime ?? leadtimeBySku.get(normalizeSkuCode(master.code))?.leadTime ?? 0,
            activeSafetyRuleFor(now.slice(0, 10)),
          );
          const values: Record<LeadTimeSearchField, string | number> = {
            sku: master.code,
            name: master.name,
            specification: master.specification,
            group: master.group,
            line: master.line,
            leadTime: version?.leadTime ?? leadtimeBySku.get(normalizeSkuCode(master.code))?.leadTime ?? 0,
            leadTimeSafety: safety.leadTimeDays,
            forecastDays: safety.forecastDays,
            situationDays: safety.situationDays,
            totalSafetyDays: safety.total,
          };
          const value = normalizeSearchText(String(values[searchField]));
          const matched = searchField === "sku" ? value.startsWith(key) : value.includes(key);
          return (
            (!key || matched) &&
            (!statusFilter || (version?.status || "Đang áp dụng") === statusFilter)
          );
        })
        .sort((a, b) => compareGroupThenSku(a.master, b.master)),
    [activeRows, query, searchField, statusFilter, now],
  );
  const selectedMaster = masterMap.get(normalizeSkuCode(formSku));
  const skuSuggestions = useMemo(() => {
    const key = normalizeSearchText(formSku);
    if (!key) return [];
    return masterSkus
      .filter((sku) => normalizeSearchText(sku.code).startsWith(key) || normalizeSearchText(sku.name).includes(key))
      .sort(compareGroupThenSku)
      .slice(0, 8);
  }, [formSku, masterSkus]);
  const selectedVersions = versions.filter((item) => item.sku === normalizeSkuCode(selectedSku)).sort((a, b) => b.setupAt.localeCompare(a.setupAt));
  const selectedActive = activeLeadTimeAt(versions, normalizeSkuCode(selectedSku), now);
  const selectedPending = selectedVersions.find((item) => item.status === "Chờ xác nhận" || item.status === "Nháp");
  const selectedLegacy = leadtimeBySku.get(normalizeSkuCode(selectedSku));
  const currentLead = selectedActive?.leadTime ?? selectedLegacy?.leadTime ?? 0;
  const selectedSafetyRule = activeSafetyRuleFor(now.slice(0, 10));
  const selectedSafety = safetyBreakdown(currentLead, selectedSafetyRule);

  const openPanel = (next: LeadTimePanel) => {
    if (dirty && !window.confirm("Dữ liệu chưa lưu sẽ bị mất. Bạn có muốn tiếp tục?")) return;
    setPanel(next); setDirty(false); setError(""); setNotice("");
    if (next === "create") { setFormSku(""); setLeadValue(""); setNote(""); setReason(""); setSkuLookupOpen(false); setSkuValidated(false); }
    if (next === "edit" && selectedSku) { setFormSku(selectedSku); setLeadValue(""); setNote(""); setReason(""); }
  };
  const validateMaster = (master?: Sku) => {
    if (!master) return "Không thể thêm mới Lead Time vì SKU chưa tồn tại trong SKU Master.";
    if (master.status !== "Đang sử dụng") return `SKU ${master.code} không ở trạng thái được phép sử dụng.`;
    const missing = [!master.code && "Mã SKU", !master.name && "Tên sản phẩm", !master.group && "Nhóm sản phẩm", (!master.line || master.line === "—") && "Line"].filter(Boolean);
    return missing.length ? `Không thể thêm mới Lead Time vì thông tin SKU Master chưa đầy đủ. SKU ${master.code} chưa có thông tin ${missing.join(", ")}.` : "";
  };
  const persist = async (record: LeadTimeVersion, action: string) => {
    setSaving(true);
    const response = await fetch("/api/records", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ entity: "leadtime_versions", key: record.id, payload: record, updatedBy: operator }) });
    if (response.ok) await fetch("/api/records", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ entity: "leadtime_audit", key: `${record.id}:${Date.now()}`, payload: { sku: record.sku, skuId: record.skuId, version: record.version, action, oldLeadTime: currentLead, newLeadTime: record.leadTime, reason: record.reason || cancelReason, operator, operatedAt: new Date().toISOString(), confirmedBy: record.confirmedBy, confirmedAt: record.confirmedAt, validFrom: record.validFrom, validTo: record.validTo, usedByProductionEngine: !!record.usedByPlans?.length }, updatedBy: operator }) });
    setSaving(false);
    if (!response.ok) throw new Error();
  };
  const saveDraft = async (status: "Nháp" | "Chờ xác nhận") => {
    const sku = normalizeSkuCode(formSku);
    const master = masterMap.get(sku);
    const masterError = validateMaster(master);
    const value = Number(leadValue);
    if (masterError) { setError(masterError); return; }
    if (!Number.isInteger(value) || value < 0) { setError("Lead Time phải là số nguyên lớn hơn hoặc bằng 0."); return; }
    if (versions.some((item) => item.sku === sku && ["Nháp", "Chờ xác nhận"].includes(item.status))) { setError(`SKU ${sku} đã có hồ sơ Lead Time đang chờ xử lý.`); return; }
    if (panel === "create" && (selectedActive || selectedLegacy)) { setError(`SKU ${sku} đã có Lead Time. Vui lòng chọn dòng và dùng chức năng Sửa.`); return; }
    if (panel === "edit" && !reason.trim()) { setError("Vui lòng nhập Lý do thay đổi."); return; }
    const record: LeadTimeVersion = { id: `LT-${sku}-${Date.now()}`, skuId: skuStableId(master!), sku, version: leadTimeVersionNumber(versions, sku), leadTime: value, status, setupAt: new Date().toISOString(), note: note.trim(), reason: reason.trim(), createdBy: operator, updatedBy: operator };
    try { await persist(record, panel === "edit" ? "Tạo thay đổi" : "Thêm mới"); setVersions((items) => [record, ...items]); setSelectedSku(sku); setPanel(null); setDirty(false); setNotice(status === "Nháp" ? "Đã lưu bản Nháp." : "Đã lưu và chuyển sang Chờ xác nhận."); } catch { setError("Không thể lưu dữ liệu. Vui lòng thử lại."); }
  };
  const confirmPending = async () => {
    if (!selectedPending || selectedPending.status !== "Chờ xác nhận") return;
    const master = masterMap.get(selectedPending.sku);
    const masterError = validateMaster(master);
    if (masterError) { setError(masterError); return; }
    const confirmedAt = new Date().toISOString();
    const old = activeLeadTimeAt(versions, selectedPending.sku, confirmedAt);
    const next = { ...selectedPending, status: "Đang áp dụng" as const, validFrom: confirmedAt, confirmedBy: operator, confirmedAt, updatedBy: operator };
    const ended = old ? { ...old, status: "Hết hiệu lực" as const, validTo: confirmedAt, updatedBy: operator } : null;
    try { if (ended) await persist(ended, "Hết hiệu lực tự động"); await persist(next, "Xác nhận áp dụng"); setVersions((items) => items.map((item) => item.id === next.id ? next : ended && item.id === ended.id ? ended : item)); leadtimeBySku.set(next.sku, { sku: next.sku, name: master!.name, spec: master!.specification, group: master!.group, line: master!.line, ltProduction: next.leadTime, ltQc: 0, ltWarehouse: 0, note: next.note, leadTime: next.leadTime, moq: master!.moq }); setPanel(null); setNotice("Lead Time mới đã được xác nhận và bắt đầu có hiệu lực."); } catch { setError("Không thể xác nhận dữ liệu. Vui lòng thử lại."); }
  };
  const cancelConfirmation = async () => {
    if (!selectedActive || !cancelReason.trim()) { setError("Vui lòng nhập lý do hủy xác nhận."); return; }
    if (selectedActive.usedByPlans?.length) { setError("Lead Time này đã được Production Engine sử dụng. Vui lòng tạo một thay đổi mới thay thế."); return; }
    const previous = selectedVersions.find((item) => item.status === "Hết hiệu lực" && item.validTo === selectedActive.validFrom);
    const cancelled = { ...selectedActive, status: "Đã hủy xác nhận" as const, updatedBy: operator };
    const restored = previous ? { ...previous, status: "Đang áp dụng" as const, validTo: undefined, updatedBy: operator } : null;
    try { await persist(cancelled, "Hủy xác nhận"); if (restored) await persist(restored, "Khôi phục phiên bản cũ"); setVersions((items) => items.map((item) => item.id === cancelled.id ? cancelled : restored && item.id === restored.id ? restored : item)); setPanel(null); setCancelReason(""); setNotice("Đã hủy xác nhận và giữ bản ghi trong lịch sử."); } catch { setError("Không thể hủy xác nhận. Vui lòng thử lại."); }
  };

  return <main className={`workspace leadtime-v2 ${panel === "create" || panel === "edit" ? "leadtime-form-only" : ""}`}>
    <div className="safety-rules-title"><h1>Lead Time theo SKU</h1></div>
    <section className={`leadtime-command-bar ${panel === "search" ? "search-open" : ""}`}><b>CHỨC NĂNG</b><div className="leadtime-command-row"><div className="leadtime-command-actions">
      <button onClick={() => openPanel("create")}>＋ Thêm mới</button>
      <button disabled={!selectedSku} onClick={() => openPanel("edit")}>✎ Sửa</button>
      <button onClick={() => openPanel("search")}>⌕ Tra cứu</button>
      <button disabled={!selectedPending || selectedPending.status !== "Chờ xác nhận"} onClick={() => openPanel("confirm")}>✓ Xác nhận</button>
      <button className="warning" disabled={!selectedActive} onClick={() => openPanel("cancel")}>↶ Hủy xác nhận</button>
    </div>{panel === "search" && <div className="leadtime-compact-search"><label><span>TRA THEO</span><select value={searchField} onChange={(e) => { setSearchField(e.target.value as LeadTimeSearchField); setQuery(""); }}><option value="sku">Mã SKU</option><option value="name">Tên sản phẩm</option><option value="specification">Quy cách</option><option value="group">Nhóm sản phẩm</option><option value="line">Line</option><option value="leadTime">Lead Time</option><option value="leadTimeSafety">Safety theo Lead Time</option><option value="forecastDays">Ngày cộng dự báo</option><option value="situationDays">Ngày cộng tình huống</option><option value="totalSafetyDays">Tổng Safety Days</option></select></label><label className="leadtime-compact-query"><span>NỘI DUNG TRA</span>{searchField === "group" ? <select value={query} onChange={(e) => setQuery(e.target.value)}><option value="">Tất cả nhóm</option>{leadTimeGroups.map((item) => <option key={item} value={item}>{item}</option>)}</select> : searchField === "line" ? <select value={query} onChange={(e) => setQuery(e.target.value)}><option value="">Tất cả Line</option>{leadTimeLines.map((item) => <option key={item} value={item}>{item}</option>)}</select> : <input value={query} onChange={(e) => setQuery(e.target.value)} inputMode={["leadTime", "leadTimeSafety", "forecastDays", "situationDays", "totalSafetyDays"].includes(searchField) ? "numeric" : "search"} placeholder={`Nhập ${searchField === "sku" ? "mã SKU" : "nội dung cần tra"}...`} />}</label><label><span>TRẠNG THÁI</span><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="">Tất cả</option><option>Chờ xác nhận</option><option>Đang áp dụng</option></select></label><div className="leadtime-compact-actions"><button className="ghost-button" title="Xóa điều kiện" onClick={() => { setQuery(""); setStatusFilter(""); }}>Xóa lọc</button><button className="primary-button" onClick={() => setPanel(null)}>Tìm kiếm</button><button className="outline-button" onClick={() => { setSearchField("sku"); setQuery(""); setStatusFilter(""); setPanel(null); }}>Quay lại</button></div></div>}</div></section>
    {(notice || error) && <div className={`save-notice master-save-notice ${error ? "leadtime-error" : ""}`}><span>{error || notice}</span><span>{error && <><button className="inline-link" onClick={onOpenSkuMaster}>Đi đến SKU Master</button><button onClick={() => setError("")}>Đóng</button></>}</span></div>}
    {(panel === "create" || panel === "edit") && <section className="data-card leadtime-inline-panel"><header><div><h2>{panel === "create" ? "Thêm mới" : "Sửa"} Lead Time</h2></div><button onClick={() => openPanel(null)}>×</button></header><div className="leadtime-form-grid"><fieldset><legend>Thông tin SKU</legend><div className="leadtime-sku-lookup"><label><span>Mã SKU *</span><input value={formSku} readOnly={panel === "edit"} autoComplete="off" onFocus={() => { if (panel === "create") setSkuLookupOpen(true); }} onChange={(e) => { setFormSku(e.target.value); setDirty(true); setError(""); setSkuValidated(false); setSkuLookupOpen(true); }} onBlur={() => { const normalized = normalizeSkuCode(formSku); setFormSku(normalized); setSkuLookupOpen(false); setSkuValidated(!!normalized); if (normalized && !masterMap.has(normalized)) setError("Không thể thêm mới Lead Time vì SKU chưa tồn tại trong SKU Master."); else if (normalized) setError(validateMaster(masterMap.get(normalized))); }} placeholder="Nhập mã hoặc chọn từ SKU Master" /></label>{panel === "create" && skuLookupOpen && formSku.trim() && skuSuggestions.length > 0 && <div className="leadtime-sku-suggestions">{skuSuggestions.map((sku) => <button type="button" key={sku.code} onMouseDown={(event) => { event.preventDefault(); setFormSku(normalizeSkuCode(sku.code)); setSkuLookupOpen(false); setSkuValidated(true); setError(validateMaster(sku)); }}><b>{sku.code}</b><span>{sku.name}</span><small>{sku.specification} · {sku.line}</small></button>)}</div>}</div>{skuValidated && formSku && !selectedMaster && <div className="leadtime-inline-error">Không thể thêm mới Lead Time vì SKU chưa tồn tại trong SKU Master.</div>}<div className="leadtime-readonly-grid"><label><span>Tên sản phẩm</span><input readOnly value={selectedMaster?.name || ""} /></label><label><span>Quy cách</span><input readOnly value={selectedMaster?.specification || ""} /></label><label><span>Nhóm sản phẩm</span><input readOnly value={selectedMaster?.group || ""} /></label><label><span>Line</span><input readOnly value={selectedMaster?.line || ""} /></label><label><span>Trạng thái SKU</span><input readOnly value={selectedMaster?.status || ""} /></label></div></fieldset><fieldset><legend>Dữ liệu Lead Time</legend>{panel === "edit" && <label><span>Lead Time hiện tại</span><input readOnly value={currentLead} /></label>}<label><span>{panel === "edit" ? "Lead Time mới" : "Lead Time"} *</span><input type="number" min="0" step="1" value={leadValue} onChange={(e) => { setLeadValue(e.target.value); setDirty(true); }} /></label><label><span>Ngày thiết lập</span><input readOnly value={formatDateTimeDisplay(new Date())} /></label>{panel === "edit" && <label><span>Lý do thay đổi *</span><textarea value={reason} onChange={(e) => { setReason(e.target.value); setDirty(true); }} /></label>}<label><span>Ghi chú</span><textarea value={note} onChange={(e) => { setNote(e.target.value); setDirty(true); }} /></label></fieldset></div><div className="function-actions"><button className="ghost-button" onClick={() => openPanel(null)}>Hủy</button><button className="primary-button" disabled={saving || !!validateMaster(selectedMaster) || leadValue === "" || (panel === "edit" && !reason.trim())} onClick={() => saveDraft("Chờ xác nhận")}>Lưu</button></div></section>}
    {panel === "confirm" && selectedPending && <section className="data-card leadtime-inline-panel"><header><h2>Xác nhận áp dụng</h2><button onClick={() => setPanel(null)}>×</button></header><div className="approval-summary"><span><small>SKU</small><b>{selectedPending.sku}</b></span><span><small>Lead Time hiện tại</small><b>{currentLead}</b></span><span><small>Lead Time mới</small><b>{selectedPending.leadTime}</b></span><span><small>Safety Days mới dự kiến</small><b>{safetyBreakdown(selectedPending.leadTime, activeSafetyRuleFor(now.slice(0,10))).total}</b></span></div><p className="leadtime-impact"><b>Ảnh hưởng dữ liệu:</b> Production Engine chưa chốt sẽ có cảnh báo và chỉ đổi khi người dùng bấm Tính lại.</p><div className="function-actions"><button className="ghost-button" onClick={() => setPanel(null)}>Không xác nhận</button><button className="primary-button" disabled={saving} onClick={confirmPending}>Xác nhận áp dụng</button></div></section>}
    {panel === "cancel" && selectedActive && <section className="data-card leadtime-inline-panel"><header><h2>Hủy xác nhận</h2><button onClick={() => setPanel(null)}>×</button></header><label className="leadtime-cancel-reason"><span>Lý do hủy xác nhận *</span><textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} /></label><div className="function-actions"><button className="ghost-button" onClick={() => setPanel(null)}>Đóng</button><button className="danger-button" disabled={saving || !cancelReason.trim()} onClick={cancelConfirmation}>Hủy xác nhận</button></div></section>}
    <section className="data-card master-data-card"><div className="result-bar"><strong>{filteredRows.length}</strong> SKU có dữ liệu Lead Time <span>· Bấm một lần để chọn, bấm hai lần để xem chi tiết</span></div><div className="table-wrap"><table className="leadtime-table leadtime-main-table"><thead><tr><th>SKU</th><th>TÊN SẢN PHẨM</th><th>QUY CÁCH</th><th>NHÓM SP</th><th>LINE</th><th>LEAD TIME</th><th>SAFETY THEO LEAD TIME</th><th>NGÀY CỘNG DỰ BÁO</th><th>NGÀY CỘNG TÌNH HUỐNG</th><th>TỔNG SAFETY DAYS</th><th>TRẠNG THÁI</th></tr></thead><tbody>{filteredRows.map(({ master, version, leadTime, safety }) => <tr key={master.code} className={selectedSku === normalizeSkuCode(master.code) ? "selected" : ""} role="button" tabIndex={0} onClick={() => { setSelectedSku(normalizeSkuCode(master.code)); if (panel === "detail") setPanel(null); }} onDoubleClick={() => { setSelectedSku(normalizeSkuCode(master.code)); setPanel("detail"); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); setSelectedSku(normalizeSkuCode(master.code)); setPanel("detail"); } }}><td><button className="sku-link" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => { e.stopPropagation(); setSelectedSku(normalizeSkuCode(master.code)); setPanel("detail"); }}>{master.code}</button></td><td>{master.name}</td><td>{master.specification}</td><td><span className="tag">{master.group}</span></td><td>{master.line}</td><td className="number">{leadTime}</td><td className="number">{safety.leadTimeDays}</td><td className="number">{safety.forecastDays}</td><td className="number">{safety.situationDays}</td><td className="number master-total">{safety.total}</td><td><span className={version?.status === "Chờ xác nhận" ? "status-warning" : "status-good"}>{version?.status || "Đang áp dụng"}</span></td></tr>)}</tbody></table></div></section>
    {panel === "detail" && selectedSku && <section className="data-card leadtime-detail"><header><div><h2>Thông tin đang áp dụng · {selectedSku}</h2><p>{masterMap.get(selectedSku)?.name} · {masterMap.get(selectedSku)?.specification}</p></div><button aria-label="Đóng" onClick={() => setPanel(null)}>×</button></header><h3>Thông tin đang áp dụng</h3><div className="leadtime-detail-grid"><span><small>SKU</small><b>{selectedSku}</b></span><span><small>Tên sản phẩm</small><b>{masterMap.get(selectedSku)?.name}</b></span><span><small>Quy cách</small><b>{masterMap.get(selectedSku)?.specification}</b></span><span><small>Nhóm sản phẩm</small><b>{masterMap.get(selectedSku)?.group}</b></span><span><small>Line</small><b>{masterMap.get(selectedSku)?.line}</b></span><span><small>Lead Time hiện tại</small><b>{currentLead}</b></span><span><small>Safety theo Lead Time</small><b>{selectedSafety.leadTimeDays}</b></span><span><small>Ngày cộng dự báo</small><b>{selectedSafety.forecastDays}</b></span><span><small>Ngày cộng tình huống</small><b>{selectedSafety.situationDays}</b></span><span className="leadtime-detail-total"><small>Tổng Safety Days</small><b>{selectedSafety.total}</b></span><span><small>Mã bộ quy tắc Safety Days</small><b>{selectedSafetyRule?.code || "—"}</b></span><span><small>Phiên bản quy tắc Safety Days</small><b>{selectedSafetyRule?.version || "—"}</b></span><span><small>Trạng thái Lead Time</small><b>{selectedActive?.status || "Đang áp dụng"}</b></span><span><small>Ngày thiết lập</small><b>{selectedActive ? formatDateTimeDisplay(selectedActive.setupAt) : "—"}</b></span><span><small>Ngày hiệu lực</small><b>{selectedActive?.validFrom ? formatDateTimeDisplay(selectedActive.validFrom) : "—"}</b></span><span><small>Ngày hết hiệu lực</small><b>{selectedActive?.validTo ? formatDateTimeDisplay(selectedActive.validTo) : "—"}</b></span><span><small>Người tạo</small><b>{selectedActive?.createdBy || "Dữ liệu gốc"}</b></span><span><small>Người cập nhật</small><b>{selectedActive?.updatedBy || "Dữ liệu gốc"}</b></span><span><small>Người xác nhận</small><b>{selectedActive?.confirmedBy || "—"}</b></span><span><small>Thời gian xác nhận</small><b>{selectedActive?.confirmedAt ? formatDateTimeDisplay(selectedActive.confirmedAt) : "—"}</b></span></div><h3>Lịch sử thay đổi Lead Time</h3><div className="table-wrap"><table><thead><tr><th>PHIÊN BẢN</th><th>LEAD TIME</th><th>NGÀY THIẾT LẬP</th><th>NGÀY HIỆU LỰC</th><th>NGÀY HẾT HIỆU LỰC</th><th>TRẠNG THÁI</th><th>NGƯỜI TẠO</th><th>NGƯỜI CẬP NHẬT</th><th>NGƯỜI XÁC NHẬN</th><th>LÝ DO THAY ĐỔI</th></tr></thead><tbody>{selectedVersions.length ? selectedVersions.map((item) => <tr key={item.id}><td>{item.version}</td><td>{item.leadTime}</td><td>{formatDateTimeDisplay(item.setupAt)}</td><td>{item.validFrom ? formatDateTimeDisplay(item.validFrom) : "—"}</td><td>{item.validTo ? formatDateTimeDisplay(item.validTo) : "—"}</td><td>{item.status}</td><td>{item.createdBy}</td><td>{item.updatedBy}</td><td>{item.confirmedBy || "—"}</td><td>{item.reason || "—"}</td></tr>) : <tr><td>Dữ liệu gốc</td><td>{currentLead}</td><td>—</td><td>—</td><td>—</td><td>Đang áp dụng</td><td>Dữ liệu gốc</td><td>Dữ liệu gốc</td><td>—</td><td>Khởi tạo từ dữ liệu Lead Time hiện có</td></tr>}</tbody></table></div></section>}
    {panel === "detail" && <button className="leadtime-detail-overlay" aria-label="Đóng bảng chi tiết" onClick={() => setPanel(null)} />}
    {panel === "detail" && selectedSku && <div className="leadtime-detail-heading"><b>SKU : {selectedSku}</b><span>Tên sản phẩm: {masterMap.get(selectedSku)?.name}</span></div>}
  </main>;
}

export default function Home() {
  const [language, setLanguage] = useState<Language>("vi");
  const [authenticated, setAuthenticated] = useState(true);
  const [session, setSession] = useState<LoginSession | null>({
    kind: "account",
    name: "Người dùng web",
    detail: "Truy cập bằng liên kết",
  });
  const [view, setView] = useState<MainView>("sku");
  const [activeChild, setActiveChild] = useState<string | null>(null);
  const [planTab, setPlanTab] = useState<PlanningTab>("base");
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [skuSearchMode, setSkuSearchMode] = useState<SkuSearchMode>("sku");
  const [group, setGroup] = useState("Tất cả nhóm");
  const [line, setLine] = useState("Tất cả Line");
  const [selected, setSelected] = useState<Sku | null>(null);
  const [skuDetailOpen, setSkuDetailOpen] = useState(false);
  const [skuSearchOpen, setSkuSearchOpen] = useState(false);
  const [customSkus, setCustomSkus] = useState<Sku[]>([]);
  const [addingSku, setAddingSku] = useState(false);
  const [editingSku, setEditingSku] = useState<Sku | null>(null);
  const [skuHistory, setSkuHistory] = useState<SkuHistoryVersion[]>([]);
  const [skuHistoryOpen, setSkuHistoryOpen] = useState(false);
  const [skuReturnAvailable, setSkuReturnAvailable] = useState(false);
  const [skuCreateError, setSkuCreateError] = useState("");
  const [skuCreateGroup, setSkuCreateGroup] = useState("");
  const [skuCreateLine, setSkuCreateLine] = useState("");
  const [skuCreateProcesses, setSkuCreateProcesses] = useState<string[]>([]);
  const [stockExpanded, setStockExpanded] = useState(false);
  const [processExpanded, setProcessExpanded] = useState(false);
  const [warehouseSku, setWarehouseSku] = useState("");
  useEffect(() => {
    if (view !== "sku" || activeChild !== "sku-master") {
      setSelected(null);
      setSkuDetailOpen(false);
      setSkuHistoryOpen(false);
      setSkuSearchOpen(false);
      setStockExpanded(false);
      setProcessExpanded(false);
    }
  }, [view, activeChild]);
  useEffect(() => {
    void loadSystemUsers();
    void loadPermissionRecords();
  }, []);
  const skuRecords = useMemo(() => Array.from(new Map([...skus, ...customSkus].map((sku) => [normalizeSkuCode(sku.code), sku])).values()), [customSkus]);
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
                  : sku.line;
          const keyword = normalizeSearchText(query);
          const normalizedTarget = normalizeSearchText(target);
          const matched =
            skuSearchMode === "sku"
              ? normalizedTarget.startsWith(keyword)
              : normalizedTarget.includes(keyword);
          const matchedGroup = group === "Tất cả nhóm" || sku.group === group;
          const matchedLine = line === "Tất cả Line" || sku.line === line;
          return matched && matchedGroup && matchedLine;
        })
        .sort(compareGroupThenSku),
    [skuRecords, query, skuSearchMode, group, line],
  );
  const selectedProcesses = selected?.processes?.length
    ? selected.processes
    : ["A-CUT", "A-ASSY", "A-CRIMP", "A-PACKING", "A-FINAL"];
  const selectedSkuHistory = selected
    ? skuHistory.filter((item) => item.sku === normalizeSkuCode(selected.code)).sort((a, b) => b.version - a.version)
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
        "B-FINAL": "Hoàn thiện",
      }) as Record<string, string>
    )[code] || code;
  const skuCreateGroupKey = normalizeSearchText(skuCreateGroup);
  const skuCreateExternal = skuCreateGroupKey.includes("mua hang") || skuCreateGroupKey.includes("gia cong ngoai");
  const skuCreateSource = !skuCreateGroup.trim() ? "" : skuCreateGroupKey.includes("mua hang") ? "Mua ngoài" : skuCreateGroupKey.includes("gia cong ngoai") ? "Gia công" : "Tự chế";
  const skuCreateProcessOptions: Record<string, string[]> = {
    A: ["A-CUT", "A-ASSY", "A-CRIMP", "A-PACKING", "A-FINAL"],
    B: ["B-ASSY", "B-FINAL"],
    C: ["C-MAI", "C-PREP", "C-TIEN", "C-RUA", "C-GIACONG", "C-KHOAN", "C-PVC", "C-CHI", "C-INOX", "C-DANHBONG", "C-FINAL"],
  };

  useEffect(() => {
    let queued = false;
    const translate = () => {
      queued = false;
      applyLanguage(language);
    };
    translate();
    const observer = new MutationObserver(() => {
      if (!queued) {
        queued = true;
        requestAnimationFrame(translate);
      }
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["placeholder"],
    });
    return () => observer.disconnect();
  }, [language, authenticated]);

  useEffect(() => {
    fetch("/api/records?entity=sku")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) =>
        setCustomSkus(
          data.records.map((record: { payload: Sku }) => record.payload),
        ),
      )
      .catch(() =>
        setSkuCreateError("Dữ liệu dùng chung tạm thời chưa tải được."),
      );
    fetch("/api/records?entity=sku_history")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => setSkuHistory(data.records.map((record: { payload: SkuHistoryVersion }) => record.payload)))
      .catch(() => {});
    fetch("/api/records?entity=bom")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => {
        const saved = new Map<string, BomCatalogRecord>(
          data.records
            .map((record: { key: string; payload: BomCatalogRecord }) => [
              record.key,
              record.payload,
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
      .catch(() => {});
  }, []);

  const saveNewSku = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const code = String(data.get("code") || "")
      .trim()
      .toUpperCase();
    const name = String(data.get("name") || "").trim();
    if (!editingSku && skuRecords.some((item) => item.code.toUpperCase() === code)) {
      setSkuCreateError("Mã SKU đã tồn tại trong SKU Master.");
      return;
    }
    const sourceLabel = String(data.get("mode") || "Tự chế");
    const mode = sourceLabel === "Mua ngoài" ? "Mua hàng" : sourceLabel === "Gia công" ? "Gia công" : "Tự sản xuất";
    const newGroup = String(data.get("group") || "").trim();
    const normalizedGroup = normalizeSearchText(newGroup);
    const hasProcess = sourceLabel === "Tự chế" && !normalizedGroup.includes("mua hang") && !normalizedGroup.includes("gia cong ngoai");
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
    const next: Sku = editingSku ? { ...editingSku, ...masterFields } : { ...masterFields, moq: 0, safetyDays: 0, leadTime: "Chưa thiết lập", standardHours: "Chưa thiết lập", status: "Đang sử dụng" };
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
      if (JSON.stringify(comparable(editingSku)) === JSON.stringify(comparable(next))) {
        setSkuCreateError("Chưa có nội dung nào thay đổi.");
        return;
      }
    }
    const nextCustom = [...customSkus.filter((item) => normalizeSkuCode(item.code) !== code), next];
    const changedAt = new Date().toISOString();
    const histories = skuHistory.filter((item) => item.sku === code).sort((a, b) => a.version - b.version);
    const previous = histories.find((item) => !item.validTo);
    const closedPrevious: SkuHistoryVersion | undefined = editingSku
      ? previous
        ? { ...previous, validTo: changedAt }
        : { id: `SKUH-${code}-1`, sku: code, version: 1, validTo: changedAt, changedAt, changedBy: session?.name || "vthduyen", data: editingSku }
      : undefined;
    const nextHistory: SkuHistoryVersion = { id: `SKUH-${code}-${editingSku ? (histories.at(-1)?.version || 1) + 1 : 1}`, sku: code, version: editingSku ? (histories.at(-1)?.version || 1) + 1 : 1, validFrom: changedAt, changedAt, changedBy: session?.name || "vthduyen", data: next };
    const response = await fetch("/api/records", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entity: "sku",
        key: next.code,
        payload: next,
        updatedBy: session?.name || "vthduyen",
      }),
    });
    if (!response.ok) {
      setSkuCreateError(
        "Không thể lưu SKU vào dữ liệu dùng chung. Vui lòng thử lại.",
      );
      return;
    }
    const historyRecords = [closedPrevious, nextHistory].filter(Boolean) as SkuHistoryVersion[];
    for (const record of historyRecords) {
      const historyResponse = await fetch("/api/records", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ entity: "sku_history", key: record.id, payload: record, updatedBy: session?.name || "vthduyen" }) });
      if (!historyResponse.ok) {
        setSkuCreateError("SKU đã được lưu nhưng lịch sử thay đổi chưa ghi nhận đầy đủ. Vui lòng thử lại.");
        return;
      }
    }
    setCustomSkus(nextCustom);
    setSkuHistory((current) => [...current.filter((item) => !historyRecords.some((record) => record.id === item.id)), ...historyRecords]);
    setAddingSku(false);
    setEditingSku(null);
    setSelected(next);
    setSkuCreateError("");
    setSkuSearchMode("sku");
    setQueryInput(code);
    setQuery(code);
    setSkuReturnAvailable(true);
  };

  if (!authenticated)
    return (
      <LoginGate
        onLogin={(nextSession) => {
          setSession(nextSession);
          setAuthenticated(true);
          if (nextSession.kind === "line") {
            setView("production");
            setActiveChild("production-report");
          }
        }}
        language={language}
        onLanguage={setLanguage}
      />
    );

  const sessionLine = session?.kind === "line" ? session.line : undefined;
  return (
    <div className={`app-shell${sessionLine ? " line-session" : ""}`}>
      <AutoTablePagination
        resetKey={`${view}-${activeChild}-${planTab}-${query}-${group}-${line}-${skuRecords.length}`}
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
          <button
            className={view === "users" ? "nav-active" : ""}
            onClick={() => setView("users")}
          >
            👤 Quản trị hệ thống <i>›</i>
          </button>
          {view === "users" && (
            <div className="nav-children">
              <button className="child-active">Đăng nhập & phân quyền</button>
              <button>Danh sách người dùng</button>
              <button>Nhật ký thao tác</button>
            </div>
          )}
          <button
            className={view === "sku" ? "nav-active" : ""}
            onClick={() => setView("sku")}
          >
            ▦ Dữ liệu cơ bản <i>{view === "sku" ? "⌄" : "›"}</i>
          </button>
          {view === "sku" && (
            <div className="nav-children">
              <button className="child-active">SKU Master</button>
            </div>
          )}
          <button>
            ▣ Quản lý kho <i>›</i>
          </button>
          <button
            className={view === "bom" ? "nav-active" : ""}
            onClick={() => setView("bom")}
          >
            ⌘ Cấu trúc thành phẩm <i>{view === "bom" ? "⌄" : "›"}</i>
          </button>
          {view === "bom" && (
            <div className="nav-children">
              <button className="child-active">BOM Thành phẩm</button>
              <button>BOM BTP</button>
            </div>
          )}
          <button
            className={view === "planning" ? "nav-active" : ""}
            onClick={() => setView("planning")}
          >
            ◫ Kế hoạch sản xuất <i>{view === "planning" ? "⌄" : "›"}</i>
          </button>
          {view === "planning" && (
            <div className="nav-children planning-children">
              <button
                className={planTab === "base" ? "child-active" : ""}
                onClick={() => setPlanTab("base")}
              >
                Base Forecast
              </button>
              <button
                className={planTab === "demand" ? "child-active" : ""}
                onClick={() => setPlanTab("demand")}
              >
                Demand Event
              </button>
              <button
                className={planTab === "proposal" ? "child-active" : ""}
                onClick={() => setPlanTab("proposal")}
              >
                Đề xuất sản xuất tuần · 05
              </button>
              <button
                className={planTab === "plan" ? "child-active" : ""}
                onClick={() => setPlanTab("plan")}
              >
                Kế hoạch tuần · 06
              </button>
              <button
                className={planTab === "tracking" ? "child-active" : ""}
                onClick={() => setPlanTab("tracking")}
              >
                Theo dõi lệnh · 04
              </button>
            </div>
          )}
          <button>
            ⚙ Quản lý sản xuất <i>›</i>
          </button>
        </nav>
        <TopModules
          view={view}
          sessionLine={sessionLine}
          onParent={(v) => {
            setView(v);
            setActiveChild(null);
          }}
        />
        <AppSidebar
          view={view}
          child={activeChild}
          sessionLine={sessionLine}
          onParent={(v) => {
            setView(v);
            setActiveChild(null);
          }}
          onChild={async (v, c, tab) => {
            if (v === "users" && c === "users-list" && !cachedSystemUsers())
              await loadSystemUsers();
            if (
              v === "users" &&
              c === "permissions" &&
              !cachedPermissionRecords()
            )
              await loadPermissionRecords();
            setView(v);
            setActiveChild(c);
            if (tab) setPlanTab(tab);
          }}
        />
        <div className="session-user">
          <LanguageSwitch language={language} onChange={setLanguage} />
          <span>
            <b>{session?.name || "Vũ Hương Duyên"}</b>
            <small>{session?.detail || "KHSX · vthduyen"}</small>
          </span>
        </div>
      </header>
      {!activeChild ? (
        view === "users" ? <main className="workspace empty-workspace" aria-label="Chọn một menu con để hiển thị nội dung" /> : <ModuleOverview view={view} sessionLine={sessionLine} onOpen={(id, tab) => { setActiveChild(id); if (tab) setPlanTab(tab); }} />
      ) : view === "users" ? (
        <UserContent section={activeChild} />
      ) : view === "warehouse" ? (
        <WarehouseContent
          section={activeChild}
          initialSku={warehouseSku}
          operator={session?.name || "vthduyen"}
          onOpenSku={(code) => {
            const found = skuRecords.find((s) => s.code === code);
            setView("sku");
            setActiveChild("sku-master");
            setSelected(found || null);
            setSkuDetailOpen(!!found);
          }}
        />
      ) : view === "production" ? (
        <ProductionContent section={activeChild} sessionLine={sessionLine} />
      ) : view === "sku" ? (
        activeChild === "leadtime" ? (
          <LeadtimeMasterView
            masterSkus={skuRecords}
            operator={session?.name || "vthduyen"}
            onOpenSkuMaster={() => setActiveChild("sku-master")}
          />
        ) : activeChild === "safety-days" ? (
          <SafetyRulesView />
        ) : (
          <main className={`workspace ${addingSku ? "leadtime-form-only" : ""}`}>
            {skuReturnAvailable && !addingSku && <button className="sku-back-list" onClick={() => { setSkuSearchMode("sku"); setQueryInput(""); setQuery(""); setGroup("Tất cả nhóm"); setLine("Tất cả Line"); setSelected(null); setSkuDetailOpen(false); setSkuHistoryOpen(false); setSkuSearchOpen(false); setSkuReturnAvailable(false); }}>← Trở về danh sách SKU Master</button>}
            <div className="safety-rules-title"><h1>SKU Master</h1></div>
            <section className={`leadtime-command-bar sku-command-bar ${skuSearchOpen ? "search-open" : ""}`}><b>CHỨC NĂNG</b><div className="leadtime-command-row"><div className="leadtime-command-actions">
              <button onClick={() => { setEditingSku(null); setAddingSku(true); setSkuReturnAvailable(false); setSkuCreateGroup(""); setSkuCreateLine(""); setSkuCreateProcesses([]); setSkuCreateError(""); setSkuDetailOpen(false); setSkuHistoryOpen(false); }}>＋ Thêm mới</button>
              <button disabled={!selected} onClick={() => { if (!selected) return; setEditingSku(selected); setAddingSku(true); setSkuReturnAvailable(false); setSkuCreateGroup(selected.group); setSkuCreateLine(hasProductionProcess(selected) ? selected.line.replace(/^Line\s+/i, "") : ""); setSkuCreateProcesses(selected.processes || []); setSkuCreateError(""); setSkuDetailOpen(false); setSkuHistoryOpen(false); }}>✎ Sửa</button>
              <button onClick={() => { setSkuSearchOpen((open) => !open); setSkuDetailOpen(false); setSkuHistoryOpen(false); }}>⌕ Tra cứu</button>
              <button disabled={!selected} onClick={() => { setSkuHistoryOpen(true); setSkuDetailOpen(false); }}>Lịch sử</button>
            </div>{skuSearchOpen && <div className="leadtime-compact-search"><label><span>TRA THEO</span><select value={skuSearchMode} onChange={(e) => { setSkuSearchMode(e.target.value as SkuSearchMode); setQueryInput(""); setQuery(""); }}><option value="sku">Mã SKU</option><option value="name">Tên sản phẩm</option><option value="specification">Quy cách</option><option value="group">Nhóm sản phẩm</option><option value="line">Line</option></select></label><label className="leadtime-compact-query"><span>NỘI DUNG TRA</span>{skuSearchMode === "group" ? <select value={queryInput} onChange={(e) => { setQueryInput(e.target.value); setQuery(e.target.value); }}><option value="">Tất cả nhóm</option>{skuGroups.map((item) => <option key={item}>{item}</option>)}</select> : skuSearchMode === "line" ? <select value={queryInput} onChange={(e) => { setQueryInput(e.target.value); setQuery(e.target.value); }}><option value="">Tất cả Line</option>{Array.from(new Set(skuRecords.map((sku) => sku.line))).sort().map((item) => <option key={item}>{item}</option>)}</select> : <input value={queryInput} onChange={(e) => { setQueryInput(e.target.value); setQuery(e.target.value); }} placeholder={skuSearchMode === "sku" ? "Nhập mã SKU" : skuSearchMode === "name" ? "Nhập tên sản phẩm" : "Nhập quy cách"} />}</label><div className="leadtime-compact-actions"><button onClick={() => { setQueryInput(""); setQuery(""); }}>Xóa lọc</button><button className="primary-button" onClick={() => setSkuSearchOpen(false)}>Tìm kiếm</button><button onClick={() => { setSkuSearchMode("sku"); setQueryInput(""); setQuery(""); setSkuSearchOpen(false); }}>Quay lại</button></div></div>}</div></section>
            {addingSku && <section className="data-card leadtime-inline-panel sku-inline-create">
              <header><div><h2>{editingSku ? "Sửa SKU" : "Thêm mới SKU"}</h2></div><button onClick={() => { setAddingSku(false); setEditingSku(null); }}>×</button></header>
              <form key={editingSku?.code || "new-sku"} onSubmit={saveNewSku}>
                <div className="leadtime-form-grid">
                  <fieldset>
                    <legend>Thông tin SKU</legend>
                    <div className="leadtime-readonly-grid sku-create-fields">
                      <label><span>Mã SKU *</span><input name="code" required autoFocus readOnly={!!editingSku} defaultValue={editingSku?.code || ""} placeholder="Ví dụ: 102XS04001" /></label>
                      <label><span>Tên sản phẩm *</span><input name="name" required defaultValue={editingSku?.name || ""} placeholder="Nhập tên sản phẩm" /></label>
                      <label><span>Quy cách</span><input name="specification" defaultValue={editingSku?.specification === "—" ? "" : editingSku?.specification || ""} placeholder="Nhập quy cách" /></label>
                      <label><span>Nhóm sản phẩm *</span><input name="group" list="sku-group-options" required value={skuCreateGroup} onChange={(event) => { const value = event.target.value; const key = normalizeSearchText(value); setSkuCreateGroup(value); if (key.includes("mua hang") || key.includes("gia cong ngoai")) { setSkuCreateLine(""); setSkuCreateProcesses([]); } }} placeholder="Chọn hoặc nhập nhóm" /><datalist id="sku-group-options">{skuGroups.map((item) => <option key={item} value={item} />)}</datalist></label>
                    </div>
                  </fieldset>
                  <fieldset>
                    <legend>Thiết lập sản xuất</legend>
                    <div className="leadtime-readonly-grid sku-create-fields">
                      <label><span>Đơn vị tính</span><select name="unit" defaultValue={editingSku?.unit || "—"}><option>—</option><option>CÁI</option><option>BỘ</option><option>SỢI</option><option>KG</option><option>TỜ</option></select></label>
                      <label><span>Nguồn</span><input name="mode" readOnly value={skuCreateSource} /></label>
                      <label><span>Line</span><select name="line" required={!skuCreateExternal && !!skuCreateGroup.trim()} disabled={skuCreateExternal || !skuCreateGroup.trim()} value={skuCreateExternal ? "" : skuCreateLine} onChange={(event) => { setSkuCreateLine(event.target.value); setSkuCreateProcesses([]); }}><option value="">Chọn Line</option><option>A</option><option>B</option><option>C</option></select></label>
                    </div>
                    <div className={`sku-process-picker ${skuCreateExternal || !skuCreateLine ? "disabled" : ""}`}><span>Mã công đoạn</span>{skuCreateExternal ? <p>Không áp dụng</p> : !skuCreateLine ? <p>Chọn nhóm sản phẩm và Line để hiển thị công đoạn</p> : <><div className="sku-process-options">{(skuCreateProcessOptions[skuCreateLine] || []).map((code) => <label key={code}><input type="checkbox" name="processes" value={code} checked={skuCreateProcesses.includes(code)} onChange={(event) => setSkuCreateProcesses((current) => event.target.checked ? [...current, code] : current.filter((item) => item !== code))} /><span><b>{code}</b><small>{processLabel(code)}</small></span></label>)}</div><label className="sku-process-result"><span>Công đoạn đã chọn</span><input readOnly value={skuCreateProcesses.join(" / ")} placeholder="Chọn công đoạn phía trên" /></label></>}</div>
                  </fieldset>
                </div>
                {skuCreateError && <div className="sku-create-error">{skuCreateError}</div>}
                <div className="function-actions"><button type="button" className="ghost-button" onClick={() => { setAddingSku(false); setEditingSku(null); }}>Hủy</button><button type="submit" className="primary-button">{editingSku ? "Lưu thay đổi" : "Lưu SKU"}</button></div>
              </form>
            </section>}
            {!addingSku && <section className="data-card sku-master-card">
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
                  <button
                    className="ghost-button"
                    onClick={() => {
                      setQueryInput("");
                      setQuery("");
                      setGroup("Tất cả nhóm");
                      setLine("Tất cả Line");
                    }}
                  >
                    Xóa bộ lọc
                  </button>
                </div>
              </div>
              <div className="result-bar">
                <strong>{filtered.length}</strong> SKU được tìm thấy{" "}
                <span>Bấm một lần để chọn, bấm hai lần để xem chi tiết →</span>
              </div>
              <div className="table-wrap">
                <table data-page-size="25">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>TÊN SẢN PHẨM</th>
                      <th>QUY CÁCH</th>
                      <th>NHÓM SẢN PHẨM</th>
                      <th>LINE / CÔNG ĐOẠN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((sku) => (
                      <tr
                        key={sku.code}
                        className={selected?.code === sku.code ? "selected" : ""}
                        onClick={() => {
                          setSelected(sku);
                          setSkuDetailOpen(false);
                          setSkuHistoryOpen(false);
                          setStockExpanded(false);
                          setProcessExpanded(false);
                        }}
                        onDoubleClick={() => {
                          setSelected(sku);
                          setSkuDetailOpen(true);
                          setStockExpanded(false);
                          setProcessExpanded(false);
                        }}
                      >
                        <td>
                          <button className="sku-link" onClick={(event) => { event.stopPropagation(); setSelected(sku); setSkuDetailOpen(false); }} onDoubleClick={(event) => { event.stopPropagation(); setSelected(sku); setSkuDetailOpen(true); }}>{sku.code}</button>
                        </td>
                        <td className="product-name">{sku.name}</td>
                        <td>{sku.specification}</td>
                        <td>
                          <span className="tag">{sku.group}</span>
                        </td>
                        <td>
                          {!hasProductionProcess(sku) ? (
                            <span className="no-process">Không áp dụng</span>
                          ) : (
                            <>
                              <span className="line-dot" />
                              {sku.line}
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>}
          </main>
        )
      ) : view === "bom" ? (
        activeChild === "bom-change" ? (
          <BomChangeContent />
        ) : (
          <BomLookupView />
        )
      ) : (
        <PlanningView tab={planTab} operator={session?.name || "vthduyen"} />
      )}
      {view === "sku" && activeChild === "sku-master" && selected && skuHistoryOpen && (
        <><button className="overlay" aria-label="Đóng lịch sử SKU" onClick={() => setSkuHistoryOpen(false)} /><aside className="detail-panel sku-history-panel"><div className="detail-header"><div><p>LỊCH SỬ SKU</p><h2>{selected.code}</h2><span>{selected.name}</span></div><button onClick={() => setSkuHistoryOpen(false)}>×</button></div><div className="detail-scroll"><section><h3>Chi tiết thay đổi</h3><div className="sku-history-list">{selectedSkuHistory.length ? selectedSkuHistory.map((item) => <article key={item.id}><header><b>Phiên bản {String(item.version).padStart(2, "0")}</b><span className={!item.validTo ? "status-good" : ""}>{item.validTo ? "Hết hiệu lực" : "Đang hiệu lực"}</span></header><dl><div><dt>Ngày hiệu lực</dt><dd>{item.validFrom ? formatDateTimeDisplay(item.validFrom) : "Dữ liệu gốc"}</dd></div><div><dt>Ngày hết hiệu lực</dt><dd>{item.validTo ? formatDateTimeDisplay(item.validTo) : "—"}</dd></div><div><dt>Tên sản phẩm</dt><dd>{item.data.name}</dd></div><div><dt>Quy cách</dt><dd>{item.data.specification}</dd></div><div><dt>Nhóm sản phẩm</dt><dd>{item.data.group}</dd></div><div><dt>Đơn vị tính</dt><dd>{item.data.unit}</dd></div><div><dt>Nguồn</dt><dd>{item.data.mode === "Mua hàng" ? "Mua ngoài" : item.data.mode === "Tự sản xuất" ? "Tự chế" : item.data.mode}</dd></div><div><dt>Line</dt><dd>{item.data.line}</dd></div><div className="full"><dt>Mã công đoạn</dt><dd>{item.data.processes?.join(" / ") || "—"}</dd></div><div className="full"><dt>Người thay đổi</dt><dd>{item.changedBy} · {formatDateTimeDisplay(item.changedAt)}</dd></div></dl></article>) : <article><header><b>Dữ liệu hiện tại</b><span className="status-good">Đang hiệu lực</span></header><dl><div><dt>Ngày hiệu lực</dt><dd>Dữ liệu gốc</dd></div><div><dt>Ngày hết hiệu lực</dt><dd>—</dd></div><div><dt>Tên sản phẩm</dt><dd>{selected.name}</dd></div><div><dt>Quy cách</dt><dd>{selected.specification}</dd></div><div><dt>Nhóm sản phẩm</dt><dd>{selected.group}</dd></div><div><dt>Đơn vị tính</dt><dd>{selected.unit}</dd></div><div><dt>Nguồn</dt><dd>{selected.mode === "Mua hàng" ? "Mua ngoài" : selected.mode === "Tự sản xuất" ? "Tự chế" : selected.mode}</dd></div><div><dt>Line</dt><dd>{selected.line}</dd></div><div className="full"><dt>Mã công đoạn</dt><dd>{selected.processes?.join(" / ") || "—"}</dd></div></dl></article>}</div></section></div></aside></>
      )}
      {view === "sku" && activeChild === "sku-master" && selected && skuDetailOpen && (
        <>
          <button
            className="overlay"
            aria-label="Đóng"
            onClick={() => setSkuDetailOpen(false)}
          />
          <aside className="detail-panel sku-detail-panel">
            <div className="detail-header">
              <div>
                <p>HỒ SƠ SKU</p>
                <h2>{selected.code}</h2>
                <span>{selected.name}</span>
              </div>
              <button onClick={() => setSkuDetailOpen(false)}>×</button>
            </div>
            <div className="detail-scroll">
              <div className="detail-status">
                <span>
                  <i /> {selected.status}
                </span>
                <button onClick={() => { setEditingSku(selected); setAddingSku(true); setSkuCreateGroup(selected.group); setSkuCreateLine(hasProductionProcess(selected) ? selected.line.replace(/^Line\s+/i, "") : ""); setSkuCreateProcesses(selected.processes || []); setSkuCreateError(""); setSkuDetailOpen(false); }}>Chỉnh sửa</button>
              </div>
              <section>
                <h3>Thông tin cơ bản</h3>
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
                    <dt>Đơn vị tính</dt>
                    <dd>{selected.unit}</dd>
                  </div>
                </dl>
              </section>
              <section className="sku-stock-section">
                <button
                  className="section-toggle"
                  onClick={() => setStockExpanded((v) => !v)}
                >
                  <span>
                    <b>Tồn kho theo kho</b>
                    <small>Cập nhật: 28/08/2026 14:35:18</small>
                  </span>
                  <em>
                    {stockExpanded ? "Thu gọn" : "Xem chi tiết"}{" "}
                    {stockExpanded ? "⌃" : "⌄"}
                  </em>
                </button>
                <div className="sku-stock-summary compact">
                  <div>
                    <span>Tổng tồn</span>
                    <b>{selected.code === "102XS04001" ? "4.000" : "1.440"}</b>
                  </div>
                  <div>
                    <span>Đang chuyển</span>
                    <b>{selected.code === "102XS04001" ? "500" : "0"}</b>
                  </div>
                  <div>
                    <span>Tồn khả dụng</span>
                    <b>{selected.code === "102XS04001" ? "3.500" : "1.440"}</b>
                  </div>
                </div>
                {stockExpanded && (
                  <div className="sku-stock-expanded">
                    <div className="stock-location-card">
                      <strong>KHO TP</strong>
                      <span>A01-02 · LOT-260822-01</span>
                      <dl>
                        <div>
                          <dt>Tồn hiện tại</dt>
                          <dd>
                            {selected.code === "102XS04001" ? "4.000" : "1.440"}
                          </dd>
                        </div>
                        <div>
                          <dt>Đang chuyển</dt>
                          <dd>
                            {selected.code === "102XS04001" ? "500" : "0"}
                          </dd>
                        </div>
                        <div>
                          <dt>Tồn khả dụng</dt>
                          <dd>
                            {selected.code === "102XS04001" ? "3.500" : "1.440"}
                          </dd>
                        </div>
                      </dl>
                    </div>
                    <div className="sku-stock-actions">
                      <button>Xem lịch sử nhập xuất</button>
                      <button>Tra tồn tại thời điểm</button>
                      <button
                        onClick={() => {
                          setWarehouseSku(selected.code);
                          setSelected(null);
                          setView("warehouse");
                          setActiveChild("inventory");
                        }}
                      >
                        Mở trong Quản lý kho
                      </button>
                    </div>
                    <p className="stock-readonly-note">
                      Số tồn chỉ đọc, không sửa trực tiếp trong SKU Master.
                    </p>
                  </div>
                )}
              </section>
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
                    <dd>{selected.mode === "Mua hàng" ? "Mua ngoài" : selected.mode === "Tự sản xuất" ? "Tự chế" : selected.mode}</dd>
                  </div>
                  <div>
                    <dt>Safety Days</dt>
                    <dd>{selected.safetyDays} ngày</dd>
                  </div>
                  <div>
                    <dt>Lead time</dt>
                    <dd>{selected.leadTime}</dd>
                  </div>
                  <div>
                    <dt>Giờ công chuẩn</dt>
                    <dd>{selected.standardHours}</dd>
                  </div>
                </dl>
              </section>
              {hasProductionProcess(selected) && (
                <section className="sku-process-section">
                  <button
                    className="section-toggle"
                    onClick={() => setProcessExpanded((v) => !v)}
                  >
                    <span>
                      <b>Quy trình sản xuất</b>
                      <small>
                        {selected.line} · {selectedProcesses.length} công đoạn
                      </small>
                    </span>
                    <em>
                      {processExpanded ? "Thu gọn" : "Xem chi tiết"}{" "}
                      {processExpanded ? "⌃" : "⌄"}
                    </em>
                  </button>
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
    </div>
  );
}
