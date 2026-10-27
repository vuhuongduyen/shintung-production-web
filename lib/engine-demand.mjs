import {demandMatchesWeek} from './demand-week.mjs';
const key = value => String(value || '').trim().toUpperCase();
export function pendingDemand(row, week) {
 return Boolean(row) && !row._deleted && key(row.status) === 'CHƯA LẬP KẾ HOẠCH' && demandMatchesWeek(row, week);
}
export function engineDemandMatches(payload, events) {
 if (!Array.isArray(payload?.rows) || !Array.isArray(payload?.metrics)) return false;
 const totals = new Map();
 for (const row of events) {
  if (!pendingDemand(row, payload.week)) continue;
  const total = totals.get(key(row.sku)) || {eventQty:0,fillQty:0};
  if (row.type === 'Phát sinh') total.eventQty += Number(row.qty || 0);
  if (row.type === 'Bù tải') total.fillQty += Number(row.qty || 0);
  totals.set(key(row.sku), total);
 }
 const metrics = new Map(payload.metrics);
 const present = new Set(payload.rows.map(row => key(row.sku)));
 if ([...totals.keys()].some(sku => !present.has(sku))) return false;
 return payload.rows.every(row => {
  const actual=metrics.get(row.id), expected=totals.get(key(row.sku)) || {eventQty:0,fillQty:0};
  return actual && ['eventQty','fillQty'].every(k=>Number(actual[k] ?? 0)===expected[k]) && Number(actual.eventWeek ?? 0)===expected.eventQty+expected.fillQty;
 });
}

// Include pending weekly demand even when the monthly forecast has no SKU row.
export function engineInputRows(forecasts, events, month, week) {
 const period = forecasts.filter(f => (f.applicationMonth || f.month) === month);
 const rows = period.filter(f => !period.some(r => r.sourceReportMonth) || f.sourceReportMonth);
 const seen = new Set(rows.map(f => key(f.sku)));
 for (const event of events) {
  const sku = key(event.sku);
  if (!sku || seen.has(sku) || !pendingDemand(event, week)) continue;
  seen.add(sku);
  rows.push({sku, month, applicationMonth:month, used:0, name:'', spec:'', line:''});
 }
 return rows;
}
