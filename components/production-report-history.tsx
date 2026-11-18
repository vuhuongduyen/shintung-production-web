"use client";
import {isDailyOutput} from '../lib/production-report-model.mjs';
import {FeedbackActionButton} from './action-feedback';
import {DataTable} from './onspa-ui/DataTable';
import {DataCell} from './onspa-ui/DataCell';
import {productionDisplayTime} from "../lib/production-display-time.mjs";
import ProductionEmployeeCount from './production-employee-count';
import ProductionStaffing from "./production-staffing";
import {hasFinishedOutput} from '../lib/production-output-summary.mjs';
import {useState} from 'react';
type Row=Record<string,any>;
const n=(v:any)=>Number(v||0).toLocaleString('vi-VN',{maximumFractionDigits:2});
const t=productionDisplayTime;
const date=(r:Row)=>r.productionDate||new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh'}).format(new Date(r.completedAt));
export function ProductionDailySummary({reports,open}:{reports:Row[];open:(r:Row)=>void}) {
 const legacyHours=reports.some(r=>!isDailyOutput(r));
 const outputReports=reports.filter(hasFinishedOutput),days=[...new Set(outputReports.map(date))].sort();let cumulative=0;
 if(!days.length)return null;
 return <><h3>Sản lượng theo ngày</h3><DataTable className="table-wrap"><table className="production-table"><thead><tr><th>Ngày sản lượng</th><th>Đã duyệt</th><th>Chờ duyệt</th><th>Lũy kế đã duyệt</th>{legacyHours&&<th>Giờ HC / TC</th>}<th>Chi tiết</th></tr></thead><tbody>{days.map(day=>{const rows=outputReports.filter(r=>date(r)===day),approved=rows.filter(r=>r.reviewStatus==='Đã xác nhận');const qty=approved.reduce((s,r)=>s+Number(r.approvedQuantity??r.reportedQuantity),0);cumulative+=qty;
 // Hours follow their civil working date, independently of the quantity date.
 const allHours=reports.filter(r=>r.reviewStatus==='Đã xác nhận');const hc=allHours.reduce((s,r)=>s+Number(r.hours?.perDay?(r.hours.perDay.find((p:Row)=>p.date===day)?.hc||0):(date(r)===day?r.hours?.hc||0:0)),0),ot=allHours.reduce((s,r)=>s+Number(r.hours?.perDay?(r.hours.perDay.find((p:Row)=>p.date===day)?.ot||0):(date(r)===day?r.hours?.ot||0:0)),0);
 return <tr key={day}><DataCell>{day.split('-').reverse().join('/')}</DataCell><DataCell kind="number">{n(qty)}</DataCell><DataCell kind="number">{n(rows.filter(r=>r.reviewStatus==='Chờ kiểm tra').reduce((s,r)=>s+Number(r.reportedQuantity),0))}</DataCell><DataCell kind="number">{n(cumulative)}</DataCell>{legacyHours&&<DataCell kind="number">{n(hc)} / {n(ot)}</DataCell>}<DataCell>{rows.map((r,i)=><FeedbackActionButton key={r.id} onClick={()=>open(r)}>Lần {i+1}</FeedbackActionButton>)}</DataCell></tr>;})}</tbody></table></DataTable></>;
}
export default function ProductionReportHistory({reports,employees,open}:{reports:Row[];employees:Row[];open:(r:Row)=>void}) {
 const [tab,setTab]=useState<'report'|'day'>('report');const sorted=reports.slice().sort((a,b)=>String(a.completedAt).localeCompare(String(b.completedAt)));const cumulative=new Map<string,number>();
 return <section className="data-card"><div className="actual-tabs"><FeedbackActionButton className={tab==='report'?'selected':''} onClick={()=>setTab('report')}>Từng lần báo công</FeedbackActionButton><FeedbackActionButton className={tab==='day'?'selected':''} onClick={()=>setTab('day')}>Sản lượng theo ngày</FeedbackActionButton></div>{tab==='day'?<>{[...new Set(reports.filter(hasFinishedOutput).map(r=>r.transitId))].map(id=><section key={id}><h3>{reports.find(r=>r.transitId===id)?.lsxCode}</h3><ProductionDailySummary reports={reports.filter(r=>r.transitId===id)} open={open}/></section>)}</>:<DataTable className="table-wrap production-table-wrap"><table className="production-table"><thead><tr>{['Ngày sản lượng','LSX','Sản lượng','Lũy kế đã duyệt','Bắt đầu','Kết thúc','Ghi nhận','Số người','Người thực tế lần báo công','Giờ HC / TC','Trạng thái','Người thao tác (ID)','Chi tiết'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{sorted.map(r=>{const qty=(cumulative.get(r.transitId)||0)+(r.reviewStatus==='Đã xác nhận'?Number(r.approvedQuantity??r.reportedQuantity):0);cumulative.set(r.transitId,qty);const ids=[...new Set<string>(r.sourceSnapshot?.attendance?.filter((e:Row)=>e.sourceId===r.transitId||e.destinationId===r.transitId).flatMap((e:Row)=>e.employees||[])||r.hours?.perEmployee?.map((p:Row)=>p.id)||[])];return <tr key={r.id}><DataCell>{date(r).split('-').reverse().join('/')}</DataCell><DataCell kind="code">{r.lsxCode}</DataCell><DataCell kind="number">{n(r.reportedQuantity)}</DataCell><DataCell kind="number">{n(qty)}</DataCell><DataCell>{t(r.startedAt)}</DataCell><DataCell>{t(r.completedAt)}</DataCell><DataCell>{t(r.reportedAt)}</DataCell><DataCell>{<ProductionEmployeeCount row={{...r,employees:ids}} employees={employees}/>}</DataCell><DataCell><details name="onspa-report-staffing"><summary>Xem số người thực tế</summary><ProductionStaffing hours={r.hours} employees={employees}/></details></DataCell><DataCell kind="number">{n(r.hours?.hc)} / {n(r.hours?.ot)}</DataCell><DataCell>{r.reviewStatus}</DataCell><DataCell>{r.actorId||r.reportedById||r.reportedBy||'Chưa ghi nhận'}</DataCell><DataCell><FeedbackActionButton onClick={()=>open(r)}>Chi tiết</FeedbackActionButton></DataCell></tr>;})}{!sorted.length&&<tr data-no-data="true"><DataCell colSpan={13}>Chưa có báo công.</DataCell></tr>}</tbody></table></DataTable>}</section>;
}
