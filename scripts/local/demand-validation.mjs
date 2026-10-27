import {monday,weekEnd} from '../../lib/production-plan.mjs';
import {usableSku} from '../../lib/sku-state.mjs';
export async function validateNewDemand(db,p,catalog=null){
 const fields={};
 if(!p.planningWeekStart || monday(p.planningWeekStart)!==p.planningWeekStart)fields.planningWeekStart='Chọn ngày bắt đầu tuần kế hoạch (thứ Hai). / 請選擇計畫週星期一。';
 else p.planningWeekEnd=weekEnd(p.planningWeekStart);
 const source=await db.prepare("SELECT payload FROM app_records WHERE entity='sku' AND record_key=?").bind(String(p.sku||'')).first();
 const sku=catalog ? catalog.find(r=>r.key===String(p.sku||''))?.payload : source&&JSON.parse(source.payload);
 if(!usableSku(sku))fields.sku='SKU chưa được xác nhận hoặc không còn tồn tại. / 產品尚未確認。';
 if(!Number.isFinite(Number(p.qty))||Number(p.qty)<=0)fields.qty='Số lượng phải lớn hơn 0. / 數量須大於零。';
 const date=s=>{const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(s));if(!m)return null;const iso=`${m[3]}-${m[2]}-${m[1]}`;const d=new Date(iso);return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===iso?iso:null;};
 const start=date(p.requestDate),end=date(p.delivery);if(!start)fields.requestDate='Ngày yêu cầu không hợp lệ. / 需求日期無效。';if(!end||start&&end<start)fields.delivery='Ngày giao không hợp lệ hoặc trước ngày yêu cầu. / 交貨日期無效。';
 if(!['Phát sinh','Bù tải'].includes(p.type))fields.type='Chọn loại nhu cầu hợp lệ. / 需求類型無效。';
 if(!['Gấp','Thường'].includes(p.priority))fields.priority='Chọn mức ưu tiên hợp lệ. / 優先級無效。';
 return {fields,sku};
}
