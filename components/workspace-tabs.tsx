'use client';
import {FeedbackActionButton} from './action-feedback';
import {useEffect,useRef} from 'react';
export type WorkspaceTab = {id:string;title:string};
export default function WorkspaceTabs({tabs,active,onSelect,onClose,language='vi'}:{tabs:WorkspaceTab[];active:string|null;onSelect:(id:string)=>void;onClose:(id:string)=>void;language?:string}) {
 const activeButton=useRef<HTMLButtonElement|null>(null);
 useEffect(()=>{const button=activeButton.current;const bar=button?.closest<HTMLElement>('[role=tablist]');if(button&&bar&&bar.getClientRects().length){const b=button.getBoundingClientRect(),r=bar.getBoundingClientRect();if(b.left<r.left)bar.scrollLeft-=r.left-b.left;else if(b.right>r.right)bar.scrollLeft+=b.right-r.right;}},[active,tabs.length]);
 const label=language==='zh'?'開啟的畫面':language==='en'?'Open screens':'Màn hình đang mở';
 const close=language==='zh'?'關閉':language==='en'?'Close':'Đóng';
 return <div className="workspace workspace-tabs" data-own-language="true" role="tablist" aria-label={label}>
  {tabs.map((tab,index)=><div key={tab.id} className={`workspace-tab${tab.id===active?' is-active':''}`}>
   <FeedbackActionButton ref={tab.id===active?activeButton:undefined} role="tab" type="button" id={`${tab.id}-tab`} aria-selected={tab.id===active} aria-controls={tab.id} tabIndex={tab.id===active?0:-1} onClick={()=>onSelect(tab.id)} onKeyDown={event=>{
    const next=event.key==='ArrowRight'?tabs[(index+1)%tabs.length]:event.key==='ArrowLeft'?tabs[(index+tabs.length-1)%tabs.length]:event.key==='Home'?tabs[0]:event.key==='End'?tabs[tabs.length-1]:null;
    if(next){event.preventDefault();onSelect(next.id);document.getElementById(`${next.id}-tab`)?.focus();}
   }}>{tab.title}</FeedbackActionButton>
   <FeedbackActionButton className="workspace-tab-close" type="button" aria-label={`${close} ${tab.title}`} title={`${close} ${tab.title}`} onClick={()=>onClose(tab.id)}>×</FeedbackActionButton>
  </div>)}
 </div>;
}
