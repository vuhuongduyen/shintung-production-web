const published = new Set(['Đang áp dụng','Đã xác nhận','Sắp có hiệu lực','Đã xác nhận – Chờ hiệu lực','Hết hiệu lực','Đã hủy','Đã hủy xác nhận']);
const state = row => row?._deleted || row?.cancelled || ['Đã hủy','Đã hủy xác nhận'].includes(row?.status) ? 'cancelled' : row?.status === 'Hết hiệu lực' ? 'expired' : ['Đang áp dụng','Đã xác nhận','Sắp có hiệu lực','Đã xác nhận – Chờ hiệu lực'].includes(row?.status) ? 'active' : 'draft';
const needsPair = row => row && (row.confirmedAt || published.has(row.status));
// Only the leadtime group has a materialized safety_rules counterpart, keyed by
// the same id. Other group types and standalone legacy rules have no such mapping.
export function safetyLinkedPairError(operations, stored) {
 const old = new Map(stored.map(r=>[`${r.entity}:${r.record_key}`,JSON.parse(r.payload)]));
 const ops = new Map(operations.map(op=>[`${op.entity}:${op.key}`,op]));
 for (const op of operations) {
  if (!['safety_rules','safety_rule_groups'].includes(op.entity)) continue;
  const groupOp=ops.get(`safety_rule_groups:${op.key}`), ruleOp=ops.get(`safety_rules:${op.key}`);
  const beforeGroup=old.get(`safety_rule_groups:${op.key}`), beforeRule=old.get(`safety_rules:${op.key}`);
  const group=groupOp?.payload || beforeGroup;
  if (group?.group!=='leadtime' && beforeGroup?.group!=='leadtime') continue;
  if (!ruleOp && !beforeRule && !needsPair(beforeGroup) && !needsPair(group)) continue;
  if (!groupOp || !ruleOp) return 'Nhóm Safety Leadtime và quy tắc liên kết phải được cập nhật cùng giao dịch.';
  const rule=ruleOp.payload;
  if (group.group!=='leadtime' || group.id!==op.key || rule.id!==op.key || state(group)!==state(rule) || state(group)==='draft')
   return 'Trạng thái hoặc định danh cặp Safety Leadtime không khớp.';
  if (needsPair(beforeGroup) && !beforeRule) return 'Thiếu quy tắc Safety đã xác nhận; cần đối chiếu lịch sử trước khi cập nhật.';
  if (['effectiveFrom','effectiveTo','confirmedAt'].some(key=>(group[key]||'')!==(rule[key]||'')) || !Array.isArray(group.rows) || JSON.stringify(group.rows)!==JSON.stringify(rule.leadTimeRules))
   return 'Ngày hiệu lực hoặc nội dung cặp Safety Leadtime không khớp.';
 }
 return '';
}

// Display defaults are not persisted history and must never be expired on first confirmation.
export function previousSafetyGroup(versions, selected, isPersisted) {
 const candidates=versions.filter(row=>row.id!==selected.id && row.group===selected.group && row.status==='Đang áp dụng' && !row._deleted && !row.cancelled && isPersisted(row.id));
 return candidates.find(row=>row.id===selected.sourceId) || candidates[0];
}
