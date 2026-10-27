// Scoped bridge: only newly approved receipts explicitly marked for Sheets are exported.
export const REAL_SHEET='SAMPLE_SHEET_ID_NOT_CONFIGURED';
export const sha=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
const fail=(message,status=422)=>{throw Object.assign(Error(message),{status});};
const read=async(db,e,k)=>{const r=await db.prepare('SELECT payload FROM app_records WHERE entity=? AND record_key=?').bind(e,k).first();return r?JSON.parse(r.payload):null;};
const reply=(b,s=200)=>Response.json(b,{status:s,headers:{'Cache-Control':'no-store'}});
export async function sheetSetup(request,env,actor){
 if(!actor?.isAdmin||actor.line)return reply({error:'Chỉ Admin được cấu hình kết nối kho.'},403);
 const db=env.DB,old=await read(db,'warehouse_sheet_config','connection');
 if(request.method==='GET')return reply({configured:!!old,spreadsheetId:old?.spreadsheetId||'',lastContactAt:old?.lastContactAt||'',enabled:!!old?.enabled});
 if(request.method!=='POST'||request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Yêu cầu không hợp lệ'},403);
 const body=await request.json();
 if(['backfill-preview','backfill-queue'].includes(body.action))return sheetBackfill(db,old,body,actor,new URL(request.url).hostname);
 if(body.action==='disable'){
  if(old)await db.prepare("UPDATE app_records SET payload=? WHERE entity='warehouse_sheet_config' AND record_key='connection'").bind(JSON.stringify({...old,enabled:false})).run();
  return reply({ok:true,configured:!!old,enabled:false,spreadsheetId:old?.spreadsheetId||'',lastContactAt:old?.lastContactAt||''});
 }
 const spreadsheetId=String(body.spreadsheetId||'').trim(),host=new URL(request.url).hostname;
 if(!/^[A-Za-z0-9_-]{20,150}$/.test(spreadsheetId))fail('Nhập ID file Google Sheet hợp lệ.');
 if(spreadsheetId===REAL_SHEET&&host!=='disabled.example.invalid')fail('Môi trường thử không được kết nối file kho thật.',403);
 if(old?.spreadsheetId&&old.spreadsheetId!==spreadsheetId)fail('Đã liên kết file khác. Cần đối chiếu phiếu trước khi đổi file.',409);
 const token=crypto.randomUUID()+crypto.randomUUID(),now=new Date().toISOString();
 const config={spreadsheetId,tokenHash:await sha(token),enabled:true,createdAt:old?.createdAt||now,updatedAt:now,updatedBy:actor.login};
 await db.prepare("INSERT INTO app_records VALUES('warehouse_sheet_config','connection',?,?,?) ON CONFLICT(entity,record_key) DO UPDATE SET payload=excluded.payload,updated_by=excluded.updated_by,updated_at=excluded.updated_at").bind(JSON.stringify(config),actor.login,now).run();
 return reply({ok:true,configured:true,enabled:true,lastContactAt:'',token,spreadsheetId,baseUrl:new URL(request.url).origin});
}
export async function sheetBridge(request,env){
 if(request.method!=='POST')return reply({error:'Chỉ hỗ trợ POST'},405);
 const db=env.DB,config=await read(db,'warehouse_sheet_config','connection');
 if(!config)return reply({code:'NOT_CONFIGURED',error:'Web này chưa có cấu hình kho. Kiểm tra địa chỉ web đã nhập trong Apps Script.'},401);
 if(!config.enabled)return reply({code:'DISABLED',error:'Kết nối kho đang tắt trên web. Admin cần bật lại kết nối.'},401);
 let b;try{b=await request.json();}catch{return reply({code:'INVALID_JSON',error:'Nội dung kết nối không hợp lệ. Cập nhật file WEB.gs.'},400);}
 if(!b||typeof b!=='object'||Array.isArray(b))return reply({error:'Nội dung kết nối không hợp lệ.'},400);
 // Scoped secret in HTTPS JSON avoids reliance on hosting Authorization forwarding.
 // Retain bearer support for previously installed clients. Never log the request body.
 const token=String(b.bridgeToken||request.headers.get('authorization')?.replace(/^Bearer /i,'')||'').trim();
 delete b.bridgeToken;
 if(!token)return reply({code:'TOKEN_MISSING',error:'Web không nhận được khóa kết nối. Thay code WEB.gs bằng bản mới rồi chạy ONSPA_khoiPhucKetNoi.'},401);
 if(token.length<32||token.length>256||await sha(token)!==config.tokenHash)return reply({code:'TOKEN_INVALID',error:'Khóa đã lưu trong Apps Script không khớp web này. Chạy ONSPA_caiDatKetNoi và nhập đúng địa chỉ web, khóa hiện hành.'},401);
 if(b.spreadsheetId!==config.spreadsheetId)fail('Sai file Google Sheet đã liên kết.',403);
 if(config.spreadsheetId===REAL_SHEET&&new URL(request.url).hostname!=='disabled.example.invalid')fail('Cấm kết nối file kho thật từ môi trường thử.',403);
 const contactAt=new Date().toISOString();
 // JSON-path update plus hash guard cannot re-enable or overwrite a concurrently rotated key.
 await db.prepare("UPDATE app_records SET payload=json_set(payload,'$.lastContactAt',?) WHERE entity='warehouse_sheet_config' AND record_key='connection' AND json_extract(payload,'$.tokenHash')=? AND json_extract(payload,'$.enabled')=1").bind(contactAt,config.tokenHash).run();
 if(b.action==='ping')return reply({ok:true,connected:true,lastContactAt:contactAt});
 if(b.action==='pull'){
 const rows=(await db.prepare("SELECT w.record_key,w.payload,json_extract(r.payload,'$.completedAt') AS latest_completed_at FROM app_records w LEFT JOIN app_records r ON r.entity='production_report' AND r.record_key=json_extract(w.payload,'$.reportId') WHERE w.entity='warehouse_in' AND json_extract(w.payload,'$.sheetSync.status') IS NOT NULL AND (json_extract(w.payload,'$.sheetSync.status') IN ('pending','error') OR COALESCE(json_extract(r.payload,'$.completedAt'),json_extract(w.payload,'$.sourceCompletedAt'),'')<>COALESCE(json_extract(w.payload,'$.sheetSync.exportedCompletedAt'),'')) ORDER BY w.updated_at LIMIT 50").all()).results;
 return reply({receipts:rows.map(r=>({...JSON.parse(r.payload),id:r.record_key,...(r.latest_completed_at?{sourceCompletedAt:r.latest_completed_at}:{})})).filter(p=>!p._deleted&&!p.cancelled&&!p.voided)});
 }
 const key=String(b.receiptId||''),stored=await db.prepare("SELECT payload FROM app_records WHERE entity='warehouse_in' AND record_key=?").bind(key).first();
 if(!stored)fail('Không tìm thấy phiếu nhập kho trên web.',404);
 const p=JSON.parse(stored.payload);
 if(!p.sheetSync||p.source!=='Sản xuất'||p.reportId!==b.reportId||p.sku!==b.sku||p._deleted||p.cancelled||p.voided)fail('Phiếu không thuộc kết nối này hoặc đã hủy.',409);
 const now=new Date().toISOString();let next;
 if(b.action==='ack'||b.action==='error'){
  const report=await read(db,'production_report',p.reportId),latest=report?.completedAt||p.sourceCompletedAt||'';
  if(b.action==='ack'&&b.sourceCompletedAt!==latest)fail('Ngày xuất trạm vừa thay đổi. Hệ thống sẽ cập nhật lại.',409);
  next={...p,...(b.action==='ack'?{sourceCompletedAt:latest}:{}),sheetSync:{...p.sheetSync,...(b.action==='ack'?{exportedCompletedAt:latest}:{}),status:b.action==='ack'?'sent':'error',at:now,error:b.action==='error'?String(b.error||'Lỗi ghi Sheet').slice(0,1000):'',spreadsheetId:config.spreadsheetId}};
 }else if(b.action==='confirm'){
  const qty=b.receivedQuantity,at=String(b.confirmedAt||''),by=String(b.confirmedBy||'').trim(),reason=String(b.differenceReason||'').trim();
  if(typeof qty!=='number'||!Number.isFinite(qty)||qty<0||Number(b.proposedQuantity)!==Number(p.proposedQuantity))fail('Số lượng không hợp lệ hoặc SL đề nghị đã thay đổi. Kiểm tra lại phiếu.');
  if(!by||by==='KHÔNG XÁC ĐỊNH'||!Number.isFinite(Date.parse(at)))fail('Thiếu người hoặc thời gian kho xác nhận.');
  const difference=qty-Number(p.proposedQuantity);
  if(Math.abs(difference)>0.000001&&!reason)fail('Có chênh lệch: cần nhập lý do tại cột P.');
  const eventHash=await sha(JSON.stringify([key,qty,at,by,reason]));
  if(p.sheetConfirmationHash===eventHash)return reply({ok:true,duplicate:true});
  if((p.confirmation_status||p.status)!=='Chờ xác nhận')fail('Phiếu đã được xác nhận bằng thông tin khác. Cần đối chiếu trước khi sửa.',409);
  next={...p,receivedQuantity:qty,difference,differenceReason:reason,status:'Đã xác nhận',confirmation_status:'Đã xác nhận',confirmationStatus:'Đã xác nhận',confirmedAt:at,confirmedBy:by,confirmationBasis:'Kho xác nhận tại Google Sheet',sheetConfirmationHash:eventHash,updatedAt:now,updatedBy:by,sheetSync:{...p.sheetSync,status:'sent',at:now,error:''}};
 }else fail('Thao tác không hợp lệ');
 const result=await db.batch([
 db.prepare("UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity='warehouse_in' AND record_key=? AND payload=?").bind(JSON.stringify(next),next.updatedBy||'Google Sheet kho',now,key,stored.payload),
 db.prepare("INSERT INTO app_records SELECT 'warehouse_sheet_audit',?,?,?,? WHERE EXISTS(SELECT 1 FROM app_records WHERE entity='warehouse_in' AND record_key=? AND payload=?)").bind(crypto.randomUUID(),JSON.stringify({action:b.action,receiptId:key,at:now,confirmedBy:next.confirmedBy,receivedQuantity:next.receivedQuantity,error:next.sheetSync.error}),next.updatedBy||'Google Sheet kho',now,key,JSON.stringify(next))]);
 if(result[0].meta.changes!==1)fail('Phiếu vừa thay đổi. Hệ thống sẽ thử lại.',409);
 return reply({ok:true});
}

function receiptDay(value){
 const s=String(value||'');if(!Number.isFinite(Date.parse(s)))return '';
 if(!/(Z|[+-]\d\d:\d\d)$/.test(s))return s.slice(0,10);
 return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(s));
}
async function sheetBackfill(db,config,body,actor,host){
 if(!config?.enabled||!config.lastContactAt)fail('Cần kết nối Google Sheet thành công trước khi đồng bộ phiếu cũ.');
 if(config.spreadsheetId===REAL_SHEET&&host!=='disabled.example.invalid')fail('Không được đồng bộ kho thật từ môi trường thử.',403);
 const {from,to}=body;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(from||'')||!/^\d{4}-\d{2}-\d{2}$/.test(to||'')||!Number.isFinite(Date.parse(from))||!Number.isFinite(Date.parse(to))||from>to||(Date.parse(to)-Date.parse(from))/86400000>31)fail('Chọn khoảng ngày hợp lệ, tối đa 31 ngày.');
 const rows=(await db.prepare("SELECT w.record_key,w.payload,r.payload AS report_payload FROM app_records w JOIN app_records r ON r.entity='production_report' AND r.record_key=json_extract(w.payload,'$.reportId') WHERE w.entity='warehouse_in' AND json_extract(w.payload,'$.source')='Sản xuất' ORDER BY w.record_key").all()).results;
 const eligible=[],blocked=[];
 for(const row of rows){
 const p=JSON.parse(row.payload),report=JSON.parse(row.report_payload),day=receiptDay(report.completedAt);
 if(day<from||day>to||p._deleted||p.cancelled||p.voided||report._deleted||report.cancelled||report.voided)continue;
 if(report.reviewStatus!=='Đã xác nhận'||!Number.isFinite(Number(p.proposedQuantity))||Number(p.proposedQuantity)<=0||Number(p.proposedQuantity)!==Number(report.approvedQuantity??report.reportedQuantity)||report.sku!==p.sku){blocked.push({id:row.record_key,lsxCode:p.lsxCode,reason:'Báo công chưa xác nhận hoặc số lượng/SKU không khớp phiếu.'});continue;}
 eligible.push({...row,p,completedAt:report.completedAt,day});
 }
 if(eligible.length>500)fail('Có quá 500 phiếu. Chọn khoảng ngày ngắn hơn.');
 const revision=await sha(JSON.stringify([config.spreadsheetId,from,to,eligible.map(r=>[r.record_key,r.payload,r.report_payload])]));
 const view=eligible.map(r=>({id:r.record_key,reportId:r.p.reportId,lsxCode:r.p.lsxCode,sku:r.p.sku,quantity:Number(r.p.proposedQuantity),day:r.day,syncStatus:r.p.sheetSync?.status||'Chưa gửi'}));
 if(body.action==='backfill-preview')return reply({revision,receipts:view,blocked});
 if(body.revision!==revision)fail('Phiếu vừa thay đổi. Bấm Kiểm tra phiếu để xem lại trước khi đồng bộ.',409);
 const now=new Date().toISOString(),todo=eligible.filter(r=>!r.p.sheetSync);
 const statements=todo.map(r=>db.prepare("UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity='warehouse_in' AND record_key=? AND payload=? AND EXISTS(SELECT 1 FROM app_records WHERE entity='production_report' AND record_key=? AND payload=?)").bind(JSON.stringify({...r.p,sourceCompletedAt:r.completedAt,sheetSync:{status:'pending',queuedAt:now,queuedBy:actor.login,backfill:true,spreadsheetId:config.spreadsheetId}}),actor.login,now,r.record_key,r.payload,r.p.reportId,r.report_payload));
 const applied=statements.length?await db.batch(statements):[];
 const queued=applied.reduce((sum,x)=>sum+(x.meta?.changes||0),0);
 return reply({revision,receipts:view,blocked,queued,alreadyQueued:eligible.length-todo.length,changed:todo.length-queued});
}
