// Read-only projection: drafts never replace the most recent Planning approval.
export function acceptedCapacity(row){
 if(row.status==='Đã xác nhận'&&row.reviewStatus==='approved'&&row.khsxAcceptedAt)return row;
 const approval=(row.history||[]).slice().reverse().find(h=>h.action==='review'&&h.decision==='approve'&&h.request?.kind==='capacity'&&h.after);
 if(!approval)return row;
 return {...row,input:approval.after,availableHours:approval.newHours??approval.result?.availableHours,version:approval.version,status:'Đã xác nhận',reviewStatus:'approved',syncedAt:approval.request.at,khsxAcceptedAt:approval.at,retainedApproval:true};
}
