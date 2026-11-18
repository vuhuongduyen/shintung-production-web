import {productionMenuRights} from './menu-action-access.mjs';
// Preserve the existing correction handler's second, department/Line boundary.
// A Line-scoped Edit grant alone was never authority to correct reports.
export function canCorrectProduction(actor){
 if(!productionMenuRights(actor).correct||!actor?.login)return false;
 if(actor.isAdmin)return true;
 return (actor.grants||[]).some(value=>{const grant=String(value).toLocaleLowerCase('vi');return grant.includes('quản lý sản xuất')&&(grant.endsWith('/ xác nhận')||grant.endsWith('/ sửa')&&!actor.line);});
}
