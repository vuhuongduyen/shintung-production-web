'use client';
import {WarehouseSheetSetup} from './warehouse-sheet-setup';
import {useContext,useEffect,useRef,useState} from 'react';
import {StandardToolbar,toolbar,ToolbarPermissions} from './standard-toolbar/StandardToolbar';
import {productionDisplayTime} from '../lib/production-display-time.mjs';
import {ACTION_FEEDBACK_EVENT,notifyActionFailure} from '../lib/action-feedback';
import {recordFetch} from '../lib/record-fetch';
import {announceDataChange} from '../lib/data-sync';
type Receipt={pendingCorrection?:{status:string};withdrawalRequest?:{status:string};sheetSync?:{status:string;error?:string;command?:{kind:string}};id:string;group?:string;confirmedBy?:string;source?:string;entryMode?:string;reportId?:string;lsxCode?:string;sku?:string;name?:string;spec?:string;line?:string;proposedQuantity?:number;receivedQuantity?:number|null;status?:string;confirmation_status?:string;confirmationStatus?:string;createdBy?:string;createdAt?:string;sourceCompletedAt?:string;cancelled?:boolean;voided?:boolean;_deleted?:boolean};
const receiptTime=(value?:string)=>{if(!value)return 0;const normalized=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(value)?value+'+07:00':value;return Date.parse(normalized)||0;};
const rawStatusOf=(r:Receipt)=>r.confirmation_status||r.confirmationStatus||r.status||'—';
const statusOf=(r:Receipt)=>r.pendingCorrection?.status==='pending'?'Chờ đối soát sửa/hủy':r.withdrawalRequest?.status==='pending'?'Chờ Kho xử lý thu hồi':r.withdrawalRequest?.status==='approved-awaiting-sheet'?'Kho đồng ý, chờ đối soát Sheet':rawStatusOf(r);
export function WarehouseReceipts({catalog,onOpenSku,pendingOnly,requestSequence,searchOpen,onCloseSearch,onOpenSearch,onChooseErp}:{onOpenSearch:()=>void;onChooseErp:()=>void;searchOpen:boolean;onCloseSearch:()=>void;catalog:{code:string;group:string}[];onOpenSku:(sku:string)=>void;pendingOnly:boolean;requestSequence?:number}){
 const canUse=useContext(ToolbarPermissions),canConfirm=canUse('WarehouseContent','Xác nhận');
 const [selected,setSelected]=useState<string[]>([]),[review,setReview]=useState<{revision:string;receipts:Receipt[]}|null>(null),[confirmBusy,setConfirmBusy]=useState(false);
 const [receivedChecked,setReceivedChecked]=useState(false);
 const lock=useRef(false),allBox=useRef<HTMLInputElement>(null);
 const confirmSelected=async(action:'preview'|'confirm')=>{
  if(lock.current)return;lock.current=true;setConfirmBusy(true);
  try{
   const response=await recordFetch('/api/warehouse-confirm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,ids:action==='preview'?selectedShown.map(r=>r.id):review?.receipts.map(r=>r.id),revision:review?.revision,receivedAsProposed:receivedChecked})});
   const result=await response.json();
   if(!response.ok)throw Object.assign(Error(result.error||'Không xác nhận được. Kiểm tra kết nối và thử lại.'),{status:response.status});
   if(action==='preview'){setReview(result);setReceivedChecked(false);return;}
   setReview(null);setSelected([]);announceDataChange('warehouse_in');setReload(n=>n+1);
   window.dispatchEvent(new CustomEvent('onspa-approvals-changed'));
   if(result.ok===false)throw Error(result.error);
   window.dispatchEvent(new CustomEvent(ACTION_FEEDBACK_EVENT,{detail:{kind:'success',message:`Đã xác nhận ${result.confirmed} phiếu nhập kho.`}}));
  }catch(e){if((e as {status?:number}).status===409){setReview(null);setReceivedChecked(false);setSelected([]);setReload(n=>n+1);}notifyActionFailure((e as Error).message);}finally{lock.current=false;setConfirmBusy(false);}
 };
 const [maintenance]=useState(()=>typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('warehouse-maintenance')==='1');
 const [confirmPlan,setConfirmPlan]=useState<any>(null);
 const runConfirm=async(action:string)=>{setSyncBusy(true);try{const response=await recordFetch('/api/warehouse-backfill',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,revision:confirmPlan?.revision,receivedAsProposed:true})});const result=await response.json();if(!response.ok)throw Error(result.error);setConfirmPlan(result);if(action==='confirm'){setReload(n=>n+1);window.dispatchEvent(new CustomEvent(ACTION_FEEDBACK_EVENT,{detail:{kind:'success',message:`Đã xác nhận ${result.confirmed} phiếu nhập kho.`}}));}}catch(e){notifyActionFailure((e as Error).message);}finally{setSyncBusy(false);}};
 const [syncPlan,setSyncPlan]=useState<any>(null),[syncBusy,setSyncBusy]=useState(false),[reload,setReload]=useState(0);
 const runSync=async(action:string)=>{setSyncBusy(true);try{const response=await recordFetch('/api/warehouse-backfill',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,revision:syncPlan?.revision})});const result=await response.json();if(!response.ok)throw Error(result.error||'Không đối chiếu được');setSyncPlan(result);if(action==='apply'){setReload(n=>n+1);window.dispatchEvent(new CustomEvent(ACTION_FEEDBACK_EVENT,{detail:{kind:'success',message:`Đã bù ${result.created} phiếu nhập kho. Phiếu đã có được giữ nguyên.`}}));}}catch(e){notifyActionFailure(String((e as Error).message));}finally{setSyncBusy(false);}};
 const [audit,setAudit]=useState<{approved:number;receipts:number;pending:number;missing:{reportId:string;lsxCode:string;sku:string;quantity:number}[]}|null>(null);
 const [rows,setRows]=useState<Receipt[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{let alive=true;setLoading(true);setError('');recordFetch('/api/records?entity=warehouse_in'+(maintenance?'&audit=1':'')).then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.error||'Không tải được phiếu nhập kho.');if(alive)setAudit(data.reconciliation||null);return (data.records||[]).map((r:{key:string;payload:Receipt;sourceCompletedAt?:string})=>({...r.payload,id:r.key,sourceCompletedAt:r.sourceCompletedAt})).filter((r:Receipt)=>!r._deleted);}).then(data=>{if(alive)setRows(data);}).catch(e=>{if(alive)setError(`${e.message} Vui lòng tải lại trang để thử lại.`);}).finally(()=>{if(alive)setLoading(false);});return()=>{alive=false};},[requestSequence,reload,maintenance]);
 const [field,setField]=useState(''),[draft,setDraft]=useState(''),[applied,setApplied]=useState({field:'',value:''});
 const groupOf=(r:Receipt)=>catalog.find(s=>s.code===r.sku)?.group||r.group||'—';
 const modeOf=(r:Receipt)=>r.entryMode==='manual'?'Thủ công':r.entryMode==='automatic'||(r.source==='Sản xuất'&&r.reportId)?'Tự động':'Chưa ghi nhận';
 const valueOf=(r:Receipt,key:string)=>key==='group'?groupOf(r):key==='mode'?modeOf(r):key==='status'?statusOf(r):String(r[key as keyof Receipt]||'');
 const fields=[['lsxCode','Lệnh sản xuất'],['sku','SKU'],['name','Tên SP'],['group','Nhóm SP'],['line','Line'],['status','Trạng thái'],['createdBy','Người ghi nhận'],['confirmedBy','Người xác nhận'],['mode','Cách ghi nhận']];
 const clear=()=>{setDraft('');setApplied({field:'',value:''})};
 const shown=rows.filter(r=>!applied.value||valueOf(r,applied.field).toLocaleLowerCase('vi').includes(applied.value.toLocaleLowerCase('vi'))).filter(r=>!pendingOnly||rawStatusOf(r)==='Chờ xác nhận').sort((a,b)=>receiptTime(b.sourceCompletedAt)-receiptTime(a.sourceCompletedAt));
 const eligible=shown.filter(r=>r.source==='Sản xuất'&&rawStatusOf(r)==='Chờ xác nhận'&&!r.cancelled&&!r.voided&&r.pendingCorrection?.status!=='pending'&&!r.sheetSync?.command);
 const selectedShown=eligible.filter(r=>selected.includes(r.id));
 useEffect(()=>{if(allBox.current)allBox.current.indeterminate=selectedShown.length>0&&selectedShown.length<eligible.length;},[selectedShown.length,eligible.length]);
 useEffect(()=>{setSelected([]);setReview(null);},[applied,pendingOnly,requestSequence]);
 return <>
 <WarehouseSheetSetup/>
 <StandardToolbar name="WarehouseContent" items={[
 toolbar.action({'aria-pressed':true,onClick:()=>{}},'Nhập từ Sản xuất báo công',true,'action'),
 toolbar.action({onClick:onChooseErp},'Tự nhập bằng phiếu ERP',true,'action'),
 toolbar.action({onClick:onOpenSearch,'aria-pressed':searchOpen},'Tra cứu',true,'lookup'),
 toolbar.action({onClick:()=>confirmSelected('preview'),disabled:confirmBusy||!selectedShown.length||selectedShown.length>500,disabledExplanation:'Tích chọn từ 1 đến 500 phiếu chờ xác nhận trong bảng.'},`Xác nhận đã chọn (${selectedShown.length})`,canConfirm,'action'),
 searchOpen&&toolbar.field('Tra theo',[toolbar.select({value:field,onChange:e=>{setField(e.target.value);setDraft('')}},<><option value="">Chọn hạng mục</option>{fields.map(([v,l])=><option key={v} value={v}>{l}</option>)}</>)]),
 searchOpen&&!!field&&toolbar.field('Nội dung tra',[['group','line','status','mode','createdBy','confirmedBy'].includes(field)?toolbar.select({value:draft,onChange:e=>setDraft(e.target.value)},<><option value="">Chọn nội dung</option>{Array.from(new Set(rows.map(r=>valueOf(r,field)))).filter(Boolean).sort().map(v=><option key={v} value={v}>{v}</option>)}</>):toolbar.input({value:draft,onChange:e=>setDraft(e.target.value),'aria-label':'Nội dung tra'})]),
 searchOpen&&toolbar.action({onClick:clear},'Xóa lọc',true,'clear'),
 searchOpen&&toolbar.action({onClick:()=>{if(field&&draft.trim())setApplied({field,value:draft.trim()})}},'Tìm kiếm',true,'search'),
 searchOpen&&toolbar.action({onClick:()=>{clear();onCloseSearch();setField('')}},'Quay lại',true,'back')
 ]}/>

 {maintenance&&audit&&<StandardToolbar name="WarehouseContent" items={[toolbar.action({onClick:()=>runConfirm('confirm-preview'),disabled:syncBusy},'Kiểm tra phiếu chờ xác nhận',true,'action'),!!confirmPlan&&toolbar.action({onClick:()=>runConfirm('confirm'),disabled:syncBusy||!confirmPlan.count},'Xác nhận đủ số lượng',true,'action'),toolbar.action({onClick:()=>runSync('preview'),disabled:syncBusy},'Đối chiếu phiếu thiếu',true,'action'),!!syncPlan&&toolbar.action({onClick:()=>runSync('apply'),disabled:syncBusy||!syncPlan.create?.length||syncPlan.ok},'Bù phiếu còn thiếu',true,'action')]}/>}
 {maintenance&&confirmPlan&&<p role="status">{confirmPlan.ok?`Đã xác nhận ${confirmPlan.confirmed} phiếu`:`Có ${confirmPlan.count} phiếu chờ xác nhận đủ số lượng`}</p>}
 {syncPlan&&<div role="status">Cần tạo {syncPlan.create.length} phiếu · Đã có liên kết {syncPlan.alreadyLinked} · Phiếu cũ đã bao phủ {syncPlan.covered.reduce((n:number,r:any)=>n+r.reportIds.length,0)} báo công · Cần đối chiếu riêng {syncPlan.blocked.length} lệnh{syncPlan.blocked.map((r:any)=><p key={r.lsxCode+r.sku}>{r.lsxCode} · {r.sku}: {r.reason} (Phiếu cũ: {r.existingQuantity}; báo công: {r.reportQuantity})</p>)}</div>}
 {error&&<p role="alert" style={{color:'#b91c1c',fontSize:20}}>{error}</p>}
 <div className="table-wrap"><table className="warehouse-receive-table"><thead><tr><th><input ref={allBox} type="checkbox" aria-label="Chọn tất cả phiếu chờ xác nhận trong danh sách đã lọc" disabled={!canConfirm||confirmBusy||!eligible.length} checked={eligible.length>0&&selectedShown.length===eligible.length} onChange={e=>setSelected(e.target.checked?eligible.map(r=>r.id):[])} /></th><th>Ngày nhập kho</th><th>Lệnh sản xuất</th><th>SKU</th><th>Tên SP</th><th>Quy cách</th><th>Nhóm SP</th><th>Line</th><th>SL đề nghị nhập</th><th>SL thực nhận</th><th>Người ghi nhận</th><th>Người xác nhận</th><th>Cách ghi nhận</th><th>Trạng thái</th><th>Mã báo công</th></tr></thead><tbody>
 {shown.map(r=><tr key={r.id}><td><input type="checkbox" aria-label={`Chọn phiếu ${r.lsxCode||r.sku} · ${r.id}`} disabled={!canConfirm||confirmBusy||!eligible.some(v=>v.id===r.id)} checked={selectedShown.some(v=>v.id===r.id)} onChange={e=>setSelected(old=>e.target.checked?[...old,r.id]:old.filter(id=>id!==r.id))} /></td><td>{r.sourceCompletedAt&&receiptTime(r.sourceCompletedAt)?productionDisplayTime(new Date(receiptTime(r.sourceCompletedAt)).toISOString()):'—'}</td><td>{r.lsxCode||'—'}</td><td><button type="button" className="sku-link" onClick={()=>r.sku&&onOpenSku(r.sku)}>{r.sku||'—'}</button></td><td>{r.name||'—'}</td><td>{r.spec||'—'}</td><td>{groupOf(r)}</td><td>{r.line||'—'}</td><td className="number">{Number(r.proposedQuantity||0).toLocaleString('vi-VN')}</td><td className="number">{r.receivedQuantity==null?'Chưa ghi nhận':Number(r.receivedQuantity).toLocaleString('vi-VN')}</td><td>{r.createdBy||'—'}</td><td>{r.confirmedBy||'Chưa xác nhận'}</td><td>{modeOf(r)}</td><td><span className={statusOf(r)==='Chờ xác nhận'?'pending-badge':'done-badge'}>{statusOf(r)}</span>{r.sheetSync&&<details><summary>Google Sheet: {r.sheetSync.status==='sent'?'Đã đồng bộ':r.sheetSync.status==='error'?'Lỗi đồng bộ':'Chờ đồng bộ'}</summary>{r.sheetSync.error||'Apps Script kiểm tra mỗi phút sau khi cài đặt kết nối.'}</details>}</td><td><details className="receipt-code"><summary aria-label={`Xem mã báo công của lệnh ${r.lsxCode||r.sku}`}></summary><span>{r.reportId||r.id}</span></details></td></tr>)}
 {!loading&&!error&&!shown.length&&<tr><td colSpan={15}>Không có phiếu nhập kho{pendingOnly?' chờ xác nhận':''}.</td></tr>}
 </tbody></table></div>
 {review&&<div className="receipt-confirm-backdrop"><section className="receipt-confirm-dialog" role="dialog" aria-modal="true" aria-label="Xác nhận phiếu nhập kho">
 <h2>Xác nhận {review.receipts.length} phiếu nhập kho</h2>
 <p>Kiểm tra từng phiếu. Chỉ xác nhận khi đã nhận đủ số lượng đề nghị; SL thực nhận sẽ được ghi bằng SL đề nghị nhập.</p>
 <div className="table-wrap"><table data-no-pagination="true"><thead><tr><th>Lệnh sản xuất</th><th>SKU</th><th>Tên SP</th><th>SL đề nghị nhập</th></tr></thead><tbody>{review.receipts.map(r=><tr key={r.id}><td>{r.lsxCode}</td><td>{r.sku}</td><td>{r.name}</td><td>{Number(r.proposedQuantity).toLocaleString('vi-VN')}</td></tr>)}</tbody></table></div>
 <label><input type="checkbox" checked={receivedChecked} disabled={confirmBusy} onChange={e=>setReceivedChecked(e.target.checked)} /> Tôi đã kiểm tra và nhận đủ số lượng của các phiếu trên.</label>
 <StandardToolbar name="WarehouseContent" items={[toolbar.action({onClick:()=>confirmSelected('confirm'),disabled:confirmBusy||!receivedChecked,disabledExplanation:'Tích xác nhận đã kiểm tra số lượng trước khi lưu.'},'Xác nhận nhập kho',canConfirm,'action'),toolbar.action({onClick:()=>setReview(null),disabled:confirmBusy},'Quay lại',true,'back')]} />
 </section></div>}
 </>;
}
