const phases={
 'daily-output-withdrawal-request':{status:'pending',label:'Chờ Kho xử lý thu hồi',priority:1},
 'daily-output-withdrawal-completed':{status:'completed',label:'Đã thu hồi',priority:3},
};
// Derive display from the already-authorized journal; no extra per-report fetch.
// Keep request/decision history immutable and never infer stock reversal from approval.
export function dailyWithdrawalViews(events){
 const views=new Map();
 for(const event of events){
  let phase=phases[event.kind];
  if(event.kind==='daily-output-withdrawal-decision')phase=event.after?.status==='approved-awaiting-sheet'?{status:'approved-awaiting-sheet',label:'Kho đồng ý, chờ đối soát Sheet',priority:2}:event.after?.status==='rejected'?{status:'rejected',label:'Kho từ chối thu hồi',priority:2}:null;
  const at=Date.parse(event.recordedAt);
  if(!phase||!event.reportId||!event.withdrawalId||!Number.isFinite(at))continue;
  const old=views.get(event.reportId);
  if(old&&(old.at>at||old.at===at&&(old.id!==event.withdrawalId||old.priority>=phase.priority)))continue;
  views.set(event.reportId,{...phase,id:event.withdrawalId,at,actor:event.actor});
 }
 return views;
}
