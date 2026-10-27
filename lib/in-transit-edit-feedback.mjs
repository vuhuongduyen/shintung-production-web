/** Pure state diagnosis; never changes authorization or permits a mutation. */
export function inTransitEditBlockReason(count, syncStatus, busy, locale = 'vi') {
  const choose = (vi, zh, en) => locale === 'zh' ? zh : locale === 'en' ? en : vi;
  if (busy) return choose('Đang xử lý. Vui lòng chờ hoàn tất rồi thử lại.', '正在處理，請稍候再試。', 'Processing. Wait until it finishes, then try again.');
  if (!count) return choose('Chưa chọn dòng nào. Chọn 1 dòng đã đồng bộ để chỉnh sửa.', '尚未選取資料。請選取 1 筆已同步資料後編輯。', 'No row selected. Select 1 synced row to edit.');
  if (count !== 1) return choose(`Đang chọn ${count} dòng. Chỉ chọn 1 dòng để chỉnh sửa.`, `已選取 ${count} 筆。請只選取 1 筆資料後編輯。`, `${count} rows selected. Select only 1 row to edit.`);
  if (syncStatus === 'CHƯA ĐỒNG BỘ') return choose('Dòng này chưa đồng bộ. Nhập thông tin LSX trực tiếp trên bảng và đồng bộ trước khi chỉnh sửa.', '此資料尚未同步。請先在表格輸入工單資訊並同步，再進行編輯。', 'This row is not synced. Enter the production order details in the table and sync before editing.');
  return '';
}
