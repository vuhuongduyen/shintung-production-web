const norm = value => String(value || '').normalize('NFC').toLowerCase().replace(/\s+/g,' ').trim();
/** @param {string|null} menu */
export function canBomAction(actor, action, editing = false, menu = null) {
  if (!actor?.login) return false;
  if (actor.isAdmin || ['ADMIN','SUPER_ADMIN','site-owner','local-owner'].includes(actor.role)) return true;
  const allowed = action==='save' ? [editing?'sửa':'thêm'] : action==='confirm' ? ['xác nhận'] : action==='undo' ? ['hủy xác nhận'] : ['hủy','sửa'];
  return (actor.grants || []).some(grant => {
    const parts=norm(grant).split('/').map(x=>x.trim());
    return parts.some(x=>x==='cấu trúc thành phẩm') && (!menu||parts.includes(norm(menu))) && allowed.includes(parts.at(-1));
  });
}
