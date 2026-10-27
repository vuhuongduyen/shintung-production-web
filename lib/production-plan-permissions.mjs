const normalize = value => String(value || '').normalize('NFC').toLowerCase().replaceAll('_', ' ').replace(/\s+/g, ' ').trim();
const actions = {
    save: ['sửa'],
    close: ['xác nhận'],
    reopen: ['hủy xác nhận', 'mở lại'],
};

// Match the whole menu and final action, so Hủy xác nhận cannot grant Xác nhận.
// Mở lại is the existing legacy alias for reopening a Production Plan.
export function canPlanAction(actor, action) {
    if (!actor?.login || actor.authMode === 'quick_line' || !Object.hasOwn(actions, action)) return false;
    if (actor.isAdmin) return true;
    return (actor.grants || []).some(grant => {
        const parts = normalize(grant).split('/').map(part => part.trim());
        return parts.length === 3 && parts[0] === 'kế hoạch sản xuất' && parts[1] === 'production plan' && actions[action].includes(parts[2]);
    });
}
