"use client";
import {FeedbackActionButton} from './action-feedback';
import {DataCell} from './onspa-ui/DataCell';
import {useEffect,useState} from 'react';
import {apiFetch,useDataRefresh} from '../lib/data-sync';
import {productionDisplayTime} from '../lib/production-display-time.mjs';
type Stock={snapshot:null|{code:string;weekKey:string;snapshotAt:string};stock:null|{tpQty:number;kdQty:number;totalQty:number}};
export default function SkuStock({code,onOpenWarehouse}:{code:string;onOpenWarehouse:()=>void}) {
 const revision=useDataRefresh(['inventory_snapshot']);
 const [result,setResult]=useState<{code:string;data:Stock}|null>(null),[error,setError]=useState(''),[expanded,setExpanded]=useState(false);
 useEffect(()=>{let alive=true;setError('');apiFetch(`/api/records?entity=sku&stock=${encodeURIComponent(code)}`).then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error||'Không tải được tồn kho');if(alive)setResult({code,data});}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false};},[code,revision]);
 const data=result?.code===code?result.data:null;
 const fmt=(v:number|undefined)=>v==null?'—':v.toLocaleString('vi-VN',{maximumFractionDigits:2});
 return <section className="sku-stock-section"><FeedbackActionButton className="section-toggle" onClick={()=>setExpanded(v=>!v)} aria-expanded={expanded}><span><b>Tồn kho theo kho</b><small>{data?.snapshot?`Chốt: ${productionDisplayTime(data.snapshot.snapshotAt,'—')} · Tuần bắt đầu ${productionDisplayTime(data.snapshot.weekKey,'—')}`:'Tồn ERP đã chốt'}</small></span><em>{expanded?'Thu gọn ⌃':'Xem chi tiết ⌄'}</em></FeedbackActionButton>{error?<p role="alert">{error}</p>:!data?<p>Đang tải tồn kho…</p>:!data.snapshot?<p>Chưa có bản tồn ERP đã chốt.</p>:!data.stock?<p>SKU này chưa có trong bản chốt {data.snapshot.code}.</p>:<><div className="sku-stock-summary compact">{[['Kho TP',data.stock.tpQty],['Kho KD',data.stock.kdQty],['Tổng tồn',data.stock.totalQty]].map(([label,value])=><div key={label}><span>{label}</span><b>{fmt(Number(value))}</b></div>)}</div>{expanded&&<div className="sku-stock-expanded"><table><thead><tr><th>Kho</th><th>Tồn đã chốt</th></tr></thead><tbody><tr><DataCell>Kho TP</DataCell><DataCell kind="number">{fmt(data.stock.tpQty)}</DataCell></tr><tr><DataCell>Kho KD</DataCell><DataCell kind="number">{fmt(data.stock.kdQty)}</DataCell></tr><tr><DataCell>Tổng TP + KD</DataCell><DataCell kind="number">{fmt(data.stock.totalQty)}</DataCell></tr></tbody></table><p>Bản chốt: {data.snapshot.code}</p><FeedbackActionButton onClick={onOpenWarehouse}>Mở trong Quản lý kho</FeedbackActionButton><p className="stock-readonly-note">Tồn kho lấy từ bản ERP đã chốt mới nhất theo tuần. File chưa chốt chưa được áp dụng.</p></div>}</>}</section>;
}
