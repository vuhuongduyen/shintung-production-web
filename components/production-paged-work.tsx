'use client';
import {useCallback,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {WorkspaceActivityContext,useDataRefresh} from '../lib/data-sync';
import {cachedProductionPage,readProductionPage} from '../lib/production-page-cache';
import {productionOrderPageUrl,applyPagedProductionSave} from '../lib/production-order-page-client.mjs';
import {StandardToolbar,toolbar,ExportPermissionContext} from './standard-toolbar/StandardToolbar';
import {PageTitle} from './onspa-ui/PageTitle';
import {FeedbackActionButton} from './action-feedback';
import ProductionDailyBoard from './production-daily-board';
import ProductionPagedWorkDetail from './production-paged-work-detail';
type Row=Record<string,any>;
export default function ProductionPagedWork({sessionLine,preferenceUser,fallback}:{sessionLine?:string;preferenceUser?:string;fallback:ReactNode}){
 const active=useContext(WorkspaceActivityContext),exportAllowed=useContext(ExportPermissionContext),[snapshot,setSnapshot]=useState<Row|null>(null),[legacy,setLegacy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [search,setSearch]=useState(false),[field,setField]=useState(''),[query,setQuery]=useState(''),[line,setLine]=useState(sessionLine||'all'),[status,setStatus]=useState('all'),[applied,setApplied]=useState<Row|null>(null),[sort,setSort]=useState('due'),[page,setPage]=useState(1),[refresh,setRefresh]=useState(0);
 const [editing,setEditing]=useState(false),[detail,setDetail]=useState<Row|null>(null),[notice,setNotice]=useState(''),[holdExpired,setHoldExpired]=useState(false);
 const loadedUrl=useRef('');
 const generation=useRef(0),owner=useRef({}),seen=useRef(new Set<string>()),revision=useDataRefresh(['production_workflow','production_report'],{ignoreSource:owner.current});
 const url=productionOrderPageUrl({page,sort,applied,line:sessionLine||'all'});
 const held=editing||!!detail;
 const lastRead=useRef({url:'',refresh:0,revision:0});
 const identity=JSON.stringify([preferenceUser||'',sessionLine||'all']);
 useEffect(()=>{if(!active||held)return;const id=++generation.current;
  const cached=cachedProductionPage(url,identity);if(cached?.supported===true){loadedUrl.current=url;setSnapshot(cached);setLegacy(false);}
  setLoading(true);setError('');
  const force=lastRead.current.url===url&&(lastRead.current.refresh!==refresh||lastRead.current.revision!==revision);lastRead.current={url,refresh,revision};
  void readProductionPage(url,identity,force).then(data=>{if(id!==generation.current)return;
   if(data.supported===false){setLegacy(true);setLoading(false);return;}
   loadedUrl.current=url;setLegacy(false);setSnapshot(data);setPage(data.page);setLoading(false);
  }).catch(e=>{if(id!==generation.current)return;if(e.status===401||e.status===403){loadedUrl.current='';setSnapshot(null);}setError(e.message);setLoading(false);});
  // Focus/poll joins an in-flight read instead of aborting and restarting it.
  return()=>{generation.current++;};
 },[url,active,held,refresh,revision,identity]);
 useEffect(()=>{if(!active||held||!snapshot||loadedUrl.current!==url||snapshot.page*snapshot.pageSize>=snapshot.total)return;
  const timer=setTimeout(()=>{void readProductionPage(productionOrderPageUrl({page:snapshot.page+1,sort,applied,line:sessionLine||'all'}),identity).catch(()=>{});},250);
  return()=>clearTimeout(timer);
 },[snapshot,url,active,held,sort,applied,sessionLine,identity]);
 useEffect(()=>{setHoldExpired(false);if(!snapshot?.reportingHold?.active)return;const t=setTimeout(()=>{setHoldExpired(true);setRefresh(n=>n+1);},Math.max(0,snapshot.reportingHold.remainingMs));return()=>clearTimeout(t);},[snapshot?.reportingHold]);
 const saved=useCallback((result:Row)=>{setSnapshot(old=>applyPagedProductionSave(old,result,seen.current));setRefresh(n=>n+1);},[]);
 const reset=()=>{setApplied(null);setQuery('');setStatus('all');setLine(sessionLine||'all');setPage(1);};
 const find=()=>{if(!field){setError('Chọn hạng mục tra cứu trước khi tìm kiếm.');return;}if(!['Line','Trạng thái'].includes(field)&&!query.trim()){setError('Nhập nội dung tra cứu trước khi tìm kiếm.');return;}setApplied({field,query:query.trim(),status,line});setPage(1);setRefresh(n=>n+1);};
 if(legacy)return <>{fallback}</>;
 const paused=!!snapshot?.reportingHold?.active&&!holdExpired;
 return <main className="workspace production-workspace production-work-screen" aria-busy={loading}><PageTitle variant="menu-root">SX BÁO CÔNG</PageTitle>
  {paused&&<div role="status" className="data-card production-attendance-note">{snapshot?.reportingHold.message}</div>}
  <div className="work-command-row"><StandardToolbar permissionFeedback name="ProductionManagement" items={[
   toolbar.action({onClick:()=>setSearch(true)},'Tra cứu',true,'lookup'),
   ...(search?[
    toolbar.field('Tra theo',[toolbar.select({value:field,onChange:e=>{setField(e.target.value);setQuery('');setStatus('all');}},<><option value="">Chọn hạng mục</option>{['LSX','SKU','Tên sản phẩm','Plan ID','Line','Trạng thái','Tuần kế hoạch'].map(v=><option key={v}>{v}</option>)}</>)]),
    ...(field?[toolbar.field('Nội dung tra',[field==='Line'?toolbar.select({value:line,disabled:!!sessionLine,onChange:e=>setLine(e.target.value)},<>{sessionLine?<option value={sessionLine}>Line {sessionLine}</option>:<><option value="all">Tất cả Line</option>{['A','B'].map(v=><option key={v} value={v}>Line {v}</option>)}</>}</>):field==='Trạng thái'?toolbar.select({value:status,onChange:e=>setStatus(e.target.value)},<><option value="all">Tất cả trạng thái</option>{[['completed','Đã hoàn thành (sớm / đúng / trễ)'],['running','Đang sản xuất'],['waiting','Chưa sản xuất'],['paused','Tạm ngưng'],['incident','Sự cố'],['review','Chờ xác nhận hoàn thành'],['cancelled','Đã hủy']].map(([v,s])=><option key={v} value={v}>{s}</option>)}</>):toolbar.input({type:field==='Tuần kế hoạch'?'date':'text',value:query,onChange:e=>setQuery(e.target.value),onKeyDown:e=>{if(e.key==='Enter')find();},placeholder:`Nhập ${field}`})])]:[]),
    toolbar.action({onClick:find},'Tìm kiếm',true,'search'),toolbar.action({onClick:reset},'Xóa lọc',true,'clear'),toolbar.action({onClick:()=>{setSearch(false);setField('');reset();}},'Quay lại',true,'back')
   ]:[toolbar.field('Sắp xếp',[toolbar.select({value:sort,onChange:e=>{setSort(e.target.value);setPage(1);}},<><option value="due">Hạn hoàn thành gần nhất</option><option value="start">Ngày bắt đầu gần nhất</option></>)])]),
   toolbar.action({onClick:()=>setRefresh(n=>n+1),disabled:loading||held,disabledExplanation:'Đang xử lý hoặc đang mở bản nháp.'},'Cập nhật dữ liệu',true,'action'),
   toolbar.action({onClick:()=>window.location.assign(productionOrderPageUrl({page:1,sort,applied,line:sessionLine||'all',format:'csv'})),disabled:!snapshot||!snapshot.rights.export||!exportAllowed||loading||held||!!error,disabledExplanation:!exportAllowed||snapshot&&!snapshot.rights.export?'Bạn chưa có quyền xuất dữ liệu SX báo công.':'Chờ danh sách tải xong và đóng bản nháp trước khi xuất.'},'Xuất dữ liệu CSV theo bộ lọc',true,'action')
  ]}/></div>
  {error&&<div role="alert" className="production-inline-message error">{error}{snapshot?' Đang giữ kết quả đã tải trước đó.':''} <FeedbackActionButton type="button" disabled={loading} disabledExplanation="Đang tải dữ liệu. Vui lòng chờ hoàn tất rồi thử lại." onClick={()=>setRefresh(n=>n+1)}>Thử lại</FeedbackActionButton></div>}
  <p role="status" className="production-attendance-note" style={{minHeight:"1.4em"}}>{loading&&snapshot?(loadedUrl.current===url?'Đang cập nhật nền… Bạn vẫn có thể chọn trang khác.':'Đang tải trang đã chọn… Bạn vẫn có thể chọn trang khác.'):''}</p>
  {notice&&<div role="status" className="production-inline-message success">{notice}</div>}
  {!snapshot&&!error&&<section className="data-card production-empty" role="status">Đang tải dữ liệu sản xuất…</section>}
  {snapshot&&<><p className="production-attendance-note">Theo toàn bộ bộ lọc: {snapshot.total.toLocaleString('vi-VN')} lệnh · Đã duyệt {snapshot.totals.approved.toLocaleString('vi-VN')} · Chờ duyệt {snapshot.totals.pending.toLocaleString('vi-VN')}</p><ProductionDailyBoard orders={snapshot.orders} reports={[]} policy={snapshot.dailyOutputPolicy} allowed={snapshot.rights.work&&!paused&&loadedUrl.current===url} blockedReason={!snapshot.rights.work?'Bạn chưa có quyền báo sản lượng.':paused?snapshot.reportingHold?.message:loadedUrl.current!==url?'Đang tải trang hoặc bộ lọc mới. Vui lòng chờ đúng kết quả.':undefined} active={active} owner={owner.current} onSaved={saved} openDetail={setDetail} onEditingChange={setEditing} onNotice={setNotice} serverPage={{page:snapshot.page,pageSize:snapshot.pageSize,total:snapshot.total,loading:held,onChange:next=>{if(next===page)setRefresh(n=>n+1);else setPage(next);}}}/></>}
  {detail&&snapshot&&<ProductionPagedWorkDetail order={detail} active={active} onClose={()=>setDetail(null)}/>}
 </main>;
}
