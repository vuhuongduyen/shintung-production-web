const active=item=>!item.expiry||item.expiry==='—';
const text=value=>String(value??'').trim().replace(/\s+/g,' ').replace(/^—$/,'');
const unit=value=>text(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
const number=value=>Number(text(value).replace('%','').replace(',','.'));
export function reconcileBom(base,manifest){
 const next=structuredClone(base),changes=[],blocked=[];
 const root=manifest.roots[base.sku];
 if(root)for(const field of ['name','spec','unit'])if(field==='unit'?unit(next[field])!==unit(root[field]):text(next[field])!==text(root[field])){changes.push({sku:base.sku,code:base.sku,field,before:next[field]??'',after:root[field],pages:[root.page]});next[field]=root[field];}
 for(const patch of manifest.patches.filter(p=>p.sku===base.sku)){
  const current=next.items.filter(i=>i.code===patch.code&&active(i));
  if(current.length>1){blocked.push({parent:base.sku,code:patch.code,reason:'BOM trên web có nhiều dòng đang sử dụng cùng mã',pages:patch.pages});continue;}
  let item=current[0];
  if(!item){
   if(!Object.hasOwn(patch.fields,'qty')||patch.excluded){blocked.push({parent:base.sku,code:patch.code,reason:'Thiếu dòng nhưng chưa có định mức thống nhất',pages:patch.pages});continue;}
   item={stt:String((Math.max(0,...next.items.map(i=>Number(i.stt)||0))+10)).padStart(4,'0'),code:patch.code,...patch.fields,denominator:'1',source:patch.source,check:'Khớp',effective:'30/09/2026',expiry:'—'};
   next.items.push(item);changes.push({sku:base.sku,code:patch.code,field:'Thêm dòng',before:'',after:`${item.qty} / ${item.denominator} · ${item.waste}`,pages:patch.pages});continue;
  }
  for(const field of ['name','spec','unit','qty','waste']){
   if(!Object.hasOwn(patch.fields,field))continue;
   let after=patch.fields[field],before=item[field];
   if(field==='qty'){
    const ratio=number(before)/number(item.denominator||'1'),desired=number(after),den=number(item.denominator||'1');
    // Preserve approved numerator/denominator representation, including 5010304 = 1/10.
    if(Math.abs(ratio-desired)<1e-10||den!==1&&ratio>=Number(patch.bounds[0])&&ratio<=Number(patch.bounds[1])&&number(patch.fields.waste||'0')===0)continue;
    after=String(Number((desired*den).toFixed(10)));
   }
   if(field==='unit'&&unit(before)===unit(after))continue;
   if(field==='name'&&text(before).toUpperCase()===text(after).toUpperCase())continue;
   if(field==='waste'&&number(before)===number(after))continue;
   if(text(before)===text(after))continue;
   changes.push({sku:base.sku,code:patch.code,field,before:before??'',after,pages:patch.pages});item[field]=after;
  }
 }
 return {next,changes,blocked};
}
