'use client';
import {useEffect,createContext,useContext,useRef} from 'react';
export type ApprovalIntent={entity:string;sequence:number};
export const ApprovalNavigationContext=createContext<ApprovalIntent|null>(null);
export function useApprovalNavigation(entities:string[],apply:()=>void,ready=true){
 const request=useContext(ApprovalNavigationContext),last=useRef<number|null>(null);
 useEffect(()=>{if(ready&&request&&entities.includes(request.entity)&&last.current!==request.sequence){last.current=request.sequence;apply();}},[request,entities,apply,ready]);
}
// Visual focus is independent of checkboxes and never selects records for an action.
export default function WorkspaceInteractions(){
 useEffect(()=>{
  const highlight=(event:Event)=>{
   const target=event.target instanceof Element?event.target:null;
   const row=target?.closest('tbody > tr');
   if(!row||!row.closest('.app-shell')||row.closest('[data-no-row-highlight]'))return;
   const table=row.closest('table');if(!table)return;
   table.querySelectorAll('[data-current-row]').forEach(old=>{if(old.closest('table')===table&&old!==row)old.removeAttribute('data-current-row');});
   row.setAttribute('data-current-row','true');
  };
  const confirm=(button:HTMLButtonElement)=>{
   const label=(button.textContent||button.getAttribute('aria-label')||'').trim().replace(/^[✓✔☑\s]+/,'');
   const yes=/^(xác nhận|duyệt|đồng ý|confirm|approve|確認|核准|同意)(\b|\s|$|[（(])/iu.test(label);
   if(yes)button.setAttribute('data-confirm-action','true');else button.removeAttribute('data-confirm-action');
  };
  const scan=(node:Node)=>{const element=node instanceof Element?node:node.parentElement;if(!element)return;const parent=element.closest('button');if(parent)confirm(parent);element.querySelectorAll<HTMLButtonElement>('button').forEach(confirm);};
  scan(document.body);
  const observer=new MutationObserver(records=>records.forEach(record=>{if(record.type==='characterData')scan(record.target);else record.addedNodes.forEach(scan);}));
  observer.observe(document.body,{childList:true,subtree:true,characterData:true});
  document.addEventListener('click',highlight,true);document.addEventListener('focusin',highlight,true);
  return()=>{observer.disconnect();document.removeEventListener('click',highlight,true);document.removeEventListener('focusin',highlight,true);};
 },[]);
 return null;
}
