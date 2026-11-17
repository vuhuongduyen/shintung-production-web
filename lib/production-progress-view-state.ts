'use client';
import {useCallback,useEffect,useRef,useState,type SetStateAction} from 'react';
import {productionDisplayStore} from './production-display-store.mjs';

// This menu uses the existing verified account/grants/Line display boundary.
// Persist navigation only: no report selection, dialog, draft or write rights.
export function useProgressViewState<T extends object>(key:string,initial:T){
 const storageKey='view:production-progress:'+key;
 const [value,setValue]=useState<T>(()=>productionDisplayStore.get(storageKey)||initial);
 const current=useRef(value),touched=useRef(false);
 useEffect(()=>{
  const restore=()=>{if(touched.current)return;const saved=productionDisplayStore.get(storageKey);if(saved){current.current=saved;setValue(saved);}};
  restore();return productionDisplayStore.subscribe(restore);
 },[storageKey]);
 const update=useCallback((change:SetStateAction<T>)=>{
  const next=typeof change==='function'?(change as (old:T)=>T)(current.current):change;
  if(JSON.stringify(next)===JSON.stringify(current.current))return;
  touched.current=true;current.current=next;setValue(next);productionDisplayStore.put(storageKey,next);
 },[storageKey]);
 return [value,update] as const;
}
export function useProgressViewFields<T extends object>(key:string,initial:T){
 const [value,update]=useProgressViewState(key,initial);
 return <K extends keyof T>(name:K)=>[value[name],(change:SetStateAction<T[K]>)=>update(old=>({...old,[name]:typeof change==='function'?(change as (v:T[K])=>T[K])(old[name]):change}))] as const;
}
