const fail=message=>{throw Object.assign(Error(message),{status:422});};
// Called only after the server has resolved the immutable receipt policy.
// A legacy completion is one quantity receipt, never a sum of stage outputs.
export function quantityCompletion(body){
 const entries=body.stageEntries||[];
 if(!Array.isArray(entries))fail('Danh sách công đoạn không hợp lệ.');
 const values=entries.filter(e=>Number(e.quantity)>0);
 if(values.length>1)fail('Gửi một sản lượng thành phẩm cho mỗi lần báo; không cộng các công đoạn.');
 const quantity=body.quantity??body.backfill?.quantity??values[0]?.quantity;
 if(values.length&&body.quantity!==undefined&&body.quantity!==values[0].quantity)fail('Sản lượng gửi không khớp; kiểm tra lại một số lượng phát sinh.');
 if(!Number.isSafeInteger(quantity)||quantity<=0)fail('Nhập số thành phẩm phát sinh để báo sản lượng.');
 const instant=Date.parse(body.backfill?.to||body.effectiveAt||'');
 let local=body.productionLocalDateTime;
 if(!local){if(!Number.isFinite(instant))fail('Thiếu ngày giờ sản xuất hợp lệ (GMT+7).');local=new Date(instant+25200000).toISOString().slice(0,16);}
 return {action:'daily-output',orderId:body.orderId,quantity,productionDate:local.slice(0,10),productionLocalDateTime:local,
  requestIdempotency:body.requestIdempotency,...(body.expectedOrderRevision!==undefined?{expectedOrderRevision:body.expectedOrderRevision}:{})};
}
