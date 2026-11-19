// Owner assignment, 19/11/2026: only these two active accounts receive SKU Master actions.
// Additive runtime policy; never rewrites stored personal/department permissions.
export const skuMasterUserGrants=['Xem','Thêm','Sửa','Xóa','Xác nhận','Hủy xác nhận','Hủy','Xuất dữ liệu'].map(action=>`Dữ liệu cơ bản / SKU Master / ${action}`);
export function assignedSkuMasterGrants(user,personal){
 if(!user||user.active!==true||user._deleted||user.line||user.authMode==='quick_line'||personal&&(personal._deleted||personal.active!==true))return [];
 return ['nttvy','htndiem'].includes(String(user.login||'').trim().toLowerCase())?[...skuMasterUserGrants]:[];
}
