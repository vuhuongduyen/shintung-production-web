const denialFallback='Không có quyền truy cập Điều phối nhân sự. Vui lòng kiểm tra tài khoản và quyền truy cập.';
const scopeSetup='Admin thiết lập tại Capacity tuần → Lịch làm việc dự kiến → Điều phối nhân sự → Thiết lập QLSX.';
export async function allocationDenialMessage(response){
 let message='';
 try{
  const text=(await response.text()).trim();
  try{const result=JSON.parse(text);if(result&&typeof result==='object'&&'error' in result&&typeof result.error==='string')message=result.error.trim();}
  catch{if(text&&!/[<>{}]/.test(text)&&!response.headers.get('content-type')?.includes('json'))message=text;}
 }catch{/* A missing/unreadable body must not invent a missing-scope diagnosis. */}
 message=message.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,500);
 if(!message)return denialFallback;
 const missingScope=/chưa.{0,45}(?:cấu hình|thiết lập|cấp|gán).{0,20}phạm vi QLSX/i.test(message);
 return missingScope?`${message} ${scopeSetup}`:message;
}
