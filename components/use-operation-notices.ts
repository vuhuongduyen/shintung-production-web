'use client';
import {useEffect} from 'react';
import {operationNoticeSelector,resultKind} from '../lib/operation-notice.mjs';
import {ACTION_FEEDBACK_EVENT,ACTION_FEEDBACK_CLEAR_EVENT} from '../lib/action-feedback';
/** Bridge existing operation result banners; never promote field hints/table statuses. */
export function useOperationNotices(){
 useEffect(()=>{
 const seen=new WeakMap<Element,string>();const hidden=new Set<HTMLElement>();let mounted=true;let scheduled=false;let lastSource:HTMLElement|null=null;
 const scan=()=>{scheduled=false;if(!mounted)return;if(lastSource&&(!lastSource.isConnected||lastSource.closest('[hidden],[aria-hidden="true"]'))){lastSource=null;window.dispatchEvent(new Event(ACTION_FEEDBACK_CLEAR_EVENT));}for(const node of document.querySelectorAll<HTMLElement>(operationNoticeSelector)){
  if(node.closest('[data-global-operation-notice], [data-operation-guidance], [hidden], [aria-hidden="true"], td, th')||node.querySelector('input,select,textarea'))continue;
  const text=Array.from(node.childNodes).map(n=>n.nodeType===1&&((n as Element).matches('button,[data-feedback-button]'))?'':n.textContent||'').join(' ').trim();
  if(!text||seen.get(node)===text)continue;
  if(!hidden.has(node)&&!node.getClientRects().length)continue;
  const kind=resultKind(text,node.className,node.getAttribute('role'));if(!kind)continue;
  seen.set(node,text);hidden.add(node);node.setAttribute('data-operation-source-hidden','true');
  const close=Array.from(node.querySelectorAll<HTMLButtonElement>('button')).find(b=>/^[×✕]$/.test(b.textContent?.trim()||'')||/đóng|close|關閉/i.test(b.getAttribute('aria-label')||''));
  lastSource=node;window.dispatchEvent(new CustomEvent(ACTION_FEEDBACK_EVENT,{detail:{message:text,kind,trigger:node,onDismiss:()=>close?.click()}}));
 }};
 const observer=new MutationObserver(()=>{if(!scheduled){scheduled=true;queueMicrotask(scan);}});
 observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden','aria-hidden']});queueMicrotask(scan);
 return()=>{mounted=false;observer.disconnect();for(const node of hidden)node.removeAttribute('data-operation-source-hidden');};
 },[]);
}
