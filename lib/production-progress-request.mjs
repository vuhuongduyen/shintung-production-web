// Bound both headers and body reads. Even a transport that ignores abort must
// release its cache promise; a late response cannot replace a newer retry.
export async function readProgressResponse(fetcher,init={},timeoutMs=25000,scope='active'){
 const controller=new AbortController();let timer;
 const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{
  reject(new Error('Tải Tiến độ sản xuất quá lâu. Dữ liệu đã tải vẫn được giữ; bấm Thử lại để cập nhật.'));
  controller.abort();
 },timeoutMs);});
 try{return await Promise.race([Promise.resolve().then(async()=>{
  const response=await fetcher('/api/production-workflow?view=progress'+(scope==='all'?'&scope=all':''),{...init,signal:controller.signal});
  let body;try{body=await response.json();}catch{throw Object.assign(new Error('Không đọc được phản hồi Tiến độ sản xuất. Vui lòng thử lại.'),{status:response.status});}
  if(!response.ok)throw Object.assign(new Error(body?.error||'Không tải được Tiến độ sản xuất.'),{status:response.status});
  return body;
 }),timeout]);}finally{clearTimeout(timer);}
}
