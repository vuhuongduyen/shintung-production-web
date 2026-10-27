'use client';
import {useContext,useEffect,useState} from 'react';
import {tableExportReport} from '../lib/table-report.mjs';
import {ExportPermissionContext} from './standard-toolbar/StandardToolbar';
import {permissionDeniedMessage} from '../lib/permission-feedback';
import {toolbarLocale} from './standard-toolbar/translations';
import ReportPreview from './report-preview';
type Data={title:string;headers:string[];rows:any[][]};
function readTable(table:HTMLTableElement,index:number):Data|null{
 if(table.dataset.reportSource){try{return JSON.parse(table.dataset.reportSource);}catch{return null;}}
 const head=table.tHead?.rows[table.tHead.rows.length-1];if(!head)return null;
 const all=Array.from(head.cells),keep=all.map((c,i)=>({c,i})).filter(({c})=>!/^(chi tiết|thao tác|chọn|操作|詳細|details|actions)$/i.test(c.textContent?.trim()||'')&&!!c.textContent?.trim());
 if(!keep.length)return null;
 const value=(c:HTMLTableCellElement)=>{const explicit=c.getAttribute('data-report-value');if(explicit!==null)return explicit;const inputs=Array.from(c.querySelectorAll<HTMLInputElement|HTMLSelectElement>('input,select'));if(inputs.length){return inputs.map(input=>input instanceof HTMLSelectElement?input.selectedOptions[0]?.textContent||input.value:input.type==='checkbox'?(input.checked?'Có':'Không'):input.type==='radio'?'':input.value).filter(Boolean).join(' – ');}const clone=c.cloneNode(true) as HTMLElement;clone.querySelectorAll('table').forEach(el=>el.remove());return clone.textContent?.replace(/\s+/g,' ').trim()||'';};
 const rows=Array.from(table.tBodies).flatMap(body=>Array.from(body.rows)).filter(r=>r.cells.length===all.length&&!r.querySelector('td[colspan],th[colspan]')).map(r=>keep.map(({i})=>value(r.cells[i])));
 const title=table.getAttribute('aria-label')||table.closest('section')?.querySelector('h2,h3')?.textContent||`Bảng dữ liệu ${index+1}`;
 return {title:title.trim(),headers:keep.map(({c})=>c.textContent?.trim()||''),rows};
}
export default function TableReports({scopeId,resetKey,enabled}:{scopeId:string;resetKey:string;enabled:boolean}){
 const allowed=useContext(ExportPermissionContext);
 const [denial,setDenial]=useState('');
 const [report,setReport]=useState<any>(null);
 // Existing explicit export actions retain their preview/download flow.
 function preview(workspace:HTMLElement){
  if(!allowed){setDenial(permissionDeniedMessage(toolbarLocale()));return false;}
  const tables=Array.from(workspace.querySelectorAll<HTMLTableElement>('table')).filter(el=>el.tHead&&el.getClientRects().length&&!el.closest('.onspa-report-tools,.onspa-report-overlay,[role=dialog]')&&!el.parentElement?.closest('td')).map(readTable).filter(Boolean) as Data[];
  const populated=tables.filter(d=>d.rows.length);if(!populated.length)return false;
  const reports=populated.map(d=>tableExportReport(d)),first=reports[0];
  setReport({...first,sheets:reports.flatMap(r=>r.sheets)});return true;
 }
 useEffect(()=>{setReport(null);},[resetKey]);
 useEffect(()=>{
  if(!enabled)return;
  const handler=(event:Event)=>{
   const e=event as CustomEvent<{button?:HTMLElement}>;
   const root=document.getElementById(scopeId),button=e.detail?.button;
   if(!button||!root?.contains(button))return;
   if(!allowed){event.preventDefault();setDenial(permissionDeniedMessage(toolbarLocale()));return;}
   const main=button.closest<HTMLElement>('main.workspace');
   if(main&&preview(main))event.preventDefault();
  };
  window.addEventListener('onspa-table-export',handler);return()=>window.removeEventListener('onspa-table-export',handler);
 },[scopeId,resetKey,enabled,allowed]);
 return <>{denial&&<p role="alert" className="production-inline-message error">{denial}</p>}{enabled&&allowed&&report?<ReportPreview report={report} close={()=>setReport(null)}/>:null}</>;
}
