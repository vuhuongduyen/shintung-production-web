export const isMasterCancelled = row => !!row?.cancelled || row?.status === 'Đã hủy';
export function latestMasterTime(row) {
 const times = [row?.updatedAt,row?.modifiedAt,row?.modified_at,row?.updated_at,row?.createdAt,row?.created_at,row?.configuredAt,row?.setupAt,row?.cancelledAt,...(row?.history || []).map(h=>h.at)].map(v=>Date.parse(v||'')).filter(Number.isFinite);
 return times.length ? Math.max(...times) : 0;
}
export const newestMasterFirst = (a,b) => latestMasterTime(b)-latestMasterTime(a);
export const effectiveMasterValue = (row,field) => isMasterCancelled(row) ? null : row?.[field];
export const basicMasterLabels = {sku:'SKU Master',leadtime:'Leadtime',labor_hours:'Giờ công',safety_rule_groups:'Safety Days',employees:'Danh sách nhân viên'};
export function canCancelMaster(actor,entity) {
 if(!actor?.login||!basicMasterLabels[entity])return false;
 if(actor.isAdmin||['local-owner','site-owner'].includes(actor.role))return true;
 const menu=entity==='safety_rule_groups'?'safety days':basicMasterLabels[entity].toLowerCase();
 return (actor.grants||[]).some(grant=>{
  const parts=String(grant).normalize('NFC').toLowerCase().split('/').map(x=>x.trim());
  return parts.includes('dữ liệu cơ bản')&&parts.some(x=>x.includes(menu))&&['hủy','sửa'].includes(parts.at(-1));
 });
}
export const projectCancelledMaster = (entity,row) => !isMasterCancelled(row)?row:entity==='leadtime'?{...row,retainedLeadTime:row.leadTime,leadTime:0}:entity==='labor_hours'?{...row,retainedLaborHour:row.laborHour,laborHour:null}:row;
