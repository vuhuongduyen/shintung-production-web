'use client';
import {FeedbackActionButton} from '../action-feedback';
import {useSyncExternalStore} from 'react';
import {subscribeToolbarLocale,toolbarLocale} from '../standard-toolbar/translations';
import {paginationModel,paginationPages,paginationLabels,paginationSummary} from '../../lib/pagination-presentation.mjs';
export {paginationPages} from '../../lib/pagination-presentation.mjs';
type Props={total:number;page:number;pageSize:number;onPageChange:(page:number)=>void;disabled?:boolean;className?:string};
export function ManualPagination(props:Props){
 const locale=useSyncExternalStore(subscribeToolbarLocale,toolbarLocale,()=> 'vi');
 return <PaginationView {...props} locale={locale}/>;
}
export function PaginationView({total,page,pageSize,onPageChange,disabled=false,className='',locale}:Props & {locale:string}){
 const model=paginationModel(total,page,pageSize),{pages,current}=model,labels=paginationLabels(locale);
 const change=(target:number)=>{if(!disabled&&target!==current)onPageChange(target);};
 return <nav className={`onspa-manual-pagination onspa-pagination ${className}`} aria-label={labels.navigation}>
  <span className="onspa-pagination-summary">{paginationSummary(model,locale)}</span>
  <div className="onspa-pagination-pages"><FeedbackActionButton type="button" aria-label={labels.previous} disabled={disabled||current<=1} disabledExplanation={disabled?'Đang xử lý. Vui lòng chờ hoàn tất.':'Bạn đang ở trang đầu tiên.'} onClick={()=>change(current-1)}>‹</FeedbackActionButton>
  {paginationPages(current,pages).map((value,index)=>value==='ellipsis'?<span key={`ellipsis-${index}`} aria-hidden="true">…</span>:<FeedbackActionButton type="button" key={value} className={current===value?'active':''} aria-current={current===value?'page':undefined} aria-label={`${labels.page} ${value}`} disabled={disabled||model.total===0} disabledExplanation={disabled?'Đang xử lý. Vui lòng chờ hoàn tất.':'Chưa có dữ liệu để chuyển trang.'} onClick={()=>change(value)}>{value}</FeedbackActionButton>)}
  <FeedbackActionButton type="button" aria-label={labels.next} disabled={disabled||current>=pages} disabledExplanation={disabled?'Đang xử lý. Vui lòng chờ hoàn tất.':'Bạn đang ở trang cuối cùng.'} onClick={()=>change(current+1)}>›</FeedbackActionButton></div>
 </nav>;
}
