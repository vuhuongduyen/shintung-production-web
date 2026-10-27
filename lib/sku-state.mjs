export const confirmationStatus = p => p?.cancelled || p?.status==='Đã hủy' ? 'Đã hủy' : p?.confirmation_status || (['Chờ xác nhận','Đã xác nhận'].includes(p?.status)?p.status:'');
export const usageStatus = p => p?.usage_status || (p?.status==='Đang sử dụng'?'Đang sử dụng':p?.status==='Ngừng sử dụng'?'Ngừng sử dụng':'Chưa sử dụng');
export const usableSku = p => !!p && !p.cancelled && !p._deleted && confirmationStatus(p)==='Đã xác nhận' && usageStatus(p)==='Đang sử dụng';
export const skuMatchesStatus = (p,value) => value==='all'||(['Đang sử dụng','Ngừng sử dụng'].includes(value)?usageStatus(p)===value:confirmationStatus(p)===value);
