"use client";
import {validBusinessDate} from '../lib/effective-dated-value.mjs';
import {useMemo,useRef,useState} from 'react';
import {ACTION_FEEDBACK_EVENT} from '../lib/action-feedback';
import {apiFetch} from '../lib/data-sync';
import {parseLaborHoursText,reconcileLaborHours} from '../lib/labor-hours-reconcile.mjs';
import {StandardToolbar,toolbar} from './standard-toolbar/StandardToolbar';

type Master={code:string;[key:string]:unknown};
type RecordRow={sku:string;laborHour:number|null;version:number;note?:string};
type PreviewRow={sku:string;laborHour:number;old?:RecordRow;status:string;guidance?:string;change:boolean};
type Preview={rows:PreviewRow[];changes:PreviewRow[];unchanged:number;skipped:number;retained:number};
export default function LaborHoursImport({masterSkus,onClose,onSaved}:{masterSkus:Master[];onClose:()=>void;onSaved:()=>Promise<void>}) {
  const [text,setText]=useState(''),[source,setSource]=useState(''),[records,setRecords]=useState<RecordRow[]|null>(null);
  const [effectiveFrom,setEffectiveFrom]=useState('');
  const preview:Preview|null=useMemo(()=>text&&records&&validBusinessDate(effectiveFrom)?reconcileLaborHours(parseLaborHoursText(text),masterSkus,records,effectiveFrom):null,[text,masterSkus,records,effectiveFrom]);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const lock=useRef(false);
  const fileInput=useRef<HTMLInputElement>(null);
  async function readPdf(file?:File) {
    if(!file||lock.current)return;
    lock.current=true;setBusy(true);setRecords(null);setMessage('');setText('');setSource('');
    try {
      if(!file.name.toLowerCase().endsWith('.pdf')||file.size>20*1024*1024)throw Error('Chọn file PDF không quá 20 MB.');
      const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc=new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs',import.meta.url).toString();
      const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
      const rows:string[]=[];let missing=0;let hoursX:number|null=null;
      try {
        if(pdf.numPages>100)throw Error('PDF không được vượt quá 100 trang.');
        for(let n=1;n<=pdf.numPages;n++) {
          const content=await (await pdf.getPage(n)).getTextContent();
          const header=(content.items as {str?:string;transform?:number[]}[]).find(item=>item.str?.includes('GIỜ CÔNG CHUẨN'));
          if(header?.transform)hoursX=header.transform[4]-5;
          if(hoursX===null)throw Error('Không xác định được cột Giờ công chuẩn. Vui lòng kiểm tra mẫu PDF.');
          const groups=new Map<number,{x:number;text:string}[]>();
          for(const item of content.items as {str?:string;transform?:number[]}[]) {
            if(!item.str?.trim()||!item.transform)continue;
            const y=Math.round(item.transform[5]/3)*3,cells=groups.get(y)||[];
            cells.push({x:item.transform[4],text:item.str.trim()});groups.set(y,cells);
          }
          for(const [,cells] of [...groups].sort((a,b)=>b[0]-a[0])) {
            cells.sort((a,b)=>a.x-b.x);
            const sku=cells[0]?.text;
            if(!/^\d{3}[A-Z][A-Z0-9.-]*$/i.test(sku||''))continue;
            const hour=cells.filter(c=>c.x>=hoursX!).map(c=>c.text).join('').trim();
            if(!hour){missing++;continue;}
            if(!/^\d+(?:[.,]\d+)?$/.test(hour))throw Error('Giờ công không rõ tại trang '+n+', SKU '+sku+'. Vui lòng kiểm tra PDF.');
            rows.push(sku.toUpperCase()+'\t'+hour);
          }
        }
      } finally {await pdf.destroy();}
      if(!rows.length)throw Error('Không đọc được bảng giờ công. Hãy chọn PDF xuất trực tiếp có cột Mã sản phẩm và Giờ công chuẩn (giờ/SP).');
      const parsed=parseLaborHoursText(rows.join('\n'));
      setText(rows.join('\n'));setSource(file.name);
      setRecords(await readRecords());
      setMessage('Đã đọc '+parsed.length+' mã có giờ công; bỏ qua '+missing+' mã trống giờ công. Chọn ngày hiệu lực để đối chiếu rồi nhấn Lưu. Chưa thay đổi dữ liệu.');
    } catch(error) {setMessage(error instanceof Error?error.message:'Không đọc được PDF.');}
    finally {lock.current=false;setBusy(false);if(fileInput.current)fileInput.current.value='';}
  }
  async function readRecords():Promise<RecordRow[]> {
    const response=await apiFetch('/api/records?entity=labor_hours',{cache:'no-store'});
    const data=await response.json();
    if(!response.ok)throw Error(data.error||'Không thể đọc Giờ công.');
    return data.records.map((row:{payload:RecordRow})=>row.payload);
  }
  function showResult(message:string,success=false) {
    setMessage(message);
    window.dispatchEvent(new CustomEvent(ACTION_FEEDBACK_EVENT,{detail:{message,kind:success?'success':'error',...(success?{onDismiss:onClose}:{})}}));
  }
  async function apply() {
    if(lock.current||!preview?.changes.length)return;if(!validBusinessDate(effectiveFrom)){setMessage('Nhập ngày hiệu lực có căn cứ trước khi lưu.');return;}lock.current=true;setBusy(true);
    let saved=0;const failures:string[]=[];
    try {
      // Freeze the reviewed versions. The existing API checks permissions and CAS
      // for each row and writes its history/audit under the signed-in web user.
      for(const row of preview.changes) {
        setMessage(`Đang lưu ${saved+1}/${preview.changes.length}: ${row.sku}`);
        const response=await apiFetch('/api/labor-hours',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mode:row.old?'edit':'create',sku:row.sku,laborHour:row.laborHour,expectedVersion:row.old?.version||0,note:row.old?.note||'',reason:`Đối chiếu PDF: ${source.trim()}`,source:'PDF',effectiveFrom})});
        const data=await response.json();
        if(!response.ok){
          if(response.status===401||response.status===403||response.status>=500)throw Error(`${row.sku}: ${data.error||'Không thể lưu.'}`);
          failures.push(`${row.sku}: ${data.error||'Không thể lưu.'}. Kiểm tra SKU Master hoặc tải lại PDF sau khi dữ liệu được xử lý.`);continue;
        }
        saved++;
      }
      const refreshed=await readRecords(),checked=reconcileLaborHours(parseLaborHoursText(text),masterSkus,refreshed,effectiveFrom);
      setRecords(refreshed);
      await onSaved();
      if(failures.length||checked.changes.length) {
        showResult(`Đã lưu ${saved} mã. Chưa lưu đầy đủ: ${failures.join('; ')||`${checked.changes.length} mã còn cần cập nhật`}. Kiểm tra thông tin mã và chọn lại PDF trước khi lưu tiếp.`);
      } else {
        showResult(`Đã cập nhật giờ công thành công: ${saved} mã đã lưu. Giữ nguyên ${checked.retained} mã không có trong PDF.${checked.skipped?` Bỏ qua ${checked.skipped} mã không hợp lệ như danh sách đã thông báo; bổ sung SKU Master rồi tải lại PDF để cập nhật các mã này.`:''}`,true);
      }
    } catch(error) {
      setRecords(null);
      showResult(`Đã lưu ${saved} mã. Đã dừng: ${error instanceof Error?error.message:'Lỗi lưu dữ liệu'}. Chọn lại PDF trước khi tiếp tục; các mã đã lưu sẽ không ghi trùng.`);
      try {await onSaved();} catch {/* Keep the original failure visible; allow retry from the same import screen. */}
    } finally {lock.current=false;setBusy(false);}
  }
  return <section className="data-card master-standard-card" aria-label="Cập nhật giờ công PDF">
    <h2>Cập nhật giờ công/SP bằng PDF</h2>
    <p>Giờ công đã có sẽ cập nhật theo PDF; chưa có sẽ thêm mới nếu SKU Master hợp lệ. Mã không có trong PDF giữ nguyên trên web. Giá trị 0 trong PDF được ghi nhận; ô trống không thay thế dữ liệu.</p>
    <input ref={fileInput} type="file" accept=".pdf,application/pdf" hidden onChange={event=>void readPdf(event.target.files?.[0])}/>
    <StandardToolbar name="LaborHoursMaster" items={[toolbar.action({disabled:busy,onClick:()=>fileInput.current?.click()},'Chọn file PDF',true,'action')]}/>
    <label>Ngày hiệu lực của mức trong PDF<input type="date" required disabled={busy} value={effectiveFrom} onChange={event=>setEffectiveFrom(event.target.value)}/></label><p>Đối chiếu theo ngày hiệu lực đã chọn, không theo mức hiện tại hoặc ngày tải PDF. Sửa cùng ngày tạo phiên bản mới; phiếu và kế hoạch đã lưu giữ căn cứ cũ.</p>
    {source&&<p>File đã chọn: <strong>{source}</strong></p>}
    {message&&<p role="status">{message}</p>}
    {preview&&<>
      {preview.skipped>0&&<div role="alert" style={{color:'#a51d24',background:'#fff0f0',border:'1px solid #d98282',padding:12,fontSize:18}}>
        <strong>{preview.skipped} mã chưa thể lưu. Các mã hợp lệ vẫn có thể lưu.</strong>
        <ul>{preview.rows.filter(row=>!row.change&&row.status!=='Không đổi').map(row=><li key={row.sku}><b>{row.sku}</b>: {row.status}. {row.guidance}</li>)}</ul>
      </div>}
      <p>{preview.rows.length} mã PDF · Thêm mới: {preview.changes.filter(row=>!row.old).length} · Cập nhật: {preview.changes.filter(row=>row.old).length} · Đã khớp: {preview.unchanged} · Giữ nguyên ngoài PDF: {preview.retained} · Bỏ qua: {preview.skipped}</p>

    </>}
    <footer aria-label="Lưu giờ công PDF" style={{marginTop:12}}>
      {preview&&<p>Lưu {preview.changes.length} mã hợp lệ; giữ nguyên {preview.retained} mã không có trong PDF.{preview.skipped>0?` ${preview.skipped} mã lỗi không được ghi, xem hướng xử lý phía trên.`:''}</p>}
      <StandardToolbar name="LaborHoursMaster" items={[
        toolbar.action({disabled:busy||!preview?.changes.length,disabledExplanation:busy?'Đang lưu, vui lòng chờ.':!preview?'Chọn PDF trước khi lưu.':'Không có mã hợp lệ cần thêm mới hoặc cập nhật.',onClick:apply},busy?'Đang lưu…':'Lưu',true,'action'),
        toolbar.action({disabled:busy,onClick:onClose},'Đóng',true,'back'),
      ]}/>
    </footer>
  </section>;
}
