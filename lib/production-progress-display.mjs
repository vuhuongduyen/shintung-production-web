import {normalized} from './production-plan.mjs';
// Shared progress labels and color keys for KHSX and QLSX.
const states = {
 'CHO XAC NHAN HOAN THANH': ['Chờ xác nhận HT', 'review'],
 'BAO CONG CHO XAC NHAN': ['Báo công chờ xác nhận', 'review'],
 'CHUA SAN XUAT': ['Chưa SX', 'waiting'],
 'DANG SAN XUAT': ['Đang SX', 'running'],
 'DANG TAM NGUNG': ['Đang tạm ngưng', 'paused'],
 'TAM DUNG SU CO': ['Tạm dừng sự cố', 'incident'],
 'HT SOM': ['HT sớm', 'early'],
 'HT DUNG TIEN DO': ['Hoàn thành', 'completed'],
 'HT TRE TIEN DO': ['HT trễ', 'late'],
};
export function productionProgressDisplay(value) {
 const state = states[normalized(value)];
 return state ? {label:state[0],tone:state[1]} : null;
}
