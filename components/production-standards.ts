'use client';
import {useEffect,useState} from 'react';
import {recordFetch} from '../lib/record-fetch';
import {useDataRefresh,clientSessionGeneration} from '../lib/data-sync';
import {productionDisplayStore} from '../lib/production-display-store.mjs';
import {productionBoundedRead} from '../lib/production-bounded-read.mjs';
const retained=():Map<string,number>|null=>{const saved=productionDisplayStore.get('standards');return Array.isArray(saved)?new Map(saved):null;};
export function useProductionStandards({enabled=true}:{enabled?:boolean}={}){
 const revision=useDataRefresh(['labor_hours']);
 const [state,setState]=useState<{values:Map<string,number>;error:string;loading:boolean}>(()=>{const values=enabled?retained():null;return {values:values||new Map(),error:'',loading:enabled&&!values};});
 useEffect(()=>{
  if(!enabled){setState(current=>current.loading||current.error||current.values.size?{values:new Map(),error:'',loading:false}:current);return;}
  let active=true,received=false;const session=clientSessionGeneration();
  const restore=()=>{if(!active||received)return;const values=retained();if(values)setState(current=>current.loading||!current.values.size?{values,error:'',loading:false}:current);};
  restore();const unsubscribe=productionDisplayStore.subscribe(restore);
  productionBoundedRead(recordFetch,'/api/production-standards',{cache:'no-store'}).then(data=>{
   if(!active||session!==clientSessionGeneration())return;
   const values=new Map<string,number>();for(const record of data.records||[]){const p=record.payload;if(p&&!p._deleted&&!p.cancelled&&p.status!=='Đã hủy'&&p.laborHour!==null&&p.laborHour!==undefined&&Number.isFinite(Number(p.laborHour))&&Number(p.laborHour)>=0)values.set(String(p.sku||record.key).trim().toUpperCase(),Number(p.laborHour));}
   received=true;productionDisplayStore.put('standards',[...values]);
   setState(current=>{const unchanged=!current.loading&&!current.error&&current.values.size===values.size&&[...values].every(([sku,hours])=>current.values.get(sku)===hours);return unchanged?current:{values,error:'',loading:false};});
  }).catch(e=>{if(!active||session!==clientSessionGeneration())return;const denied=[401,403].includes(e.status);if(denied)productionDisplayStore.clear();setState(current=>({values:denied?new Map():current.values,error:e.message||'Không tải được giờ công chuẩn',loading:false}));});
  return()=>{active=false;unsubscribe();};
 },[revision,enabled]);
 return state;
}
