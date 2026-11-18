/** Never retry an attendance write: a timeout can occur after server commit. */
export async function hrImportRequest(body,{fetcher=fetch,timeoutMs=45000}={}){
 const controller=new AbortController();let timer;
 const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{reject(Error('Chưa xác nhận được kết quả vì máy chủ phản hồi quá lâu. Không tự tải lại file. Mở Hủy lần nhập hoặc tra cứu chấm công để đối chiếu trước khi thử lại.'));controller.abort();},timeoutMs);});
 try{return await Promise.race([timeout,(async()=>{
  let response;try{response=await fetcher('/api/production-workflow',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:controller.signal});}catch{throw Error('Mất kết nối; chưa xác nhận được kết quả. Kiểm tra Hủy lần nhập hoặc tra cứu chấm công trước khi tải lại file.');}
  let result;try{result=await response.json();}catch{throw Error('Máy chủ trả kết quả không hợp lệ; chưa xác nhận lưu. Kiểm tra Hủy lần nhập hoặc tra cứu chấm công trước khi tải lại file.');}
  if(!response.ok)throw Error(result.error||'Không thực hiện được thao tác. Kiểm tra kết quả trước khi thử lại.');
  return result;
 })()]);}finally{clearTimeout(timer);}
}
