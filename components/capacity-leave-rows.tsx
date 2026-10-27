'use client';
import {FeedbackActionButton} from './action-feedback';
import {DataTable} from './onspa-ui/DataTable';
import {DataCell} from './onspa-ui/DataCell';
import {useEffect,useRef} from 'react';
import {blankCountedLeave,isBlankCountedLeave,calculateCapacity,withCountedLeaves} from '../lib/capacity.mjs';
import {weekEnd} from '../lib/production-plan.mjs';
type Row=Record<string,any>;
type Props={kind:'hc'|'ot';week:string;input:Row;disabled:boolean;onChange:(rows:Row[])=>void;t:(vi:string,zh:string,en:string)=>string};
export default function CapacityLeaveRows({kind,week,input,disabled,onChange,t}:Props){
 const rows:Row[]=input[kind+'LeaveRows']||[];
 const visible:Row[]=rows.length?rows:[blankCountedLeave()];
 const focus=useRef<number|null>(null),cells=useRef(new Map<number,HTMLInputElement>());
 useEffect(()=>{if(focus.current!==null){cells.current.get(focus.current)?.focus();focus.current=null;}},[rows]);
 const edit=(i:number,key:string,value:any)=>{const next=visible.map((r,j)=>j===i?{...r,id:r.id||crypto.randomUUID(),[key]:value,...(key==='from'&&(!r.to||r.to===r.from)?{to:value}:{})}:r);onChange(next);};
 const down=(i:number)=>{
  if(disabled)return;
  if(i<visible.length-1){cells.current.get(i+1)?.focus();return;}
  if(isBlankCountedLeave(visible[i])){cells.current.get(i)?.focus();return;}
  focus.current=i+1;onChange([...visible,{...blankCountedLeave(),id:crypto.randomUUID()}]);
 };
 const titles=[t('Số người nghỉ','請假人數','People absent'),t('Từ ngày','開始日期','From date'),t('Đến ngày','結束日期','To date'),t('Hình thức nghỉ','請假方式','Leave type'),t('Từ giờ','開始時間','From time'),t('Đến giờ','結束時間','To time'),...(kind==='ot'?[t('Số giờ/người','時數／人','Hours/person')]:[]),t('Giờ ảnh hưởng','影響人時','Affected hours'),t('Ghi chú','備註','Note'),t('Thao tác','操作','Actions')];
 return <>
  <p>{t('Nhấn phím ↓ trong ô nhập ở dòng cuối để thêm dòng; cũng có thể bấm nút ↓. Mỗi dòng ghi một nhóm người có cùng lịch nghỉ. Trong cùng ngày, không ghi lại cùng người vào nhiều dòng.','最後一列輸入欄按 ↓ 或按 ↓ 按鈕新增。每列為相同請假時段的一組人，同一天勿重複計入同一人。','Press ↓ in an input on the last row, or use the ↓ button, to add a row. Each row represents a group with the same leave schedule; do not count the same person in multiple rows on one day.')}</p>
  <DataTable className="table-wrap cap-leave-table"><table data-no-pagination="true"><thead><tr>{titles.map(title=><th key={title}>{title}</th>)}</tr></thead><tbody>
  {visible.map((row,i)=>{
   let hours:number|null=null;try{if(!isBlankCountedLeave(row)){const calculated=calculateCapacity(withCountedLeaves(input,kind,[row]),week);hours=kind==='hc'?calculated.hcLeaveHours:calculated.otLeaveHours;}}catch{}
   const field=(key:string,type='text')=><input aria-label={`${titles[0]} ${i+1} ${key}`} type={type} disabled={disabled} min={type==='date'?week:type==='number'?'0':undefined} max={type==='date'?weekEnd(week):undefined} step={type==='number'?'any':undefined} value={row[key]??''} onChange={e=>edit(i,key,type==='number'?(e.target.value===''?'':Number(e.target.value)):e.target.value)}/>;
   return <tr key={i} onKeyDown={e=>{if(e.key==='ArrowDown'&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&!e.repeat&&e.target instanceof HTMLInputElement){e.preventDefault();down(i);}}}>
    <DataCell><input aria-label={`${t('Số người nghỉ','請假人數','People absent')} ${i+1}`} ref={element=>{if(element)cells.current.set(i,element);else cells.current.delete(i);}} type="number" min="1" step="1" value={row.people} disabled={disabled} onChange={e=>edit(i,'people',e.target.value===''?'':Number(e.target.value))}/></DataCell>
    <DataCell>{field('from','date')}</DataCell><DataCell>{field('to','date')}</DataCell>
    <DataCell><select aria-label={`${t('Hình thức nghỉ','請假方式','Leave type')} ${i+1}`} value={row.mode} disabled={disabled} onChange={e=>edit(i,'mode',e.target.value)}>
     <option value="full">{kind==='hc'?t('Cả ngày','整天','Full day'):t('Toàn bộ tăng ca','全部加班','Entire overtime')}</option>
     <option value={kind==='hc'?'hours':'interval'}>{t('Theo khoảng giờ','依時段','Time interval')}</option>
     {kind==='ot'&&<><option value="absent">{t('Số giờ nghỉ/người','請假時數／人','Absent hours/person')}</option><option value="attended">{t('Số giờ tham gia/người','參與時數／人','Attended hours/person')}</option></>}
    </select></DataCell>
    <DataCell>{['hours','interval'].includes(row.mode)?field('start','time'):'—'}</DataCell><DataCell>{['hours','interval'].includes(row.mode)?field('end','time'):'—'}</DataCell>
    {kind==='ot'&&<DataCell>{['absent','attended'].includes(row.mode)?<>{row.mode==='attended'?t('Giờ tham gia','參與時數','Attended'):t('Giờ nghỉ','請假時數','Absent')}{field('hours','number')}</>:'—'}</DataCell>}
    <DataCell kind="number">{hours===null?'—':hours.toLocaleString('vi-VN',{minimumFractionDigits:2,maximumFractionDigits:2})}</DataCell><DataCell>{field('note')}</DataCell>
    <DataCell><FeedbackActionButton type="button" disabled={disabled} disabledExplanation={"Lịch đang khóa hoặc bạn chưa có quyền chỉnh sửa. Kiểm tra trạng thái xác nhận và quyền được cấp."} aria-label={`${t('Xuống dòng','下一列','Next row')} ${i+1}`} onClick={()=>down(i)}>↓</FeedbackActionButton><FeedbackActionButton type="button" disabled={disabled||isBlankCountedLeave(row)} disabledExplanation={disabled ? "Lịch đang khóa hoặc bạn chưa có quyền chỉnh sửa. Kiểm tra trạng thái xác nhận và quyền được cấp." : "Dòng nghỉ đang trống, không có dữ liệu để xóa."} onClick={()=>onChange(visible.filter((_,j)=>i!==j))}>{t('Xóa dòng','刪除列','Remove row')}</FeedbackActionButton></DataCell>
   </tr>;
  })}
  </tbody></table></DataTable>
  <p>{t('Khoảng ngày chỉ tính ngày có lịch làm việc tương ứng. Nghỉ theo giờ cần cấu hình khung giờ thực tế tại Lịch / Khung giờ.','日期範圍僅計入有排班的日期，按時請假需設定實際工作時段。','Date ranges count only scheduled workdays. Hourly leave requires actual time slots under Calendar / time slots.')}</p>
 </>;
}
