'use client';
import {FeedbackActionButton} from './action-feedback';
import {useLayoutEffect,useState} from 'react';
import {createPortal} from 'react-dom';

type Option={code:string;name:string;spec?:string};
export default function BomCodeSuggestions({anchor,options,onSelect}:{anchor:HTMLInputElement|null;options:Option[];onSelect:(code:string)=>void}){
 const [rect,setRect]=useState<DOMRect|null>(()=>anchor?.getBoundingClientRect()||null);
 useLayoutEffect(()=>{
  if(!anchor)return;
  const position=()=>setRect(anchor.getBoundingClientRect());
  const frame=requestAnimationFrame(position);
  window.addEventListener('scroll',position,true);
  window.addEventListener('resize',position);
  return ()=>{cancelAnimationFrame(frame);window.removeEventListener('scroll',position,true);window.removeEventListener('resize',position)};
 },[anchor]);
 if(!anchor||!rect||!options.length)return null;
 return createPortal(<div className="bom-compact-suggestions bom-code-popover" style={{top:rect.bottom+3,left:Math.max(4,Math.min(rect.left,window.innerWidth-340)),width:Math.min(430,window.innerWidth-8)}}>{options.map(option=><FeedbackActionButton type="button" key={option.code} onMouseDown={e=>e.preventDefault()} onClick={()=>onSelect(option.code)}><b>{option.code}</b><span>{option.name}</span><small>{option.spec||'—'}</small></FeedbackActionButton>)}</div>,document.body);
}
