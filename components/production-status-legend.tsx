'use client';
import {useSyncExternalStore} from 'react';
import {Popover,PopoverTrigger,PopoverContent} from './ui/popover';
import {FeedbackActionButton} from './action-feedback';
import {toolbarLocale,subscribeToolbarLocale,translateToolbar} from './standard-toolbar/translations';
const states=[['overdue','Quá hạn'],['running','Đang SX'],['waiting','Chưa SX'],['paused','Đang tạm ngưng'],['incident','Tạm dừng sự cố'],['review','Chờ xác nhận HT'],['early','HT sớm'],['completed','Hoàn thành'],['late','HT trễ'],['cancelled','Đã hủy']];
const colors:Record<string,[string,string]>={cancelled:['#ffe4e6','#a11b24'],overdue:['#b42318','#fff'],running:['#cde3ff','#104d91'],waiting:['#ffedb0','#694600'],paused:['#ffddb4','#874000'],incident:['#ebcff5','#722183'],review:['#e9ddf4','#643489'],early:['#bcece3','#005e55'],completed:['#c4e9c6','#195c2b'],late:['#ffd0cd','#a01c16']};
export default function ProductionStatusLegend(){
 const locale=useSyncExternalStore(subscribeToolbarLocale,toolbarLocale,()=> 'vi'),t=(v:string)=>translateToolbar(v,locale);
 return <Popover><PopoverTrigger asChild><FeedbackActionButton type="button" className="output-formula-arrow" aria-label={t('Quy định màu trạng thái')}>ⓘ</FeedbackActionButton></PopoverTrigger><PopoverContent className="production-reason-popover" side="bottom" align="end" collisionPadding={12}><strong>{t('Quy định màu trạng thái')}</strong><ul style={{listStyle:'none',padding:0,display:'grid',gap:8}}>{states.map(([tone,label])=><li key={tone}><span className={`onspa-progress onspa-progress-${tone}`} style={{background:colors[tone][0],color:colors[tone][1],display:'inline-block',padding:'4px 8px'}}>{t(label)}</span></li>)}</ul><p>{t('Lệnh chưa hoàn thành còn sản lượng và đã quá ngày kế hoạch: ưu tiên màu đỏ, giữ nguyên tên trạng thái. Không hiển thị thêm dòng Quá hạn.')}</p></PopoverContent></Popover>;
}
