import {usableSku} from './sku-state.mjs';
import {isMasterCancelled} from './basic-master.mjs';
import {effectiveValueOn,validBusinessDate} from './effective-dated-value.mjs';

export function parseLaborHoursText(text) {
  const seen=new Set();
  return String(text).trim().split(/\r?\n/).filter(line=>line.trim()).map((line,index)=>{
    const parts=line.trim().split(/[\t; ]+/);
    const sku=parts[0]?.toUpperCase();
    if(parts.length!==2||!sku||!/^\d+(?:[.,]\d+)?$/.test(parts[1]))throw Error(`Dòng ${index+1}: cần mã SKU và giờ công không âm.`);
    if(seen.has(sku))throw Error(`SKU ${sku} bị lặp. Vui lòng kiểm tra nguồn.`);
    seen.add(sku);
    const laborHour=Number(parts[1].replace(',','.'));
    if(!Number.isFinite(laborHour))throw Error(`Giờ công ${sku} không hợp lệ.`);
    return {sku,laborHour};
  });
}

export function reconcileLaborHours(incoming,masters,records,effectiveFrom) {
  const catalog=new Map(masters.map(row=>[row.code.toUpperCase(),row]));
  const current=new Map(records.map(row=>[row.sku.toUpperCase(),row]));
  const sourceCodes=new Set(incoming.map(row=>row.sku));
  const rows=incoming.map(row=>{
    const master=catalog.get(row.sku),old=current.get(row.sku);
    const dated=effectiveFrom!==undefined,resolved=dated?effectiveValueOn(old?.resolvedRateVersions||old?.effectiveVersions||[],effectiveFrom):null;
    const previousLaborHour=dated?(resolved.ok?resolved.basis.value:null):old?.laborHour;
    const invalidHistory=dated&&!resolved.ok&&['ambiguous','invalid-version'].includes(resolved.reason);
    const status=!master?'Không có trong SKU Master':!usableSku(master)?'SKU chưa đủ điều kiện':isMasterCancelled(old)?'Giờ công đã hủy':dated&&!validBusinessDate(effectiveFrom)?'Chưa chọn ngày hiệu lực':invalidHistory?'Lịch sử hiệu lực cần đối chiếu':old&&previousLaborHour!=null&&Number(previousLaborHour)===row.laborHour?'Không đổi':old?'Cập nhật':'Bổ sung giờ công';
    const guidance=status==='Không có trong SKU Master'?'Thêm mã này vào SKU Master và xác nhận, sau đó tải lại PDF để cập nhật giờ công.':status==='SKU chưa đủ điều kiện'?'Kiểm tra và xác nhận SKU Master; mã phải đang sử dụng.':status==='Giờ công đã hủy'?'Kiểm tra lịch sử và xử lý trạng thái hủy trước khi cập nhật.':status==='Chưa chọn ngày hiệu lực'?'Chọn ngày hiệu lực có căn cứ để đối chiếu PDF.':invalidHistory?'Đối chiếu các phiên bản chồng lấn hoặc không hợp lệ trước khi lưu.':'';
    return {...row,old,previousLaborHour,status,guidance,change:status==='Cập nhật'||status==='Bổ sung giờ công'};
  });
  return {rows,changes:rows.filter(row=>row.change),unchanged:rows.filter(row=>row.status==='Không đổi').length,skipped:rows.filter(row=>!row.change&&row.status!=='Không đổi').length,retained:records.filter(row=>!sourceCodes.has(row.sku.toUpperCase())).length};
}
