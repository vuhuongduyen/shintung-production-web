'use client';
import {FeedbackActionButton} from './action-feedback';
import {useEffect,useId,useRef,useState,useSyncExternalStore} from 'react';
import {createPortal} from 'react-dom';
import {toolbarLocale,subscribeToolbarLocale} from './standard-toolbar/translations';

export default function EngineReason({reason,sku}:{reason:string;sku:string}){
 const [position,setPosition]=useState<{left:number;top:number;width:number}|null>(null);
 const panel=useRef<HTMLDivElement>(null),button=useRef<HTMLButtonElement>(null);
 const id=useId();
 const language=useSyncExternalStore(subscribeToolbarLocale,toolbarLocale,()=> 'vi');
 const more=language==='en'?'View more':language==='zh'?'查看更多':'Xem thêm';
 const title=language==='en'?'Reason':language==='zh'?'原因':'Lý do';
 const close=language==='en'?'Close':language==='zh'?'關閉':'Đóng';
 useEffect(()=>{
  if(!position)return;
  panel.current?.showPopover();
  const dismiss=(e:Event)=>{if(e.target instanceof Node&&panel.current?.contains(e.target))return;panel.current?.hidePopover();};
  window.addEventListener('resize',dismiss);
  window.addEventListener('scroll',dismiss,true);
  return()=>{window.removeEventListener('resize',dismiss);window.removeEventListener('scroll',dismiss,true);};
 },[position]);
 function show(){
  if(position){panel.current?.hidePopover();return;}
  const rect=button.current!.getBoundingClientRect();
  const width=Math.min(400,window.innerWidth-24);
  const left=rect.right+8+width<=window.innerWidth-12?rect.right+8:Math.max(12,rect.left-width-8);
  const top=Math.max(12,Math.min(rect.top,window.innerHeight-260));
  setPosition({left,top,width});
 }
 return <><FeedbackActionButton ref={button} type="button" className="calc-button" aria-expanded={!!position} aria-controls={id} aria-label={`${more}: ${sku}`} onClick={show}>{more}</FeedbackActionButton>{position&&createPortal(<div id={id} ref={panel} popover="auto" className="engine-reason-popover" style={position} role="region" aria-label={`${title}: ${sku}`} onToggle={e=>{if(e.newState==='closed')setPosition(null);}}><div className="engine-reason-heading"><span>{title} · {sku}</span><FeedbackActionButton type="button" aria-label={close} onClick={()=>panel.current?.hidePopover()}>×</FeedbackActionButton></div><p>{reason||'—'}</p></div>,document.body)}</>;
}
