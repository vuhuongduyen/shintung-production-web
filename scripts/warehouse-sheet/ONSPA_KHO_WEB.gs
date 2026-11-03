/** Add this NEW file to warehouse Apps Script. Do not paste the old SX push file here. */
const ONSPA_REAL_SHEET = '1y5J-G5IoIzEgXsf_2hpqrXOTgvL0RJp5lBjR9bbapk4';
function ONSPA_caiDatKetNoi() {
 const ui=SpreadsheetApp.getUi(),ss=SpreadsheetApp.getActive();
 const url=ui.prompt('Kết nối ONSPA','Dán địa chỉ web (https://...)',ui.ButtonSet.OK_CANCEL);if(url.getSelectedButton()!==ui.Button.OK)return;
 const base=url.getResponseText().trim().replace(/\/$/,'');
 if(!/^https:\/\/(sanxuat|onspa-thu-nghiem-21102026)\.shintung-vn-4458\.chatgpt\.site$/.test(base))throw Error('Địa chỉ web không đúng.');
 if(ss.getId()===ONSPA_REAL_SHEET&&base!=='https://sanxuat.shintung-vn-4458.chatgpt.site')throw Error('Không nối web thử vào kho thật.');
 const token=ui.prompt('Khóa kết nối','Dán khóa từ nút Kết nối Google Sheet trên web',ui.ButtonSet.OK_CANCEL);if(token.getSelectedButton()!==ui.Button.OK)return;
 PropertiesService.getScriptProperties().setProperties({ONSPA_URL:base,ONSPA_TOKEN:token.getResponseText().trim(),ONSPA_SHEET:ss.getId()});
 ONSPA_khoiPhucKetNoi();
}
// Reuse the URL/key already saved by setup; no need to create another key.
function ONSPA_khoiPhucKetNoi(){
 ONSPA_api_({action:'ping'}); // authentication check only; no receipt mutations
 ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='ONSPA_dongBoTuDong').forEach(t=>ScriptApp.deleteTrigger(t));
 ScriptApp.newTrigger('ONSPA_dongBoTuDong').timeBased().everyMinutes(1).create();
 SpreadsheetApp.getUi().alert('Đã cài kết nối. Tự đồng bộ mỗi phút. Kho vẫn dùng menu xác nhận như trước.');
}
function ONSPA_api_(body){
 const p=PropertiesService.getScriptProperties().getProperties();if(!p.ONSPA_URL||!p.ONSPA_TOKEN)throw Error('Chưa cài kết nối: chạy ONSPA_caiDatKetNoi.');
 const response=UrlFetchApp.fetch(p.ONSPA_URL+'/api/warehouse-sheet/bridge',{method:'post',contentType:'application/json',payload:JSON.stringify(Object.assign({},body,{spreadsheetId:p.ONSPA_SHEET,bridgeToken:p.ONSPA_TOKEN})),muteHttpExceptions:true});
 let data;try{data=JSON.parse(response.getContentText());}catch(e){throw Error('Web chưa trả dữ liệu hợp lệ. Kiểm tra kết nối.');}
 if(response.getResponseCode()!==200)throw Error((data.code?'['+data.code+'] ':'')+(data.error||'Lỗi kết nối '+response.getResponseCode()));return data;
}
function ONSPA_dongBoTuDong(){
 const lock=LockService.getDocumentLock();if(!lock.tryLock(1000))return;
 try{
 const p=PropertiesService.getScriptProperties().getProperties(),sh=SpreadsheetApp.openById(p.ONSPA_SHEET).getSheetByName('NHAP');if(!sh)throw Error('Không có tab NHAP.');
 const receipts=ONSPA_api_({action:'pull'}).receipts||[];
 for(const r of receipts){
 try{
 const n=sh.getLastRow(),values=n>1?sh.getRange(2,1,n-1,21).getValues():[],matches=[];
 values.forEach((v,i)=>{if(String(v[9])===r.reportId)matches.push(i+2);});
 if(matches.length>1)throw Error('ID báo công trùng nhiều dòng. Cần đối chiếu, không tự ghi đè.');
 const raw=String(r.sourceCompletedAt||'');const date=new Date(/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?$/.test(raw)?raw+'+07:00':raw);if(!Number.isFinite(date.getTime()))throw Error('Thiếu ngày xuất trạm hợp lệ.');
 let row=matches[0];
 if(row){const v=sh.getRange(row,1,1,21).getValues()[0];if(String(v[2])!==r.sku||String(v[8])!==r.lsxCode||v[7]!=='ONSPA_WEB')throw Error('ID đã có nhưng dữ liệu hoặc nguồn khác. Cần đối chiếu phiếu cũ trước khi liên kết.');
 if(Number(v[4])!==Number(r.proposedQuantity)){
  if(!r.sheetSync?.correctionRevision||v[12]!=='CHỜ KHO XÁC NHẬN'||v[13]!==''||v[17]!==''||v[18]!=='')throw Error('Phiếu kho đã có dữ liệu nhận hàng hoặc chưa có điều chỉnh hợp lệ; không tự ghi đè.');
  sh.getRange(row,5).setValue(r.proposedQuantity);
 }
}
 else{
 row=Math.max(2,sh.getLastRow()+1);if(row>sh.getMaxRows())sh.insertRowsAfter(sh.getMaxRows(),1);
 sh.getRange(row,1,1,21).setValues([[date,'',ONSPA_text_(r.sku),ONSPA_text_(r.name),r.proposedQuantity,ONSPA_text_(r.spec),'','ONSPA_WEB',ONSPA_text_(r.lsxCode),ONSPA_text_(r.reportId),ONSPA_text_(r.planId),ONSPA_text_(r.line),'CHỜ KHO XÁC NHẬN','','','',new Date(),'','','CHƯA ĐỒNG BỘ WEB','']]);
 sh.getRange(row,1).setNumberFormat('dd/MM/yyyy');sh.getRange(row,17,1,2).setNumberFormat('dd/MM/yyyy HH:mm:ss');
 }
 sh.getRange(row,1).setValue(date).setNumberFormat('dd/MM/yyyy');
 SpreadsheetApp.flush();ONSPA_api_({action:'ack',receiptId:r.id,reportId:r.reportId,sku:r.sku,sourceCompletedAt:r.sourceCompletedAt,proposedQuantity:r.proposedQuantity,correctionRevision:r.sheetSync?.correctionRevision||null});
 }catch(e){ONSPA_api_({action:'error',receiptId:r.id,reportId:r.reportId,sku:r.sku,error:String(e.message||e)});}
 }
 const n=sh.getLastRow();if(n>1){const rows=sh.getRange(2,1,n-1,21).getValues();let count=0;rows.forEach((v,i)=>{if(count<50&&v[7]==='ONSPA_WEB'&&['KHO ĐÃ XÁC NHẬN','CÓ CHÊNH LỆCH'].includes(v[12])&&v[19]!=='ĐÃ ĐỒNG BỘ WEB'){count++;ONSPA_guiXacNhan_(sh,i+2);}});}
 }finally{lock.releaseLock();}
}
function ONSPA_text_(v){const s=String(v||'');return /^[=+@-]/.test(s)?"'"+s:s;}
function ONSPA_guiXacNhan_(sh,row){
 const v=sh.getRange(row,1,1,21).getValues()[0];if(v[7]!=='ONSPA_WEB')return false;
 try{
 if(!(v[17] instanceof Date)||!Number.isFinite(v[17].getTime()))throw Error('Thiếu thời gian kho xác nhận.');
 ONSPA_api_({action:'confirm',receiptId:'SX:'+String(v[9]),reportId:String(v[9]),sku:String(v[2]),proposedQuantity:Number(v[4]),receivedQuantity:Number(v[13]),differenceReason:String(v[15]||''),confirmedAt:v[17].toISOString(),confirmedBy:String(v[18]||'')});
 sh.getRange(row,20,1,2).setValues([['ĐÃ ĐỒNG BỘ WEB','']]);return true;
 }catch(e){sh.getRange(row,20,1,2).setValues([['LỖI ĐỒNG BỘ WEB',ONSPA_text_(e.message||e)]]);return false;}
}
