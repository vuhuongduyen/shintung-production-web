import {bomLineActive,bomPositive,validateBomNumbers} from '../../lib/bom-rules.mjs';
import {randomUUID} from 'node:crypto';
import bomData from '../../app/bom-data.json' with {type:'json'};
import {recordRevision,conflictMessage} from '../../lib/record-revision.mjs';
import {usableSku} from '../../lib/sku-state.mjs';
import {normalizeBomWaste} from '../../lib/bom-waste.mjs';
import {syncBomSources,sourceFromSku} from '../../lib/bom-source.mjs';

const failure=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const original=new Map(bomData.map(row=>[row.sku,{...row,status:'Đã xác nhận',confirmedDate:row.setup,confirmedBy:'SETUP_ADMIN'}]));
const active=bomLineActive;
const normalizedCode=value=>String(value||'').trim().toUpperCase();
const baseBom=(sku,stored)=>stored?JSON.parse(stored):original.get(sku)||null;
const materialCatalog=catalog=>new Map([
 ...bomData.flatMap(b=>b.items||[]).map(item=>[item.code,item]),
 ...catalog.map(row=>[row.key,{code:row.key,name:row.payload.name,spec:row.payload.specification,unit:row.payload.unit,source:sourceFromSku(row.payload)||''}]),
]);
function validateLines(boms,lines,materials,single=false){
 if(!Array.isArray(lines)||!lines.length||lines.length>(single?200:20))failure('Vui lòng nhập từ 1 đến 20 dòng thay đổi chung.');
 const seen=new Set();
 return lines.map(input=>{
  const code=normalizedCode(input.code),newCode=normalizedCode(input.newCode),action=input.action;
  if(!code||!['Thêm mới','Thay đổi','Ngừng sử dụng'].includes(action)||seen.has(code))failure('Mã LK/NVL hoặc loại thay đổi không hợp lệ hay bị lặp.');
  seen.add(code);
  if(!materials.has(code)||newCode&&!materials.has(newCode))failure(`Mã LK/NVL ${code} hoặc mã thay thế chưa có trong danh mục.`,409);
  const found=boms.map(b=>b.items?.find(item=>item.code===code&&active(item))||null);
  if(action==='Thêm mới'&&found.some(Boolean))failure(`LK/NVL ${code} đã có trong một BOM đã chọn; không thể thêm mới hàng loạt.`,409);
  if(action!=='Thêm mới'&&found.some(item=>!item))failure(`LK/NVL ${code} không đang sử dụng trong mọi BOM đã chọn.`,409);
  if(action!=='Thêm mới'){
   const reference=found[0],comparable=item=>JSON.stringify([item.name||'',item.spec||'',item.unit||'',materials.get(item.code)?.source||item.source||'',item.qty||'',item.denominator||'1',normalizeBomWaste(item.waste)??item.waste??'']);
   if(found.some(item=>comparable(item)!==comparable(reference)))failure(`LK/NVL ${code} có lượng dùng, mẫu số hoặc hao hụt khác nhau giữa các SKU. Hãy sửa riêng từng SKU.`,409);
  }
  if(newCode&&(action!=='Thay đổi'||newCode===code||boms.some(b=>b.items?.some(item=>item.code===newCode&&active(item)))))failure(`Mã thay thế ${newCode} không phù hợp hoặc đã có trong BOM.`,409);
  if(action==='Thay đổi'&&!newCode&&!String(input.newQty||'').trim()&&!String(input.waste||'').trim()&&(!String(input.denominator||'').trim()||Number(String(input.denominator).replace(',','.'))===Number(String(found[0]?.denominator||'1').replace(',','.'))))failure('Vui lòng nhập mã thay thế, lượng dùng mới hoặc hao hụt mới.');
  if(action!=='Ngừng sử dụng'){if(String(input.newQty||'').trim())bomPositive(input.newQty,'Lượng dùng mới');if(String(input.denominator||'').trim())bomPositive(input.denominator,'Mẫu số');}
  const waste=normalizeBomWaste(input.waste);
  if(waste===null)failure('Hao hụt phải là tỷ lệ phần trăm không âm.');
  const known=materials.get(code);
  return {code,newCode,action,name:known.name||found[0]?.name||'',spec:known.spec||found[0]?.spec||'',oldQty:found[0]?.qty||'',newQty:String(input.newQty||'').trim(),denominator:String(input.denominator||found[0]?.denominator||'1').trim(),waste,note:String(input.note||'').trim()};
 });
}
function applyLines(base,lines,record,date,materials){
 const items=(base.items||[]).map(item=>({...item}));
 for(const line of lines){
  const current=items.find(item=>item.code===line.code&&active(item));
  if(line.action==='Ngừng sử dụng'){if(current)current.expiry=date;continue;}
  const source=materials.get(line.newCode||line.code);
  if(line.action==='Thêm mới'){
   items.push({stt:String((items.length+1)*10).padStart(4,'0'),code:line.code,name:source.name,spec:source.spec||'',qty:line.newQty||'1',denominator:line.denominator||'1',waste:line.waste||'',setup:record.setup,effective:date,expiry:'—',unit:source.unit||'—',source:source.source||'Tự chế',check:'Khớp'});
  }else{
   current.expiry=date;
   items.push({...current,stt:String((items.length+1)*10).padStart(4,'0'),code:line.newCode||line.code,name:line.newCode?source.name:current.name,spec:line.newCode?source.spec||'':current.spec,unit:line.newCode?source.unit||'—':current.unit,source:line.newCode?source.source||'Tự chế':current.source,qty:line.newQty||current.qty,denominator:line.denominator||current.denominator||'1',waste:line.waste||current.waste||'',setup:record.setup,effective:date,expiry:'—'});
  }
 }
 const originalSetup=original.get(base.sku)?.setup||base.setup;
 return {...base,version:record.newVersions[base.sku],status:'Đã xác nhận',setup:originalSetup,changeDate:record.setup,modifiedDate:date,confirmedDate:base.confirmedDate||originalSetup||date,confirmedBy:base.confirmedBy||'SETUP_ADMIN',changeDocument:record.id,items};
}
export async function mutateBomBulk(db,body,actor,catalog=[]){
 if(!actor?.login)failure('Vui lòng đăng nhập.',401);
 const action=body?.action,key=String(body?.key||'').trim();if(!key||!['save','confirm','cancel','undo'].includes(action))failure('Thao tác phiếu BOM không hợp lệ.');
 const current=await db.prepare("SELECT payload FROM app_records WHERE entity='bom_change' AND record_key=?").bind(key).first();
 if(body.expectedRevision!==await recordRevision(current?.payload))failure(conflictMessage,409);
 let record,skus;
 if(action==='save'){
  if(current&&(!body.single||!['Nháp','Chờ xác nhận'].includes(JSON.parse(current.payload).status)))failure('Mã phiếu đã tồn tại hoặc đã được xử lý.',409);
  if(current&&(JSON.parse(current.payload).bulk||JSON.parse(current.payload).sku!==String(body.sku||'').trim()))failure('Không được đổi mã hàng hoặc loại phiếu đang sửa.',409);
  skus=(body.single?[body.sku]:body.skus)?.map(normalizedCode);
  if(!Array.isArray(skus)||skus.length<(body.single?1:2)||skus.length>30||new Set(skus).size!==skus.length)failure('Sửa hàng loạt cần 2 đến 30 SKU khác nhau.');
  if(!String(body.reason||'').trim())failure('Vui lòng nhập lý do thay đổi.');
  const masters=new Map(catalog.map(row=>[normalizedCode(row.key),row.payload]));
  if(skus.some(sku=>!usableSku(masters.get(sku))))failure('SKU chưa xác nhận hoặc chưa sử dụng trong SKU Master.',409);
 }else{
  if(!current)failure('Không tìm thấy phiếu thay đổi.',404);
  record=JSON.parse(current.payload);skus=record.skus||[record.sku];
  if(Boolean(record.bulk)===Boolean(body.single)||!Array.isArray(skus)||!(action==='undo'?record.status==='Đã xác nhận':['Nháp','Chờ xác nhận'].includes(record.status)))failure('Trạng thái phiếu không cho phép thao tác này.',409);
 }
 const source=[];
 for(const sku of skus){const row=await db.prepare("SELECT payload FROM app_records WHERE entity='bom' AND record_key=?").bind(sku).first(),base=baseBom(sku,row?.payload);if(!base)failure(`SKU ${sku} chưa có BOM nguồn.`,409);source.push({sku,raw:row?.payload??null,base});}
 if(action==='save'&&body.single&&body.sourceRevision!==await recordRevision(source[0].raw))failure('BOM nguồn đã thay đổi. Tải lại BOM trước khi lưu phiếu.',409);
 const masters=new Map(catalog.map(row=>[normalizedCode(row.key),row.payload]));
 if(['save','confirm'].includes(action)&&skus.some(sku=>!usableSku(masters.get(sku))))failure('SKU chưa xác nhận hoặc đã ngừng sử dụng.',409);
 if(['save','confirm'].includes(action)&&source.some(item=>item.base.status!=='Đã xác nhận'))failure('BOM nguồn phải được xác nhận trước khi lập thay đổi.',409);
 const materials=materialCatalog(catalog),now=new Date().toISOString(),date=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(now));
 let confirmedBoms=[];
 if(action==='save'){
  const pending=(await db.prepare("SELECT record_key,payload FROM app_records WHERE entity='bom_change'").all()).results.find(row=>{const change=JSON.parse(row.payload);return row.record_key!==key&&change.status==='Chờ xác nhận'&&skus.some(sku=>(change.skus||[change.sku]).includes(sku));});
  if(pending)failure(`SKU đã có phiếu ${pending.record_key} chờ xác nhận. Vui lòng xử lý phiếu trước.`,409);
  const lines=validateLines(source.map(item=>item.base),body.lines,materials,body.single);
  for(const line of lines){const added=line.newCode||(line.action==='Thêm mới'?line.code:null);if(added&&!usableSku(masters.get(added)))failure(`Mã ${added} chưa xác nhận/đang sử dụng trong SKU Master.`,409);}
  record={id:key,bulk:!body.single,sku:skus[0],skus,oldVersion:'Theo từng SKU',newVersion:'Theo từng SKU',sourceSnapshots:Object.fromEntries(source.map(x=>[x.sku,x.raw?JSON.parse(x.raw):null])),oldVersions:Object.fromEntries(source.map(x=>[x.sku,x.base.version])),newVersions:Object.fromEntries(source.map(x=>[x.sku,String(Number(x.base.version||0)+1).padStart(4,'0')])),sourceRevisions:Object.fromEntries(await Promise.all(source.map(async x=>[x.sku,await recordRevision(x.raw)]))),lines,reason:String(body.reason).trim(),setup:date,effective:'—',status:body.single&&body.status==='Nháp'?'Nháp':'Chờ xác nhận',createdBy:current?JSON.parse(current.payload).createdBy:actor.login,createdAt:current?JSON.parse(current.payload).createdAt:now,modifiedBy:actor.login,modifiedAt:now};
  if(body.single){record.oldVersion=source[0].base.version;record.newVersion=record.newVersions[skus[0]];record.user=actor.login;}
 }else{
  if(action==='confirm'){
   if(!record.sourceRevisions)failure('Phiếu cũ chưa có bản nguồn để đối chiếu. Mở Sửa và lưu lại trước khi xác nhận.',409);
   for(const item of source)if(record.sourceRevisions[item.sku]!==await recordRevision(item.raw))failure(`BOM ${item.sku} đã thay đổi từ lúc lưu phiếu. Tải lại và đối chiếu trước khi xác nhận.`,409);
   validateLines(source.map(item=>item.base),record.lines,materials,body.single);
   for(const line of record.lines){const added=line.newCode||(line.action==='Thêm mới'?line.code:null);if(added&&!usableSku(masters.get(added)))failure(`Mã ${added} chưa xác nhận/đang sử dụng trong SKU Master.`,409);}
  }
  if(action==='undo'&&!record.appliedRevisions){
   if(!body.single)failure('Phiếu chưa có dữ liệu khôi phục.',409);
   const audits=(await db.prepare("SELECT payload FROM app_records WHERE entity='admin_audit' ORDER BY updated_at DESC").all()).results.map(row=>JSON.parse(row.payload));
   const item=source[0],audit=audits.find(row=>row.entity==='bom'&&row.key===item.sku&&row.after?.changeDocument===key);
   if(!audit||await recordRevision(JSON.stringify(audit.after))!==await recordRevision(item.raw))failure('Không có bản trước/sau khớp để khôi phục phiếu này; BOM có thể đã được sửa tiếp.',409);
   record={...record,sourceSnapshots:{[item.sku]:audit.before},appliedRevisions:{[item.sku]:await recordRevision(item.raw)}};
  }
  if(action==='undo')for(const item of source)if(record.appliedRevisions?.[item.sku]!==await recordRevision(item.raw))failure(`BOM ${item.sku} đã thay đổi sau khi xác nhận. Không thể hủy xác nhận hàng loạt.`,409);
  confirmedBoms=action==='confirm'?source.map(item=>syncBomSources(applyLines(item.base,record.lines,record,date,materials),catalog.map(row=>row.payload))):[];
  confirmedBoms.forEach(validateBomNumbers);
  record={...record,status:action==='confirm'?'Đã xác nhận':action==='undo'?'Đã hủy xác nhận':'Đã hủy',effective:action==='confirm'?date:'—',confirmedBy:action==='confirm'?actor.login:record.confirmedBy,confirmedAt:action==='confirm'?now:record.confirmedAt,appliedRevisions:action==='confirm'?Object.fromEntries(await Promise.all(confirmedBoms.map(async bom=>[bom.sku,await recordRevision(JSON.stringify(bom))]))):record.appliedRevisions,modifiedBy:actor.login,modifiedAt:now};
 }
 const writes=[],guardKey=randomUUID();
 const checks=[current?"EXISTS(SELECT 1 FROM app_records WHERE entity='bom_change' AND record_key=? AND payload=?)":"NOT EXISTS(SELECT 1 FROM app_records WHERE entity='bom_change' AND record_key=?)"];
 const bindings=current?[key,current.payload]:[key];
 for(const item of source){checks.push(item.raw?"EXISTS(SELECT 1 FROM app_records WHERE entity='bom' AND record_key=? AND payload=?)":"NOT EXISTS(SELECT 1 FROM app_records WHERE entity='bom' AND record_key=?)");bindings.push(item.sku,...(item.raw?[item.raw]:[]));}
 if(action==='save')for(const sku of skus){checks.push("NOT EXISTS(SELECT 1 FROM app_records bc WHERE bc.entity='bom_change' AND bc.record_key<>? AND json_extract(bc.payload,'$.status')='Chờ xác nhận' AND (json_extract(bc.payload,'$.sku')=? OR EXISTS(SELECT 1 FROM json_each(bc.payload,'$.skus') WHERE value=?)))");bindings.push(key,sku,sku);}
 writes.push(db.prepare(`INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'bom_bulk_guard',?,?,?,? WHERE ${checks.join(' AND ')}`).bind(guardKey,'{}',actor.login,now,...bindings));
 const operations=[{entity:'bom_change',key,payload:record,raw:current?.payload??null}];
 if(action==='confirm')for(const bom of confirmedBoms)operations.push({entity:'bom',key:bom.sku,payload:bom,raw:source.find(item=>item.sku===bom.sku).raw});
 if(action==='undo')for(const item of source)operations.push({entity:'bom',key:item.sku,payload:record.sourceSnapshots[item.sku]||original.get(item.sku),raw:item.raw,remove:record.sourceSnapshots[item.sku]===null});
 for(const op of operations){const raw=JSON.stringify(op.payload);op.nextRaw=raw;
  writes.push(op.remove?db.prepare("DELETE FROM app_records WHERE entity='bom' AND record_key=? AND payload=? AND EXISTS(SELECT 1 FROM app_records WHERE entity='bom_bulk_guard' AND record_key=?)").bind(op.key,op.raw,guardKey):op.raw?db.prepare("UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity=? AND record_key=? AND payload=? AND EXISTS(SELECT 1 FROM app_records WHERE entity='bom_bulk_guard' AND record_key=?)").bind(raw,actor.login,now,op.entity,op.key,op.raw,guardKey):db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM app_records WHERE entity='bom_bulk_guard' AND record_key=?) ON CONFLICT(entity,record_key) DO NOTHING").bind(op.entity,op.key,raw,actor.login,now,guardKey));
  writes.push(db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'admin_audit',?,?,?,? WHERE changes()=1").bind(randomUUID(),JSON.stringify({entity:op.entity,key:op.key,before:op.raw?JSON.parse(op.raw):null,after:op.payload,actor:actor.login,at:now}),actor.login,now));
 }
 writes.push(db.prepare("DELETE FROM app_records WHERE entity='bom_bulk_guard' AND record_key=?").bind(guardKey));
 const result=await db.batch(writes);if(result[0].meta.changes!==1||operations.some((_,i)=>result[1+i*2].meta.changes!==1))failure(conflictMessage,409);
 return {ok:true,change:record,boms:operations.slice(1).map(op=>op.payload),bomRevisions:Object.fromEntries(await Promise.all(operations.slice(1).map(async op=>[op.key,op.remove?null:await recordRevision(JSON.stringify(op.payload))]))),revision:await recordRevision(JSON.stringify(record))};
}
