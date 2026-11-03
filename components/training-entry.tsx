'use client';
import {useEffect,useState} from 'react';
export function TrainingEntry(){
 const [visible,setVisible]=useState(false);
 useEffect(()=>{const update=()=>setVisible(location.hostname==='sanxuat.shintung-vn-4458.chatgpt.site');update();const timer=setInterval(update,30000);return()=>clearInterval(timer);},[]);
 if(!visible)return null;
 return <a href="https://onspa-thu-nghiem-21102026.shintung-vn-4458.chatgpt.site" target="_blank" rel="noopener noreferrer" className="onspa-training-entry" title="Mở tab thử riêng · Chỉ xem từ 17:00 ngày 30/10/2026 (GMT+7)">Vào môi trường thử ↗</a>;
}
