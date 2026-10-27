'use client';
import {PageTitle} from './onspa-ui/PageTitle';
import {DataTable} from './onspa-ui/DataTable';
import {DataCell} from './onspa-ui/DataCell';
import {useEffect,useState,useSyncExternalStore} from 'react';
import {recordFetch} from '../lib/record-fetch';
import {StandardToolbar,toolbar} from './standard-toolbar/StandardToolbar';
import {toolbarLocale,subscribeToolbarLocale} from './standard-toolbar/translations';
type Change={sku:string;code:string;field:string;before:string;after:string;pages:number[]};
type Preview={id:string;source:string;rows:number;exclusions:number;changes:Change[];boms:{sku:string;revision:string|null}[];blocked:{parent:string;code:string;reason:string;pages:number[]}[]};
export default function BomReconciliation({onBack,onApplied}:{onBack:()=>void;onApplied:()=>Promise<void>}){
 const language=useSyncExternalStore(subscribeToolbarLocale,toolbarLocale,()=>'vi'),t=(vi:string,zh:string,en:string)=>language==='zh'?zh:language==='en'?en:vi;
 const [preview,setPreview]=useState<Preview|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState(''),[query,setQuery]=useState('');
 async function load(){setBusy(true);setError('');try{const r=await recordFetch('/api/bom-pdf-reconciliation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'preview'})}),data=await r.json();if(!r.ok)throw new Error(data.error);setPreview(data);}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
 useEffect(()=>{void load();},[]);
 async function apply(){if(!preview)return;setBusy(true);setError('');setSuccess('');let count=0,changes=0;try{
  for(let i=0;i<preview.boms.length;i+=30){const batch=preview.boms.slice(i,i+30),r=await recordFetch('/api/bom-pdf-reconciliation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'apply',id:preview.id,skus:batch.map(b=>b.sku),expectedRevisions:Object.fromEntries(batch.map(b=>[b.sku,b.revision]))})}),data=await r.json();if(!r.ok)throw new Error(data.error);count+=data.count;changes+=data.changes;setSuccess(t(`Đã cập nhật ${count}/${preview.boms.length} BOM…`,`已更新 ${count}/${preview.boms.length} BOM…`,`Updated ${count}/${preview.boms.length} BOMs…`));}
  await onApplied();setSuccess(t(`Cập nhật thành công ${count} BOM · ${changes} nội dung. Đã lưu lịch sử trước và sau.`,`成功更新 ${count} 個 BOM · ${changes} 項內容。已保存變更前後記錄。`,`Successfully updated ${count} BOMs · ${changes} fields. Before/after history saved.`));await load();
 }catch(e){setError(`${count?t(`Đã lưu ${count} BOM. `,`已保存 ${count} 個 BOM。`,`Saved ${count} BOMs. `):''}${e instanceof Error?e.message:String(e)}`);await onApplied();}finally{setBusy(false);}}
 const fields:Record<string,string>={name:t('Tên','名稱','Name'),spec:t('Quy cách','規格','Specification'),unit:t('Đơn vị','單位','Unit'),qty:t('Lượng dùng','用量','Quantity'),waste:t('Hao hụt (%)','損耗 (%)','Waste (%)'),'Thêm dòng':t('Bổ sung dòng thiếu','新增缺失列','Add missing row')};
 const visible=preview?.changes.filter(c=>!query||`${c.sku} ${c.code}`.toUpperCase().includes(query.toUpperCase()))||[];
 return <main className="workspace bom-workspace" data-own-language="true">
  <PageTitle>{t('BOM · Đối chiếu PDF','BOM · PDF 核對','BOM · PDF reconciliation')}</PageTitle>
  <StandardToolbar name="BomLookupView" items={[
   toolbar.action({onClick:apply,disabled:busy||!preview?.boms.length, disabledExplanation: busy ? "Đang xử lý. Vui lòng chờ hoàn tất rồi thử lại." : "Kiểm tra PDF và đối chiếu các BOM hợp lệ trước khi áp dụng."},t('Áp dụng cập nhật từ PDF','套用 PDF 更新','Apply PDF corrections'),true,'action'),
   toolbar.action({onClick:load,disabled:busy, disabledExplanation: "Đang xử lý. Vui lòng chờ hoàn tất rồi thử lại."},t('Kiểm tra lại','重新核對','Review again'),true,'lookup'),
   toolbar.field(t('Mã hàng','品號','Item code'),[toolbar.input({value:query,onChange:e=>setQuery(e.target.value),placeholder:t('Tra mã cha hoặc LK/NVL','查詢父項或材料','Search parent or material')})]),
   toolbar.action({onClick:onBack,disabled:busy, disabledExplanation: "Đang xử lý. Vui lòng chờ hoàn tất rồi thử lại."},t('Trở lại danh sách BOM','返回 BOM 清單','Back to BOM list'),true,'back')
  ]}/>
  {error&&<p role="alert" className="bom-change-error">{error}</p>}
  {success&&<p role="status" style={{color:'#166534',background:'#dcfce7',padding:12,borderRadius:6}}>{success}</p>}
  {preview&&<>
   <p><strong>{preview.source}</strong> · {preview.rows.toLocaleString()} {t('dòng PDF','PDF 列','PDF rows')} · {preview.boms.length} BOM · {preview.changes.length} {t('nội dung cần cập nhật','待更新內容','corrections')}</p>
   <p>{t(`Giữ nguyên lượng dùng và hao hụt của ${preview.exclusions} dòng có “Hao hụt [2]”. Mẫu số đã thiết lập được giữ nguyên.`,`保留 ${preview.exclusions} 列「損耗 [2]」的用量與損耗，並保留既有分母。`,`Preserve quantities and waste for ${preview.exclusions} rows with “Waste [2]”, and retain existing denominators.`)}</p>
   <section className="data-card bom-card"><DataTable className="table-wrap"><table className="bom-table" data-no-pagination="true"><thead><tr>{[t('Mã cha','父項','Parent'),t('Mã hàng','品號','Item'),t('Nội dung','欄位','Field'),t('Trước cập nhật','更新前','Before'),t('Theo PDF','PDF 內容','PDF value'),t('Trang PDF','PDF 頁','PDF page')].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{visible.map((c,i)=><tr key={i}><DataCell kind="code">{c.sku}</DataCell><DataCell kind="code">{c.code}</DataCell><DataCell>{fields[c.field]||c.field}</DataCell><DataCell>{c.before||'—'}</DataCell><DataCell>{c.after||'—'}</DataCell><DataCell>{c.pages.join(', ')}</DataCell></tr>)}</tbody></table></DataTable></section>
   <details><summary>{t('Các dòng cần đối chiếu riêng','需單獨核對的列','Rows requiring separate review')} ({preview.blocked.length})</summary><DataTable className="table-wrap"><table className="bom-table" data-no-pagination="true"><thead><tr><th>{t('Mã cha','父項','Parent')}</th><th>{t('Mã hàng','品號','Item')}</th><th>{t('Nội dung','內容','Details')}</th><th>{t('Trang PDF','PDF 頁','PDF page')}</th></tr></thead><tbody>{preview.blocked.map((b,i)=><tr key={i}><DataCell>{b.parent}</DataCell><DataCell kind="code">{b.code}</DataCell><DataCell>{b.reason}</DataCell><DataCell>{b.pages.join(', ')}</DataCell></tr>)}</tbody></table></DataTable></details>
  </>}
 </main>;
}
