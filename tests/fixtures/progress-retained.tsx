import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import Production from '../../components/production-management';
import {productionDisplayStore} from '../../lib/production-display-store.mjs';
import {clearProductionSnapshot} from '../../lib/production-workflow-cache';
import '../../app/globals.css';
import '../../app/planning-compact.css';
const orders=Array.from({length:45},(_,i)=>({id:'TEST-'+i,lsxCode:'TEST-'+String(i).padStart(3,'0'),name:i%2?'Dây tắm PVC thử nghiệm':'Bộ sen thử nghiệm',sku:'TEST-PVC',line:'A',lsxQty:1000,planEnd:'2026-12-01',syncStatus:'ĐÃ ĐỒNG BỘ'}));
let revision=1;
window.fetch=async()=>{await new Promise(r=>setTimeout(r,1800));return Response.json({orders:orders.map(o=>({...o,planningNote:'Dữ liệu thử lần '+revision})),reports:[],events:[],employees:[],actualSchedules:[],approvedSchedules:[],rights:{manager:true,confirm:true,line:'A'},dailyOutputPolicy:{active:true}});};
function Test(){const [epoch,setEpoch]=useState(0),[ready,setReady]=useState(false);React.useEffect(()=>{void productionDisplayStore.activate('SYNTHETIC-BROWSER:A').then(()=>setReady(true));},[]);return <><aside style={{padding:12,background:'#fff3cf'}}>MÔI TRƯỜNG TEST · Dữ liệu giả lập · phản hồi nền trễ 1,8 giây <button onClick={()=>{revision++;clearProductionSnapshot();setEpoch(n=>n+1);}}>Đóng và mở lại menu thử</button></aside>{ready&&<Production key={epoch} mode="progress" preferenceUser="TEST" sessionLine="A" confirmReportAllowed={true}/>}</>;}
createRoot(document.getElementById('root')!).render(<Test/>);
