"use client";
import {FeedbackActionButton} from './action-feedback';
import {DataTable} from './onspa-ui/DataTable';
import {DataCell} from './onspa-ui/DataCell';
import {useEffect,useRef,useState} from 'react';
import {apiFetch as fetch} from '../lib/data-sync';
type User={login:string;name:string;department:string;active:boolean;eligible:boolean;reason:string;before:string[]};
type Plan={revision:string;users:User[];catalog:{group:string;menus:{label:string;grants:string[]}[]}[]};
type Preview={revision:string;previewToken:string;selectedLogins:string[];grants:string[];users:(User&{added:string[];after:string[]})[];changedUsers:number};
export default function UserPermissionSetup({onClose,onApplied}:{onClose:()=>void;onApplied:()=>void}){
 const [plan,setPlan]=useState<Plan|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[selected,setSelected]=useState<string[]>([]),[grants,setGrants]=useState<string[]>([]),[preview,setPreview]=useState<Preview|null>(null),[stale,setStale]=useState(false);
 const pending=useRef(false),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;fetch('/api/user-permission-setup',{cache:'no-store'}).then(async r=>{const body=await r.json();if(!r.ok)throw Error(body.error||'Không tải được danh sách quyền.');if(mounted.current)setPlan(body);}).catch(()=>{if(mounted.current)setError('Không tải được danh sách quyền. Đóng và mở lại để thử lại.');});return()=>{mounted.current=false}},[]);
 const toggle=(value:string,items:string[],save:(next:string[])=>void)=>{setPreview(null);setError('');save(items.includes(value)?items.filter(item=>item!==value):[...items,value]);};
 const submit=async(action:'preview'|'apply')=>{
  if(!plan||pending.current||stale||!selected.length||!grants.length||action==='apply'&&!preview)return;
  pending.current=true;setBusy(true);setError('');
  try{
   const request=action==='apply'&&preview?{action,expectedRevision:preview.revision,selectedLogins:preview.selectedLogins,grants:preview.grants,previewToken:preview.previewToken,confirmed:true}:{action,expectedRevision:plan.revision,selectedLogins:selected,grants};
   const r=await fetch('/api/user-permission-setup',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(request)}),body=await r.json();
   if(!mounted.current)return;
   if(!r.ok){if(r.status===409){setStale(true);setPreview(null);}throw Error(r.status===409?'Quyền vừa thay đổi. Đóng và mở lại thiết lập để xem trước lại.':r.status===403?'Bạn không có quyền thiết lập phân quyền.':'Không lưu được quyền. Kiểm tra lựa chọn và thử lại.');}
   if(action==='preview')setPreview(body);
   else if(body.ok===true){onApplied();onClose();}
   else throw Error('Chưa xác minh được kết quả lưu. Đóng và mở lại để kiểm tra.');
  }catch(e){if(mounted.current)setError(e instanceof Error&&/^(Quyền vừa|Bạn không|Không lưu|Chưa xác minh)/.test(e.message)?e.message:'Không kết nối được máy chủ. Đóng và mở lại để kiểm tra trước khi thử lưu lại.');}
  finally{pending.current=false;if(mounted.current)setBusy(false);}
 };
 const blocked=busy||stale;
 return <><FeedbackActionButton className="panel-backdrop" aria-label="Đóng thiết lập quyền" disabled={busy} disabledExplanation="Đang xử lý. Vui lòng chờ hoàn tất." onClick={onClose}/><aside className="detail-panel user-edit-panel" role="dialog" aria-modal="true" aria-labelledby="permission-setup-heading" style={{width:'min(1100px, 96vw)'}}>
  <div className="detail-header"><div><p>PHÂN QUYỀN NGƯỜI DÙNG</p><h2 id="permission-setup-heading">Bổ sung quyền cho user được chọn</h2></div><FeedbackActionButton onClick={onClose} disabled={busy} disabledExplanation="Đang xử lý. Vui lòng chờ hoàn tất." aria-label="Đóng">×</FeedbackActionButton></div>
  <p>Chọn user và từng quyền cần thêm. Giữ mọi quyền hiện có; không thiết lập lại toàn bộ user hoặc quyền bộ phận.</p>
  {error&&<p role="alert" className="production-inline-message error">{error}</p>}
  {!plan&&!error&&<p>Đang tra quyền hiện tại…</p>}
  {plan&&!preview&&<>
   <DataTable className="table-wrap"><table data-no-pagination="true"><thead><tr><th>Chọn</th><th>ID user</th><th>Họ tên</th><th>Bộ phận</th><th>Quyền hiện tại</th></tr></thead><tbody>{plan.users.map(user=><tr key={user.login}><DataCell><input type="checkbox" aria-label={`Chọn user ${user.login}`} checked={selected.includes(user.login)} disabled={blocked||!user.eligible} onChange={()=>toggle(user.login,selected,setSelected)}/></DataCell><DataCell kind="code">{user.login}</DataCell><DataCell>{user.name}</DataCell><DataCell>{user.department}</DataCell><DataCell>{user.reason||`${user.before.length} quyền`}<details><summary>Xem quyền hiện tại</summary>{user.before.map(grant=><div key={grant}>{grant}</div>)}</details></DataCell></tr>)}</tbody></table></DataTable>
   <p>Đã chọn {selected.length} user · {grants.length} quyền bổ sung. Mở từng nhóm để chọn đúng menu và thao tác.</p>
   <div className="permission-matrix-wrap">{plan.catalog.map(group=><details key={group.group}><summary>{group.group}</summary>{group.menus.map(menu=><fieldset key={menu.label} disabled={blocked}><legend>{menu.label}</legend>{menu.grants.map(grant=><label key={grant} style={{display:'inline-flex',alignItems:'center',gap:4,marginRight:12}}><input type="checkbox" aria-label={grant} checked={grants.includes(grant)} onChange={()=>toggle(grant,grants,setGrants)}/>{grant.split(' / ').at(-1)}</label>)}</fieldset>)}</details>)}</div>
  </>}
  {preview&&<section aria-label="Xem trước quyền bổ sung"><h3>Đối chiếu trước khi lưu</h3><p>{preview.users.length} user được chọn · {preview.changedUsers} user có quyền mới. Các tài khoản chuyển sang quyền riêng để giữ nguyên quyền hiện tại và bổ sung phần đã chọn; thay đổi quyền bộ phận về sau không tự áp dụng.</p><p>Quyền Xem có thể mở dữ liệu nhân viên, nghỉ, giờ công và thu nhập ở menu tương ứng. Chỉ xác nhận khi bạn cho phép những user bên dưới truy cập dữ liệu và thực hiện đúng thao tác được liệt kê.</p>
   <DataTable className="table-wrap"><table data-no-pagination="true"><thead><tr><th>User</th><th>Quyền trước</th><th>Chỉ bổ sung</th><th>Quyền sau</th></tr></thead><tbody>{preview.users.map(user=><tr key={user.login}><DataCell>{user.login}<small>{user.name}</small></DataCell><DataCell><details><summary>{user.before.length} quyền giữ nguyên</summary>{user.before.map(grant=><div key={grant}>{grant}</div>)}</details></DataCell><DataCell>{user.added.length?user.added.map(grant=><div key={grant}>{grant}</div>):'Đã có đủ quyền đã chọn'}</DataCell><DataCell>{user.after.length} quyền</DataCell></tr>)}</tbody></table></DataTable>
  </section>}
  <p>Điều phối nhân sự có thiết lập riêng tại Capacity tuần → Lịch làm việc dự kiến → Điều phối nhân sự → Thiết lập QLSX. Bổ sung quyền ở đây không lưu phạm vi điều phối.</p>
  <div className="edit-user-actions"><FeedbackActionButton className="ghost-button" onClick={onClose} disabled={busy} disabledExplanation="Đang xử lý. Vui lòng chờ hoàn tất.">Quay lại</FeedbackActionButton>{preview?<><FeedbackActionButton onClick={()=>{setPreview(null);setError('');}} disabled={busy} disabledExplanation="Đang xử lý. Vui lòng chờ hoàn tất.">Sửa lựa chọn</FeedbackActionButton><FeedbackActionButton className="primary-button" onClick={()=>void submit('apply')} disabled={blocked||!preview.changedUsers} disabledExplanation={busy?'Đang lưu. Vui lòng chờ.':stale?'Đóng và mở lại để xem trước lại.':'Không có quyền mới cần lưu.'}>{busy?'Đang lưu…':'Xác nhận bổ sung quyền'}</FeedbackActionButton></>:<FeedbackActionButton className="primary-button" onClick={()=>void submit('preview')} disabled={!plan||blocked||!selected.length||!grants.length} disabledExplanation={busy?'Đang xử lý. Vui lòng chờ.':stale?'Đóng và mở lại để xem trước lại.':'Chọn ít nhất một user và một quyền cần bổ sung.'}>{busy?'Đang đối chiếu…':'Xem trước quyền bổ sung'}</FeedbackActionButton>}</div>
 </aside></>;
}
