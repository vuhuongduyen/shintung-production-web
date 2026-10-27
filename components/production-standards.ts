'use client';
import {useEffect,useState} from 'react';
import {recordFetch} from '../lib/record-fetch';
import {useDataRefresh} from '../lib/data-sync';
export function useProductionStandards(){
 const revision=useDataRefresh(['labor_hours']);
 const [state,setState]=useState<{values:Map<string,number>;error:string;loading:boolean}>({values:new Map(),error:'',loading:true});
 useEffect(()=>{let active=true;recordFetch('/api/production-standards',{cache:'no-store'}).then(async response=>{if(!response.ok)throw Error('Không tải được giờ công chuẩn');const data=await response.json();const values=new Map<string,number>();for(const record of data.records||[]){const p=record.payload;if(p&&!p._deleted&&!p.cancelled&&p.status!=='Đã hủy'&&p.laborHour!==null&&p.laborHour!==undefined&&Number.isFinite(Number(p.laborHour))&&Number(p.laborHour)>=0)values.set(String(p.sku||record.key).trim().toUpperCase(),Number(p.laborHour));}if(active)setState(current=>{const unchanged=!current.loading&&!current.error&&current.values.size===values.size&&[...values].every(([sku,hours])=>current.values.get(sku)===hours);return unchanged?current:{values,error:'',loading:false};});}).catch(e=>{if(active)setState({values:new Map(),error:e.message||'Không tải được giờ công chuẩn',loading:false});});return()=>{active=false;};},[revision]);
 return state;
}
