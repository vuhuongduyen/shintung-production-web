// Byte-bounded transport of an exact, ordered SQL summary snapshot. No digest
// approximation: commit compares every page plus the complete tail/empty scope.
const pageBytes=512*1024,keyWindow=1000;
export const summaryByteBudget=8*1024*1024;
const after=(alias,lo1,lo2)=>`(${lo1} IS NULL OR ${alias}.k1>${lo1} OR (${alias}.k1=${lo1} AND ${alias}.k2>${lo2}))`;
const through=(alias,hi1,hi2)=>`(${alias}.k1<${hi1} OR (${alias}.k1=${hi1} AND ${alias}.k2<=${hi2}))`;
export async function readSummaryScope(db,{sql,args,maxPages=32,maxBytes=summaryByteBudget}){
 if(!Number.isInteger(maxPages)||maxPages<0||maxPages>32||!Number.isInteger(maxBytes)||maxBytes<0||maxBytes>summaryByteBudget)throw Error('Invalid summary page budget');
 const pages=[];let lower=null,lower2=null,bytesRead=0;
 for(;;){
  const candidates=(await db.prepare(`SELECT s.k1,s.k2,length(CAST(s.v AS BLOB)) AS bytes FROM (${sql}) s WHERE ${after('s','?','?')} ORDER BY s.k1,s.k2 LIMIT ${keyWindow+1}`).bind(...args,lower,lower,lower,lower2).all()).results;
  if(!candidates.length)break;
  const chosen=candidates.slice(0,keyWindow),groups=[];let keys=[],bytes=2;
  for(const row of chosen){
   const size=Number(row.bytes);if(size+2>pageBytes)throw Object.assign(Error('Một bản tóm tắt phiếu vượt giới hạn đọc an toàn; cần đối chiếu dữ liệu.'),{status:409});
   if(keys.length&&bytes+size+1>pageBytes){groups.push(keys);keys=[];bytes=2;}
   bytes+=size+(keys.length?1:0);keys.push(row);
  }
  if(keys.length)groups.push(keys);
  for(let start=0;start<groups.length;start+=3){
   const packets=await Promise.all(groups.slice(start,start+3).map(group=>db.prepare(`SELECT coalesce(json_group_array(json(v)),'[]') AS payload FROM (SELECT s.v FROM (${sql}) s WHERE (s.k1,s.k2) IN (SELECT json_extract(value,'$[0]'),json_extract(value,'$[1]') FROM json_each(?)) ORDER BY s.k1,s.k2)`).bind(...args,JSON.stringify(group.map(r=>[r.k1,r.k2]))).first()));
   for(let i=0;i<packets.length;i++){const size=new TextEncoder().encode(packets[i].payload).byteLength;bytesRead+=size;if(size>pageBytes||bytesRead>maxBytes||pages.length>=maxPages)throw Object.assign(Error('Phạm vi phiếu vượt giới hạn đối chiếu an toàn; chưa lưu, cần chia phạm vi kiểm tra.'),{status:409});const last=groups[start+i].at(-1);pages.push({bounds:[lower,lower2,last.k1,last.k2],payload:packets[i].payload});lower=last.k1;lower2=last.k2;}
  }
  if(candidates.length<=keyWindow)break;
 }
 if(!pages.length)return {pages:0,bytes:0,reports:[],guard:{sql:`(NOT EXISTS(SELECT 1 FROM (${sql})))`,args}};
 const values=pages.map((_,i)=>`(${i},?,?)`).join(','),lowerRange=after('s','p.lo1','p.lo2'),upperRange=through('s','p.hi1','p.hi2');
 const guard=`(WITH actual AS MATERIALIZED (${sql}), expected(i,bounds,payload) AS (VALUES ${values}), pages AS MATERIALIZED (SELECT i,json_extract(bounds,'$[0]') lo1,json_extract(bounds,'$[1]') lo2,json_extract(bounds,'$[2]') hi1,json_extract(bounds,'$[3]') hi2,payload FROM expected) SELECT NOT EXISTS(SELECT 1 FROM pages p WHERE p.payload<>(SELECT coalesce(json_group_array(json(v)),'[]') FROM (SELECT s.v FROM actual s WHERE ${lowerRange} AND ${upperRange} ORDER BY s.k1,s.k2))) AND NOT EXISTS(SELECT 1 FROM actual s WHERE ${after('s','(SELECT hi1 FROM pages ORDER BY i DESC LIMIT 1)','(SELECT hi2 FROM pages ORDER BY i DESC LIMIT 1)')}))`;
 // Decode only after the caller has checked the combined stored/import budget.
 let decoded;return {pages:pages.length,bytes:bytesRead,get reports(){return decoded??=pages.flatMap(p=>JSON.parse(p.payload));},guard:{sql:guard,args:[...args,...pages.flatMap(p=>[JSON.stringify(p.bounds),p.payload])]}};
}
