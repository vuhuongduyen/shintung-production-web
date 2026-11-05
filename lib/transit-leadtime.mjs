import base from '../app/leadtime-data.json' with {type:'json'};
const skuKey=v=>String(v||'').trim().toUpperCase();
const value=r=>{const v=r?.leadTime??r?.leadtime??r?.standardLeadTime??r?.days;return v==null||v===''||!Number.isFinite(Number(v))?null:Number(v);};
const stopped=r=>r?._deleted||r?.cancelled||r?.status==='Đã hủy'||r?.status==='Hủy';
export function transitStandardLeadtime(order,saved=[],versions=[],at=new Date().toISOString()) {
 if(order.planLeadtimeBasis){
  const b=order.planLeadtimeBasis;
  if(!(b.kind==='plan-close-leadtime-v1'&&skuKey(b.sku)===skuKey(order.sku)&&b.planRowId===(order.planRowId||order.id)&&Number.isFinite(Date.parse(b.closedAt))&&((typeof b.value==='number'&&Number.isFinite(b.value)&&b.value>=0)||b.value===null)))return null;
  if(b.tiers!==undefined){
   if(!Array.isArray(b.tiers)||!b.tiers.length||b.tiers.some(t=>typeof t.moq!=='number'||!Number.isFinite(t.moq)||typeof t.value!=='number'||!Number.isFinite(t.value)||t.value<0))return null;
   const tiers=[...b.tiers].sort((a,c)=>a.moq-c.moq);return (tiers.find(t=>t.moq>=Number(order.lsxQty||0))||tiers.at(-1)).value;
  }
  return b.value;
 }
 const sku=skuKey(order.sku),custom=saved.filter(r=>skuKey(r.sku)===sku);
 if(custom.some(stopped))return null;
 const active=versions.filter(r=>skuKey(r.sku)===sku&&!stopped(r)&&(r.status==='Đang áp dụng'||r.status==='Hết hiệu lực'&&r.confirmedAt)&&r.validFrom&&Date.parse(r.validFrom)<=Date.parse(at)&&(!r.validTo||Date.parse(at)<Date.parse(r.validTo))).sort((a,b)=>Date.parse(b.validFrom)-Date.parse(a.validFrom))[0];
 if(active)return value(active);
 const levels=(custom.length?custom:base.filter(r=>skuKey(r.sku)===sku)).filter(r=>!stopped(r)&&value(r)!==null).sort((a,b)=>Number(a.moq??a.MOQ??a.quantity??a.referenceQty??0)-Number(b.moq??b.MOQ??b.quantity??b.referenceQty??0));
 const picked=levels.find(r=>Number(r.moq??r.MOQ??r.quantity??r.referenceQty??0)>=Number(order.lsxQty||0))||levels.at(-1);
 return value(picked);
}

export function capturePlanLeadtime(row,saved,versions,closedAt,closedBy){
 if(!Number.isFinite(Date.parse(closedAt)))throw Error('Thiếu thời điểm chốt kế hoạch.');
 const dated=versions.map(v=>({...v,...Object.fromEntries(['validFrom','validTo'].filter(k=>/^\d{4}-\d{2}-\d{2}$/.test(v[k]||'')).map(k=>[k,v[k]+'T00:00:00+07:00']))}));
 const published=dated.filter(v=>skuKey(v.sku)===skuKey(row.sku)&&!stopped(v)&&(v.status==='Đang áp dụng'||v.status==='Hết hiệu lực'&&v.confirmedAt));
 const active=published.filter(v=>v.validFrom&&Date.parse(v.validFrom)<=Date.parse(closedAt)&&(!v.validTo||Date.parse(closedAt)<Date.parse(v.validTo)));
 const cancelled=saved.some(v=>skuKey(v.sku)===skuKey(row.sku)&&stopped(v));
 const selected=active.length===1?active[0]:null;
 const days=cancelled?null:published.length?selected?value(selected):null:transitStandardLeadtime({...row,lsxQty:row.plan},saved,[],closedAt);
 const custom=saved.filter(v=>skuKey(v.sku)===skuKey(row.sku));
 const tiers=!published.length&&!cancelled?(custom.length?custom:base.filter(v=>skuKey(v.sku)===skuKey(row.sku))).filter(v=>!stopped(v)&&value(v)!==null).map(v=>({moq:Number(v.moq??v.MOQ??v.quantity??v.referenceQty??0),value:value(v)})):null;
 const validTiers=tiers?.some(t=>!Number.isFinite(t.moq))?[]:tiers,observed=validTiers&&!validTiers.length?null:days;
 return {kind:'plan-close-leadtime-v1',planRowId:row.id,sku:row.sku,plannedQuantity:row.plan,closedAt,closedBy,businessDate:new Date(Date.parse(closedAt)+25200000).toISOString().slice(0,10),value:observed,...(validTiers?{tiers:validTiers}:{}),basis:selected?'effective-version-at-plan-close':observed===null?'missing':'observed-at-plan-close',versionId:selected?.id??selected?._recordKey??null};
}
