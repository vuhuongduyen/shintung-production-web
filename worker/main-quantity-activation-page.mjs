// Explicit MAIN Admin operator. No account, permissions or integration changes.
export const mainQuantityPagePath='/_admin/quantity-activation';
export function mainQuantityActivationPage({sourceId,actorKey,nonce,projectId}){
 const config=JSON.stringify({sourceId,actorKey,projectId,api:'/api/main-quantity-activation'}).replaceAll('<','\\u003c');
 const script=`(${quantityPageClient.toString()})(${config});`;
 const html=`<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Bật báo sản lượng — MAIN</title>
<style nonce="${nonce}">*{box-sizing:border-box}body{margin:0;background:#f5f7fa;color:#183041;font:16px/1.5 "Times New Roman",serif}main{max-width:760px;margin:32px auto;padding:24px;background:#fff;border:1px solid #d7e0e8;border-radius:10px}h1{font-size:24px;margin:0 0 12px}p{margin:12px 0}button,a{font:inherit}button{padding:10px 16px;border:1px solid #275e7d;border-radius:6px;background:#fff;color:#183f59;cursor:pointer}button.primary{background:#27633b;color:#fff}button:disabled{opacity:.5;cursor:not-allowed}button:focus-visible,a:focus-visible,input:focus-visible{outline:3px solid #e6a936;outline-offset:3px}.actions{display:flex;gap:10px;flex-wrap:wrap;margin:20px 0}.status{min-height:84px;padding:14px;border:1px solid #d7e0e8;border-radius:6px;overflow-wrap:anywhere}.confirm{display:flex;gap:10px;align-items:flex-start;margin:16px 0}.confirm input{width:20px;height:20px;flex:none;margin-top:3px}details{margin-top:18px;color:#4b5f6c}code{overflow-wrap:anywhere}a{color:#155f8a}@media(max-width:600px){main{margin:12px;padding:18px}h1{font-size:21px}.actions button{flex:1 1 100%}}</style></head>
<body><main><h1>Bật báo sản lượng trên web chính</h1><p>Lệnh dở dang chuyển sang báo theo sản lượng tại thời điểm kích hoạt thành công do hệ thống ghi nhận (T). Chuẩn bị dữ liệu chưa tạo T và không áp dụng hồi tố. Giữ nguyên dữ liệu đã ghi; ngày áp dụng Giờ công/SP được xác định riêng theo ngày nghiệp vụ và lịch sử định mức. Chỉ thao tác sau khi đã kiểm bản sao lưu đầy đủ; không tạo phiếu nghiệp vụ thật để thử.</p>
<div id="status" class="status" role="status" aria-live="polite" aria-atomic="true">Đang kiểm tra trạng thái…</div>
<label class="confirm"><input id="ack" type="checkbox" disabled><span>Tôi xác nhận bật mô hình mới trên MAIN. Bước này ghi mốc dữ liệu và hiện chưa có hoàn tác tự động.</span></label>
<div class="actions"><button id="refresh" type="button">Kiểm tra trạng thái</button><button id="prepare" type="button" disabled>Chuẩn bị dữ liệu mốc</button><button id="activate" class="primary" type="button" disabled>Bật trên MAIN</button></div>
<p id="result" role="status" aria-live="polite"></p><p><a href="/">Về ONSPA chính</a></p>
<details><summary>Thông tin bản phát hành và an toàn</summary><p>Nguồn: <code id="source"></code></p><p>Chỉ Admin toàn quyền qua phiên ONSPA hiện hành được thao tác. Mở trang không tự chuẩn bị hoặc bật. Khi mất phản hồi, kiểm trạng thái rồi dùng lại cùng mã thao tác; không tạo mốc mới.</p></details>
<script nonce="${nonce}">${script}</script></main></body></html>`;
 return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Security-Policy':`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`}});
}
function quantityPageClient(config){
 const byId=id=>document.getElementById(id),status=byId('status'),result=byId('result'),ack=byId('ack');
 const refresh=byId('refresh'),prepare=byId('prepare'),activate=byId('activate');
 const key='onspa.main.quantity.v1:'+config.sourceId+':'+config.actorKey;
 let current=null,busy=false,safe=false,storageReady=true,pending=null;
 byId('source').textContent=config.sourceId;
 try{const saved=sessionStorage.getItem(key);if(saved){const p=JSON.parse(saved);if(p.sourceId!==config.sourceId||!/^[A-Za-z0-9-]{16,80}$/.test(p.nonce))throw Error('Mã thao tác lưu không hợp lệ.');pending=p;}}catch{storageReady=false;}
 function controls(){refresh.disabled=busy;ack.disabled=busy||!safe||current?.state!=='prepared'||!current?.resume;prepare.disabled=busy||!safe||!storageReady||current?.state!=='unprepared';activate.disabled=busy||!safe||current?.state!=='prepared'||!current?.resume||!ack.checked;}
 async function request(path,body){
  const r=await fetch(path,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',redirect:'error',headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{})});
  if(!r.headers.get('content-type')?.includes('application/json'))throw Error('Chưa xác định kết quả: phản hồi không phải JSON. Kiểm tra trạng thái; không tạo mã mới.');
  const value=await r.json();if(!r.ok)throw Error('HTTP '+r.status+': '+(value.error||'Không thực hiện được; giữ nguyên để đối chiếu.'));return value;
 }
 async function read(){
  safe=false;current=null;ack.checked=false;
  const value=await request(config.api);
  if(value.currentSourceId!==config.sourceId||value.sourceId&&value.sourceId!==config.sourceId)throw Error('Nguồn đang chạy đã thay đổi. Tải lại trang và đối chiếu trước khi ghi.');
  current=value;safe=value.cutoverTiming==='activation-receipt';
  if(!safe)throw Error('Cơ chế ghi thời điểm chuyển đổi không khớp; dừng để đối chiếu.');
  const labels={unprepared:'Chưa chuẩn bị; chưa ghi thời điểm chuyển đổi T.',prepared:'Đã chuẩn bị dữ liệu. Chưa bật và chưa ghi T. Kiểm lại rồi tích xác nhận để bật trên MAIN.',active:'Đã bật báo sản lượng trên MAIN.'};
  status.textContent=labels[value.state]||'Trạng thái không hỗ trợ; dừng để đối chiếu.';
  if(value.state==='active'){
   if(!value.receivedAt||!Number.isFinite(Date.parse(value.receivedAt)))throw Error('Thiếu thời điểm chuyển đổi đã xác minh; dừng để đối chiếu.');
   status.textContent+=' Thời điểm chuyển đổi T (GMT+7): '+new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'medium',hourCycle:'h23'}).format(new Date(value.receivedAt))+'.';
  }
  if(value.state==='prepared'&&!value.resume)status.textContent+=' Bản chuẩn bị thuộc phiên người thao tác hoặc nguồn khác; không được dùng mã mới để ghi đè.';
  if(!['unprepared','prepared','active'].includes(value.state))safe=false;
  return value;
 }
 async function inspect(){if(busy)return;busy=true;controls();result.textContent='';try{await read();}catch(e){safe=false;status.textContent=e.message;}finally{busy=false;controls();}}
 async function mutate(action){
  if(busy)return;
  if(action==='prepare'&&(prepare.disabled||current?.state!=='unprepared'))return;
  if(action==='activate'&&(activate.disabled||!ack.checked||!current?.resume))return;
  const before=current;
  let body;
  try{
   if(action==='prepare'){
    if(!pending){pending={sourceId:config.sourceId,nonce:crypto.randomUUID()};sessionStorage.setItem(key,JSON.stringify(pending));}
    body={action,requestIdempotency:pending.nonce};
   }else body={action,requestIdempotency:before.resume.requestIdempotency,expectedRevision:before.revision,acknowledge:true};
  }catch{storageReady=false;result.textContent='Không lưu được mã thử lại trong tab này. Chưa gửi yêu cầu ghi.';controls();return;}
  busy=true;controls();result.textContent=action==='prepare'?'Đang chuẩn bị dữ liệu mốc…':'Đang bật trên MAIN…';
  let failure=null;
  try{await request(config.api,body);}catch(e){failure=e.message;}
  try{const after=await read();result.textContent=failure?(after.state==='active'?'Phản hồi trước chưa xác định; đã đọc lại và xác nhận MAIN đang bật.':failure+' Trạng thái đã đọc lại; giữ cùng mã thao tác.'):(after.state==='active'?'Đã đọc lại: MAIN đang bật, cùng mốc đã ghi nhận.':'Đã đọc lại bản chuẩn bị; chưa bật.');}
  catch(e){safe=false;result.textContent=(failure?failure+' ':'')+e.message;}
  finally{busy=false;controls();}
 }
 refresh.addEventListener('click',inspect);ack.addEventListener('change',controls);prepare.addEventListener('click',()=>mutate('prepare'));activate.addEventListener('click',()=>mutate('activate'));
 controls();void inspect();
}
