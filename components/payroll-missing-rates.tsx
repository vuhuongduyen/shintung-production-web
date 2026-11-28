import {payrollMissingRates} from '../lib/payroll-missing-rates.mjs';
import {DataTable} from './onspa-ui/DataTable';
const labels={
 vi:['Căn cứ giờ công cần kiểm tra','Mã SP','Tên sản phẩm','LSX','Ngày sản xuất','Nguyên nhân / Cách xử lý','Không có căn cứ giờ công chuẩn/SP hợp lệ tại ngày sản xuất. Vào Dữ liệu cơ bản → Giờ công, đối chiếu lịch sử và chọn ngày hiệu lực khi thêm hoặc sửa mức.','Thiếu căn cứ của một Line sẽ chặn phân bổ quỹ chung A+B. Phiếu đã lưu căn cứ giữ nguyên; không tự lấy định mức hiện tại thay thế.'],
 zh:['需核對的標準工時依據','產品編號','產品名稱','製令','生產日期','原因／處理方式','生產日期缺少有效的每件標準工時依據。請至基本資料 → 工時，核對歷史並在新增或修改時選擇生效日期。','任一產線缺少依據會阻止 A+B 共同獎金分配。已保存的單據依據保持不變，不自動改用現行定額。'],
 en:['Labor rate evidence to check','SKU','Product','Work order','Production date','Cause / Action','No valid standard hours per unit for the production date. Open Basic data → Labor hours, review history and choose the effective date when adding or editing a rate.','Missing evidence in either Line blocks the shared A+B fund allocation. Saved report evidence remains unchanged; current rates are not substituted.']
};
export default function PayrollMissingRates({overviews,locale}:{overviews:Record<string,any>[];locale:string}){
 const rows=payrollMissingRates(overviews);if(!rows.length)return null;
 const l=labels[locale as keyof typeof labels]||labels.vi;
 return <section aria-label={l[0]}><h3>{l[0]}</h3><p>{l[7]}</p><DataTable className="table-wrap"><table><thead><tr>{['Line',...l.slice(1,6)].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{rows.map((r:Record<string,string>)=><tr key={`${r.line}:${r.orderCode}:${r.date}`}><td>{r.line}</td><td>{r.sku||'—'}</td><td>{r.name||'—'}</td><td>{r.orderCode}</td><td>{r.date?r.date.split('-').reverse().join('/'):'—'}</td><td>{l[6]}</td></tr>)}</tbody></table></DataTable></section>;
}
