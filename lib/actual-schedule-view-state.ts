'use client';
import {useCallback,useEffect,useRef,useState,type SetStateAction} from 'react';
import {productionDisplayStore} from './production-display-store.mjs';

// Navigation only, inside the existing verified user/grants/Line boundary.
// A new calendar Line gets its own filters; no edit, selection or rights persist.
export function useActualScheduleViewFields<T extends object>(key:string,initial:T){
 const storageKey='view:actual-schedule:'+key;
 const defaults=useRef(initial);
 const restore=()=>({...defaults.current,...productionDisplayStore.get(storageKey)}) as T;
 const [state,setState]=useState(()=>({key:storageKey,value:restore()}));
 const current=useRef(state);
 if(current.current.key!==storageKey)current.current={key:storageKey,value:restore()};
 const value=current.current.value;
 useEffect(()=>{
  const restoreStored=()=>{const next={key:storageKey,value:restore()};current.current=next;setState(next);};
  restoreStored();return productionDisplayStore.subscribe(restoreStored);
 },[storageKey]);
 const update=useCallback((change:SetStateAction<T>)=>{
  const old=current.current.value,next=typeof change==='function'?(change as (old:T)=>T)(old):change;
  if(JSON.stringify(next)===JSON.stringify(old))return;
  current.current={key:storageKey,value:next};setState(current.current);productionDisplayStore.put(storageKey,next);
 },[storageKey]);
 return <K extends keyof T>(name:K)=>[value[name],(change:SetStateAction<T[K]>)=>update(old=>({...old,[name]:typeof change==='function'?(change as (v:T[K])=>T[K])(old[name]):change}))] as const;
}
