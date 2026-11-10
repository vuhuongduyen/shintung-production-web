"use client";
export default function LaborRateWarning({items}:{items:{id:string;sku?:string;date?:string}[]}){
 if(!items.length)return null;
 return <details className="production-inline-message"><summary>Chưa xác định được Giờ công/SP cho {items.length} dòng</summary><p>Mở Chi tiết phiếu để kiểm tra SKU, ngày sản lượng và căn cứ đã lưu. Sau đó mở menu Giờ công, tìm đúng SKU và xem Lịch sử: đối chiếu ngày hiệu lực; nếu không có, dùng ngày cập nhật của từng mức. Không dùng mức sau ngày phiếu để lấp chỗ thiếu. Nếu dữ liệu không tải được, tải lại màn hình; nếu vẫn lỗi, gửi mã phiếu và thông báo lỗi cho người quản trị. Chỉ sửa nguồn khi đã xác minh đúng; phiếu đã chốt cần người có quyền kiểm tra, không tự ghi đè căn cứ cũ.</p><ul>{items.map((r,i)=><li key={`${r.id}-${i}`}>{r.id||'Chưa có mã phiếu'} · SKU {r.sku||'chưa đọc được'} · Ngày {r.date||'chưa đọc được'}</li>)}</ul></details>;
}
