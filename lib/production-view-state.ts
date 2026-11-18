'use client';
import {useCallback,useEffect,useRef,useState,type SetStateAction} from 'react';
import {productionDisplayStore} from './production-display-store.mjs';

// Display preferences share the already verified account/grants/Line boundary.
// Never retain a dialog, unsaved business entry, or mutation capability here.
export function useProductionViewState<T extends object>(key:string,initial:T){
 const [value,setValue]=useState<T>(()=>productionDisplayStore.get('view:'+key)||initial);
 const current=useRef(value),touched=useRef(false);
 useEffect(()=>{
  const restore=()=>{if(touched.current||!productionDisplayStore.ready())return;
   const saved=productionDisplayStore.get('view:'+key);
   if(saved){current.current=saved;setValue(saved);}
  };
  restore();return productionDisplayStore.subscribe(restore);
 },[key]);
 const update=useCallback((change:SetStateAction<T>)=>{
  const next=typeof change==='function'?(change as (old:T)=>T)(current.current):change;
  if(JSON.stringify(next)===JSON.stringify(current.current))return;
  touched.current=true;
  current.current=next;setValue(next);productionDisplayStore.put('view:'+key,next);
 },[key]);
 return [value,update] as const;
}
export function useProductionViewFields<T extends object>(key:string,initial:T){
 const [value,update]=useProductionViewState(key,initial);
 return <K extends keyof T>(name:K)=>[value[name],(change:SetStateAction<T[K]>)=>update(old=>({...old,[name]:typeof change==='function'?(change as (v:T[K])=>T[K])(old[name]):change}))] as const;
}
