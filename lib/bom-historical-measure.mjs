import {bomDate,bomLineActive} from './bom-rules.mjs';
const text=value=>String(value??'').trim();
// Read-only projection of the original quantity's measure. The change-line
// denominator/waste may describe the replacement; today's SKU unit is not proof.
export function bomHistoricalMeasure(record,sku,line){
 const source=record?.sourceSnapshots?.[sku],date=bomDate(record?.effective),quantity=text(line.oldQty);
 const missing={unit:'—',denominator:'—',waste:'—',historyNote:'Thiếu hoặc mơ hồ bản BOM trước thay đổi; chưa xác định đơn vị, mẫu số và hao hụt lịch sử.'};
 if(!quantity||!Array.isArray(source?.items))return missing;
 const candidates=source.items.filter(item=>text(item.code)===text(line.code)&&text(item.qty)===quantity&&(!date||bomLineActive(item,date)));
 if(candidates.length!==1)return missing;
 const previous=candidates[0];
 const note=text(previous.unit)?'Đơn vị, mẫu số và hao hụt theo bản BOM trước thay đổi.':'Thiếu đơn vị trong bản BOM trước thay đổi; không lấy danh mục hiện tại thay thế.';
 return {unit:text(previous.unit)?String(previous.unit):'—',denominator:text(previous.denominator)?String(previous.denominator):'1',waste:text(previous.waste)?String(previous.waste):'—',historyNote:note+(!date?' Chưa có ngày hết hiệu lực được chứng minh.':'')};
}
