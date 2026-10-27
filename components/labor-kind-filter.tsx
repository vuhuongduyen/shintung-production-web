"use client";
import {useSyncExternalStore} from 'react';
import {Popover,PopoverTrigger,PopoverContent} from './ui/popover';
import styles from './standard-toolbar/StandardToolbar.module.css';
import filterStyles from './labor-kind-filter.module.css';
import {translateToolbar,toolbarLocale,subscribeToolbarLocale} from './standard-toolbar/translations';
export const laborKinds=['Nghỉ','Đi trễ','Về sớm','Phụ kho','CV khác','Chuyển Line','Thu hồi nhân sự'];
export default function LaborKindFilter({value,onChange}:{value:string;onChange:(value:string)=>void}) {
 const locale=useSyncExternalStore(subscribeToolbarLocale,toolbarLocale,()=> 'vi');
 const t=(text:string)=>translateToolbar(text,locale);
 const selected=value?value.split('|'):[];
 const toggle=(kind:string)=>onChange(laborKinds.filter(k=>k===kind?!selected.includes(k):selected.includes(k)).join('|'));
 return <Popover><PopoverTrigger asChild><button type="button" className={`${styles.button} ${filterStyles.trigger}`} aria-label={t('Loại biến động tra cứu')} title={selected.map(t).join(', ')}>{selected.length?selected.map(t).join(', '):t('Tất cả biến động')} ▾</button></PopoverTrigger><PopoverContent align="start" className={filterStyles.panel}><div className={filterStyles.options} role="group" aria-label={t('Loại biến động')}><label className={filterStyles.option}><input type="checkbox" checked={!value} onChange={()=>onChange('')}/>{t('Tất cả biến động')}</label>{laborKinds.map(kind=><label key={kind} className={filterStyles.option}><input type="checkbox" checked={selected.includes(kind)} onChange={()=>toggle(kind)}/>{t(kind)}</label>)}</div></PopoverContent></Popover>;
}
