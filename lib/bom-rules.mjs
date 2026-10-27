export const bomToday = () => new Date().toLocaleDateString('en-CA', {timeZone:'Asia/Ho_Chi_Minh'});
export function bomDate(value) {
  const raw = String(value ?? '').trim();
  if (!raw || raw === '—') return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
  const iso = m ? `${m[3]}-${m[2]}-${m[1]}` : raw;
  const time = Date.parse(`${iso}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && Number.isFinite(time) && new Date(time).toISOString().slice(0,10) === iso ? iso : false;
}
export function bomLineActive(item, at = bomToday()) {
  const from = bomDate(item.effective), to = bomDate(item.expiry);
  return from !== false && to !== false && (!from || from <= at) && (!to || to > at);
}
export function bomPositive(value, label) {
  const text = String(value ?? '').trim().replace(',', '.');
  if (!/^\d+(?:\.\d+)?$/.test(text) || !Number.isFinite(Number(text)) || Number(text) <= 0)
    throw Object.assign(new Error(`${label} phải là số lớn hơn 0.`), {status:400});
  return text;
}
export function validateBomNumbers(bom) {
  if (!Array.isArray(bom.items) || !bom.items.length) throw Object.assign(new Error('BOM cần ít nhất một dòng thành phần.'), {status:400});
  for (const item of bom.items) {
    if (!item.code) throw Object.assign(new Error('Vui lòng chọn mã cho tất cả dòng BOM.'), {status:400});
    // Historical rows are retained, not reinterpreted during a later change.
    if (bomDate(item.expiry) && bomDate(item.expiry) <= bomToday()) continue;
    bomPositive(item.qty, `Lượng dùng ${item.code}`);
    bomPositive(item.denominator || '1', `Mẫu số ${item.code}`);
    const from=bomDate(item.effective), to=bomDate(item.expiry);
    if (from===false || to===false || from && to && from>=to) throw Object.assign(new Error(`Ngày hiệu lực ${item.code} không hợp lệ.`), {status:400});
  }
}
