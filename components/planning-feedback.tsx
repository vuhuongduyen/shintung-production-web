'use client';
import {useEffect,useContext,useRef,useSyncExternalStore} from 'react';
import {toolbarLocale,subscribeToolbarLocale} from './standard-toolbar/translations';
import {ACTION_FEEDBACK_CLEAR_EVENT,ACTION_FEEDBACK_DURATION} from '../lib/action-feedback';
import {WorkspaceActivityContext} from '../lib/data-sync';
import styles from './planning-feedback.module.css';
export default function PlanningFeedback({kind,message,onClose}:{kind:'success'|'error';message:string;onClose:()=>void}){
 const active=useContext(WorkspaceActivityContext);
 const close=useRef(onClose);close.current=onClose;
 useEffect(()=>{if(!active){close.current();return;}const dismiss=()=>close.current();const timer=window.setTimeout(dismiss,ACTION_FEEDBACK_DURATION);window.addEventListener(ACTION_FEEDBACK_CLEAR_EVENT,dismiss);return()=>{window.clearTimeout(timer);window.removeEventListener(ACTION_FEEDBACK_CLEAR_EVENT,dismiss);};},[message,kind,active]);
 const language=useSyncExternalStore(subscribeToolbarLocale,toolbarLocale,()=> 'vi');
 const title=language==='zh'?(kind==='success'?'操作成功':'操作未完成'):language==='en'?(kind==='success'?'Operation completed':'Operation not completed'):(kind==='success'?'THAO TÁC THÀNH CÔNG':'THAO TÁC CHƯA HOÀN TẤT');
 return <section data-operation-result="true" className={`${styles.panel} ${kind==='error'?styles.error:styles.success}`} role={kind==='error'?'alert':'status'} aria-live={kind==='error'?'assertive':'polite'}><header><strong>{title}</strong><button type="button" onClick={onClose} aria-label={language==='zh'?'關閉':language==='en'?'Close':'Đóng thông báo'}>×</button></header><p>{message}</p></section>;
}
