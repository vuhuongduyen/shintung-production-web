/** @param {number} total @param {number} page @param {number} pageSize */
export function paginationModel(total,page,pageSize){
 const count=Math.max(0,Math.floor(Number(total)||0)),size=Math.max(1,Math.floor(Number(pageSize)||1));
 const pages=Math.max(1,Math.ceil(count/size)),current=Math.max(1,Math.min(Math.floor(Number(page)||1),pages));
 return {total:count,pageSize:size,pages,current,start:count?(current-1)*size+1:0,end:Math.min(current*size,count)};
}
/** @param {number} current @param {number} total @returns {Array<number|'ellipsis'>} */
export function paginationPages(current,total){
 const sorted=[...new Set([1,total,current-2,current-1,current,current+1,current+2].filter(n=>n>=1&&n<=total))].sort((a,b)=>a-b);
 /** @type {Array<number|'ellipsis'>} */ const result=[];
 for(let i=0;i<sorted.length;i++){if(i&&sorted[i]-sorted[i-1]>1)result.push('ellipsis');result.push(sorted[i]);}return result;
}
/** @param {string} locale */
export function paginationLabels(locale){
 return locale==='en'?{showing:'Showing',rows:'rows',previous:'Previous page',next:'Next page',navigation:'Table pagination',page:'Page'}:locale==='zh'?{showing:'顯示',rows:'列',previous:'上一頁',next:'下一頁',navigation:'表格分頁',page:'第'}:{showing:'Hiển thị',rows:'dòng',previous:'Trang trước',next:'Trang sau',navigation:'Phân trang bảng',page:'Trang'};
}
/** @param {ReturnType<typeof paginationModel>} model @param {string} locale */
export function paginationSummary(model,locale){const labels=paginationLabels(locale);return `${labels.showing} ${model.start}–${model.end} / ${model.total} ${labels.rows}`;}
/** Explicit producer markers only; arbitrary one-cell data is still a record. @param {{dataset?:{noData?:string,empty?:string},classList?:{contains:(name:string)=>boolean}} row */
export function isPaginationPlaceholder(row){return row.dataset?.noData==='true'||row.dataset?.empty==='true'||Boolean(row.classList?.contains('no-data')||row.classList?.contains('empty-row'));}
