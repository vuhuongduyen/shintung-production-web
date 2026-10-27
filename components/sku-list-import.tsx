"use client";
import {useRef,useState} from 'react';
import {apiFetch} from '../lib/data-sync';
import {parseSkuList,missingSkuRows,importedSkuDraft} from '../lib/sku-list-import.mjs';
import {StandardToolbar,toolbar} from './standard-toolbar/StandardToolbar';
import {DataTable} from './onspa-ui/DataTable';
type Row={code:string;name:string;specification:string;group:string;line:string;sourceLaborHour:number|null};
type Stored={key:string;payload:{code:string;confirmation_status?:string;status?:string}};
export default function SkuListImport({onBack,onSaved}:{onBack:()=>void;onSaved:()=>Promise<unknown>}) {
  const [text,setText]=useState(''),[source,setSource]=useState(''),[rows,setRows]=useState<Row[]|null>(null);
  const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const lock=useRef(false);
  async function catalog():Promise<Stored[]> {
    const response=await apiFetch('/api/records?entity=sku',{cache:'no-store'}),data=await response.json();
    if(!response.ok)throw Error(data.error||'Không tải được SKU Master.');
    return data.records;
  }
  async function compare() {
    if(lock.current)return;lock.current=true;setBusy(true);setMessage('');
    try {
      if(!source.trim())throw Error('Nhập tên file nguồn.');
      const parsed=parseSkuList(text);if(!parsed.length)throw Error('Nhập danh sách SKU.');
      const missing=missingSkuRows(parsed,await catalog());setRows(missing);
      setMessage(`${parsed.length} mã nguồn; ${missing.length} mã cần thêm. ${parsed.length-missing.length} mã đã tồn tại được giữ nguyên.`);
    }catch(e){setRows(null);setMessage(e instanceof Error?e.message:'Không đối chiếu được.');}
    finally{lock.current=false;setBusy(false);}
  }
  async function save() {
    if(lock.current||!rows?.length)return;lock.current=true;setBusy(true);let saved=0;
    try {
      for(const row of rows) {
        setMessage(`Đang thêm ${saved+1}/${rows.length}: ${row.code}`);
        const response=await apiFetch('/api/sku-request',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({key:row.code,payload:importedSkuDraft(row,source.trim()),operation:'create',expectedRevision:0})});
        const data=await response.json();if(!response.ok)throw Error(`${row.code}: ${data.error||'Không thể thêm SKU.'}`);saved++;
      }
      const current=await catalog(),missing=missingSkuRows(rows,current);
      const pending=current.filter(record=>rows.some(row=>row.code===record.key)&&(record.payload.confirmation_status||record.payload.status)==='Chờ xác nhận').length;
      setMessage(`Đã thêm ${saved} SKU. Kiểm tra lại: ${rows.length-missing.length}/${rows.length} mã có trong SKU Master; ${pending} mã Chờ xác nhận. Bạn có thể chọn từng mã và nhấn Sửa để bổ sung dữ liệu.`);
      setRows(missing);await onSaved();
    }catch(e){setRows(null);setMessage(`Đã thêm ${saved} mã. Đã dừng: ${e instanceof Error?e.message:'Lỗi lưu'}. Đối chiếu lại để tiếp tục, các mã đã có sẽ không ghi lại.`);await onSaved();}
    finally{lock.current=false;setBusy(false);}
  }
  return <section className="data-card master-standard-card" aria-label="Thêm SKU từ danh sách">
    <h2>Thêm SKU từ danh sách</h2>
    <p>Chỉ bổ sung mã chưa có. SKU mới ở trạng thái Chờ xác nhận; thông tin chưa có để trống. Giờ công nguồn được lưu tham chiếu, chưa áp dụng trước khi hoàn thiện SKU.</p>
    <label>Tên file nguồn<input aria-label="Tên file nguồn SKU" value={source} disabled={busy} onChange={e=>{setSource(e.target.value);setRows(null);}}/></label>
    <label>Danh sách SKU<textarea aria-label="Danh sách SKU bổ sung" rows={5} style={{width:'100%'}} value={text} disabled={busy} onChange={e=>{setText(e.target.value);setRows(null);}} placeholder="Dán 6 cột cách nhau bằng tab: SKU, tên, quy cách, nhóm, Line, giờ công nguồn"/></label>
    <StandardToolbar name="Home" items={[
      toolbar.action({disabled:busy,onClick:compare},'Kiểm tra danh sách',true,'action'),
      toolbar.action({disabled:busy||!rows?.length,onClick:save},`Thêm SKU (${rows?.length||0})`,true,'action'),
      toolbar.action({disabled:busy,onClick:onBack},'Quay lại',true,'back'),
    ]}/>
    {message&&<p role="status">{message}</p>}
    {rows&&rows.length>0&&<DataTable className="table-wrap"><table data-no-pagination="true"><thead><tr><th>SKU</th><th>Tên sản phẩm</th><th>Quy cách</th><th>Nhóm</th><th>Line</th><th>Giờ công nguồn</th></tr></thead><tbody>{rows.map(row=><tr key={row.code}><td>{row.code}</td><td>{row.name}</td><td>{row.specification||'—'}</td><td>{row.group||'—'}</td><td>{row.line||'—'}</td><td>{row.sourceLaborHour===null?'—':row.sourceLaborHour.toFixed(3)}</td></tr>)}</tbody></table></DataTable>}
  </section>;
}
