/**
 * @typedef {'unauthorized' | 'forbidden' | 'unavailable'} DataStatusFailureKind
 * @typedef {{kind: DataStatusFailureKind, label: string, message: string}} DataStatusFailure
 * @param {unknown} error
 * @returns {DataStatusFailure}
 */
export function dataStatusReadState(error) {
 const status=(typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number') ? error.status : undefined;
 return status===401?{kind:'unauthorized',label:'Cần đăng nhập',message:'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.'}:status===403?{kind:'forbidden',label:'Không có quyền xem dữ liệu quản trị',message:'Không có quyền xem dữ liệu quản trị.'}:{kind:'unavailable',label:'Mất kết nối',message:'Không đọc được dữ liệu tổng hợp; chưa có số liệu xác thực.'};
}
