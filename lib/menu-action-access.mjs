// A grant belongs to one menu. A grant on a sibling menu is never authority.
// Explicit legacy group-wide grants remain explicit; no new grants are added here.
export const normalizePermission=value=>String(value||'').toLocaleLowerCase('vi').replaceAll('_',' ').replace(/\s+/g,' ').trim();
export function hasMenuPermission(actor,menu,actions){
 if(!actor)return false;
 if(actor.isAdmin)return true;
 if(!menu)return false;
 const target=String(menu).split('/').map(normalizePermission),wanted=actions.map(normalizePermission);
 return (actor.grants||[]).some(grant=>{
  const parts=String(grant).split('/').map(normalizePermission),action=parts.pop();
  return wanted.includes(action)&&(parts.join('/')===target.join('/')||parts.length===1&&target.length===2&&parts[0]===target[0]);
 });
}
export const writeActions=['Thêm','Sửa','Lưu','Nhập','Tạo','Cập nhật'];
export const productionMenus={work:'Quản lý sản xuất / Báo công sản xuất',schedule:'Quản lý sản xuất / Lịch SX thực tế',progress:'Quản lý sản xuất / Tiến độ sản xuất',correction:'Quản lý sản xuất / Điều chỉnh báo công'};
export function productionMenuRights(actor){
 return {work:hasMenuPermission(actor,productionMenus.work,writeActions),manager:hasMenuPermission(actor,productionMenus.schedule,['Sửa','Xác nhận']),confirm:hasMenuPermission(actor,productionMenus.progress,['Xác nhận']),correct:hasMenuPermission(actor,productionMenus.correction,['Sửa','Xác nhận'])};
}
export function workflowActionAllowed(actor,body){
 if(body.action==='recalculate-attendance-hours')return !!actor?.isAdmin&&!actor.line;
 const r=productionMenuRights(actor),hr=hasMenuPermission(actor,productionMenus.schedule,['Ghi vắng mặt']);
 if(['attendance-edit','attendance-cancel','attendance-correction','line-absence','attendance-override'].includes(body.action))return r.manager||hr;
 if(['warehouse-duty','line-movement','staff-recall','staff-recall-approve','schedule'].includes(body.action))return r.manager;
 if(body.action==='approve-hours')return r.correct;
 if(body.action==='absence')return body.absenceType==='Phụ kho'?r.manager:hr;
 return r.work;
}
export function entityPermissionMenu(entity){
 const fixed={sku:'Dữ liệu cơ bản / SKU Master',sku_history:'Dữ liệu cơ bản / SKU Master',employees:'Dữ liệu cơ bản / Danh sách nhân viên',warehouse_in:'Quản lý kho / Nhập kho',warehouse_out:'Quản lý kho / Xuất kho',warehouse_transfer:'Quản lý kho / Chuyển kho',warehouse_docs:'Quản lý kho / Phiếu kho',warehouse_count:'Quản lý kho / Kiểm kê',bom:'Cấu trúc thành phẩm / Dữ liệu lượng dùng BOM',bom_change:'Cấu trúc thành phẩm / Phiếu thay đổi BOM',forecast:'Kế hoạch sản xuất / Base_forecast',forecast_import_history:'Kế hoạch sản xuất / Base_forecast',demand_event:'Kế hoạch sản xuất / Demand_event',production_report:productionMenus.work,labor_adjustment:productionMenus.correction,capacity:'Quản lý sản xuất / Capacity tuần'};
 if(fixed[entity])return fixed[entity];
 for(const [prefix,menu] of [['inventory','Quản lý kho / Tồn kho ERP'],['leadtime','Dữ liệu cơ bản / Leadtime'],['safety','Dữ liệu cơ bản / Quy tắc Safety Days'],['labor_hours','Dữ liệu cơ bản / Giờ công'],['production_engine','Kế hoạch sản xuất / Production_engine'],['production_plan','Kế hoạch sản xuất / Production_plan'],['in_transit','Kế hoạch sản xuất / In_transit']])if(String(entity).startsWith(prefix))return menu;
 return null;
}
