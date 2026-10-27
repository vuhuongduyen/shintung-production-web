// Save and close must use the same explicit capacity acknowledgement flow.
export async function requestPlanWithCapacityConfirmation({send,body,decide,isCurrent=()=>true}) {
 let dailyCapacityAck;
 for(;;){
  const response=await send({...body,dailyCapacityAck});
  const result=await response.json();
  if(result.error!=='dailyCapacityConfirmation')return {response,result,cancelled:false};
  let warning;
  try{warning=JSON.parse(result.details?.find(d=>d.id==='dailyCapacity')?.reason||'null');}catch{}
  if(!warning?.token||!Array.isArray(warning.warnings))throw Error('Không đọc được cảnh báo giờ khả dụng. Tải lại kế hoạch rồi thử lại.');
  warning.notChecked=Array.isArray(warning.notChecked)?warning.notChecked:[];
  if(!isCurrent()||!await decide(warning)||!isCurrent())return {response,result,cancelled:true};
  dailyCapacityAck=warning.token;
 }
}
