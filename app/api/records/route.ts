import { env } from "cloudflare:workers";

const allowed = new Set([
  "users", "permissions", "versions", "sku", "sku_history", "leadtime", "leadtime_versions", "leadtime_audit", "safety_days", "safety_rules", "safety_rule_groups", "safety_rule_audit", "production_engine_snapshot",
  "inventory", "warehouse_in", "warehouse_out", "warehouse_transfer", "warehouse_docs", "warehouse_count",
  "inventory_snapshot", "inventory_snapshot_audit",
  "bom", "bom_change", "forecast", "demand_event", "production_engine", "production_plan", "in_transit",
  "production_report", "labor_adjustment", "capacity",
]);

export async function GET(request: Request) {
  const entity = new URL(request.url).searchParams.get("entity") || "";
  if (!allowed.has(entity)) return Response.json({ error: "Hạng mục không hợp lệ" }, { status: 400 });
  try {
    const result = await env.DB.prepare("SELECT record_key, payload, updated_by, updated_at FROM app_records WHERE entity = ? ORDER BY updated_at DESC").bind(entity).all();
    return Response.json({ records: result.results.map((row: any) => ({ key: row.record_key, payload: JSON.parse(row.payload), updatedBy: row.updated_by, updatedAt: row.updated_at })) });
  } catch (error) {
    console.error("load records", error);
    return Response.json({ error: "Không thể tải dữ liệu dùng chung" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { entity?: string; key?: string; payload?: unknown; updatedBy?: string };
    if (!body.entity || !allowed.has(body.entity) || !body.key || body.payload === undefined) return Response.json({ error: "Dữ liệu cập nhật không hợp lệ" }, { status: 400 });
    if (["leadtime_versions", "leadtime_audit", "safety_rules", "safety_rule_groups", "safety_rule_audit"].includes(body.entity) && !["admin", "vthduyen", "Vũ Hương Duyên", "Người dùng web"].includes(body.updatedBy || "")) {
      return Response.json({ error: "Bạn không có quyền thay đổi Quy tắc Safety Days" }, { status: 403 });
    }
    const now = new Date().toISOString();
    await env.DB.prepare("INSERT INTO app_records (entity, record_key, payload, updated_by, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(entity, record_key) DO UPDATE SET payload = excluded.payload, updated_by = excluded.updated_by, updated_at = excluded.updated_at").bind(body.entity, body.key, JSON.stringify(body.payload), body.updatedBy || "vthduyen", now).run();
    return Response.json({ ok: true, updatedAt: now });
  } catch (error) {
    console.error("save record", error);
    return Response.json({ error: "Không thể lưu dữ liệu. Vui lòng thử lại." }, { status: 503 });
  }
}
