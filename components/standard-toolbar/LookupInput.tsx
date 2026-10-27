'use client';
import {useId,useLayoutEffect,useRef,useState,type InputHTMLAttributes,type ChangeEvent,type Ref} from 'react';
import {createPortal} from 'react-dom';
import styles from './StandardToolbar.module.css';
export type LookupOption={value:string;label:string;searchText?:string};
import {lookupText} from '../../lib/lookup-text';
/** Opt-in suggestions use only options already authorized and loaded by the caller. */
export function LookupInput({options,locale,onQueryEnter,ref:forwardedRef,...props}:InputHTMLAttributes<HTMLInputElement>&{options:LookupOption[];locale:string;onQueryEnter?:()=>void;ref?:Ref<HTMLInputElement>}){
 const id=useId(),anchor=useRef<HTMLInputElement|null>(null);
 const [open,setOpen]=useState(false),[active,setActive]=useState(-1),[rect,setRect]=useState<DOMRect|null>(null);
 const query=lookupText(String(props.value??''));
 const matches=options.filter(option=>lookupText(option.searchText||`${option.value} ${option.label}`).includes(query)).slice(0,20);
 const visible=open&&!props.disabled&&!!query;
 useLayoutEffect(()=>{if(!visible)return;const update=()=>setRect(anchor.current?.getBoundingClientRect()||null);update();window.addEventListener('resize',update);window.addEventListener('scroll',update,true);return()=>{window.removeEventListener('resize',update);window.removeEventListener('scroll',update,true);};},[visible,props.value]);
 useLayoutEffect(()=>{if(visible&&active>=0)document.getElementById(`${id}-${active}`)?.scrollIntoView?.({block:'nearest'});},[visible,active,id]);
 const choose=(option:LookupOption)=>{props.onChange?.({target:{value:option.value},currentTarget:{value:option.value}} as ChangeEvent<HTMLInputElement>);setOpen(false);setActive(-1);};
 const popup=visible&&rect?<div id={id} role="listbox" aria-label={locale==='en'?'Employee suggestions':locale==='zh'?'員工建議':'Gợi ý nhân viên'} className={styles.suggestions} style={{left:Math.max(8,Math.min(rect.left,window.innerWidth-Math.min(360,window.innerWidth-16)-8)),top:rect.bottom+4,width:Math.min(360,window.innerWidth-16),maxHeight:Math.max(80,Math.min(240,window.innerHeight-rect.bottom-12))}}>
  {matches.map((option,index)=><div key={option.value} id={`${id}-${index}`} role="option" aria-selected={index===active} className={styles.suggestion} onMouseDown={event=>event.preventDefault()} onMouseMove={()=>setActive(index)} onClick={()=>choose(option)}>{option.label}</div>)}
  {!matches.length&&<div role="status" className={styles.suggestion}>{locale==='en'?'No match. Check the code or name.':locale==='zh'?'沒有符合項目，請檢查代碼或姓名。':'Không tìm thấy. Kiểm tra lại mã hoặc tên.'}</div>}
 </div>:null;
 return <><input {...props} ref={node=>{anchor.current=node;if(typeof forwardedRef==='function')forwardedRef(node);else if(forwardedRef)forwardedRef.current=node;}} role="combobox" autoComplete="off" aria-autocomplete="list" aria-expanded={visible} aria-controls={visible?id:undefined} aria-activedescendant={visible&&active>=0&&matches[active]?`${id}-${active}`:undefined}
  onChange={event=>{setOpen(true);setActive(-1);props.onChange?.(event);}} onFocus={event=>{setOpen(true);props.onFocus?.(event);}} onBlur={event=>{setOpen(false);setActive(-1);props.onBlur?.(event);}}
  onKeyDown={event=>{
   if(event.nativeEvent.isComposing||event.nativeEvent.keyCode===229){props.onKeyDown?.(event);return;}
   if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();setOpen(true);setActive(current=>matches.length?(current<0?(event.key==='ArrowDown'?0:matches.length-1):(current+(event.key==='ArrowDown'?1:-1)+matches.length)%matches.length):-1);return;}
   if(visible&&event.key==='Escape'){event.preventDefault();event.stopPropagation();setOpen(false);setActive(-1);return;}
   if(visible&&event.key==='Enter'&&!event.altKey&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey){event.preventDefault();event.stopPropagation();if(!event.repeat&&active>=0&&matches[active])choose(matches[active]);else{setOpen(false);setActive(-1);if(!event.repeat)onQueryEnter?.();}return;}
   props.onKeyDown?.(event);
  }}/>{popup&&createPortal(popup,anchor.current?.closest('[role="dialog"]')||document.body)}</>;
}
