const codePattern=/^(?=.*\d)[A-Z0-9]{5,24}$/;

export function bomRowsFromPdfTextItems(items){
 const lines=new Map();
 for(const item of items){
  const text=String(item?.str||'').trim(),transform=item?.transform;
  if(!text||!Array.isArray(transform))continue;
  const y=Math.round(Number(transform[5]||0)*2)/2;
  lines.set(y,[...(lines.get(y)||[]),{x:Number(transform[4]||0),text}]);
 }
 const rows=[];
 for(const cells of lines.values()){
  const sorted=cells.sort((a,b)=>a.x-b.x);
  const codeCell=sorted.find(cell=>cell.x>=45&&cell.x<120&&codePattern.test(cell.text));
  if(!codeCell)continue;
  const levelCell=sorted.find(cell=>cell.x>=118&&cell.x<150);
  const unit=sorted.filter(cell=>cell.x>=420&&cell.x<450).map(cell=>cell.text).join(' ').trim();
  rows.push({productCode:codeCell.text.trim(),level:levelCell?.text.trim()||'',unit});
 }
 return rows;
}

export function analyzeBomUnitRows(rows){
 const grouped=new Map();
 for(const raw of Array.isArray(rows)?rows:[]){
  const productCode=String(raw?.productCode||'').trim();if(!codePattern.test(productCode))continue;
  grouped.set(productCode,[...(grouped.get(productCode)||[]),{level:String(raw?.level||'').trim(),unit:String(raw?.unit||'').trim().replace(/\s+/g,' ').toLocaleUpperCase('vi')}]);
 }
 const units={},missingLevel0=[],blankLevel0=[],duplicateLevel0=[],conflictingLevel0=[];
 for(const [productCode,items] of grouped){
  const level0=items.filter(item=>item.level==='0');
  if(!level0.length){missingLevel0.push(productCode);continue;}
  const nonblank=[...new Set(level0.map(item=>item.unit).filter(Boolean))];
  if(level0.some(item=>!item.unit))blankLevel0.push(productCode);
  if(level0.length>1)duplicateLevel0.push(productCode);
  if(nonblank.length>1){conflictingLevel0.push({productCode,units:nonblank});continue;}
  if(nonblank.length===1&&!level0.some(item=>!item.unit))units[productCode]=nonblank[0];
 }
 return {totalProductCodes:grouped.size,units,missingLevel0,blankLevel0,duplicateLevel0,conflictingLevel0};
}
