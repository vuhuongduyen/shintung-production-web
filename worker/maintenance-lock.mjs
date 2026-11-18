// Temporary maintenance release. No DB/config/credential mutations here.
// Publication is a separate step; do not describe this source as an active lock.
export const maintenanceLocked = true;
export const maintenanceCode = 'ONSPA_MAINTENANCE_LOCKED';
const backupPosts = new Set(['/api/full-backup/start', '/api/full-backup/complete']);
export function maintenanceLock(request, env = {}) {
  // Opening requires an explicit deployment of this same saved source with
  // the maintenance-only setting. Missing/unknown values remain locked.
  if (!maintenanceLocked || env.ONSPA_MAINTENANCE_MODE === 'open') return null;
  const url = new URL(request.url), method = request.method.toUpperCase();
  const read = method === 'GET' || method === 'HEAD';
  // These two existing handlers still verify Admin or a scoped backup device.
  // They may create/clean backup transport, but do not edit business records.
  if (method === 'POST' && backupPosts.has(url.pathname)) return null;
  // Normal password verification/session/audit only. All business writes and
  // setup, password-reset, Line-login and permission endpoints remain locked.
  if (method === 'POST' && url.pathname === '/api/auth/login') return null;
  // Delegate only this exact operator route to its existing Admin, origin,
  // source identity, revision and CAS guards; no production write is exempt.
  if (url.pathname === '/api/main-quantity-activation' && method === 'POST') return null;
  if (read && url.pathname === '/_admin/quantity-activation') return null;
  if (read && url.pathname.startsWith('/api/')) return null;
  const headers = {'Cache-Control':'no-store', 'Retry-After':'120', 'X-Content-Type-Options':'nosniff', 'X-ONSPA-Maintenance':'locked'};
  const message = 'Hệ thống đang bảo trì để chuyển đổi báo công. Tạm ngưng lưu và xác nhận; dữ liệu đã lưu được giữ nguyên. Không nhập lại thao tác chưa rõ kết quả.';
  if (!read || url.pathname.startsWith('/api/')) return Response.json({error:message,code:maintenanceCode,locked:true}, {status:423,headers});
  return new Response(method === 'HEAD' ? null : `<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ONSPA — Đang bảo trì</title><main style="max-width:720px;margin:12vh auto;padding:24px;font:20px/1.6 'Times New Roman',serif;color:#174c30"><h1>ONSPA đang bảo trì</h1><p>${message}</p><p>Vui lòng đóng tab và chờ thông báo mở lại hệ thống.</p></main></html>`, {status:503,headers:{...headers,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"}});
}
