/** Pure preview helpers only. No SpreadsheetApp writes or automatic migration.
 * Keep the original SKU/quantity/range/date semantics; add explicit exclusion
 * of the warehouse's existing disabled statuses. Unsupported formulas require
 * review instead of being silently rewritten or marked safe.
 */
function ONSPA_congThucTonVoHieu_(formula) {
 const input=String(formula||'');let changed=0,seen=0;
 const range="(?:'NHAP'|NHAP)!\\$?C\\$?(\\d+):\\$?C\\$?(\\d+)";
 const pattern=new RegExp('SUMIF\\(\\s*('+range+')\\s*([;,])\\s*([^;,()]+)\\s*\\4\\s*((?:\\\'NHAP\\\'|NHAP)!\\$?E\\$?(\\d+):\\$?E\\$?(\\d+))\\s*\\)','gi');
 const next=input.replace(pattern,(match,sku,from,to,sep,criteria,quantity,qFrom,qTo)=>{
  seen++;if(from!==qFrom||to!==qTo||Number(from)<2||Number(to)<Number(from))return match;
  const status=sku.replace(/C/gi,'M'),cancel=sku.replace(/C/gi,'V');changed++;
  return 'SUMIFS('+quantity+sep+sku+sep+criteria.trim()+sep+status+sep+'"<>ĐÃ HỦY THEO YÊU CẦU SX"'+sep+cancel+sep+'"<>KHO ĐỒNG Ý HỦY")';
 });
 // Only certify expressions composed of the converted calls and simple
 // arithmetic/parentheses. A mixed or different stock formula is not a pass.
 const withoutSafe=next.replace(/SUMIFS\((?:'NHAP'|NHAP)!\$?E\$?\d+:\$?E\$?\d+([;,])(?:'NHAP'|NHAP)!\$?C\$?\d+:\$?C\$?\d+\1[^;,()]+\1(?:'NHAP'|NHAP)!\$?M\$?\d+:\$?M\$?\d+\1"<>ĐÃ HỦY THEO YÊU CẦU SX"\1(?:'NHAP'|NHAP)!\$?V\$?\d+:\$?V\$?\d+\1"<>KHO ĐỒNG Ý HỦY"\)/gi,'0');
 const supported=!!input&&/NHAP!/i.test(input.replace(/'/g,''))&&withoutSafe!==next&&/^[=\s\d.+*/()\-]+$/.test(withoutSafe);
 return {formula:supported?next:input,changed:supported?changed:0,supported,reason:supported?'':'Công thức ngoài mẫu đã đối chiếu; cần rà riêng, không tự thay.'};
}
function ONSPA_keHoachCongThucVoHieu_(cells){
 const changes=[],blocked=[];
 for(const cell of cells){const result=ONSPA_congThucTonVoHieu_(cell.formula);if(!result.supported)blocked.push({sheet:cell.sheet,row:cell.row,column:cell.column,reason:result.reason});else if(result.changed)changes.push({...cell,after:result.formula});}
 return {ready:blocked.length===0,changes,blocked};
}
