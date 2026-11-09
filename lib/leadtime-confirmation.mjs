import {validLeadtimeTiers} from './leadtime-tiers.mjs';
import {effectiveInstant} from './leadtime-effective.mjs';
import {vietnamDate} from './vietnam-calendar.mjs';
const entities=new Set(['leadtime_versions','safety_rules','safety_rule_groups']);
const confirmed=new Set(['Đang áp dụng','Đã xác nhận','Sắp có hiệu lực','Đã xác nhận – Chờ hiệu lực']);
// Applies equally to linked transactions and generic record writes, including local TEST.
export function confirmationDateError(entity,next,before,now=new Date().toISOString()) {
 if(!entities.has(entity))return '';
 const isLead=entity==='leadtime_versions';
 const from=isLead?'validFrom':'effectiveFrom';
 if(isLead && next.tiers!==undefined&&!validLeadtimeTiers(next.tiers))return 'Bảng mức MOQ/Leadtime không hợp lệ: không được trùng ngưỡng hoặc để trống/âm.';
 if(next.status==='Hết hiệu lực'&&!before)return 'Không được tạo trực tiếp phiên bản lịch sử đã hết hiệu lực.';
 if(before && (before.confirmedAt || confirmed.has(before.status) || before.status==='Hết hiệu lực')) {
  if(['Nháp','Chờ xác nhận'].includes(next.status))return 'Phiên bản đã xác nhận phải giữ lịch sử; hãy tạo phiên bản mới.';
  const fields=isLead?['sku','skuId','leadTime','moq','tiers']:['group','rows','leadTimeRules','forecastRules','situationRules'];
  if(fields.some(key=>JSON.stringify(next[key])!==JSON.stringify(before[key])))return 'Không được sửa mức hoặc quy tắc của phiên bản đã xác nhận. Hãy tạo phiên bản mới.';
  const until=isLead?'validTo':'effectiveTo';
  if(next[until]!==before[until] && next.status===before.status)return 'Kết thúc hiệu lực phải dùng giao dịch thay thế phiên bản.';
  if(next[until] && (!Number.isFinite(effectiveInstant(next[until])) || effectiveInstant(next[until])<effectiveInstant(before[from])))return 'Ngày hết hiệu lực không hợp lệ.';
 }
 if(before?.confirmedAt && before?.[from]) {
  if(next.confirmedAt!==before.confirmedAt || next[from]!==before[from])
   return 'Không được đổi ngày hiệu lực hoặc thời gian xác nhận của phiên bản đã xác nhận. Hãy tạo phiên bản mới.';
 }
 if(!confirmed.has(next.status) || confirmed.has(before?.status) || before?.status==='Hết hiệu lực')return '';
 const today=vietnamDate(now);
 if(!Number.isFinite(effectiveInstant(next.confirmedAt)) || vietnamDate(next.confirmedAt)!==today)
  return 'Thời gian xác nhận phải thuộc ngày xác nhận hiện tại (GMT+7). Vui lòng tải lại và xác nhận lại.';
 if(isLead ? next.validFrom!==next.confirmedAt : next.effectiveFrom!==today)
  return 'Ngày hiệu lực chỉ bắt đầu từ ngày xác nhận (GMT+7), không được chọn lùi hoặc tương lai.';
 const until=isLead?next.validTo:next.effectiveTo;
 if(until && (!Number.isFinite(effectiveInstant(until)) || effectiveInstant(until)<effectiveInstant(next[from])))
  return 'Ngày hết hiệu lực không hợp lệ hoặc trước ngày xác nhận.';
 return '';
}

export const needsLinkedConfirmation=(entity,next,before)=>entities.has(entity)&&[next,before].some(row=>row&&(row.confirmedAt||confirmed.has(row.status)||row.status==='Hết hiệu lực'));
