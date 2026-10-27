import {additivePermissionCatalog} from './additive-permission-catalog.mjs';
const make=(group,menus,actions)=>menus.flatMap(menu=>actions.map(action=>`${group} / ${menu} / ${action}`));
const view=['Xem'],manage=['Xem','Thêm','Sửa','Xác nhận','Hủy xác nhận','Hủy','Xuất dữ liệu'];
const reference=make('Dữ liệu cơ bản',['SKU Master','Leadtime','Giờ công','Quy tắc Safety Days'],view),bom=make('Cấu trúc thành phẩm',['Dữ liệu lượng dùng BOM','Phiếu thay đổi BOM'],view);
export const productionViewMenus=['Báo công sản xuất','Lịch SX thực tế','Tiến độ sản xuất','Nhật ký','Điều chỉnh báo công','Sản lượng và giờ công','Hiệu suất và tính sản lượng','Capacity tuần'];
export const quickLinePermissions=[...make('Quản lý sản xuất',productionViewMenus,view),'Quản lý sản xuất / Báo công sản xuất / Thêm','Quản lý sản xuất / Báo công sản xuất / Lưu'];
export const hasQuickLineReadScope=actor=>actor?.authMode==='quick_line'&&['A','B'].includes(actor.line)&&actor.login===`LINE_${actor.line}`;
export const hrAttendancePermissions=['Quản lý sản xuất / Lịch SX thực tế / Xem','Quản lý sản xuất / Lịch SX thực tế / Ghi vắng mặt'];
export const permissionProfiles={
 HR:{label:'HR: ghi nghỉ, đi trễ, về sớm trong lịch thực tế',grants:hrAttendancePermissions},
 KHSX:{label:'KHSX: lập, chốt, đồng bộ kế hoạch; xem tiến độ, tồn kho và duyệt Capacity',grants:[...reference,...bom,...make('Kế hoạch sản xuất',['Base_forecast','Demand_event','Production_engine','Quy tắc áp dụng','Production_plan','In_transit','Report'],manage),...make('Quản lý kho',['Tồn kho ERP'],view),...make('Quản lý sản xuất',['Tiến độ sản xuất','Capacity tuần'],view)]},
 QLSX:{label:'QLSX: báo công, lịch thực tế, điều chỉnh, xác nhận tiến độ, giờ công và sản lượng',grants:[...reference,...bom,...make('Dữ liệu cơ bản',['Danh sách nhân viên'],view),...make('Quản lý sản xuất',['Báo công sản xuất','Lịch SX thực tế','Tiến độ sản xuất','Nhật ký','Điều chỉnh báo công','Sản lượng và giờ công','Hiệu suất và tính sản lượng','Capacity tuần'],['Xem','Thêm','Sửa','Xác nhận','Hủy xác nhận','Xuất dữ liệu'])]},
 KHO:{label:'Kho: cập nhật, chốt tồn ERP và xử lý nghiệp vụ kho; xem SKU/BOM',grants:[...make('Dữ liệu cơ bản',['SKU Master'],view),...bom,...make('Quản lý kho',['Tổng quan','Tồn kho ERP','Nhập kho','Xuất kho','Chuyển kho','Phiếu kho','Kiểm kê','Báo cáo'],manage)]},
 QC:{label:'QC: tra cứu SKU, BOM, Leadtime, giờ công chuẩn và Safety Days',grants:[...reference,...bom]},
 SX:{label:'SX: xem và thực hiện báo công sản xuất',grants:make('Quản lý sản xuất',['Báo công sản xuất'],['Xem','Thêm'])},
};
export function profileForUser(user){
 if(['ADMIN','SUPER_ADMIN'].includes(String(user.role||'').trim().toUpperCase().replaceAll(' ','_').replaceAll('-','_')))return {kind:'admin',label:'Admin: toàn quyền website',grants:[]};
 if(user.authMode==='quick_line'&&['A','B'].includes(user.line)&&user.login===`LINE_${user.line}`)return {kind:'line',label:`Line ${user.line}: xem toàn bộ Quản lý sản xuất; chỉ báo công Line ${user.line}`,grants:quickLinePermissions};
 const profile=permissionProfiles[String(user.department||'').toUpperCase()];return profile?{kind:'department',...profile}:null;
}

// Runtime read access is additive; stored department/custom permissions remain intact.
// Quick-Line principals keep their separate production-only, server-scoped grants.
export const businessViewPermissions=additivePermissionCatalog.flatMap(group=>group.menus.map(menu=>`${group.group} / ${menu.label} / Xem`));
export function withBusinessViews(grants,active=true){
 return active?[...new Set([...grants,...businessViewPermissions])]:[];
}
