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
 if(response.getResponseCode()!==200){const error=Error((data.code?'['+data.code+'] ':'')+(data.error||'Lỗi kết nối '+response.getResponseCode()));error.status=response.getResponseCode();throw error;}return data;
}
function ONSPA_dongBoTuDong(){
 const lock=LockService.getDocumentLock();if(!lock.tryLock(1000))return;
 try{
 const p=PropertiesService.getScriptProperties().getProperties(),sh=SpreadsheetApp.openById(p.ONSPA_SHEET).getSheetByName('NHAP');if(!sh)throw Error('Không có tab NHAP.');
 const receipts=ONSPA_api_({action:'pull'}).receipts||[];
 let indexedLastRow=-1,reportRows=new Map();
 function refreshReportRows(){const last=sh.getLastRow();if(last===indexedLastRow)return;reportRows=new Map();if(last>1)sh.getRange(2,10,last-1,1).getValues().forEach((v,i)=>{const id=String(v[0]);if(!reportRows.has(id))reportRows.set(id,[]);reportRows.get(id).push(i+2);});indexedLastRow=last;}
 for(const r of receipts){
 try{
 refreshReportRows();const matches=reportRows.get(String(r.reportId))||[];
 const fresh=indexedLastRow>1?sh.getRange(2,10,indexedLastRow-1,1).createTextFinder(String(r.reportId)).matchEntireCell(true).matchCase(true).useRegularExpression(false).findAll().map(cell=>cell.getRow()):[];
 if(fresh.length!==matches.length||fresh.some((row,i)=>row!==matches[i]))throw Error('ID hoặc vị trí phiếu vừa thay đổi trong Sheet. Cần tải lại và đối chiếu, không tự ghi đè.');
 if(matches.length>1)throw Error('ID báo công trùng nhiều dòng. Cần đối chiếu, không tự ghi đè.');
 if(r.sheetSync?.command){if(['daily-pending-edit','daily-pending-cancel'].includes(r.sheetSync.command.kind))ONSPA_xuLyDieuChinhChoNhan_(sh,r,matches[0]);else ONSPA_xuLyThuHoi_(sh,r,matches[0]);continue;}
 const raw=String(r.sourceCompletedAt||'');const date=new Date(/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?$/.test(raw)?raw+'+07:00':raw);if(!Number.isFinite(date.getTime()))throw Error('Thiếu ngày xuất trạm hợp lệ.');
 let row=matches[0];
 if(row){const v=sh.getRange(row,1,1,21).getValues()[0];if(String(v[9])!==String(r.reportId)||String(v[2])!==r.sku||String(v[8])!==r.lsxCode||v[7]!=='ONSPA_WEB')throw Error('ID đã có nhưng dữ liệu hoặc nguồn khác. Cần đối chiếu phiếu cũ trước khi liên kết.');
 if(Number(v[4])!==Number(r.proposedQuantity)){
  if(!r.sheetSync?.correctionRevision||v[12]!=='CHỜ KHO XÁC NHẬN'||v[13]!==''||v[17]!==''||v[18]!=='')throw Error('Phiếu kho đã có dữ liệu nhận hàng hoặc chưa có điều chỉnh hợp lệ; không tự ghi đè.');
  sh.getRange(row,5).setValue(r.proposedQuantity);
 }
}
 else{
 row=Math.max(2,sh.getLastRow()+1);if(row>sh.getMaxRows())sh.insertRowsAfter(sh.getMaxRows(),1);
 sh.getRange(row,1,1,21).setValues([[date,'',ONSPA_text_(r.sku),ONSPA_text_(r.name),r.proposedQuantity,ONSPA_text_(r.spec),'','ONSPA_WEB',ONSPA_text_(r.lsxCode),ONSPA_text_(r.reportId),ONSPA_text_(r.planId),ONSPA_text_(r.line),'CHỜ KHO XÁC NHẬN','','','',new Date(),'','','CHƯA ĐỒNG BỘ WEB','']]);
 reportRows.set(String(r.reportId),[row]);indexedLastRow=sh.getLastRow();
 sh.getRange(row,1).setNumberFormat('dd/MM/yyyy');sh.getRange(row,17,1,2).setNumberFormat('dd/MM/yyyy HH:mm:ss');
 }
 sh.getRange(row,1).setValue(date).setNumberFormat('dd/MM/yyyy');
 SpreadsheetApp.flush();ONSPA_api_({action:'ack',receiptId:r.id,reportId:r.reportId,sku:r.sku,sourceCompletedAt:r.sourceCompletedAt,proposedQuantity:r.proposedQuantity,correctionRevision:r.sheetSync?.correctionRevision||null});
 }catch(e){const found=reportRows.get(String(r.reportId))||[];if(r.sheetSync?.command&&found.length===1&&String(sh.getRange(found[0],10).getValue())===String(r.reportId))sh.getRange(found[0],20,1,2).setValues([[String(r.sheetSync.command.kind).startsWith('daily-pending-')?'LỖI ĐỐI SOÁT ĐIỀU CHỈNH':'LỖI THU HỒI',ONSPA_text_(e.message||e)]]);ONSPA_api_({action:'error',receiptId:r.id,reportId:r.reportId,sku:r.sku,error:String(e.message||e)});}
 }
 const n=sh.getLastRow();if(n>1){const rows=sh.getRange(2,1,n-1,21).getValues();let count=0;rows.forEach((v,i)=>{const change=['LỖI ĐỐI SOÁT ĐIỀU CHỈNH','CHỜ ĐỐI SOÁT ĐIỀU CHỈNH'].includes(v[19])?ONSPA_docDieuChinhChoNhan_(sh,i+2):null;if(count<50&&change&&['applied','acknowledged'].includes(change.phase)&&v[19]!=='ĐÃ ĐỒNG BỘ WEB'){count++;try{ONSPA_guiDieuChinhChoNhan_(sh,i+2,change);}catch(e){/* Keep original command and row for reconciliation. */}}else if(count<50&&v[7]==='ONSPA_WEB'&&['KHO ĐÃ XÁC NHẬN','CÓ CHÊNH LỆCH'].includes(v[12])&&v[19]!=='ĐÃ ĐỒNG BỘ WEB'){count++;try{ONSPA_guiXacNhan_(sh,i+2);}catch(e){/* Ambiguous/moved IDs are not stamped or acknowledged; continue other rows. */}}else if(count<50&&v[7]==='ONSPA_WEB'&&v[12]==='ĐÃ HỦY THEO YÊU CẦU SX'&&v[19]!=='ĐÃ ĐỒNG BỘ WEB'){count++;try{ONSPA_guiXacNhanThuHoi_(sh,i+2);}catch(e){/* Helper records an error only on the same verified original row. */}}});}
 }finally{lock.releaseLock();}
}
function ONSPA_text_(v){const s=String(v||'');return /^[=+@-]/.test(s)?"'"+s:s;}
function ONSPA_kiemTraDongDuyNhat_(sh,row,reportId){
 const id=String(reportId||''),last=sh.getLastRow();if(!id||last<2)throw Error('Thiếu ID báo công để đối chiếu dòng gốc.');
 const found=sh.getRange(2,10,last-1,1).createTextFinder(id).matchEntireCell(true).matchCase(true).useRegularExpression(false).findAll();
 if(found.length!==1||found[0].getRow()!==row||String(sh.getRange(row,10).getValue())!==id)throw Error('ID báo công bị trùng hoặc dòng đã di chuyển; cần dòng gốc duy nhất trước khi gửi lại.');
}
function ONSPA_guiXacNhan_(sh,row){
 const v=sh.getRange(row,1,1,21).getValues()[0];if(v[7]!=='ONSPA_WEB')return false;ONSPA_kiemTraDongDuyNhat_(sh,row,v[9]);
 try{
 if(!(v[17] instanceof Date)||!Number.isFinite(v[17].getTime()))throw Error('Thiếu thời gian kho xác nhận.');
 ONSPA_api_({action:'confirm',receiptId:'SX:'+String(v[9]),reportId:String(v[9]),sku:String(v[2]),proposedQuantity:Number(v[4]),receivedQuantity:Number(v[13]),differenceReason:String(v[15]||''),confirmedAt:v[17].toISOString(),confirmedBy:String(v[18]||'')});
 sh.getRange(row,20,1,2).setValues([['ĐÃ ĐỒNG BỘ WEB','']]);return true;
 }catch(e){sh.getRange(row,20,1,2).setValues([['LỖI ĐỒNG BỘ WEB',ONSPA_text_(e.message||e)]]);return false;}
}

// Withdrawal commands never erase quantities, original receipt stamps or rows.
function ONSPA_kiemTraTonThuHoi_(sh,sku){
 if(typeof ONSPA_congThucTonVoHieu_!=='function')throw Error('Thiếu file ONSPA_STOCK_FORMULAS.gs; chưa được tự thu hồi.');
 const stock=sh.getParent().getSheetByName('TỒN KHO');if(!stock||stock.getLastRow()<3)throw Error('Không có dòng tồn kho để kiểm chứng loại lượng.');
 const found=stock.getRange(3,1,stock.getLastRow()-2,1).createTextFinder(String(sku)).matchEntireCell(true).matchCase(true).useRegularExpression(false).findAll();if(!found.length)throw Error('Không tìm thấy SKU trong TỒN KHO; chưa được xác nhận loại lượng.');
 let checked=0;for(const cell of found){const row=cell.getRow(),formulas=stock.getRange(row,1,1,stock.getLastColumn()).getFormulas()[0];for(const formula of formulas){if(!formula||!/NHAP/i.test(formula))continue;const result=ONSPA_congThucTonVoHieu_(formula);if(!result.supported||result.changed)throw Error('Công thức tồn của SKU chưa loại dòng hủy hoặc ngoài mẫu được kiểm. Chưa thu hồi lượng.');checked++;}}
 if(!checked)throw Error('Chưa có công thức nhập kho của SKU để kiểm chứng.');return checked;
}
function ONSPA_noteThuHoi_(cell,command,receiptId,created,reportId){
 const prefix='ONSPA_WITHDRAWAL:',note=cell.getNote()||'',lines=note.split('\n');let old=null;
 for(const line of lines)if(line.startsWith(prefix)){try{const value=JSON.parse(line.slice(prefix.length));if(value.commandId===command.id)old=value;}catch(e){/* Preserve unknown notes; never execute them. */}}
 const value={commandId:command.id,commandRevision:command.revision,receiptId,reportId,rowCreatedForHistory:!!created||!!old?.rowCreatedForHistory};
 if(!old||old.commandRevision!==value.commandRevision||old.reportId!==reportId||old.receiptId!==receiptId)cell.setNote(note+(note?'\n':'')+prefix+JSON.stringify(value));return value;
}
function ONSPA_guiXacNhanThuHoi_(sh,row){
 const v=sh.getRange(row,1,1,26).getValues()[0],prefix='ONSPA_WITHDRAWAL:';let marker=null;
 for(const line of (sh.getRange(row,23).getNote()||'').split('\n'))if(line.startsWith(prefix)){try{marker=JSON.parse(line.slice(prefix.length));}catch(e){}}
 ONSPA_kiemTraDongDuyNhat_(sh,row,v[9]);
 if(v[7]!=='ONSPA_WEB'||v[12]!=='ĐÃ HỦY THEO YÊU CẦU SX'||v[21]!=='KHO ĐỒNG Ý HỦY'||!marker||marker.reportId!==String(v[9])||marker.commandId!==String(v[22])||!(v[23] instanceof Date)||!Number.isFinite(v[23].getTime())||!v[24])throw Error('Chưa có đủ thông tin thu hồi trên dòng gốc.');
 try{ONSPA_kiemTraTonThuHoi_(sh,String(v[2]));
 const result=ONSPA_api_({action:'withdrawal-ack',receiptId:marker.receiptId,reportId:String(v[9]),sku:String(v[2]),commandId:marker.commandId,commandRevision:marker.commandRevision,sheetRow:row,stockExcluded:true,originalRowRetained:true,rowCreatedForHistory:marker.rowCreatedForHistory,originalProposedQuantity:Number(v[4]),originalReceivedQuantity:Number(v[13]),withdrawnAt:v[23].toISOString(),withdrawnBy:String(v[24])});
 sh.getRange(row,20,1,2).setValues([['ĐÃ ĐỒNG BỘ WEB','']]);return result;}catch(e){if(String(sh.getRange(row,10).getValue())===marker.reportId&&String(sh.getRange(row,23).getValue())===marker.commandId)sh.getRange(row,20,1,2).setValues([['LỖI THU HỒI',ONSPA_text_(e.message||e)]]);throw e;}
}
function ONSPA_xuLyThuHoi_(sh,r,row){
 const command=r.sheetSync.command,request=r.withdrawalRequest;
 if(!request||command.id!==request.id||!['withdrawal-request','withdrawal-approved','withdrawal-rejected'].includes(command.kind))throw Error('Lệnh thu hồi không khớp hoặc chưa hỗ trợ.');
 const phase=command.kind==='withdrawal-request'?'pending':command.kind==='withdrawal-approved'?'approved-awaiting-sheet':'rejected';if(request.status!==phase)throw Error('Phiên bản trạng thái thu hồi không khớp.');
 if(!r.confirmedBy||!Number.isFinite(Date.parse(r.confirmedAt))||r.receivedQuantity==null||!Number.isFinite(Number(r.receivedQuantity)))throw Error('Thiếu căn cứ Kho đã xác nhận; không tự dựng thông tin.');
 if(phase==='approved-awaiting-sheet'){if(!request.decidedBy||!Number.isFinite(Date.parse(request.decidedAt)))throw Error('Kho chưa ghi nhận người/thời điểm đồng ý.');ONSPA_kiemTraTonThuHoi_(sh,r.sku);}
 if(!row)throw Error('Không tìm thấy dòng gốc NHAP; chưa thu hồi. Cần đối chiếu trước, không tự tạo dòng thay thế.');
 const created=false;
 try{
 const v=sh.getRange(row,1,1,26).getValues()[0];if(sh.getRange(row,5).getFormula()||sh.getRange(row,14).getFormula())throw Error('Ô lượng gốc chứa công thức; cần đối chiếu riêng trước khi thu hồi.');if(v[7]!=='ONSPA_WEB'||String(v[9])!==String(r.reportId)||String(v[2])!==r.sku||String(v[8])!==r.lsxCode||Number(v[4])!==Number(r.proposedQuantity))throw Error('Dòng gốc khác ID/SKU/LSX/SL đã được duyệt.');
 // Reconcile only previously blank receipt facts from the verified Web receipt.
 // Never replace a nonempty confirmation made independently in the Sheet.
 if(!['KHO ĐÃ XÁC NHẬN','CÓ CHÊNH LỆCH','CHỜ KHO XÁC NHẬN','CHỜ XỬ LÝ YÊU CẦU HỦY','ĐÃ HỦY THEO YÊU CẦU SX'].includes(v[12]))throw Error('Trạng thái dòng kho ngoài quy trình đối chiếu.');
 if(v[13]!==''&&Number(v[13])!==Number(r.receivedQuantity)||v[17]!==''&&(!(v[17] instanceof Date)||v[17].getTime()!==Date.parse(r.confirmedAt))||v[18]!==''&&String(v[18])!==String(r.confirmedBy))throw Error('Kho Sheet đã có xác nhận khác Web; cần đối chiếu, không tự ghi đè.');
 if(v[12]==='ĐÃ HỦY THEO YÊU CẦU SX'&&(phase!=='approved-awaiting-sheet'||String(v[22])!==command.id||v[21]!=='KHO ĐỒNG Ý HỦY'))throw Error('Dòng đã vô hiệu theo yêu cầu khác; không tự khôi phục.');
 if(v[13]==='')sh.getRange(row,14).setValue(Number(r.receivedQuantity));if(v[17]==='')sh.getRange(row,18).setValue(new Date(r.confirmedAt));if(v[18]==='')sh.getRange(row,19).setValue(ONSPA_text_(r.confirmedBy));
 const marker=ONSPA_noteThuHoi_(sh.getRange(row,23),command,r.id,created,String(r.reportId));sh.getRange(row,23).setValue(command.id);sh.getRange(row,26).setValue(ONSPA_text_([request.reason,request.decisionReason].filter(Boolean).join(' · ')));
 if(phase==='approved-awaiting-sheet'){
  // Reuse first application time on retries. Keep E/N/R/S and all other rows intact.
  if(v[12]!=='ĐÃ HỦY THEO YÊU CẦU SX'){sh.getRange(row,24,1,2).setValues([[new Date(),ONSPA_text_(request.decidedBy)]]);sh.getRange(row,22).setValue('KHO ĐỒNG Ý HỦY');sh.getRange(row,13).setValue('ĐÃ HỦY THEO YÊU CẦU SX');}
  SpreadsheetApp.flush();return ONSPA_guiXacNhanThuHoi_(sh,row);
 }
 sh.getRange(row,13).setValue(phase==='pending'?'CHỜ XỬ LÝ YÊU CẦU HỦY':Number(r.receivedQuantity)===Number(r.proposedQuantity)?'KHO ĐÃ XÁC NHẬN':'CÓ CHÊNH LỆCH');sh.getRange(row,22).setValue(phase==='pending'?'CHỜ KHO XỬ LÝ':'KHO TỪ CHỐI HỦY');
 if(phase==='rejected')sh.getRange(row,24,1,2).setValues([[new Date(request.decidedAt),ONSPA_text_(request.decidedBy)]]);
 SpreadsheetApp.flush();const result=ONSPA_api_({action:'withdrawal-notice-ack',receiptId:r.id,reportId:r.reportId,sku:r.sku,commandId:command.id,commandRevision:command.revision,markedStatus:phase,sheetRow:row,noQuantityChange:true,originalRowRetained:true,rowCreatedForHistory:marker.rowCreatedForHistory,originalProposedQuantity:Number(r.proposedQuantity),originalReceivedQuantity:Number(r.receivedQuantity)});sh.getRange(row,20,1,2).setValues([[phase==='pending'?'CHỜ KHO XỬ LÝ THU HỒI':'ĐÃ ĐỒNG BỘ WEB','']]);return result;
 }catch(e){if(String(sh.getRange(row,10).getValue())===String(r.reportId)&&sh.getRange(row,8).getValue()==='ONSPA_WEB')sh.getRange(row,20,1,2).setValues([['LỖI THU HỒI',ONSPA_text_(e.message||e)]]);throw e;}
}

function ONSPA_quyetDinhThuHoiDongDangChon_(approve){
 const sh=SpreadsheetApp.getActiveSheet(),row=sh.getActiveRange()?.getRow(),ui=SpreadsheetApp.getUi(),email=Session.getActiveUser().getEmail();
 if(!email)throw Error('Đăng nhập tài khoản Google của Kho đang thao tác; không dùng tài khoản chủ file thay thế.');
 if(sh.getName()!=='NHAP'||!row||row<2)throw Error('Chọn đúng một dòng nguồn ONSPA_WEB trong NHAP.');
 if(!sh.getRange(row,1,1,26).canEdit())throw Error('Tài khoản đang dùng không có quyền sửa dòng Kho này.');
 const v=sh.getRange(row,1,1,26).getValues()[0],commandId=String(v[22]||'');if(v[7]!=='ONSPA_WEB'||!commandId)throw Error('Dòng chưa có yêu cầu thu hồi từ SX.');
 // This preview is authenticated by the existing bridge, never by an invented Web role.
 let receiptId='SX:'+String(v[9]);for(const line of (sh.getRange(row,23).getNote()||'').split('\n'))if(line.startsWith('ONSPA_WITHDRAWAL:')){try{const item=JSON.parse(line.slice('ONSPA_WITHDRAWAL:'.length));if(item.commandId===commandId&&item.receiptId)receiptId=item.receiptId;}catch(e){}}
 const preview=ONSPA_api_({action:'withdrawal-preview',receiptId,reportId:String(v[9]),sku:String(v[2]),commandId,decidedBy:email});
 if(preview.request.status==='completed'){const lock=LockService.getDocumentLock();if(!lock.tryLock(1000))throw Error('Đang xử lý kho; thử lại sau.');try{ONSPA_guiXacNhanThuHoi_(sh,row);}finally{lock.releaseLock();}ui.alert('Yêu cầu đã thu hồi; đã đối chiếu lại trạng thái.');return;}
 if(preview.request.status!=='pending'){if(approve&&preview.request.status==='approved-awaiting-sheet'||!approve&&preview.request.status==='rejected'){const r=preview.receipt;if(!r.sheetSync.command)r.sheetSync.command={kind:approve?'withdrawal-approved':'withdrawal-rejected',id:commandId,revision:preview.request.version};const lock=LockService.getDocumentLock();if(!lock.tryLock(1000))throw Error('Đang xử lý kho; thử lại sau.');try{ONSPA_xuLyThuHoi_(sh,r,row);}finally{lock.releaseLock();}ui.alert('Đã đối chiếu quyết định đã ghi; không tạo quyết định mới.');return;}throw Error('Kho đã có quyết định khác; không tự thay thế.');}
 const action=approve?'withdrawal-approve':'withdrawal-reject';let reason='';
 if(!approve){const input=ui.prompt('Từ chối thu hồi','Nhập ý kiến Kho (giữ nguyên lượng tồn)',ui.ButtonSet.OK_CANCEL);if(input.getSelectedButton()!==ui.Button.OK)return;reason=input.getResponseText().trim();if(!reason)throw Error('Nhập ý kiến từ chối.');}
 if(ui.alert(approve?'Đồng ý thu hồi':'Từ chối thu hồi','LSX: '+preview.receipt.lsxCode+'\nSKU: '+preview.receipt.sku+'\nLượng đã nhận: '+preview.receipt.receivedQuantity+'\n'+(approve?'Giữ nguyên dòng và lượng gốc, vô hiệu hóa để tồn không cộng lượng.':'Giữ nguyên dòng và tồn kho.'),ui.ButtonSet.YES_NO)!==ui.Button.YES)return;
 const lock=LockService.getDocumentLock();if(!lock.tryLock(1000))throw Error('Đang có lượt xử lý kho; thử lại lượt này sau.');
 try{
  if(!sh.getRange(row,1,1,26).canEdit())throw Error('Quyền sửa dòng Kho đã thay đổi; chưa quyết định.');
  const fresh=sh.getRange(row,1,1,26).getValues()[0];if(String(fresh[9])!==String(v[9])||String(fresh[22])!==commandId||String(fresh[2])!==String(v[2]))throw Error('Dòng vừa đổi vị trí/nội dung; chưa quyết định.');
  const cell=sh.getRange(row,23),prefix='ONSPA_WITHDRAWAL_DECISION:',note=cell.getNote()||'';let old=null;
  for(const line of note.split('\n'))if(line.startsWith(prefix)){try{const item=JSON.parse(line.slice(prefix.length));if(item.commandId===commandId)old=item;}catch(e){}}
  if(old&&['pending','uncertain'].includes(old.status)&&(old.action!==action||old.by!==email||old.reason!==reason))throw Error('Lượt quyết định trước chưa rõ kết quả. Giữ nguyên người/nội dung và đối chiếu lượt cũ, không gửi quyết định mới.');
  const intent=old&&['pending','uncertain'].includes(old.status)?old:{commandId,action,by:email,reason,key:Utilities.getUuid(),status:'pending'};
  function save(status){const current=cell.getNote()||'';cell.setNote(current+(current?'\n':'')+prefix+JSON.stringify({...intent,status}));}
  save('pending');let result;
  try{result=ONSPA_api_({action,receiptId:preview.receipt.id,reportId:String(v[9]),sku:String(v[2]),commandId,decidedBy:email,expectedRevision:preview.expectedRevision,checked:approve,reason,requestIdempotency:intent.key});save('confirmed');}
  catch(e){save(e.status>=400&&e.status<500?'failed':'uncertain');throw e;}
  if(result.request.status==='completed'){ONSPA_guiXacNhanThuHoi_(sh,row);ui.alert('Yêu cầu đã được thu hồi và ghi nhận trước đó.');return;}
  const receipt=result.receipt;if(!receipt)throw Error('Đã nhận quyết định nhưng chưa có phiếu đối chiếu; tải lại để kiểm tra.');
  if(!receipt.sheetSync.command)receipt.sheetSync.command={kind:result.request.status==='rejected'?'withdrawal-rejected':'withdrawal-approved',id:commandId,revision:result.request.version};
  try{ONSPA_xuLyThuHoi_(sh,receipt,row);}catch(e){try{ONSPA_api_({action:'error',receiptId:receipt.id,reportId:receipt.reportId,sku:receipt.sku,error:String(e.message||e)});}catch(reportError){/* Keep the local error and original intent for reconciliation. */}throw e;}ui.alert(approve?'Đã thu hồi, giữ dòng/lượng gốc và ghi lịch sử.':'Đã từ chối thu hồi; giữ nguyên tồn kho.');
 }finally{lock.releaseLock();}
}
function ONSPA_dongYThuHoiDongDangChon(){return ONSPA_quyetDinhThuHoiDongDangChon_(true);}
function ONSPA_tuChoiThuHoiDongDangChon(){return ONSPA_quyetDinhThuHoiDongDangChon_(false);}


function ONSPA_docDieuChinhChoNhan_(sh,row){let found=null;for(const line of (sh.getRange(row,23).getNote()||'').split('\n'))if(line.startsWith('ONSPA_PENDING_CORRECTION:')){try{found=JSON.parse(line.slice('ONSPA_PENDING_CORRECTION:'.length));}catch(e){}}return found;}
function ONSPA_ghiDieuChinhChoNhan_(sh,row,marker){const cell=sh.getRange(row,23),note=cell.getNote()||'';cell.setNote(note+(note?'\n':'')+'ONSPA_PENDING_CORRECTION:'+JSON.stringify(marker));}
function ONSPA_ngayDieuChinh_(value){if(value instanceof Date&&Number.isFinite(value.getTime()))return new Date(value.getTime()+25200000).toISOString().slice(0,10);return String(value||'').slice(0,10);}
function ONSPA_choPhepXacNhanKho_(sh,row){const marker=ONSPA_docDieuChinhChoNhan_(sh,row);if(marker&&marker.phase!=='acknowledged')throw Error('Phiếu đang đối soát điều chỉnh; chờ đồng bộ Web trước khi xác nhận Kho.');}
function ONSPA_guiDieuChinhChoNhan_(sh,row,marker){
 ONSPA_kiemTraDongDuyNhat_(sh,row,marker.reportId);const v=sh.getRange(row,1,1,26).getValues()[0],cancel=marker.operation==='daily-output-cancel';
 if(v[7]!=='ONSPA_WEB'||String(v[2])!==marker.sku||String(v[8])!==marker.lsxCode||String(v[9])!==marker.reportId||v[13]!==''||v[17]!==''||v[18]!==''||Number(v[4])!==marker.finalQuantity||ONSPA_ngayDieuChinh_(v[0])!==marker.productionDate||v[12]!== (cancel?'ĐÃ HỦY THEO YÊU CẦU SX':'CHỜ KHO XÁC NHẬN'))throw Error('Dòng điều chỉnh đã thay đổi hoặc có nhận hàng; chưa gửi ACK.');
 if(cancel)ONSPA_kiemTraTonThuHoi_(sh,marker.sku);
 try{const result=ONSPA_api_({action:'pending-correction-ack',receiptId:marker.receiptId,reportId:marker.reportId,sku:marker.sku,commandId:marker.id,commandRevision:marker.revision,sheetRow:row,pendingNoReceipt:true,originalRowRetained:true,originalProposedQuantity:marker.originalQuantity,finalProposedQuantity:marker.finalQuantity,finalProductionDate:marker.productionDate,stockExcluded:cancel,appliedAt:marker.appliedAt});ONSPA_ghiDieuChinhChoNhan_(sh,row,{...marker,phase:'acknowledged'});sh.getRange(row,20,1,2).setValues([['ĐÃ ĐỒNG BỘ WEB','']]);return result;}
 catch(e){if(String(sh.getRange(row,10).getValue())===marker.reportId)sh.getRange(row,20,1,2).setValues([['LỖI ĐỐI SOÁT ĐIỀU CHỈNH',ONSPA_text_(e.message||e)]]);throw e;}
}
function ONSPA_xuLyDieuChinhChoNhan_(sh,r,row){
 const command=r.sheetSync.command,change=r.pendingCorrection,cancel=command.kind==='daily-pending-cancel';if(!row)throw Error('Chưa có dòng gốc đã đồng bộ; không tự tạo dòng thay thế.');
 if(!change||change.id!==command.id||change.status!=='pending'||command.revision!==1||change.operation!==(cancel?'daily-output-cancel':'daily-output-edit'))throw Error('Lệnh sửa/hủy phiếu chờ nhận không khớp.');
 ONSPA_kiemTraDongDuyNhat_(sh,row,r.reportId);const v=sh.getRange(row,1,1,26).getValues()[0];if(v[7]!=='ONSPA_WEB'||String(v[9])!==String(r.reportId)||String(v[2])!==r.sku||String(v[8])!==r.lsxCode||sh.getRange(row,5).getFormula()||sh.getRange(row,14).getFormula())throw Error('Dòng gốc khác nguồn hoặc lượng chứa công thức.');
 let marker=ONSPA_docDieuChinhChoNhan_(sh,row);if(marker&&marker.id!==command.id&&marker.phase!=='acknowledged')throw Error('Dòng còn lượt điều chỉnh chưa đối soát.');
 if(v[13]!==''||v[17]!==''||v[18]!==''||['KHO ĐÃ XÁC NHẬN','CÓ CHÊNH LỆCH'].includes(v[12])){if(marker?.id===command.id)throw Error('Đã có nhận hàng trong lúc đối soát; cần kiểm tra, không ghi đè.');if(!ONSPA_guiXacNhan_(sh,row))throw Error('Kho có thông tin nhận hàng chưa đối soát.');return {ok:true,correctionBlocked:true};}
 if(!marker||marker.id!==command.id){
  if(v[12]!=='CHỜ KHO XÁC NHẬN'||Number(v[4])!==Number(r.proposedQuantity)||ONSPA_ngayDieuChinh_(v[0])!==String(r.sourceProductionDate||r.sourceCompletedAt).slice(0,10))throw Error('Số/ngày phiếu gốc khác bản đã đối chiếu.');
  marker={id:command.id,revision:1,phase:'prepared',operation:change.operation,receiptId:r.id,reportId:String(r.reportId),sku:r.sku,lsxCode:r.lsxCode,originalQuantity:Number(r.proposedQuantity),originalProductionDate:ONSPA_ngayDieuChinh_(v[0]),finalQuantity:cancel?Number(r.proposedQuantity):Number(change.quantity),productionDate:change.productionDate,appliedAt:new Date().toISOString()};
  if(!Number.isSafeInteger(marker.finalQuantity)||marker.finalQuantity<=0||!/^\d{4}-\d{2}-\d{2}$/.test(marker.productionDate))throw Error('Thiếu lượng/ngày điều chỉnh hợp lệ.');if(cancel)ONSPA_kiemTraTonThuHoi_(sh,r.sku);ONSPA_ghiDieuChinhChoNhan_(sh,row,marker);
 }else if(marker.operation!==change.operation||marker.finalQuantity!==(cancel?Number(r.proposedQuantity):Number(change.quantity))||marker.productionDate!==change.productionDate||![marker.originalQuantity,marker.finalQuantity].includes(Number(v[4]))||![marker.originalProductionDate,marker.productionDate].includes(ONSPA_ngayDieuChinh_(v[0])))throw Error('Nội dung khác lượt điều chỉnh đã chuẩn bị.');
 if(marker.phase==='prepared'){if(cancel)ONSPA_kiemTraTonThuHoi_(sh,r.sku);if(!cancel)sh.getRange(row,5).setValue(marker.finalQuantity);sh.getRange(row,1).setValue(new Date(marker.productionDate+'T00:00:00+07:00'));sh.getRange(row,13).setValue(cancel?'ĐÃ HỦY THEO YÊU CẦU SX':'CHỜ KHO XÁC NHẬN');sh.getRange(row,20,1,2).setValues([['CHỜ ĐỐI SOÁT ĐIỀU CHỈNH','']]);SpreadsheetApp.flush();marker={...marker,phase:'applied'};ONSPA_ghiDieuChinhChoNhan_(sh,row,marker);}
 return ONSPA_guiDieuChinhChoNhan_(sh,row,marker);
}
