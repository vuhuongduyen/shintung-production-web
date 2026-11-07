// The internal account login is the ID; hosted actor.login may instead be its email.
export const productionActorId=actor=>String(actor?.userId||actor?.permissionLogin||actor?.login||'');
// Verified against DATA SANXUAT's user directory and the web's account directory.
// Display aliases only: never used for authentication or permission evaluation.
const sourceUserAliases={
 'linea.shintungvn@gmail.com':'LINE_A',
 'khaosat.shintung@gmail.com':'LINE_B',
 'ngocphuong020479@gmail.com':'cnphuong',
 'phung8681bt@gmail.com':'ntnphung',
 'huongduyenxy@gmail.com':'vthduyen',
};
export function productionEntryActorId(entry,accounts=[]) {
 const explicit=entry.actorId||entry.reportedById||entry.byId;
 const value=entry.sourceVerified&&entry.sourceActor?entry.sourceActor:explicit||entry.actor?.login||entry.actor||entry.reportedBy||entry.operator||entry.by||entry.createdBy||entry.updatedBy||'';
 if(!value||value==='Bộ ví dụ LSX')return '';
 const alias=sourceUserAliases[String(value).trim().toLowerCase()];
 const user=accounts.find(u=>[u.id,u.login,u.email].some(v=>v&&String(v).toLowerCase()===String(value).trim().toLowerCase()))||accounts.find(u=>alias&&[u.id,u.login].some(v=>v&&String(v).toLowerCase()===alias.toLowerCase()));
 return String(user?.login||user?.id||alias||value);
}

// Confirmation attribution must never fall back to the reporter or last editor.
export function productionConfirmationActorId(entry) {
 if(entry?.reviewStatus!=='Đã xác nhận')return '';
 const value=entry.reviewedById||entry.reviewedBy||entry.confirmationBasis?.by||'';
 return value?productionEntryActorId({actorId:value}):'';
}

// Review outcome is separate from the reporting actor. Rejection is never confirmation.
export function productionReviewResult(entry) {
 const approved=entry?.reviewStatus==='Đã xác nhận',rejected=entry?.reviewStatus==='Cần điều chỉnh';
 const value=approved||rejected?entry.reviewedById||entry.reviewedBy||(approved?entry.confirmationBasis?.by:'')||'':'';
 return {result:approved?'Xác nhận':rejected?'Từ chối':'Chưa xử lý',label:approved?'Người xác nhận':rejected?'Người từ chối':'Người xử lý',timeLabel:approved?'Lúc xác nhận':rejected?'Lúc từ chối':'Lúc xử lý',actorId:value?productionEntryActorId({actorId:value}):'',at:approved||rejected?entry.reviewedAt||(approved?entry.confirmationBasis?.at:'')||'':''};
}
