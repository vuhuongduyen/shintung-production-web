'use client';
import {DataTable} from './onspa-ui/DataTable';
import {DataCell} from './onspa-ui/DataCell';
import {FeedbackActionButton} from './action-feedback';
import {productionDisplayTime} from '../lib/production-display-time.mjs';
import {productionEntryActorId,productionReviewResult} from '../lib/production-actor.mjs';
import {isDailyOutput} from '../lib/production-report-model.mjs';
type Row=Record<string,any>;
/** Read-only order history: deliberately has no approval callback or selection state. */
export default function ProductionReportHistory({reports,open,t}:{reports:Row[];open:(row:Row)=>void;t:(s:string)=>string}){
 const rows=[...reports].sort((a,b)=>String(a.productionAt||a.completedAt||'').localeCompare(String(b.productionAt||b.completedAt||'')));
 return <div className="production-report-history"><DataTable className="table-wrap"><table><thead><tr>{['Ngày hoàn thành','Công đoạn','SL thành phẩm','Người báo (ID)','Trạng thái','Người xử lý','Lúc xử lý','Chi tiết'].map(label=><th key={label}>{t(label)}</th>)}</tr></thead><tbody>{rows.map(r=>{const review=productionReviewResult(r);return <tr key={r.id}><DataCell kind="date">{productionDisplayTime(r.productionAt||r.completedAt,'—')}</DataCell><DataCell>{isDailyOutput(r)?t('Báo sản lượng'):r.stageName||r.stageCode||'—'}</DataCell><DataCell kind="number">{Number(r.reportedQuantity||0).toLocaleString('vi-VN')}</DataCell><DataCell>{productionEntryActorId(r)||'—'}</DataCell><DataCell>{t(r.reviewStatus||'Chờ kiểm tra')}</DataCell><DataCell>{review.actorId||'—'}</DataCell><DataCell kind="date">{productionDisplayTime(review.at,'—')}</DataCell><DataCell><FeedbackActionButton onClick={()=>open(r)}>{t('Xem báo công')}</FeedbackActionButton></DataCell></tr>;})}{!rows.length&&<tr><DataCell colSpan={8}>{t('Chưa có báo công')}</DataCell></tr>}</tbody></table></DataTable></div>;
}
