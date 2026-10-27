'use client';
import {useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState,type SyntheticEvent} from 'react';
import {clearActionFeedback} from '../lib/action-feedback';
export type ProductionNotice={text:string;kind:'success'|'error'};
// A response belongs to the Line/week/account where its request was started.
export function useProductionActionNotice(context:string,duration=8000){
 const scope=useMemo(()=>({}),[context]);
 const active=useRef(scope);
 const [entry,setEntry]=useState<{scope:object;value:ProductionNotice}|null>(null);
 useLayoutEffect(()=>{active.current=scope;setEntry(null);clearActionFeedback();},[scope]);
 const setMessage=useCallback((value:ProductionNotice|null)=>{if(active.current===scope)setEntry(value?{scope,value}:null);},[scope]);
 const clearMessage=useCallback(()=>{setEntry(null);clearActionFeedback();},[]);
 useEffect(()=>{if(!entry)return;const timer=setTimeout(()=>setEntry(current=>current===entry?null:current),duration);return()=>clearTimeout(timer);},[entry,duration]);
 const onInteraction=useCallback((event:SyntheticEvent)=>{
  const target=event.target;
  if(target instanceof Element&&!target.closest('[data-production-notice]')&&target.closest('button,input,select,textarea,summary,[role="button"],[role="tab"],[role="menuitem"]'))clearMessage();
 },[clearMessage]);
 return {message:entry?.scope===scope?entry.value:null,setMessage,clearMessage,onInteraction};
}
