// Bound headers and body together, including transports that ignore abort.
export async function productionBoundedRead(fetcher,url,init={},timeoutMs=15000){
 const controller=new AbortController();let timer;
 try{return await Promise.race([
  Promise.resolve().then(async()=>{
   const response=await fetcher(url,{...init,signal:controller.signal});
   const body=await response.json().catch(()=>{throw Object.assign(Error('Không đọc được dữ liệu sản xuất. Vui lòng thử lại.'),{status:response.status});});
   if(!response.ok)throw Object.assign(Error(body?.error||'Không tải được dữ liệu sản xuất.'),{status:response.status});
   return body;
  }),
  new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('Chưa cập nhật được dữ liệu mới vì máy chủ phản hồi quá lâu. Vui lòng thử lại.'));},timeoutMs);}),
 ]);}finally{clearTimeout(timer);}
}
