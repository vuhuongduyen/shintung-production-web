"use client";
import {DataCell} from './onspa-ui/DataCell';
import {eventEmployees} from '../lib/production-event-employees.mjs';
type Row=Record<string,any>;
export default function ProductionEmployeeCount({row,employees,t=(s:string)=>s}:{row:Row;employees:Row[];t?:(s:string)=>string}) {
 const ids=row.employees?.length?row.employees:row.hours?.perEmployee?.map((p:Row)=>p.id)||[];
 const hours=new Map<string,Row>((row.hours?.perEmployee||[]).map((p:Row)=>[String(p.id).toUpperCase(),p]));
 const num=(v:any)=>v==null?'—':Number(v).toLocaleString('vi-VN',{maximumFractionDigits:2});
 const people=eventEmployees({...row,employees:ids},employees);
 const count=row.count??(people.length||null);
 const showHours=Boolean(row.hours||row.kind==='completion');
 return <details className="production-employee-count" name="onspa-employee-lists"><summary aria-label={`${t('Nhân viên')} · ${count??'—'}`}>{count===null?'—':Number(count).toLocaleString('vi-VN')}</summary><div className="production-employee-grid">{row.sourceVerified&&<p>Số người và tổng giờ đã đối chiếu theo Google Sheet. Nguồn không có danh sách giờ từng nhân viên; chưa xác nhận phân bổ cá nhân.</p>}{row.estimatedStaffing&&<p>Số người theo ảnh gốc: {row.sourceCount}. Tên và giờ từng người được phân bổ bổ sung theo lịch và giờ chuẩn/SP.</p>}{!row.sourceVerified&&row.historicalImport&&row.unallocatedHours>0.01&&<p>Chưa phân bổ đủ theo lịch: {num(row.unallocatedHours)} giờ. Tổng giờ gốc vẫn được giữ nguyên.</p>}<table className="production-employee-table" data-no-pagination="true" aria-label={t('Nhân viên')}><thead><tr><th scope="col">{t('Nhân viên')}</th>{showHours&&<><th scope="col">{t('Giờ HC')}</th><th scope="col">{t('Giờ TC')}</th><th scope="col">{t('Tổng giờ công')}</th></>}</tr></thead><tbody>{people.length?people.map((p:Row)=>{const h=hours.get(String(p.id).toUpperCase());return <tr key={p.id}><DataCell><span>{p.name||p.id}</span>{p.name&&<small className="production-subtext">{p.id}</small>}</DataCell>{showHours&&(h?<><DataCell kind="number" className="number">{num(h.hc)}</DataCell><DataCell kind="number" className="number">{num(h.ot)}</DataCell><DataCell kind="number" className="number">{num(h.total)}</DataCell></>:<DataCell colSpan={3}>{t('Chưa có giờ theo nhân viên')}</DataCell>)}</tr>;}):<tr data-no-data="true"><DataCell colSpan={showHours?4:1}>{t('Chưa ghi nhận nhân viên')}</DataCell></tr>}</tbody></table></div></details>;
}
