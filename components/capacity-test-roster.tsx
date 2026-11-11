'use client';
import {useState} from 'react';
import CapacityEmployeePicker from './capacity-employee-picker';
import {StandardToolbar,toolbar} from './standard-toolbar/StandardToolbar';
import {selectTestRoster} from '../lib/capacity-test-roster.mjs';
type Row=Record<string,unknown>;
type Employee={id:string;name:string;line:string;active:boolean};
type Scope={week:string;line:string;employeeIds:string[]};
type Props={row:Row;employees:Employee[];scope?:Scope|null;disabled:boolean;onChange:(input:Row)=>void;onError:(message:string)=>void;t:(vi:string,zh:string,en:string)=>string};
export default function CapacityTestRoster({row,employees,scope,disabled,onChange,onError,t}:Props){
 const [selected,setSelected]=useState<string[]>([]);
 if(!scope||scope.week!==row.week||scope.line!==row.line)return null;
 const locked=disabled||row.status!=='Nháp'||Number(row.version)!==0||Boolean(row.lastConfirmed||row.request||row.reviewStatus);
 const candidates=employees.filter(e=>scope.employeeIds.includes(e.id));
 return <section className="cap-entry-section"><header>{t('Roster thử · chỉ nhân viên giả','測試名單 · 僅模擬員工','Test roster · synthetic staff only')}</header><div className="cap-roster-body">
 <p>{t('Chỉ áp dụng vào bản nháp mới. Thay cả danh sách đang nghỉ để bật HC/TC không khôi phục nhân viên thật. Chưa lưu cho đến khi chọn Lưu nháp.','僅適用於新草稿。替換休息日名單，避免恢復真實員工；按儲存草稿後才保存。','New drafts only. Replaces dormant names too, so HC/OT cannot restore real staff. Save draft separately to persist.')}</p>
 <CapacityEmployeePicker employees={candidates} selected={selected} disabled={locked} showSelectAll t={t} onChange={setSelected}/>
 <StandardToolbar items={[
  toolbar.action({type:'button',disabled:locked||!selected.length,onClick:()=>{try{onChange(selectTestRoster(row,employees,scope,selected));onError('');setSelected([]);}catch(error){onError(error instanceof Error?error.message:String(error));}}},t('Áp dụng danh sách thử','套用測試名單','Apply test roster')),
  toolbar.action({type:'button',disabled:!selected.length,onClick:()=>setSelected([])},t('Bỏ chọn','取消選取','Clear selection'))
 ]}/>
 </div></section>;
}
