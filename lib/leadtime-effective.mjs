import {validLeadtimeTiers} from './leadtime-tiers.mjs';
// Date-only business boundaries are midnight in Vietnam; timestamp boundaries keep their offset.
export function effectiveInstant(value) {
 if (typeof value !== 'string' || !value) return NaN;
 const date = value.slice(0, 10);
 if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NaN;
 const day = Date.parse(date + 'T00:00:00Z');
 if (!Number.isFinite(day) || new Date(day).toISOString().slice(0, 10) !== date) return NaN;
 if (value.length === 10) return Date.parse(value + 'T00:00:00+07:00');
 if (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return NaN;
 return Date.parse(value);
}
const skuKey = value => String(value || '').trim().toUpperCase();
const published = row => row.status === 'Đang áp dụng' ||
 (row.status === 'Hết hiệu lực' && Number.isFinite(effectiveInstant(row.confirmedAt)));
export function resolveLeadtimeVersion(versions, sku, at) {
 const instant = effectiveInstant(at);
 const history = versions.filter(row => skuKey(row.sku) === skuKey(sku) &&
  (published(row) || ['Đã hủy', 'Hủy', 'Đã hủy xác nhận'].includes(row.status) || row.confirmedAt));
 const active = history.filter(row => !row._deleted && !row.cancelled && published(row) &&
  Number.isFinite(effectiveInstant(row.validFrom)) && effectiveInstant(row.validFrom) <= instant &&
  (!row.validTo || (Number.isFinite(effectiveInstant(row.validTo)) && instant < effectiveInstant(row.validTo))));
 const selected=active.length===1?active[0]:undefined;
 return {hasHistory:history.length>0,selected:selected?.tiers!==undefined?(validLeadtimeTiers(selected.tiers)?{...selected,leadTime:Math.max(...selected.tiers.map(t=>t.value))}:undefined):selected};
}
