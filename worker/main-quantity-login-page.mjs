// Normal ONSPA password sign-in for the existing Admin activation page.
// No setup account, credential override, automatic activation or permission grant.
export function mainQuantityLoginPage(){
 const nonce=crypto.randomUUID();
 const script=`(${loginClient.toString()})();`;
 return new Response(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Đăng nhập Admin ONSPA</title>
<style nonce="${nonce}">*{box-sizing:border-box}body{margin:0;background:#f5f7f2;color:#194c30;font:18px/1.5 "Times New Roman",serif}main{max-width:480px;margin:8vh auto;padding:26px;background:white;border:1px solid #b6cdb9;border-radius:8px}h1{font-size:26px;margin-top:0}label{display:block;margin-top:16px}input,button{width:100%;font:inherit;padding:10px;border:1px solid #9ebba4;border-radius:4px}button{margin-top:20px;background:#206038;color:white;cursor:pointer}button:disabled{opacity:.6;cursor:wait}input:focus-visible,button:focus-visible{outline:3px solid #e6a936;outline-offset:2px}#status{min-height:54px;margin-bottom:0;color:#a32020}@media(max-width:520px){main{margin:20px 12px}}</style></head>
<body><main><h1>Đăng nhập Admin ONSPA</h1><p>Đăng nhập bằng tài khoản Admin hiện có để tiếp tục kích hoạt báo sản lượng. Các thao tác SX/Kho vẫn đang khóa bảo trì.</p>
<form id="login-form" method="post"><label for="login">ID hoặc email</label><input id="login" name="username" autocomplete="username" maxlength="100" required>
<label for="password">Mật khẩu</label><input id="password" name="password" type="password" autocomplete="current-password" minlength="4" maxlength="64" required>
<button id="submit" type="submit">Đăng nhập để tiếp tục</button><p id="status" role="status" aria-live="polite"></p></form>
<p>Đăng nhập không tự kích hoạt, không thay đổi tài khoản hoặc quyền.</p></main><script nonce="${nonce}">${script}</script></body></html>`,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Security-Policy':`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`}});
}
function loginClient(){
 const form=document.getElementById('login-form'),button=document.getElementById('submit'),status=document.getElementById('status'),password=document.getElementById('password');
 let busy=false;
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!form.reportValidity())return;busy=true;button.disabled=true;status.textContent='Đang đăng nhập…';
  try{
   const response=await fetch('/api/auth/login',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({login:document.getElementById('login').value.trim(),password:password.value,loginMode:'admin'})});
   password.value='';
   if(!response.headers.get('content-type')?.includes('application/json'))throw Error('Chưa nhận được phản hồi đăng nhập. Vui lòng thử lại.');
   const result=await response.json();if(!response.ok)throw Error(result.error||'Không đăng nhập được.');
   if(!result.user?.isAdmin)throw Error('Tài khoản này không có quyền Admin. Đăng nhập bằng tài khoản Admin ONSPA.');
   window.location.replace('/_admin/quantity-activation');
  }catch(error){password.value='';status.textContent=error.message||'Không đăng nhập được.';}
  finally{busy=false;button.disabled=false;}
 });
}
