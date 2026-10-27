"use client";
import {useEffect,useRef,useState} from 'react';
import type {AllocationQueueView} from './production-allocation-queue';
import ProductionDateTimeInput from './production-date-time-input';
import {FeedbackActionButton} from './action-feedback';
import {notifyInvalidAction} from '../lib/action-feedback';
import {productionRequestId} from '../lib/production-request-id.mjs';
import styles from './production-allocation-queue.module.css';
type Props={view:AllocationQueueView;busy:boolean;now:string;onCommand:(command:Record<string,unknown>)=>Promise<boolean>};
const local=(value:string)=>new Date(Date.parse(value)+7*3600000).toISOString().slice(0,16);
const display=(value:string)=>{const t=local(value);return `${t.slice(8,10)}/${t.slice(5,7)}/${t.slice(0,4)} ${t.slice(11)}`;};
const iso=(value:string)=>new Date(`${value.length===16?value+':00':value}+07:00`).toISOString();
export default function ProductionAllocationSelection({view,busy,now,onCommand}:Props){
 const [selected,setSelected]=useState<string[]>([]),[target,setTarget]=useState(''),[start,setStart]=useState(''),[end,setEnd]=useState(''),[saving,setSaving]=useState(false),[message,setMessage]=useState('');
 const picker=useRef<HTMLDetailsElement>(null);
 useEffect(()=>{const close=(event:PointerEvent)=>{if(event.target instanceof Node&&picker.current&&!picker.current.contains(event.target))picker.current.open=false;};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[]);
 const pending=useRef(false),receipt=useRef<{fingerprint:string;id:string}|null>(null),allBox=useRef<HTMLInputElement>(null);
 const rows=view.offers.filter(o=>!o.expired&&o.canAllocate&&(view.group==='ADMIN'||o.targetGroup===view.group)).flatMap(offer=>offer.people.filter(person=>person.pending.some(w=>Date.parse(w.endsAt)>Date.parse(now))).map(person=>({key:JSON.stringify([offer.id,person.id]),offer,person})));
 const chosen=rows.filter(row=>selected.includes(row.key)),lines=['A','B','C'].filter(line=>chosen.length&&chosen.every(row=>row.offer.targetGroup===(line==='C'?'C':'AB')));
 const disabled=busy||saving||!!view.readOnly;
 const eligible=rows.filter(row=>!chosen.some(c=>c.person.id===row.person.id&&c.key!==row.key)&&(!chosen.length||row.offer.targetGroup===chosen[0].offer.targetGroup));
 const allSelected=eligible.length>0&&eligible.every(row=>selected.includes(row.key));
 const initialize=(keys:string[])=>{
  setSelected(keys);setMessage('');
  const items=rows.filter(row=>keys.includes(row.key));
  if(!items.length){setTarget('');return;}
  if(!chosen.length){
   const windows=items.map(row=>row.person.pending.find(w=>Date.parse(w.endsAt)>Date.parse(now))!);
   const from=Math.ceil(Math.max(Date.parse(now),...windows.map(w=>Date.parse(w.effectiveAt)))/60000)*60000;
   setStart(local(new Date(from).toISOString()));setEnd(local(new Date(Math.min(...windows.map(w=>Date.parse(w.endsAt)))).toISOString()));
   setTarget(items[0].offer.targetGroup==='AB'?'A':'C');
  }
 };
 const valid=Date.parse(`${start}+07:00`)%60000===0&&Date.parse(`${end}+07:00`)%60000===0&&new Set(chosen.map(row=>row.person.id)).size===chosen.length&&chosen.length<=100&&chosen.length===selected.length&&chosen.length>0&&lines.includes(target)&&!!start&&!!end&&Number.isFinite(Date.parse(`${start}+07:00`))&&Date.parse(`${start}+07:00`)>=Date.parse(now)&&Date.parse(`${end}+07:00`)>Date.parse(`${start}+07:00`)&&chosen.every(row=>row.person.pending.some(w=>Date.parse(w.effectiveAt)<=Date.parse(`${start}+07:00`)&&Date.parse(w.endsAt)>=Date.parse(`${end}+07:00`)));
 return <>
  <form className={`${styles.form} ${styles.batchForm} ${styles.compactBatch}`} aria-label="Phân bổ nhân viên đã chọn" onInvalid={notifyInvalidAction} onSubmit={async e=>{
   e.preventDefault();if(disabled||pending.current||!valid)return;
   const command={action:'allocate-many',selections:chosen.map(row=>({offerId:row.offer.id,employeeId:row.person.id})),targetLine:target,effectiveAt:iso(start),endsAt:iso(end)};
   const fingerprint=JSON.stringify(command);if(receipt.current?.fingerprint!==fingerprint)receipt.current={fingerprint,id:productionRequestId()};
   pending.current=true;setSaving(true);setMessage('');
   try{if(await onCommand({...command,expectedRevision:view.revision,requestId:receipt.current.id})){setSelected([]);receipt.current=null;setMessage(`Đã phân bổ ${chosen.length} nhân viên vào Line ${target}.`);}}
   catch{setMessage('Chưa xác nhận lưu thành công. Giữ nguyên lựa chọn; kiểm tra thông báo rồi thử lại.');}
   finally{pending.current=false;setSaving(false);}
  }}>
   <fieldset disabled={disabled}>
    <details ref={picker} className={styles.pendingPicker} onKeyDown={event=>{if(event.key==='Escape'&&picker.current){event.preventDefault();picker.current.open=false;}}} onBlur={event=>{if(event.relatedTarget instanceof Node&&!event.currentTarget.contains(event.relatedTarget)&&picker.current)picker.current.open=false;}}>
     <summary aria-label="Nhân viên chờ phân bổ"><span>Nhân viên chờ phân bổ ({selected.length})</span><span aria-hidden="true">▾</span></summary>
     <div className={styles.pendingDropdown}>
  <div className={`table-wrap ${styles.selectionList}`} role="region" aria-label="Danh sách chờ phân bổ" tabIndex={0}>
   <table><thead><tr><th><input ref={node=>{allBox.current=node;if(node)node.indeterminate=chosen.length>0&&!allSelected;}} type="checkbox" aria-label="Chọn tất cả nhân viên phù hợp" disabled={disabled||!eligible.length} checked={allSelected} onChange={e=>{const ids=new Set<string>();initialize(e.target.checked?eligible.filter(row=>{if(row.offer.targetGroup!==(chosen[0]||eligible[0]).offer.targetGroup||ids.has(row.person.id))return false;ids.add(row.person.id);return ids.size<=100;}).map(row=>row.key):[]);}}/></th><th>Nhân viên / Mã</th><th>Line nguồn</th><th>Khoảng còn chờ · GMT+7</th></tr></thead>
   <tbody>{rows.map(row=><tr key={row.key} className={selected.includes(row.key)?styles.selectedRow:undefined}>
    <td><input type="checkbox" aria-label={`Chọn ${row.person.name} (${row.person.id})`} checked={selected.includes(row.key)} disabled={disabled||!eligible.includes(row)} onChange={e=>initialize(e.target.checked?[...selected,row.key]:selected.filter(key=>key!==row.key))}/></td>
    <td><strong>{row.person.name}</strong> ({row.person.id})</td><td>Line {row.offer.sourceLine}</td>
    <td>{row.person.pending.filter(w=>Date.parse(w.endsAt)>Date.parse(now)).map(w=><div key={`${w.effectiveAt}:${w.endsAt}`}>{display(w.effectiveAt)} – {display(w.endsAt)}</div>)}
     {row.offer.allocations.some(a=>a.canceled&&a.employeeId===row.person.id&&a.effectiveAt&&a.endsAt&&row.person.pending.some(w=>Date.parse(w.effectiveAt)<Date.parse(a.endsAt!)&&Date.parse(a.effectiveAt!)<Date.parse(w.endsAt)))&&<details><summary>Đã hủy phân công vào lịch · Trả lại Chờ phân bổ</summary><p>Đề nghị chuyển từ Line {row.offer.sourceLine} vẫn còn hiệu lực. QLSX phía gửi hoặc Admin có thể rút khoảng chờ để kết thúc đề nghị.</p></details>}
    </td>
   </tr>)}{!rows.length&&<tr><td colSpan={4}>Chưa có nhân lực chờ nhận.</td></tr>}</tbody></table>
  </div>
      <div className={styles.pickerFooter}><span>Đã chọn {selected.length} / {rows.length}</span><FeedbackActionButton type="button" onClick={()=>{if(picker.current)picker.current.open=false;}}>Xong</FeedbackActionButton></div>
     </div>
    </details>
    {selected.length>0&&<>
    <label>Line nhận<select aria-label="Line nhận cho nhân viên đã chọn" value={target} onChange={e=>setTarget(e.target.value)}>{lines.map(line=><option key={line} value={line}>{line}</option>)}</select></label>
    <label>Từ ngày, giờ<ProductionDateTimeInput label="Phân bổ từ ngày giờ" value={start} onChange={setStart}/></label>
    <label>Đến ngày, giờ<ProductionDateTimeInput label="Phân bổ đến ngày giờ" value={end} min={start} onChange={setEnd}/></label>
    <FeedbackActionButton stableContainer className={styles.submit} type="submit" disabled={disabled||!valid} disabledExplanation={disabled?'Đang xử lý hoặc xác minh quyền. Vui lòng chờ.':'Chọn Line nhận và khoảng giờ hợp lệ nằm trong khoảng còn chờ của tất cả nhân viên đã chọn.'}>Lưu phân bổ ({selected.length})</FeedbackActionButton>
    </>}
   </fieldset>
   {selected.length>0&&!valid&&<p role="alert" className={styles.notice}>Khoảng thời gian phải còn hiệu lực và nằm trong khoảng còn chờ của tất cả người đã chọn. Kiểm tra ngày giờ hoặc bỏ chọn người không phù hợp.</p>}
  </form>
  {message&&<p role="status">{message}</p>}
 </>;
}
