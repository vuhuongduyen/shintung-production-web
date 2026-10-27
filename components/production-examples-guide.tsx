"use client";
import {DataTable} from './onspa-ui/DataTable';
import {DataCell} from './onspa-ui/DataCell';
type Row=Record<string,any>;
const date=(value:string)=>value?.split('-').reverse().join('/')||'—';
export default function ProductionExamplesGuide({examples}:{examples:Row|null}) {
 const order=(line:string,code:string)=>{const o=examples?.orders?.find((r:Row)=>r.id===`TEST-LSX-${line}${code}`);return o?`${o.name||o.purpose} (${o.code})`:`Lệnh mẫu Line ${line} ${code}`;};
 const person=(line:string,code:string)=>examples?.employees?.find((r:Row)=>r.id===`TEST-NV-${line}${code}`)?.name||`Nhân viên ${line} ${code}`;
 return <section className="data-card production-examples-guide" aria-label="Bộ LSX mẫu">
  <h2>Đang dùng LSX mẫu</h2>
  <p>Nhân viên, LSX, giờ công, xác nhận và phiếu nhập kho trong bộ mẫu được lưu riêng. Chọn <b>Dữ liệu thật</b> để quay lại sản xuất thực tế. Giữ chế độ mẫu khi chuyển sang Lịch SX thực tế, Tiến độ sản xuất và Nhật ký báo công.</p>
  {examples&&<><p>Ngày thử D: <b>{date(examples.date)}</b> · D+1: <b>{date(examples.nextDate)}</b>. Dùng tài khoản admin để nhập các mốc quá khứ, theo giờ 24h. Lịch mẫu: HC 08:00–17:00, nghỉ trưa 12:00–13:00; giải lao 10:00–10:10 và 15:00–15:10; TC 17:30–21:00.</p>
   <details><summary>Danh sách LSX mẫu và hướng dẫn kiểm tra</summary>
   <DataTable className="table-wrap"><table className="production-table"><thead><tr><th>LSX</th><th>Tên SP / SKU</th><th>Line</th><th>SL</th><th>Hạn hoàn thành</th><th>Tình huống</th></tr></thead><tbody>{examples.orders.map((o:Row)=><tr key={o.id}><DataCell kind="code">{o.code}</DataCell><DataCell kind="code">{o.name} · {o.sku} · {o.spec}</DataCell><DataCell kind="code">{o.line}</DataCell><DataCell kind="number">{o.quantity}</DataCell><DataCell kind="date">{date(o.planEnd)}</DataCell><DataCell>{o.purpose}</DataCell></tr>)}</tbody></table></DataTable>
   <ol>
    <li><b>Nhập trạm lấy người:</b> {order("A","01")}  có 10 NV từ 08:00 ngày D. Nhập trạm {order("A","02")}  lúc 09:00 ngày D, chọn {person("A","01")}, {person("A","02")}, {person("A","03")}, {person("A","04")}  trong danh sách NV. Kết quả: lệnh {order("A","01")}  còn 6 người; {order("A","02")}  có 4; nhật ký ghi rõ người và hai LSX. Làm tương tự {order("B","01")}  → {order("B","02")}  với NV {person("B","01")}, {person("B","02")}, {person("B","03")}, {person("B","04")} .</li>
    <li><b>Đi trễ:</b> tại Lịch SX thực tế, chọn Line A, ngày D; đăng ký {person("A","01")}  đi trễ từ 08:00, Chưa đến. Cập nhật giờ vào 09:30. Xuất trạm {order("A","01")}  và {order("A","02")}  lúc 11:00 ngày D với 100 SP/lệnh. Giờ HC lần lượt là 20 và 6,83; NV {person("A","01")}  chỉ bị trừ ở lệnh cũ đến 09:00, lệnh mới từ 09:00–09:30. Đăng ký trước hoặc sau nhập trạm đều phải cho cùng giờ cuối.</li>
    <li><b>Số người thực tế:</b> lệnh có 10 người phân công từ 08:00; {person("A","01")} đi trễ đến 10:00. Báo công khoảng 08:00–10:00 ghi 9 người tính giờ; từ 10:00 người này mới bắt đầu được tính. Số có mặt tại giờ xuất là 10, số thực tế của khoảng báo công trước đó là 9. Bấm Xem số người theo từng khoảng giờ để đối chiếu. Thử tình huống này riêng trước khi chuyển người.</li>
    <li><b>Chưa có giờ vào:</b> thử gửi sản lượng khi NV vẫn Chưa đến. Báo công được lưu tạm; xác nhận phải báo tên NV thiếu giờ vào. Khi cập nhật giờ vào, duyệt điều chỉnh giờ nếu hệ thống yêu cầu, rồi xác nhận lại.</li>
    <li><b>Phụ kho/về sớm:</b> Line B, NV {person("B","01")}  phụ kho 09:30–10:00, NV {person("B","05")}  về sớm 10:30–17:00 ngày D. Xuất 100 SP mỗi lệnh {order("B","01")} / {order("B","02")} lúc 11:00. Giờ HC: {order("B","01")} = 20,5; {order("B","02")} = 6,83. Chi tiết ghi tên, loại biến động, khoảng giờ và QLSX cập nhật.</li>
    <li><b>Chặn khoảng trùng:</b> tạo thêm Phụ kho NV {person("B","01")}  từ 09:45–10:15 ngày D. Hệ thống phải từ chối và chỉ rõ nhân viên, khoảng giờ, bản ghi trùng. Không cộng/trừ giờ hai lần.</li>
    <li><b>Tạm ngưng/tiếp tục:</b> {order("A","02")}  tạm ngưng 11:10, tiếp tục 11:30 ngày D. Xuất thêm lúc 11:50. Khoảng 11:10–11:30 không có giờ công; nút Tiếp tục chỉ dùng khi tạm ngưng.</li>
    <li><b>Sản lượng nhiều ngày:</b> dùng {order("B","03")} , nhập trạm 11:10 ngày D với NV {person("B","06")}  lấy từ {order("B","01")} . Xuất 80 SP lúc 11:50 ngày D, 120 SP lúc 11:00 ngày D+1. Chi tiết giữ từng ngày 80/120; ngày hoàn thành lấy D+1; tổng 200, không tính ngày xác nhận thay cho ngày hoàn thành.</li>
    <li><b>Đăng ký nghỉ nhưng vẫn làm:</b> NV {person("B","10")}  có đăng ký nghỉ HC ngày D+1 trong lịch mẫu. Chọn Có mặt thực tế cho ngày đó tại Lịch SX thực tế. NV phải được tính giờ theo LSX đang được phân công; nhật ký giữ cả đăng ký và điều chỉnh.</li>
    <li><b>HT sớm/đúng/trễ:</b> Nhập trạm {order("A","03")}  lúc 11:10 ngày D với NV {person("A","06")} , xuất đủ 200 SP lúc 11:50 ngày D sẽ HT sớm (hạn D+1). {order("B","03")} hoàn tất D+1 sẽ HT đúng hạn. Nhập trạm {order("A","04")}  lúc 11:10 ngày D với NV {person("A","05")} , xuất đủ 200 SP lúc 11:50 sẽ HT trễ (hạn D−1); {order("B","04")}  dùng để thử tương tự. Xác nhận lệnh trễ khi thiếu Lý do trễ phải bị chặn; điền một ô lý do rồi xác nhận được.</li>
    <li><b>Nhật ký và tải lại:</b> xem cả Báo công và Thời gian &amp; nhân lực. Phải có tên NV, thời điểm thực hiện/ghi nhận, chuyển người, tạm ngưng, tiếp tục và điều chỉnh trước/sau. Tải lại trang giữ dữ liệu thử; nút LSX mẫu mở lại bộ hiện có, không tạo trùng.</li>
   </ol></details></>}
 </section>;
}
