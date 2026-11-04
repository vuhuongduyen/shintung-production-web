'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {Popover,PopoverTrigger,PopoverContent} from './ui/popover';
import styles from './production-plan-notices.module.css';
export type PlanNotice={key:string;severity:'warning'|'error'|'info';message:string;retry?:()=>void};
export default function ProductionPlanNotices({notices,language='vi',contextKey,active=true}:{notices:PlanNotice[];language?:'vi'|'zh'|'en';contextKey:string;active?:boolean}){
 const [open,setOpen]=useState(false),titleId=useId(),trigger=useRef<HTMLButtonElement>(null),close=useRef<HTMLButtonElement>(null);
 const previousContext=useRef(contextKey),panel=useRef<HTMLDivElement>(null);
 const text=(vi:string,zh:string,en:string)=>language==='zh'?zh:language==='en'?en:vi;
 const actionable=notices.filter(n=>n.severity!=='info').length;
 const summary=actionable?`${text('Cảnh báo','警告','Warnings')} (${actionable})`:notices[0]?.message||'';
 const accessibleSummary=notices.length?`${text('Thông báo kế hoạch','計畫通知','Plan notices')}: ${summary}`:'';
 useEffect(()=>{if(!active||!notices.length||previousContext.current!==contextKey)setOpen(false);previousContext.current=contextKey;},[active,contextKey,notices.length]);
 useEffect(()=>{if(open&&document.activeElement===document.body)close.current?.focus({preventScroll:true});},[open,notices]);
 return <span className={styles.slot} data-plan-notices="true">
  <span className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">{accessibleSummary}</span>
  <Popover open={open&&active&&Boolean(notices.length)} onOpenChange={next=>setOpen(active&&Boolean(notices.length)&&next)}>
   <PopoverTrigger asChild><button ref={trigger} type="button" className={`${styles.trigger} ${notices.some(n=>n.severity==='error')?styles.error:actionable?styles.warning:''}`} style={{visibility:notices.length?'visible':'hidden'}} aria-hidden={!notices.length||undefined} tabIndex={notices.length?0:-1} aria-label={accessibleSummary||undefined} title={accessibleSummary||undefined}><span aria-hidden="true">{actionable?'⚠':'◷'}</span><span className={styles.label}>{summary}</span><span aria-hidden="true">▾</span></button></PopoverTrigger>
   <PopoverContent ref={panel} className={styles.panel} align="start" sideOffset={6} collisionPadding={12} aria-labelledby={titleId} onOpenAutoFocus={event=>{event.preventDefault();close.current?.focus({preventScroll:true});}} onCloseAutoFocus={event=>{
    if(!notices.length||!active){event.preventDefault();const focused=document.activeElement;if(active&&(focused===document.body||panel.current?.contains(focused)||focused===trigger.current)){const toolbar=trigger.current?.closest('[data-standard-toolbar]');const next=toolbar?.querySelector<HTMLElement>('button:not([disabled]):not([aria-hidden="true"])')||toolbar?.querySelector<HTMLElement>('[role="region"]');next?.focus({preventScroll:true});}}
   }}>
    <header className={styles.header}><strong id={titleId}>{text('Thông báo kế hoạch','計畫通知','Plan notices')}</strong><button ref={close} type="button" aria-label={text('Đóng thông báo kế hoạch','關閉計畫通知','Close plan notices')} onClick={()=>setOpen(false)}>×</button></header>
    <ul className={styles.list}>{notices.map(n=><li key={n.key} data-severity={n.severity}><p>{n.message}</p>{n.retry&&<button type="button" onClick={n.retry}>{text('Thử lưu lại','重試儲存','Retry save')}</button>}</li>)}</ul>
   </PopoverContent>
  </Popover>
 </span>;
}
