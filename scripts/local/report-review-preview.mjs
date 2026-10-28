// Opt-in TEST-server provider. No database handle, filesystem writes, or network calls.
import {order as fixtureOrder,reports as fixtureReports,employees} from '../../tests/fixtures/report-review-data.mjs';
import {reviewEligibility,reviewSnapshot} from '../../lib/production-review-selection.mjs';
export function reviewPreviewEnabled(config,env=process.env){return config?.environment==='TEST'&&config.remote===false&&env.NODE_ENV!=='production'&&env.ONSPA_TEST_REVIEW_PREVIEW==='1';}
export function reviewPreviewHost(config,env=process.env){
 if(!reviewPreviewEnabled(config,env)||env.CODESPACES!=='true'||!/^[-a-z0-9]+$/.test(env.CODESPACE_NAME||'')||env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN!=='app.github.dev')return null;
 return `${env.CODESPACE_NAME}-5173.app.github.dev`;
}
export function createReportReviewPreview(config,env=process.env){
 if(!reviewPreviewEnabled(config,env))return null;
 const sessions=new WeakMap();
 return {handle({path,method,body,session}){
  if(!session)return {status:401,data:{error:'Đăng nhập bằng tài khoản TEST hiện có để xem dữ liệu mô phỏng.'}};
  if(!sessions.has(session))sessions.set(session,{order:{...fixtureOrder,week:'2026-10-26',planId:'TEST-PLAN',spec:'1/2 inch 40cm',planQty:200,planStart:'2026-10-26',lsxOpenedAt:'2026-10-24',inTransitQty:200,completedQty:0,status:'ĐÃ MỞ LSX'},reports:structuredClone(fixtureReports)});
  const state=sessions.get(session),reply=(status,data)=>({status,data});
  if(method==='GET'&&path==='/api/production-workflow')return reply(200,{previewNotice:'TEST mô phỏng trong giao diện ONSPA thật. Chỉ dữ liệu tổng hợp; xác nhận không ghi DB, KHSX hoặc Kho. Khởi động lại máy chủ để đặt lại.',orders:[state.order],progressOrders:[state.order],reports:state.reports,events:[],employees,payrollEmployees:employees,actualSchedules:[],approvedSchedules:[],rights:{confirm:true,manager:false,work:false,correct:false,hr:false,stageLive:false,line:null}});
  if(method==='GET'&&path==='/api/records')return reply(200,{records:[]});
  if(method==='GET'&&path==='/api/pending-approvals')return reply(200,{groups:[],count:0});
  if(method==='GET'&&path==='/api/storage-capability')return reply(200,{allowed:false});
  if(method==='POST'&&path==='/api/production-report'){
   const report=state.reports.find(r=>r.id===body?.reportId);
   if(body?.action!=='review'||body.approve!==true||!report)return reply(400,{error:'Chỉ xác nhận phiếu mô phỏng đã chọn.'});
   if(body.expectedVersion!==report.version||body.expectedReview!==reviewSnapshot(state.order,report))return reply(409,{error:'Phiếu mô phỏng đã thay đổi; tải lại và kiểm tra.'});
   const blocker=reviewEligibility(state.order,report,body.delayReason);if(blocker)return reply(409,{error:blocker});
   const now=new Date().toISOString();Object.assign(report,{version:report.version+1,reviewStatus:'Đã xác nhận',approvedQuantity:report.reportedQuantity,reviewedBy:session.login,reviewedById:session.login,reviewedAt:now,delayReason:body.delayReason||'',warehouseStatus:'Mô phỏng TEST · không tạo phiếu kho'});
   state.order.completedQty=state.reports.filter(r=>r.reviewStatus==='Đã xác nhận').reduce((sum,r)=>sum+r.reportedQuantity,0);state.order.inTransitQty=Math.max(0,state.order.lsxQty-state.order.completedQty);
   return reply(200,{ok:true,payload:report,synthetic:true,persistentWrites:false,warehouseOperations:false});
  }
  return reply(method==='GET'?404:403,{error:'Chế độ xem thử báo công chỉ dùng dữ liệu tổng hợp. API và ghi dữ liệu khác bị khóa.'});
 }};
}
