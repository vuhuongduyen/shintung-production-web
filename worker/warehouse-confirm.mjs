const hash=async v=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(v)))),b=>b.toString(16).padStart(2,'0')).join('');
import {hasMenuPermission} from '../lib/menu-action-access.mjs';
export async function confirmSelectedWarehouse(db,body,actor){
 if(!hasMenuPermission(actor,'Quản lý kho / Nhập kho',['Xác nhận'])||actor.line)throw Object.assign(Error('Bạn không có quyền xác nhận Nhập kho. Liên hệ Admin kiểm tra quyền menu Nhập kho.'),{status:403});
 const ids=Array.isArray(body.ids)?[...new Set(body.ids)]:[];
 if(!ids.length||ids.length>500||ids.some(id=>typeof id!=='string'||!id))throw Object.assign(Error('Chọn từ 1 đến 500 phiếu chờ xác nhận.'),{status:422});
 const all=(await db.prepare("SELECT record_key,payload FROM app_records WHERE entity='warehouse_in' ORDER BY record_key").all()).results;
 const selected=all.filter(r=>ids.includes(r.record_key));
 if(selected.length!==ids.length||selected.some(r=>{const p=JSON.parse(r.payload);return p._deleted||p.cancelled||p.voided||p.pendingCorrection?.status==='pending'||p.source!=='Sản xuất'||(p.confirmation_status||p.confirmationStatus||p.status)!=='Chờ xác nhận';}))throw Object.assign(Error('Có phiếu không còn chờ xác nhận hoặc đã bị hủy. Cập nhật danh sách rồi chọn lại.'),{status:409});
 if(selected.some(r=>{const n=Number(JSON.parse(r.payload).proposedQuantity);return !Number.isFinite(n)||n<=0;}))throw Object.assign(Error('Có phiếu thiếu số lượng đề nghị hợp lệ. Kiểm tra báo công nguồn trước khi xác nhận.'),{status:422});
 const revision=await hash(selected);
 const receipts=selected.map(r=>({...JSON.parse(r.payload),id:r.record_key}));
 if(body.action==='preview')return {revision,receipts};
 if(body.action!=='confirm'||body.receivedAsProposed!==true||body.revision!==revision)throw Object.assign(Error('Dữ liệu đã thay đổi hoặc chưa kiểm tra số lượng. Đóng khung và kiểm tra lại phiếu đã chọn.'),{status:409});
 const now=new Date().toISOString();
 const results=await db.batch(selected.map(row=>{const p=JSON.parse(row.payload),next={...p,receivedQuantity:Number(p.proposedQuantity),status:'Đã xác nhận',confirmation_status:'Đã xác nhận',confirmationStatus:'Đã xác nhận',confirmedBy:actor.login,confirmedAt:now,updatedBy:actor.login,updatedAt:now,confirmationBasis:'Kho kiểm tra và xác nhận đã nhận đủ theo số lượng đề nghị'};return db.prepare("UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity='warehouse_in' AND record_key=? AND payload=?").bind(JSON.stringify(next),actor.login,now,row.record_key,row.payload);}));
 const confirmedIds=selected.filter((_,i)=>results[i].meta.changes===1).map(r=>r.record_key),skippedIds=ids.filter(id=>!confirmedIds.includes(id));
 return {ok:skippedIds.length===0,confirmedIds,skippedIds,confirmed:confirmedIds.length,...(skippedIds.length?{error:`Đã xác nhận ${confirmedIds.length} phiếu; ${skippedIds.length} phiếu vừa thay đổi chưa được xác nhận. Kiểm tra lại danh sách.`}:{})};
}
export async function confirmWarehouse(db,body,actor){
 if(!actor.isAdmin||actor.line)throw Object.assign(Error('Chỉ Admin toàn quyền được xác nhận hàng loạt.'),{status:403});
 const rows=(await db.prepare("SELECT record_key,payload FROM app_records WHERE entity='warehouse_in' ORDER BY record_key").all()).results;
 const pending=rows.filter(r=>{const p=JSON.parse(r.payload);return !p._deleted&&!p.cancelled&&!p.voided&&p.source==='Sản xuất'&&(p.confirmation_status||p.confirmationStatus||p.status)==='Chờ xác nhận';});
 if(pending.some(r=>JSON.parse(r.payload).pendingCorrection?.status==='pending'))throw Object.assign(Error('Có phiếu đang chờ đối soát điều chỉnh; chưa được xác nhận nhận hàng.'),{status:409});
 const revision=await hash(pending);
 if(body.action==='confirm-preview')return {revision,count:pending.length};
 if(body.action!=='confirm'||body.receivedAsProposed!==true||body.revision!==revision)throw Object.assign(Error('Dữ liệu thay đổi hoặc chưa xác nhận số lượng. Kiểm tra lại danh sách.'),{status:409});
 if(pending.some(r=>{const p=JSON.parse(r.payload);return !Number.isFinite(Number(p.proposedQuantity))||Number(p.proposedQuantity)<=0;}))throw Object.assign(Error('Có phiếu thiếu số lượng hợp lệ.'),{status:422});
 if(!pending.length)return {ok:true,confirmed:0};
 const now=new Date().toISOString(),statements=[];
 for(const row of pending){const p=JSON.parse(row.payload),next={...p,receivedQuantity:Number(p.proposedQuantity),status:'Đã xác nhận',confirmation_status:'Đã xác nhận',confirmationStatus:'Đã xác nhận',confirmedBy:actor.login,confirmedAt:now,updatedBy:actor.login,updatedAt:now,confirmationBasis:'Người dùng xác nhận đã nhận đủ theo số lượng đề nghị'};
 statements.push(db.prepare("UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity='warehouse_in' AND record_key=? AND payload=?").bind(JSON.stringify(next),actor.login,now,row.record_key,row.payload));
 }
 const results=await db.batch(statements);return {ok:true,confirmed:results.reduce((n,r)=>n+r.meta.changes,0),requested:pending.length};
}
