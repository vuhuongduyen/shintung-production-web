export function parseSkuList(text) {
  const seen=new Set();
  return String(text).split(/\r?\n/).filter(line=>line.trim()).map((textLine,index)=>{
    const fields=textLine.split('\t').map(value=>value.trim());
    if(fields.length!==6)throw Error(`Dòng ${index+1}: cần 6 cột SKU, tên, quy cách, nhóm, Line, giờ công nguồn.`);
    const [rawCode,name,specification,group,line,hour]=fields,code=rawCode.toUpperCase();
    if(!/^[A-Z0-9][A-Z0-9-]*$/.test(code)||!name)throw Error(`Dòng ${index+1}: mã SKU hoặc tên sản phẩm không hợp lệ.`);
    if(seen.has(code))throw Error(`Mã ${code} bị lặp trong danh sách.`);
    if(hour&&!/^\d+(?:[.,]\d+)?$/.test(hour))throw Error(`Giờ công nguồn của ${code} không hợp lệ.`);
    seen.add(code);
    return {code,name,specification,group,line:line.match(/^[ABC]$/i)?`Line ${line.toUpperCase()}`:line,sourceLaborHour:hour?Number(hour.replace(',','.')):null};
  });
}
export function missingSkuRows(rows,records) {
  const codes=new Set(records.map(row=>String(row.key||row.code).trim().toUpperCase()));
  return rows.filter(row=>!codes.has(row.code));
}
export function importedSkuDraft(row,source) {
  return {code:row.code,name:row.name,specification:row.specification,group:row.group,line:row.line,
    unit:'',mode:'',processes:[],moq:0,safetyDays:0,leadTime:'Chưa thiết lập',standardHours:'Chưa thiết lập',
    importSource:source,sourceLaborHour:row.sourceLaborHour,
    importNote:'Bổ sung từ danh sách nguồn; cần hoàn thiện thông tin trước khi xác nhận.'};
}
