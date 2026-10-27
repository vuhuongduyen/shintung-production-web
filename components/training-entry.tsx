'use client';
import {useEffect,useState} from 'react';
const END=Date.parse('2026-10-31T17:00:00+07:00');
export function TrainingEntry(){
 const [visible,setVisible]=useState(false);
 useEffect(()=>{const update=()=>setVisible(location.hostname==='disabled.example.invalid'&&Date.now()<END);update();const timer=setInterval(update,30000);return()=>clearInterval(timer);},[]);
 if(!visible)return null;
 return <a href="https://disabled.example.invalid" target="_blank" rel="noopener noreferrer" className="onspa-training-entry" title="Mở tab thử riêng · Đến 17:00 ngày 31/10/2026">Vào môi trường thử ↗</a>;
}
