"use client";
import {useEffect,useId,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import './production-employee-popover.css';
import {DataCell} from './onspa-ui/DataCell';
import {eventEmployees} from '../lib/production-event-employees.mjs';
type Row=Record<string,any>;
export default function ProductionEmployeeCount({row,employees,t=(s:string)=>s,anchored=false}:{row:Row;employees:Row[];t?:(s:string)=>string;anchored?:boolean}) {
 const disclosure=useRef<HTMLDetailsElement>(null),trigger=useRef<HTMLElement>(null),panel=useRef<HTMLDivElement>(null);
 const panelId=useId(),[expanded,setExpanded]=useState(false),[placement,setPlacement]=useState({left:12,top:12,width:300,maxHeight:320});
 const close=(restoreFocus=false)=>{if(disclosure.current)disclosure.current.open=false;setExpanded(false);if(restoreFocus)trigger.current?.focus({preventScroll:true});};
 const previousContext=useRef({row,employees,anchored});
 useEffect(()=>{const previous=previousContext.current;if(previous.row!==row||previous.employees!==employees||previous.anchored!==anchored){close();previousContext.current={row,employees,anchored};}},[row,employees,anchored]);
 useEffect(()=>{if(!anchored)return;const other=(event:Event)=>{if((event as CustomEvent).detail!==panelId)close();};window.addEventListener('onspa-employee-hours-open',other);return()=>window.removeEventListener('onspa-employee-hours-open',other);},[anchored,panelId]);
 useLayoutEffect(()=>{
  if(!anchored||!expanded)return;
  const position=()=>{const anchor=trigger.current;if(!anchor)return;const rect=anchor.getBoundingClientRect(),viewportWidth=document.documentElement.clientWidth||window.innerWidth,viewportHeight=window.innerHeight;
   const region=anchor.closest('.report-day-table')?.getBoundingClientRect();
   if(rect.bottom<0||rect.top>viewportHeight||rect.right<0||rect.left>viewportWidth||(region&&(rect.right<region.left||rect.left>region.right))){close();return;}
   const width=Math.min(480,Math.max(1,viewportWidth-24)),below=viewportHeight-rect.bottom-12,above=rect.top-12,down=below>=Math.min(280,above),maxHeight=Math.max(60,Math.min(360,down?below-6:above-6));
   setPlacement({left:Math.max(12,Math.min(rect.left,viewportWidth-width-12)),top:down?Math.min(viewportHeight-maxHeight-12,rect.bottom+6):Math.max(12,rect.top-Math.min(maxHeight,panel.current?.scrollHeight||maxHeight)-6),width,maxHeight});
  };
  position();window.addEventListener('resize',position);document.addEventListener('scroll',position,true);
  const outside=(event:PointerEvent)=>{if(!panel.current?.contains(event.target as Node)&&!trigger.current?.contains(event.target as Node))close();};
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true);}};
  const inside=(node:EventTarget|null)=>node instanceof Node&&(panel.current?.contains(node)||trigger.current?.contains(node));
  const focusIn=(event:FocusEvent)=>{if(!inside(event.target))close();};
  let focusTimer:ReturnType<typeof setTimeout>|undefined;
  const focusOut=(event:FocusEvent)=>{if(inside(event.target)){clearTimeout(focusTimer);focusTimer=setTimeout(()=>{if(!inside(document.activeElement))close();},0);}};
  document.addEventListener('focusin',focusIn,true);document.addEventListener('focusout',focusOut,true);
  document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',escape,true);
  return()=>{clearTimeout(focusTimer);document.removeEventListener('focusin',focusIn,true);document.removeEventListener('focusout',focusOut,true);window.removeEventListener('resize',position);document.removeEventListener('scroll',position,true);document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',escape,true);};
 },[anchored,expanded]);
 const panelTab=(event:React.KeyboardEvent<HTMLDivElement>)=>{
  if(event.key!=='Tab')return;
  if(event.shiftKey){event.preventDefault();(event.target===panel.current?trigger.current:panel.current)?.focus({preventScroll:true});return;}
  if(event.target===panel.current)return;
  // The portal lives at the end of body. Continue from the disclosure's place
  // in the page instead of letting Tab fall into browser chrome or loop in a trap.
  const anchor=trigger.current;
  const next=anchor&&Array.from(document.querySelectorAll<HTMLElement>('a[href],button,input,select,textarea,summary,[tabindex]')).find(element=>element.tabIndex>=0&&!element.matches(':disabled')&&!element.closest('[hidden],[inert]')&&!panel.current?.contains(element)&&Boolean(anchor.compareDocumentPosition(element)&Node.DOCUMENT_POSITION_FOLLOWING)&&element.getClientRects().length>0);
  if(next){event.preventDefault();close();next.focus({preventScroll:true});}
  else close(); // With no next control, preserve the browser's normal exit.
 };
 const ids=row.employees?.length?row.employees:row.hours?.perEmployee?.map((p:Row)=>p.id)||[];
 const hours=new Map<string,Row>((row.hours?.perEmployee||[]).map((p:Row)=>[String(p.id).toUpperCase(),p]));
 const num=(v:any)=>v==null?'—':Number(v).toLocaleString('vi-VN',{maximumFractionDigits:2});
 const people=eventEmployees({...row,employees:ids},employees);
 const count=row.count??(people.length||null);
 const showHours=Boolean(row.hours||row.kind==='completion');
 const content=<>{row.sourceVerified&&<p>Số người và tổng giờ đã đối chiếu theo Google Sheet. Nguồn không có danh sách giờ từng nhân viên; chưa xác nhận phân bổ cá nhân.</p>}{row.estimatedStaffing&&<p>Số người theo ảnh gốc: {row.sourceCount}. Tên và giờ từng người được phân bổ bổ sung theo lịch và giờ chuẩn/SP.</p>}{!row.sourceVerified&&row.historicalImport&&row.unallocatedHours>0.01&&<p>Chưa phân bổ đủ theo lịch: {num(row.unallocatedHours)} giờ. Tổng giờ gốc vẫn được giữ nguyên.</p>}<table className="production-employee-table" data-no-pagination="true" aria-label={t('Nhân viên')}><thead><tr><th scope="col">{t('Nhân viên')}</th>{showHours&&<><th scope="col">{t('Giờ HC')}</th><th scope="col">{t('Giờ TC')}</th><th scope="col">{t('Tổng giờ công')}</th></>}</tr></thead><tbody>{people.length?people.map((p:Row)=>{const h=hours.get(String(p.id).toUpperCase());return <tr key={p.id}><DataCell><span>{p.name||p.id}</span>{p.name&&<small className="production-subtext">{p.id}</small>}</DataCell>{showHours&&(h?<><DataCell kind="number" className="number">{num(h.hc)}</DataCell><DataCell kind="number" className="number">{num(h.ot)}</DataCell><DataCell kind="number" className="number">{num(h.total)}</DataCell></>:<DataCell colSpan={3}>{t('Chưa có giờ theo nhân viên')}</DataCell>)}</tr>;}):<tr data-no-data="true"><DataCell colSpan={showHours?4:1}>{t('Chưa ghi nhận nhân viên')}</DataCell></tr>}</tbody></table></>;
 return <details ref={disclosure} className={`production-employee-count${anchored?' production-employee-anchored':''}`} name="onspa-employee-lists" onToggle={e=>{const open=e.currentTarget.open;if(anchored&&open)window.dispatchEvent(new CustomEvent('onspa-employee-hours-open',{detail:panelId}));setExpanded(open);}}><summary ref={trigger} aria-label={`${t('Nhân viên')} · ${count??'—'}`} aria-expanded={expanded} aria-controls={anchored?panelId:undefined} aria-haspopup={anchored?'dialog':undefined} onKeyDown={e=>{if(anchored&&expanded&&((e.key==='Tab'&&!e.shiftKey)||e.key==='ArrowDown')){e.preventDefault();panel.current?.focus({preventScroll:true});}}}>{anchored&&<span className="production-employee-arrow" aria-hidden="true">{expanded?'▾':'▸'}</span>}<span>{count===null?'—':Number(count).toLocaleString('vi-VN')}</span></summary>
 {anchored?(expanded&&typeof document!=='undefined'?createPortal(<div ref={panel} id={panelId} role="dialog" aria-label={t('Giờ công từng nhân viên')} tabIndex={-1} className="production-employee-popover" style={placement} onKeyDown={panelTab}><header><strong>{t('Giờ công từng nhân viên')}</strong><button type="button" onClick={()=>close(true)} aria-label={t('Đóng chi tiết nhân viên')}>×</button></header><div className="production-employee-grid">{content}</div></div>,document.body):null):<div className="production-employee-grid">{content}</div>}
 </details>;
}
