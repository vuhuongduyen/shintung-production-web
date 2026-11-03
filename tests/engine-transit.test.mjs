import test from "node:test";
import assert from "node:assert/strict";
import { engineTransitBySku } from "../lib/engine-transit.mjs";
import { mergeProduction, normalizeTransit } from "../lib/in-transit.mjs";

test("Engine totals match In Transit after partial and full completion", () => {
  const partiallyCompleted = mergeProduction(normalizeTransit({
    id: "order-1", sku: "SKU-A", lsxCode: "LSX-A", lsxQty: 2000,
    lsxOpenedAt: "2026-09-18", planQty: 2000, remaining: 2000,
  }), [{ kind: "completion", lsxCode: "LSX-A", reportedQuantity: 1000,
    approvedQuantity: 1000, reviewStatus: "Đã xác nhận" }]);
  assert.equal(partiallyCompleted.inTransitQty, 1000);
  const totals = engineTransitBySku([
    partiallyCompleted,
    normalizeTransit({ sku: "sku-a", lsxCode: "LSX-B", lsxQty: 500, completedQty: 100 }),
    normalizeTransit({ sku: "SKU-B", lsxCode: "LSX-C", lsxQty: 2000, completedQty: 2000 }),
    normalizeTransit({ sku: "SKU-C", planQty: 2000 }),
    normalizeTransit({ sku: "SKU-D", lsxCode: "LSX-D", lsxQty: 500, cancelReason: "Hủy" }),
  ]);
  assert.equal(totals.get("SKU-A"), 1400);
  assert.equal(totals.get("SKU-B"), 0);
  assert.equal(totals.get("SKU-C"), 0);
  assert.equal(totals.get("SKU-D"), 0);
});

test("Engine rejects missing transit quantity on opened orders", () => {
  assert.throws(() => engineTransitBySku([{ sku: "SKU-A", status: "ĐÃ MỞ LSX", remaining: 2000 }]), /SL đang đi/);
});
