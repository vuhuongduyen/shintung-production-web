import base from '../app/leadtime-data.json' with {type:'json'};
const skuKey=v=>String(v||'').trim().toUpperCase();
const value=r=>{const v=r?.leadTime??r?.leadtime??r?.standardLeadTime??r?.days;return v==null||v===''||!Number.isFinite(Number(v))?null:Number(v);};
const stopped=r=>r?._deleted||r?.cancelled||r?.status==='Đã hủy'||r?.status==='Hủy';
export function transitStandardLeadtime(order,saved=[],versions=[],at=new Date().toISOString()) {
 const sku=skuKey(order.sku),custom=saved.filter(r=>skuKey(r.sku)===sku);
 if(custom.some(stopped))return null;
 const active=versions.filter(r=>skuKey(r.sku)===sku&&!stopped(r)&&(r.status==='Đang áp dụng'||r.status==='Hết hiệu lực'&&r.confirmedAt)&&r.validFrom&&Date.parse(r.validFrom)<=Date.parse(at)&&(!r.validTo||Date.parse(at)<Date.parse(r.validTo))).sort((a,b)=>Date.parse(b.validFrom)-Date.parse(a.validFrom))[0];
 if(active)return value(active);
 const levels=(custom.length?custom:base.filter(r=>skuKey(r.sku)===sku)).filter(r=>!stopped(r)&&value(r)!==null).sort((a,b)=>Number(a.moq??a.MOQ??a.quantity??a.referenceQty??0)-Number(b.moq??b.MOQ??b.quantity??b.referenceQty??0));
 const picked=levels.find(r=>Number(r.moq??r.MOQ??r.quantity??r.referenceQty??0)>=Number(order.lsxQty||0))||levels.at(-1);
 return value(picked);
}
