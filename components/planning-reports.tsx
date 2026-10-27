'use client';
import {FeedbackActionButton} from './action-feedback';
import {notifyInvalidAction} from '../lib/action-feedback';
import {vietnamDisplayDate} from '../lib/vietnam-calendar.mjs';
import {ManualPagination} from './onspa-ui/ManualPagination';
import {PageTitle} from './onspa-ui/PageTitle';
import {DataTable} from './onspa-ui/DataTable';
import {DataCell} from './onspa-ui/DataCell';
import ReportPreview from './report-preview';
import {tableExportReport} from '../lib/table-report.mjs';
import { apiFetch as fetch } from "../lib/data-sync";
import {useEffect,useId,useMemo,useRef,useState,type KeyboardEvent} from 'react';
import {activateSearchButton, dispatchSearchEnter,dispatchSearchSelectEnter,markSearchSelectOpen,markSearchSelectClosed} from '../lib/search-keyboard';
import {StandardToolbar,toolbar} from './standard-toolbar/StandardToolbar';
import {reportTypes,label,columnLabels,columnsFor,unpackPlans,reportRows,filterReport,weekLabel,xmlWorkbook} from '../lib/planning-reports.mjs';
import {displayDate,monday} from '../lib/production-plan.mjs';
import styles from './planning-reports.module.css';
type Row=Record<string,any>;
const blank={week:'',query:'',group:'',line:'',status:'',from:'',to:''};
export function PlanningReportMenu({language='vi',selected,onSelect}:{language?:string;selected:string;onSelect:(value:string)=>void}){
 const groups=[{name:language==='zh'?'在途進度':language==='en'?'In-transit progress':'Tiến độ In transit',items:reportTypes.slice(0,7)},{name:language==='zh'?'生產計畫':language==='en'?'Production planning':'Kế hoạch sản xuất',items:reportTypes.slice(7)}];
 return <div role="navigation" className={styles.reportMenu} data-own-language aria-label={language==='zh'?'報表清單':language==='en'?'Report list':'Danh sách báo cáo'}>{groups.map(group=><details open key={group.name}><summary>{group.name}</summary><ul>{group.items.map(report=><li key={report[0]}><FeedbackActionButton type="button" className={selected===report[0]?styles.selected:''} aria-current={selected===report[0]?'page':undefined} onClick={()=>onSelect(report[0])}><span aria-hidden="true">▤</span><span>{label(report,language)}</span></FeedbackActionButton></li>)}</ul></details>)}</div>;
}
export default function PlanningReports({language='vi',reportType,onClose}:{language?:string;reportType:string;onClose:()=>void}){
 const t=(vi:string,zh:string,en:string)=>language==='zh'?zh:language==='en'?en:vi;
 const type=reportType;
 const searchButtonId=useId();
 const searchKeyDown=(event:KeyboardEvent<HTMLInputElement>)=>dispatchSearchEnter(event,()=>event.currentTarget.form?.requestSubmit());
 const searchSelectProps={onKeyDown:(event:KeyboardEvent<HTMLSelectElement>)=>dispatchSearchSelectEnter(event,()=>event.currentTarget.form?.requestSubmit()),onPointerDown:(event:React.PointerEvent<HTMLSelectElement>)=>markSearchSelectOpen(event.currentTarget),onBlur:(event:React.FocusEvent<HTMLSelectElement>)=>markSearchSelectClosed(event.currentTarget),onKeyUp:(event:KeyboardEvent<HTMLSelectElement>)=>{if(event.key==='Enter'||event.key==='Escape')markSearchSelectClosed(event.currentTarget);}};
 const [downloadPreview,setDownloadPreview]=useState<any>(null);
 const [filters,setFilters]=useState(blank),[applied,setApplied]=useState(blank),[preview,setPreview]=useState(false),[format,setFormat]=useState('pdf');
 const [source,setSource]=useState<Row[]>([]),[loadedType,setLoadedType]=useState(''),[loadedAt,setLoadedAt]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[page,setPage]=useState(1);
 const request=useRef<AbortController|null>(null),current=useRef({type,filters});current.current={type,filters};
 async function view(override?:typeof blank,showPreview=true){
  const chosen=current.current.type,criteria=override||current.current.filters;
  if(criteria.from&&criteria.to&&criteria.from>criteria.to){setError(t('Từ ngày phải trước hoặc bằng Đến ngày.','起日不得晚於迄日。','From date must not be after To date.'));return;}
  request.current?.abort();const controller=new AbortController();request.current=controller;
  setBusy(true);setError('');setPreview(false);setLoadedType('');
  const read=async(path:string)=>{const response=await fetch(path,{cache:'no-store',signal:controller.signal});const data=await response.json();if(!response.ok)throw Error(`${path}: HTTP ${response.status} — ${data.error||response.statusText}`);return data;};
  const records=async(entity:string)=>(await read(`/api/records?entity=${entity}`)).records||[];
  try{
   let data:Row={};
   if(chosen==='unprocessed-demand'){
    const [demand,catalog]=await Promise.all([records('demand_event'),records('sku')]);
    data={demand:demand.map((r:Row)=>({...r.payload,id:r.payload.id||r.key})),catalog:catalog.map((r:Row)=>r.payload)};
   }else if(['weekly-plan','plan-actual','engine-plan'].includes(chosen)){
    const [plans,extra]=await Promise.all([records('production_plan'),chosen==='plan-actual'?read('/api/in-transit'):chosen==='engine-plan'?records('production_engine'):Promise.resolve(null)]);
    data={plans:unpackPlans(plans),...(chosen==='plan-actual'?{transit:extra.rows}:chosen==='engine-plan'?{engines:extra}:{})};
   }else data={transit:(await read('/api/in-transit')).rows};
   if(controller.signal.aborted)return;
   setSource(reportRows(chosen,data));setPreview(showPreview);setLoadedType(chosen);setApplied({...criteria});setPage(1);setLoadedAt(new Date().toLocaleString(language==='zh'?'zh-TW':language==='en'?'en-GB':'vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hourCycle:'h23'}));
  }catch(e){if(controller.signal.aborted)return;setError(e instanceof Error&&e.message==='PLAN_DUPLICATE'?t('Có nhiều dòng kế hoạch trùng SKU trong cùng tuần. Hãy xử lý trùng ở Production Plan trước khi xuất báo cáo.','同週有重複產品計畫，請先於 Production Plan 處理。','Duplicate plans exist for a SKU in the same week. Resolve them in Production Plan before exporting.'):t('Không tải được báo cáo. Kiểm tra quyền xem menu nguồn hoặc kết nối, rồi bấm Xem trước để thử lại. ','無法載入報表。請檢查來源選單權限或連線後重試。 ','Could not load the report. Check source-menu permissions or connection, then retry. ')+(e instanceof Error?e.message:String(e)));}
  finally{if(!controller.signal.aborted)setBusy(false);}
 }
 useEffect(()=>{void view(undefined,false);return()=>request.current?.abort();},[]);
 const rows=useMemo<Row[]>(()=>filterReport(source,applied),[source,applied]);
 const columns=columnsFor(loadedType||type) as string[];
 const heading=label(reportTypes.find(r=>r[0]===(loadedType||type))!,language);
 const headers=columns.map(c=>{const v=(columnLabels as Record<string,string[]>)[c];return v?.[language==='zh'?1:language==='en'?2:0]||c;});
 const words:Record<string,string[]>={received:['Đã nhận bản Engine này','已接收此 Engine 版本','This Engine snapshot received'],'not-received':['Chưa đưa vào kế hoạch','尚未納入計畫','Not received into plan'],'other-source':['Có kế hoạch từ bản Engine khác','計畫來自其他 Engine 版本','Plan uses another Engine snapshot'],'plan-cancelled':['Kế hoạch đã hủy','計畫已取消','Plan cancelled'],'DỰ KIẾN':['Dự kiến','預計','Draft'],'ĐÃ CHỐT':['Đã chốt','已確認','Confirmed'],'ĐÃ CHUYỂN':['Đã chuyển','已轉入','Transferred'],'TẠM HOÃN':['Tạm hoãn','暫緩','On hold'],'HỦY':['Đã hủy','已取消','Cancelled'],'CHƯA MỞ LSX':['Chưa mở LSX','尚未開立工單','Not opened'],'ĐÃ MỞ LSX':['Đã mở LSX','已開立工單','Opened'],'Chưa lập kế hoạch':['Chưa lập kế hoạch','尚未排程','Unplanned'],'CHƯA ĐỒNG BỘ':['Chưa đồng bộ','尚未同步','Not synced'],'ĐÃ ĐỒNG BỘ':['Đã đồng bộ','已同步','Synced'],'CÓ THAY ĐỔI':['Có thay đổi','有變更','Changed'],'LỖI ĐỒNG BỘ':['Lỗi đồng bộ','同步錯誤','Sync error'],'HT SỚM':['Hoàn thành sớm','提前完成','Completed early'],'HT TRỄ TIẾN ĐỘ':['Hoàn thành trễ','延遲完成','Completed late'],'HT ĐÚNG TIẾN ĐỘ':['Hoàn thành đúng tiến độ','準時完成','Completed on time'],'CHƯA SẢN XUẤT':['Chưa sản xuất','尚未生產','Not started'],'ĐANG SẢN XUẤT':['Đang sản xuất','生產中','In production'],'ĐANG TẠM NGƯNG':['Đang tạm ngưng','暫停中','Paused'],'TẠM DỪNG SỰ CỐ':['Tạm dừng sự cố','異常暫停','Incident pause'],'TUẦN CHÍNH':['Tuần chính','本週','Main week'],'GỐI ĐẦU':['Gối đầu','跨週','Carryover'],'GẤP':['Gấp','緊急','Urgent'],'THƯỜNG':['Thường','一般','Normal'],'THƯỜNG - GỐI ĐẦU':['Thường – gối đầu','一般跨週','Normal carryover'],'Phát sinh':['Phát sinh','新增','Additional'],'Bù tải':['Bù tải','補載','Load balancing'],'Thường':['Thường','一般','Normal'],'Gấp':['Gấp','緊急','Urgent']};
 const word=(v:any)=>words[String(v)]?.[language==='zh'?1:language==='en'?2:0]||v;
 const cell=(row:Row,key:string):string|number=>{const v=row[key];if(v===null||v===undefined||v==='')return '—';if(key==='week')return weekLabel(v);if(key==='actualCompletedAt')return vietnamDisplayDate(v);if(['start','end','requestDate','delivery'].includes(key))return displayDate(v);if(key==='generatedAt')return new Date(v).toLocaleString(language==='zh'?'zh-TW':'en-GB',{timeZone:'Asia/Ho_Chi_Minh',hourCycle:'h23'});return word(v);};
 const exportRows=()=>rows.map(row=>columns.map(key=>cell(row,key)));
 const criteriaText=Object.entries(applied).filter(([,v])=>v).map(([k,v])=>`${({week:t('Tuần','週','Week'),query:'SKU',group:t('Nhóm SP','產品組','Group'),line:'Line',status:t('Trạng thái','狀態','Status'),from:t('Từ','從','From'),to:t('Đến','至','To')} as Record<string,string>)[k]}: ${k==='week'?weekLabel(v):['from','to'].includes(k)?displayDate(v):word(v)}`).join(' · ');
 const note=loadedType==='plan-actual'?t('So sánh với kế hoạch hiện tại đã lưu; loại kế hoạch/LSX đã hủy. Mỗi kế hoạch tính một lần, cộng các LSX liên kết. Không bao gồm lệnh phát sinh ngoài kế hoạch. SL hoàn thành là sản xuất, không phải nhập kho.','以目前已儲存計畫比較；排除取消資料。每個計畫僅計一次，彙總關聯工單；不含計畫外工單。完成量非入庫量。','Uses current saved plans, excluding cancelled plans/orders. Each plan is counted once with linked orders summed; unplanned orders are excluded. Completion is production, not warehouse receipt.'):loadedType==='engine-plan'?t('Dùng bản Engine mới nhất của mỗi tuần. Chỉ ghi đã nhận khi kế hoạch liên kết đúng bản Engine; “—” là chưa có dữ liệu xác nhận.','使用每週最新 Engine 版本。僅有正確來源關聯才視為已接收；「—」表示無確認資料。','Uses the latest Engine snapshot per week. Received requires an explicit matching source link; “—” means no confirmed value.'):loadedType==='unprocessed-demand'?t('Hiển thị nhu cầu chưa lập kế hoạch. Tuần/khoảng ngày lọc theo ngày giao; nếu chưa có ngày giao thì dùng ngày yêu cầu.','顯示未排程需求；週次與日期以交貨日篩選，無交貨日則用需求日。','Shows unplanned demand. Week/date filters use delivery date, falling back to request date.'):t('Khoảng ngày lọc theo ngày bắt đầu kế hoạch đối với báo cáo tuần; các báo cáo In transit dùng ngày kết thúc kế hoạch.','週計畫以開始日篩選；在途報表以計畫結束日篩選。','Date range uses planned start for weekly plans and planned end for in-transit reports.');
 function excel(){try{const content=xmlWorkbook(`${heading} | ${criteriaText} | ${loadedAt} (VN) | ${note}`,headers,exportRows());const url=URL.createObjectURL(new Blob([content],{type:'application/vnd.ms-excel;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`ONSPA_${loadedType}_${applied.week||'all'}.xml`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch{setError(t('Không xuất được Excel. Hãy thử lại.','無法匯出 Excel，請重試。','Could not export Excel. Please retry.'));}}
 function print(){const win=window.open('','_blank');if(!win){setError(t('Trình duyệt chặn cửa sổ in. Hãy cho phép cửa sổ bật lên rồi thử lại.','瀏覽器已封鎖列印視窗，請允許後重試。','The browser blocked the print window. Allow pop-ups and retry.'));return;}win.opener=null;const esc=(v:any)=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(heading)}</title><style>@page{size:A3 landscape;margin:10mm}body{font:11px 'Times New Roman',serif;color:#184e2d}table{border-collapse:collapse;width:100%}th,td{border:1px solid #b8cfb9;padding:5px}th{background:#eef4ed}thead{display:table-header-group}tr{break-inside:avoid}</style></head><body><h2>ONSPA — ${esc(heading)}</h2><p>${esc(criteriaText)} · ${esc(loadedAt)} (VN)</p><p>${esc(note)}</p><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${exportRows().map(row=>`<tr>${row.map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`);win.document.close();win.focus();win.print();}
 const change=(key:keyof typeof blank,value:string)=>{setFilters(old=>({...old,[key]:value}));setPreview(false);setError('');};
 const options=(key:'group'|'line'|'status')=>[...new Set(source.map(r=>String(r[key]||'')).filter(Boolean))].sort();
 const valid=preview&&!!loadedType&&!busy&&rows.length>0&&loadedType===type;
 const pages=Math.max(1,Math.ceil(rows.length/25)),shown=rows.slice((page-1)*25,page*25);
 return <main className={`workspace ${styles.workspace}`} data-own-language data-planning-data="true">
 {downloadPreview&&<ReportPreview report={downloadPreview} close={()=>setDownloadPreview(null)}/>}
 <header className={styles.reportTitle}><PageTitle>{heading}</PageTitle><FeedbackActionButton type="button" onClick={onClose} aria-label={t('Đóng báo cáo','關閉報表','Close report')}>×</FeedbackActionButton></header>
 <form onInvalid={notifyInvalidAction} className={styles.criteria} onSubmit={event=>{event.preventDefault();const button=document.getElementById(searchButtonId);if(button instanceof HTMLButtonElement)activateSearchButton(button);}}>
 <fieldset disabled={busy}><legend>{t('Chọn thời gian','選擇時間','Select period')}</legend>
 <label><span>{t('Tuần kế hoạch','計畫週次','Plan week')}</span><input onKeyDown={searchKeyDown} aria-label="Plan week" type="date" value={filters.week} onChange={e=>change('week',monday(e.target.value))}/></label>
 {filters.week&&<p>{weekLabel(filters.week)}</p>}
 <label><span>{t('Từ ngày','起日','From date')}</span><input onKeyDown={searchKeyDown} type="date" value={filters.from} onChange={e=>change('from',e.target.value)}/></label>
 <label><span>{t('Đến ngày','迄日','To date')}</span><input onKeyDown={searchKeyDown} type="date" value={filters.to} onChange={e=>change('to',e.target.value)}/></label>
 </fieldset>
 <fieldset disabled={busy}><legend>{t('Chọn sản phẩm / Lệnh sản xuất','選擇產品／工單','Select product / work order')}</legend>
 <label><span>{t('SKU / Tên / Mã lệnh','SKU／名稱／工單號','SKU / Name / Order')}</span><input onKeyDown={searchKeyDown} value={filters.query} onChange={e=>change('query',e.target.value)} placeholder={t('Nhập nội dung cần tra','輸入查詢內容','Enter search value')}/></label>
 <label><span>{t('Nhóm sản phẩm','產品組','Product group')}</span><select {...searchSelectProps} value={filters.group} onChange={e=>change('group',e.target.value)}><option value="">{t('Tất cả','全部','All')}</option>{options('group').map(v=><option key={v} value={v}>{v}</option>)}</select></label>
 <label><span>{t('Dây chuyền sản xuất','生產線','Production line')}</span><select {...searchSelectProps} value={filters.line} onChange={e=>change('line',e.target.value)}><option value="">{t('Tất cả','全部','All')}</option>{options('line').map(v=><option key={v} value={v}>{v}</option>)}</select></label>
 </fieldset>
 <fieldset disabled={busy}><legend>{t('Chọn trạng thái','選擇狀態','Select status')}</legend>
 <label><span>{t('Trạng thái','狀態','Status')}</span><select {...searchSelectProps} value={filters.status} onChange={e=>change('status',e.target.value)}><option value="">{t('Tất cả','全部','All')}</option>{options('status').map(v=><option key={v} value={v}>{word(v)}</option>)}</select></label>
 </fieldset>
 <fieldset><legend>{t('Chọn định dạng xuất','選擇輸出格式','Select output format')}</legend>
 <label className={styles.format}><input type="radio" name="report-format" value="pdf" checked={format==='pdf'} onChange={()=>setFormat('pdf')}/><span>PDF</span></label>
 <label className={styles.format}><input type="radio" name="report-format" value="excel" checked={format==='excel'} onChange={()=>setFormat('excel')}/><span>Excel (.xlsx)</span></label>
 </fieldset>
 <button type="submit" hidden tabIndex={-1} disabled={busy} aria-hidden="true"/>
 </form>
 <StandardToolbar name="PlanningReports" items={[
  toolbar.action({onClick:()=>setDownloadPreview(tableExportReport({title:heading,headers,rows:exportRows()})),disabled:!valid, disabledExplanation: "Chọn đầy đủ điều kiện báo cáo hợp lệ và xem trước trước khi xuất."},<>{t('Xuất báo cáo','匯出報表','Export report')}</>,true,'action'),
  toolbar.action({disabled:busy, disabledExplanation: "Đang xử lý. Vui lòng chờ hoàn tất rồi thử lại.",onClick:()=>{setFilters(blank);setApplied(blank);setPreview(false);setPage(1);setError('');}},<>Xóa lọc</>,true,'clear'),
  toolbar.action({id:searchButtonId,disabled:busy, disabledExplanation: "Đang xử lý. Vui lòng chờ hoàn tất rồi thử lại.",onClick:()=>view()},<>{busy?t('Đang tải…','載入中…','Loading…'):t('Xem trước','預覽','Preview')}</>,true,'search'),
  toolbar.action({onClick:onClose},<>Quay lại danh sách</>,true,'back')
 ]}/>
 {error&&<p className={styles.error} role="alert">{error}</p>}
 {preview&&<section className="data-card">
 <div className={styles.summary}><strong>{heading}</strong><span>{loadedAt&&loadedType?`${t('Dữ liệu lúc','資料時間','Data as of')} ${loadedAt} (VN) · ${rows.length} ${t('dòng','筆','rows')}`:''}</span></div>
 {loadedType&&<p className={styles.note}>{note}{criteriaText&&<> · {criteriaText}</>}</p>}
 <DataTable className="table-wrap" tabIndex={0} aria-label={heading}><table data-no-pagination="true" data-report-source={JSON.stringify({title:heading,headers,rows:exportRows()})}><thead><tr>{headers.map((h,i)=><th key={columns[i]}>{h}</th>)}</tr></thead><tbody>{shown.map((row,i)=><tr key={`${row.id||row.sku}-${i}`}>{columns.map(c=><DataCell kind="number" key={c}>{typeof cell(row,c)==='number'?Number(cell(row,c)).toLocaleString(language==='zh'?'zh-TW':language==='en'?'en-GB':'vi-VN'):cell(row,c)}</DataCell>)}</tr>)}{!shown.length&&<tr data-no-data="true"><DataCell colSpan={columns.length}>{busy?t('Đang tải dữ liệu…','載入中…','Loading…'):loadedType?t('Không có dữ liệu phù hợp.','沒有符合的資料。','No matching data.'):t('Chọn loại báo cáo rồi bấm Xem báo cáo.','選擇報表後按查看報表。','Choose a report and click View report.')}</DataCell></tr>}</tbody></table></DataTable>
 <ManualPagination total={rows.length} page={page} pageSize={25} disabled={busy} onPageChange={setPage}/>
 </section>}</main>;
}
