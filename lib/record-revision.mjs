export async function recordRevision(payload) {
  if (payload === null || payload === undefined) return null;
  const bytes = new TextEncoder().encode(typeof payload === 'string' ? payload : JSON.stringify(payload));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
}

export const conflictMessage = 'Dữ liệu đã được người khác sửa. Nội dung bạn đang nhập được giữ lại; hãy tải bản mới và đối chiếu trước khi lưu lại.';
