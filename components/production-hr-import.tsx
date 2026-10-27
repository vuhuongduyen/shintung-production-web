'use client';
import {DataTable} from './onspa-ui/DataTable';
import {DataCell} from './onspa-ui/DataCell';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {StandardToolbar,toolbar,type Items} from './standard-toolbar/StandardToolbar';
import {nonNegative} from '../lib/production-payroll.mjs';
import {matchHrRows,validHrRows,hrFileMonth} from '../lib/production-hr-import.mjs';
type Row=Record<string,any>;
export default function ProductionHrImport({month,employees,t,apply,example=false,canSave=true,renderToolbar}:{month:string;employees:Row[];t:(s:string)=>string;apply:(rows:Row[],month:string,file:File)=>Promise<void>;example?:boolean;canSave?:boolean;renderToolbar?:(items:Items)=>ReactNode}){
 const input=useRef<HTMLInputElement>(null),generation=useRef(0);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[preview,setPreview]=useState<{file:string;original:File;month:string;rows:Row[];unmatched:Row[]}|null>(null),[verified,setVerified]=useState(false),[hcColumn,setHcColumn]=useState(''),[otColumn,setOtColumn]=useState('');
 useEffect(()=>()=>{generation.current++;},[]);
 const sameColumn=hcColumn!==''&&hcColumn===otColumn;
 const read=async(file?:File)=>{
  if(!file)return;const request=++generation.current,capturedMonth=month;setBusy(true);setMessage('');setPreview(null);setVerified(false);setHcColumn('');setOtColumn('');
  try{
   if(!file.name.toLowerCase().endsWith('.pdf')||file.size>20*1024*1024)throw Error('Chọn PDF không quá 20 MB');
   const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc=new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs',import.meta.url).toString();
   const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise,lines:Row[]=[];
   try{if(pdf.numPages>100)throw Error('PDF quá 100 trang');for(let n=1;n<=pdf.numPages;n++){
    const page=await pdf.getPage(n),content=await page.getTextContent(),groups=new Map<number,{x:number;text:string}[]>();
    for(const item of content.items as {str?:string;transform?:number[]}[]){if(!item.str?.trim()||!item.transform)continue;const y=Math.round(item.transform[5]/3)*3;const cells=groups.get(y)||[];cells.push({x:item.transform[4],text:item.str.trim()});groups.set(y,cells);}
    for(const [y,cells]of [...groups].sort((a,b)=>b[0]-a[0]))lines.push({page:n,y,text:cells.sort((a,b)=>a.x-b.x).map(c=>c.text).join(' ')});
   }}finally{await pdf.destroy();}
   if(request!==generation.current)return;
   const matched=matchHrRows(lines,employees);
   if(!matched.rows.length)throw Error(lines.length?'Không tìm thấy mã hoặc tên NV khớp. Cần kiểm tra mẫu PDF.':'PDF không có văn bản đọc được; cần PDF xuất trực tiếp hoặc OCR.');
   setPreview({file:file.name,original:file,month:hrFileMonth(file.name)||capturedMonth,...matched});
  }catch(error){if(request===generation.current)setMessage(error instanceof Error?error.message:'Không đọc được PDF');}finally{if(request===generation.current)setBusy(false);}
 };
 const mapColumn=(kind:'hc'|'ot',value:string)=>{if(kind==='hc')setHcColumn(value);else setOtColumn(value);setVerified(false);setPreview(p=>p?{...p,rows:p.rows.map(r=>({...r,[kind]:value===''?'':value==='zero'?'0':nonNegative(r.numbers[Number(value)])===null?'':String(nonNegative(r.numbers[Number(value)]))}))}:p);};
 const applyPreview=async()=>{if(!preview)return;setBusy(true);setMessage('');try{await apply(preview.rows,example?month:preview.month,preview.original);setMessage(example?'Đã lưu giờ PDF cho tháng tính thử; mở lại hoặc F5 vẫn giữ dữ liệu':'Đã lưu giờ Nhân sự và áp dụng vào bảng bên dưới');setPreview(null);}catch(error){setMessage(error instanceof Error?error.message:'Không lưu được giờ Nhân sự');}finally{setBusy(false);}};
 const blocked=preview?(!example&&preview.month!==month?'Tháng PDF khác tháng đang chọn; đổi tháng ở thanh chức năng trước khi lưu.':sameColumn?'HC và TC phải chọn hai cột riêng':!validHrRows(preview.rows)?'Cần xử lý các dòng lỗi và nhập đủ giờ HC/TC trước khi lưu.':!verified?'Tích xác nhận đã đối chiếu PDF để mở nút lưu.':!canSave?'Chỉ QLSX được lưu giờ Nhân sự':''):'';
 const maxNumbers=Math.max(0,...(preview?.rows||[]).map(r=>r.numbers.length));
 const importItems:Items=[toolbar.action({disabled:busy, disabledExplanation: "Đang xử lý. Vui lòng chờ hoàn tất rồi thử lại.",onClick:()=>input.current?.click()},t(busy?'Đang đọc PDF…':'Nhập PDF Nhân sự')), ...(preview?[toolbar.action({disabled:busy||!!blocked, disabledExplanation: busy ? "Đang xử lý. Vui lòng chờ hoàn tất rồi thử lại." : "Dữ liệu Nhân sự chưa đủ điều kiện áp dụng. Kiểm tra lỗi đối chiếu trong bản xem trước.",onClick:()=>void applyPreview()},t(example?'Lưu và áp dụng vào ví dụ':'Lưu và áp dụng giờ Nhân sự')),toolbar.action({disabled:busy, disabledExplanation: "Đang xử lý. Vui lòng chờ hoàn tất rồi thử lại.",onClick:()=>{generation.current++;setPreview(null);setMessage('');setBusy(false);}},t('Đóng xem trước'))]:[]),...(preview?(['hc','ot'] as const).map(kind=>toolbar.field(t(kind==='hc'?'Số thứ tự giờ HC sau tên NV':'Số thứ tự giờ TC sau tên NV'),[toolbar.select({value:kind==='hc'?hcColumn:otColumn,disabled:busy,onChange:e=>mapColumn(kind,e.target.value)},<><option value="">{t('Chọn cột giờ')}</option>{kind==='ot'&&<option value="zero">{t('Không có TC (0 giờ)')}</option>}{Array.from({length:maxNumbers},(_,i)=><option key={i} value={i}>{i+1}</option>)}</>)])):[])];
 return <div className="payroll-hr-import">
  <input ref={input} hidden type="file" accept="application/pdf,.pdf" onChange={e=>{void read(e.target.files?.[0]);e.target.value='';}}/>
  {renderToolbar?renderToolbar(importItems):<StandardToolbar name="PayrollHrImport" items={importItems}/>}
  {message&&<p role="status">{t(message)}</p>}
  {preview&&<>
   {blocked&&<p role="status" className="payroll-incomplete">{t(blocked)}</p>}
   <p>{preview.file} · {t('Tháng nguồn PDF')}: {preview.month} · {t(example?'Tháng áp dụng thử':'Tháng áp dụng')}: {month} · {t('Số NV đọc được')}: {preview.rows.length}</p>
   {example&&preview.month!==month&&<p>{t('Dùng giờ của tháng nguồn PDF để tính thử cho tháng đang chọn.')}</p>}
   <p>{t('Chỉ nhập bảng tổng giờ tháng đã khấu trừ của Nhân sự. Chọn đúng cột HC/TC, đối chiếu từng dòng; không tự lấy số ngày nghỉ thành số giờ.')}</p>

   {sameColumn&&<p role="status">{t('HC và TC phải chọn hai cột riêng')}</p>}
   <DataTable className="table-wrap"><table className="production-table" data-no-pagination="true"><thead><tr>{['Trang','Mã NV','Tên nhân viên','Line','Dòng đọc từ PDF','Các số sau tên NV','Giờ HC sau khấu trừ','Giờ TC sau khấu trừ','Đối chiếu'].map(v=><th key={v}>{t(v)}</th>)}</tr></thead><tbody>{preview.rows.map((r,i)=><tr key={i}><DataCell>{r.page}</DataCell><DataCell>{r.id}</DataCell><DataCell>{r.name}</DataCell><DataCell kind="code">{r.line}</DataCell><DataCell>{r.text}</DataCell><DataCell>{r.numbers.map((v:string,j:number)=>`${j+1}: ${v}`).join(' | ')}</DataCell>{(['hc','ot'] as const).map(kind=><DataCell key={kind}><input type="number" min={0} max={744} step="0.01" value={r[kind]} aria-label={`${r.name} ${kind}`} disabled={busy} onChange={e=>{const value=e.target.value;setVerified(false);setPreview(p=>p?{...p,rows:p.rows.map((v,j)=>j===i?{...v,[kind]:value}:v)}:p);}}/></DataCell>)}<DataCell>{t(r.issue||(r.matchedBy==='name'?'Ghép theo tên duy nhất; cần đối chiếu':'Mã và tên khớp'))}</DataCell></tr>)}</tbody></table></DataTable>
   <details><summary>{t('Các dòng chưa ghép với NV')} ({preview.unmatched.length})</summary>{preview.unmatched.map((r,i)=><p key={i}>{r.page}: {r.text}</p>)}</details>
   <label className="payroll-confirm"><input type="checkbox" checked={verified} disabled={busy} onChange={e=>setVerified(e.target.checked)}/>{t('Đã kiểm tra đúng tháng, đủ NV và giờ HC/TC sau khấu trừ. Áp dụng sẽ thay giờ nháp của các NV khớp trong tháng này.')}</label>

  </>}
 </div>;
}
