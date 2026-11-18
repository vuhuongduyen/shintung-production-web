// Never retry a write here. The caller retains the original idempotency key
// and draft until a valid server acknowledgement has been received.
export async function postProductionCommand(body,fetcher){
 let response,result;
 try{response=await fetcher('/api/production-workflow',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});}
 catch(error){if(error?.name==='ClientSessionReadCancelled')throw error;throw Object.assign(new Error('Chưa xác nhận được kết quả lưu. Giữ dữ liệu đang nhập; kiểm tra bản ghi đã lưu rồi thử lại bằng thao tác hiện tại.'),{uncertain:true,cause:error});}
 try{result=await response.json();}catch(error){if(error?.name==='ClientSessionReadCancelled')throw error;throw Object.assign(new Error('Máy chủ chưa trả phản hồi lưu hợp lệ. Chưa xác nhận đã lưu; dữ liệu đang nhập vẫn được giữ. Kiểm tra bản ghi trước khi thử lại.'),{uncertain:true,status:response.status});}
 if(!response.ok)throw Object.assign(new Error(result?.error||'Không lưu được thao tác.'),{status:response.status,uncertain:response.status>=500});
 if(!result||typeof result!=='object'||Array.isArray(result))throw Object.assign(new Error('Chưa xác nhận được kết quả lưu hợp lệ. Giữ dữ liệu đang nhập và kiểm tra bản ghi trước khi thử lại.'),{uncertain:true});
 return result;
}
