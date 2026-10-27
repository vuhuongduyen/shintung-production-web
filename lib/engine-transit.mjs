// Engine uses the same remaining work-order quantity shown by In Transit.
export function engineTransitBySku(rows) {
  const totals = new Map();
  for (const row of rows) {
    const sku = String(row.sku || "").trim().toUpperCase();
    if (!sku) continue;
    if (!totals.has(sku)) totals.set(sku, 0);
    if (row.confirmedEmpty === true || row.status === "HỦY") continue;
    // An order without an opened LSX has no quantity in transit yet.
    if (row.status === "CHƯA MỞ LSX" && row.inTransitQty == null) continue;
    const qty = row.inTransitQty;
    if (qty == null || qty === "" || !Number.isFinite(Number(qty)) || Number(qty) < 0)
      throw new Error("In Transit thiếu SL đang đi hợp lệ cho SKU " + sku);
    totals.set(sku, (totals.get(sku) || 0) + Number(qty));
  }
  return totals;
}
