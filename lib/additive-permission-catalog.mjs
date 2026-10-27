// Business-menu permissions only. No Admin, authentication or Line scope grants.
const actions=['Xem','Thêm','Sửa','Xóa','Xác nhận','Hủy xác nhận','Hủy','Xuất dữ liệu'];
const groups=[
 ['Dữ liệu cơ bản',['SKU Master','Danh sách nhân viên','Leadtime','Giờ công','Quy tắc Safety Days']],
 ['Quản lý kho',['Tổng quan','Tồn kho ERP','Nhập kho','Xuất kho','Chuyển kho','Phiếu kho','Kiểm kê','Báo cáo']],
 ['Cấu trúc thành phẩm',['Dữ liệu lượng dùng BOM','Phiếu thay đổi BOM']],
 ['Kế hoạch sản xuất',['Base_forecast','Demand_event','Production_engine','Quy tắc áp dụng','Production_plan','In_transit','Report']],
 ['Quản lý sản xuất',['Báo công sản xuất','Lịch SX thực tế','Tiến độ sản xuất','Nhật ký','Điều chỉnh báo công','Sản lượng và giờ công','Hiệu suất và tính sản lượng','Capacity tuần']],
];
export const additivePermissionCatalog=groups.map(([group,menus])=>({group,menus:menus.map(label=>({label,grants:[...actions.filter(action=>!(label==='Capacity tuần'&&['Xóa','Hủy','Xuất dữ liệu'].includes(action))),...(label==='Lịch SX thực tế'?['Ghi vắng mặt']:[]),...(label==='Capacity tuần'?['Sửa hệ số']:[])].map(action=>`${group} / ${label} / ${action}`)}))}));
export const additivePermissionAllowlist=new Set(additivePermissionCatalog.flatMap(group=>group.menus.flatMap(menu=>menu.grants)));
