const accounts={sample_user_23:['KHSX'],sample_user_25:['KHSX'],sample_user_22:['QLSX'],sample_user_24:['QLSX'],sample_user_31:['QLSX'],sample_user_19:['Kho LK'],sample_user_18:['Kho BB'],sample_user_32:['Kho UT'],sample_user_21:['Kho LK','Kho BB','Kho UT']};
export const requestDepartments=login=>accounts[String(login||'').toLowerCase()]||[];
export const requestDepartment=login=>requestDepartments(login)[0]||null;
export const requestWorkspace=login=>requestDepartment(login)==='KHSX'?'planning':requestDepartment(login)==='QLSX'?'production':'warehouse';
export const requestPending=r=>(Array.isArray(r.pendingDepartments)?r.pendingDepartments:r.pending?[r.pending]:[]).filter(d=>r.kind==='production-incident'||d!==r.department);
export const requestRecipients=r=>Array.isArray(r.recipients)?r.recipients:r.department==='KHSX'?['QLSX']:['KHSX'];
export const canViewRequest=(r,login)=>r.kind==='production-incident'?(requestDepartments(login).includes('QLSX')||r.incident?.confirmedAt&&requestDepartments(login).includes('KHSX')):r.kind==='staff-recall'?['KHSX','QLSX'].some(d=>requestDepartments(login).includes(d)):r.messages.length>0?[r.department,...requestRecipients(r)].some(d=>requestDepartments(login).includes(d)):r.owner===login;
export const canReplyDepartments=(r,login)=>r.kind==='staff-recall'?[]:requestPending(r).filter(d=>requestDepartments(login).includes(d));
export const sendRecipients=(department,origin=department)=>department==='KHSX'?(origin==='KHSX'?['QLSX','Kho LK','Kho BB','Kho UT']:['QLSX']):['KHSX'];

export const requestStatus=r=>r.kind==='production-incident'?({awaiting_qlsx:'Chờ QLSX xác nhận',awaiting_khsx:'Chờ KHSX phản hồi',handling:'Đang xử lý',resolved:'Đã xử lý'}[r.incident?.status]||'Phiếu báo sự cố'):r.kind==='staff-recall'?(r.recall.status==='approved'?'Đã đồng ý · Có hiệu lực':'Chờ '+requestPending(r).join(', ')+' đồng ý'):!r.messages.length?'Bản nháp':requestPending(r).length?'Chờ '+requestPending(r).join(', ')+' phản hồi':'Đã phản hồi đầy đủ';
