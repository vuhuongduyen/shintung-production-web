"use client";
import {useEffect,useRef,useState} from 'react';
import {recordFetch} from '../lib/record-fetch';
import {productionDisplayTime} from '../lib/production-display-time.mjs';
import {personalPermissionRecoveryPlan} from '../lib/permission-history-recovery.mjs';
import {FeedbackActionButton} from './action-feedback';
import {StandardToolbar,toolbar} from './standard-toolbar/StandardToolbar';

const entities=['users','permissions','departments','department_permissions'];
const fields=['login','id','name','department','role','authMode','line','permissionMode','permissions','active','_deleted','updatedBy','updatedAt','enabled','schemaVersion','managers'];
const labels:Record<string,string>={login:'Tài khoản',id:'Mã',name:'Tên',department:'Bộ phận',role:'Vai trò',authMode:'Loại tài khoản',line:'Line',permissionMode:'Cách áp dụng quyền',permissions:'Danh sách quyền',active:'Đang hoạt động',_deleted:'Đã xóa',updatedBy:'Người cập nhật',updatedAt:'Thời điểm cập nhật',enabled:'Đang bật',schemaVersion:'Phiên bản cấu trúc',managers:'Phạm vi quản lý'};
type Row={key:string;payload:Record<string,unknown>};
type Current={entity:string;key:string;payload:Record<string,unknown>}[];
const object=(v:unknown):Record<string,unknown>|null=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:null;

function Snapshot({label,value,present=true}:{label:string;value:unknown;present?:boolean}){
 const record=object(value);
 return <section data-permission-snapshot={label} data-present={String(present)} data-exists={String(!!record)}>
  <h4>{label==='before'?'Trước thay đổi':label==='after'?'Sau thay đổi':'Hiện tại'}</h4>
  {!present?<p>Không ghi nhận bản dữ liệu này.</p>:!record?<p>Không có bản ghi.</p>:<dl>{fields.filter(field=>Object.hasOwn(record,field)).map(field=><div key={field} data-field={field} data-value-type={typeof record[field]} style={{marginBottom:6}}>
   <dt><strong>{labels[field]}</strong></dt><dd style={{marginInlineStart:0,whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{field==='managers'&&Array.isArray(record[field])?<ul>{(record[field] as {userId:string;group:string}[]).map((m,i)=><li key={i} data-manager-user={m.userId} data-manager-group={m.group}>{m.userId} → {m.group==='AB'?'Line A+B':`Line ${m.group}`}</li>)}</ul>:String(record[field]??'')}</dd>
  </div>)}</dl>}
 </section>;
}

/** Evidence reads do not write. Explicit recovery uses the existing guarded save. */
export default function PermissionHistoryReview({entries}:{entries:unknown[]}){
 const [current,setCurrent]=useState<Current>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 const [recovery,setRecovery]=useState<ReturnType<typeof personalPermissionRecoveryPlan>|null>(null),[busy,setBusy]=useState(false),[results,setResults]=useState<string[]>([]);
 const mutation=useRef(false);
 useEffect(()=>{let active=true;
  void Promise.all(entities.map(async entity=>{const r=await recordFetch(`/api/records?entity=${entity}`,{cache:'no-store'}),body=await r.json();if(!r.ok)throw Error(body.error||'Không đọc được quyền hiện tại.');return (body.records as Row[]).map(row=>({entity,key:row.key,payload:row.payload}));})).then(async parts=>{
   const r=await recordFetch('/api/production-allocation-scope',{cache:'no-store'}),body=await r.json();if(!r.ok)throw Error(body.error||'Không đọc được phạm vi điều phối.');
   if(active)setCurrent([...parts.flat(),{entity:'production_allocation_scope',key:'global',payload:body.configuration}]);
  }).catch(e=>{if(active)setError(e instanceof Error?e.message:'Không đọc được dữ liệu đối chiếu.');}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[]);
 const history=entries.map(object).filter((e):e is Record<string,unknown>=>!!e&&(entities.includes(String(e.entity))||['USER_PERMISSION_SETUP','USER_PERMISSION_ADD','ALLOCATION_MANAGER_SCOPE'].includes(String(e.action))));
 const prepareRecovery=()=>{try{setError('');setResults([]);setRecovery(personalPermissionRecoveryPlan(history,current,'2026-10-16T09:27:42.507Z'));}catch(e){setRecovery(null);setError(e instanceof Error?e.message:'Không lập được phương án khôi phục.');}};
 const applyRecovery=async()=>{
  if(!recovery||mutation.current)return;mutation.current=true;setBusy(true);setError('');setResults([]);
  const done:string[]=[];
  try{
   const fresh=(await Promise.all(entities.map(async entity=>{const r=await recordFetch(`/api/records?entity=${entity}`,{cache:'reload'}),body=await r.json();if(!r.ok)throw Error('Không đọc được quyền mới nhất; chưa sửa dữ liệu.');return (body.records as Row[]).map(row=>({entity,key:row.key,payload:row.payload}));}))).flat();
   const scopeResponse=await recordFetch('/api/production-allocation-scope',{cache:'no-store'}),scopeBody=await scopeResponse.json();if(!scopeResponse.ok)throw Error('Không xác minh được phạm vi điều phối; chưa sửa dữ liệu.');
   fresh.push({entity:'production_allocation_scope',key:'global',payload:scopeBody.configuration});
   const snapshot=(rows:Current)=>JSON.stringify([...rows].sort((a,b)=>`${a.entity}:${a.key}`.localeCompare(`${b.entity}:${b.key}`)));
   if(snapshot(fresh)!==snapshot(current))throw Error('User, quyền hoặc phạm vi vừa thay đổi. Chưa sửa dữ liệu; mở lại đối chiếu.');
   const auditResponse=await recordFetch('/api/admin-audit',{cache:'no-store'}),auditBody=await auditResponse.json();if(!auditResponse.ok)throw Error('Không xác minh được nhật ký mới nhất; chưa sửa dữ liệu.');
   personalPermissionRecoveryPlan(auditBody.records.map((r:Row)=>r.payload),fresh,recovery.targetAt);
   for(const change of recovery.changes){
    if(change.alreadyRestored){done.push(`${change.key}: quyền đã khớp bản gốc, không ghi lại.`);continue;}
    const saved=await recordFetch('/api/records',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({entity:'permissions',key:change.key,payload:change.after})}),body=await saved.json();
    if(!saved.ok)throw Error(`${change.key}: ${body.error||'không lưu được quyền'}. Dừng, không tự thử lại.`);
    const check=await recordFetch('/api/records?entity=permissions',{cache:'reload'}),readback=await check.json();if(!check.ok)throw Error(`${change.key}: chưa đọc lại được quyền.`);
    const actual=(readback.records as Row[]).find(r=>r.key===change.key)?.payload;
    if(!actual||['permissionMode','permissions','active','_deleted'].some(field=>actual[field]!==change.after[field]))throw Error(`${change.key}: quyền đọc lại không khớp. Dừng kiểm tra.`);
    setCurrent(previous=>previous.map(row=>row.entity==='permissions'&&row.key===change.key?{...row,payload:actual}:row));
    done.push(`${change.key}: đã khôi phục và đọc lại ${change.grantCount} quyền gốc.`);setResults([...done]);
   }
   const check=await recordFetch('/api/production-allocation-scope',{cache:'no-store'}),body=await check.json();if(!check.ok||JSON.stringify(body.configuration)!==JSON.stringify(recovery.scope))throw Error('Phạm vi điều phối đã thay đổi hoặc chưa xác minh được; cần đối chiếu.');
   setResults([...done,'Đã đọc lại: giữ nguyên phạm vi sample_user_31/C, sample_user_22/A+B. Không thay user Line, vai trò, mẫu bộ phận hoặc credentials.']);setRecovery(null);
  }catch(e){setRecovery(null);setResults([...done]);setError(e instanceof Error?e.message:'Chưa hoàn tất khôi phục; kiểm tra từng user đã ghi nhận.');}
  finally{mutation.current=false;setBusy(false);}
 };
 return <section aria-label="Đối chiếu lịch sử phân quyền" className="data-card" style={{padding:12,marginBottom:12}}>
  <h2>Đối chiếu và khôi phục quyền riêng</h2>
  <p>Xem đối chiếu không thay đổi dữ liệu. Chỉ ghi quyền khi xác nhận phương án khôi phục có đủ bằng chứng; không áp mẫu chung. Bản trước/sau bị thiếu phải được đối chiếu thêm. Danh sách quyền được hiển thị đầy đủ, không cắt ngắn.</p>
  {loading&&<p role="status">Đang đọc quyền và phạm vi hiện tại…</p>}{error&&<p role="alert">{error}</p>}
  {!loading&&<StandardToolbar name="PermissionHistoryRecovery" items={[toolbar.action({type:'button',disabled:!!error||busy,onClick:prepareRecovery},'Lập đối chiếu khôi phục quyền riêng')]}/>}
  {recovery&&<section aria-label="Xác nhận khôi phục quyền riêng"><h3>Khôi phục theo nhật ký {productionDisplayTime(recovery.targetAt)}</h3><p>Chỉ khôi phục đúng các quyền riêng có bản trước/sau đầy đủ. Giữ nguyên phạm vi điều phối, tài khoản Line, vai trò và mẫu bộ phận. Nếu phiên bản thay đổi, hệ thống dừng.</p><ul>{recovery.changes.map((c:{key:string;grantCount:number;alreadyRestored:boolean})=><li key={c.key}>{c.key}: {c.grantCount} quyền gốc {c.alreadyRestored?'· đã khớp':''}</li>)}</ul><FeedbackActionButton type="button" disabled={busy} disabledExplanation="Đang khôi phục quyền và đọc lại kết quả. Vui lòng chờ hoàn tất." onClick={()=>void applyRecovery()}>Xác nhận khôi phục đúng quyền riêng đã đối chiếu</FeedbackActionButton></section>}
  {!!results.length&&<section aria-label="Kết quả khôi phục quyền riêng"><ul>{results.map((r,i)=><li key={i}>{r}</li>)}</ul></section>}
  {!loading&&!error&&<details><summary>Quyền, tài khoản và phạm vi hiện tại ({current.length} bản ghi)</summary>{current.map(row=><article key={`${row.entity}:${row.key}`} data-permission-current-entity={row.entity} data-record-key={row.key} style={{borderBottom:'1px solid #b8cfb9',padding:8}}><h3>{row.entity} · {row.key}</h3><Snapshot label="current" value={row.payload}/></article>)}</details>}
  <h3>Lịch sử liên quan ({history.length} thao tác)</h3>
  {history.map((entry,i)=>{
   const changes=Array.isArray(entry.changes)?entry.changes.map(object).filter((c):c is Record<string,unknown>=>!!c):Object.hasOwn(entry,'before')||Object.hasOwn(entry,'after')?[{entity:entry.entity||'production_allocation_scope',key:entry.key||'global',...entry}]:[];
   return <details key={i} data-permission-history-event="true" data-at={String(entry.at||'')} data-action={String(entry.action||'update')} data-actor={String(entry.actor||'')} style={{margin:'8px 0'}}>
    <summary>{productionDisplayTime(String(entry.at||''))} · {String(entry.actor||'')} · {String(entry.action||entry.entity||'Cập nhật')} ({changes.length} bản ghi)</summary>
    {!changes.length&&<p>Nhật ký không ghi nhận các bản dữ liệu trước/sau.</p>}
    {changes.map((change,j)=><article key={j} data-permission-history-entity={String(change.entity||'')} data-record-key={String(change.key||'')} style={{borderBottom:'1px solid #b8cfb9',padding:8}}>
     <h4>{String(change.entity||'')} · {String(change.key||'')}</h4><div style={{display:'flex',flexWrap:'wrap',gap:16}}><Snapshot label="before" value={change.before} present={Object.hasOwn(change,'before')}/><Snapshot label="after" value={change.after} present={Object.hasOwn(change,'after')}/></div>
    </article>)}
   </details>;
  })}
 </section>;
}
