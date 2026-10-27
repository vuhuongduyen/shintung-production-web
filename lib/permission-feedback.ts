/** Client feedback only. This never replaces server authorization. */
export function permissionDeniedMessage(locale: string = 'vi') {
  return locale === 'en' ? 'You do not have permission to perform this action.'
    : locale === 'zh' ? '您沒有執行此操作的權限。'
    : 'Bạn không có quyền thực hiện thao tác này.';
}
export function blockDeniedAction(allowed: boolean, event: {preventDefault?: () => void; stopPropagation?: () => void} | undefined, notify: () => void): boolean {
  if (allowed) return false;
  event?.preventDefault?.();
  event?.stopPropagation?.();
  notify();
  return true;
}
/** Export/download actions only; production “Xuất trạm” and ordinary file reads are excluded. */
export function isDataExportAction(label: string): boolean {
  // This existing button uploads inventory, despite using the word “Tải”.
  if (/↑|\bupload\b|(?:^|\s)nhập\s|tải\s+excel\s+tồn\s+kho/i.test(label)) return false;
  return /(?:xuất|tải|export|download)\s*(?:file\s*)?(?:excel|pdf|dữ liệu|data)|(?:匯出|下載)\s*(?:excel|pdf|資料)/i.test(label);
}
export function hasExactExportGrant(session: {kind?: string; isAdmin?: boolean; grants?: string[]} | null | undefined, menu: string | undefined): boolean {
  if(session?.kind !== 'account')return false;
  if(session.isAdmin)return true;
  if(!menu)return false;
  const normalize=(value:string)=>value.toLocaleLowerCase('vi').replaceAll('_',' ').replace(/\s+/g,' ').trim();
  const key=normalize(`${menu} / Xuất dữ liệu`);
  return (session.grants||[]).some(grant=>normalize(grant)===key);
}
