import {unzip} from 'fflate';
import {HR_IMPORT_LIMIT} from './hr-absence-import.mjs';
const headers=['Ngày xin phép','Mã nhân viên','Tên NV','Loại nghỉ phép','Tên nghỉ phép','Thời gian bắt đầu','Thời gian kết thúc','Thời gian xin phép'];
const xml=(bytes:Uint8Array)=>{const doc=new DOMParser().parseFromString(new TextDecoder().decode(bytes),'application/xml');if(doc.querySelector('parsererror')||doc.doctype)throw Error('XML trong Excel không hợp lệ.');return doc;};
const text=(el:Element|null)=>[...el?.getElementsByTagName('t')||[]].map(t=>t.textContent||'').join('');
export async function readAbsenceXlsx(file:File){
 if(!/\.xlsx$/i.test(file.name)||file.size>5*1024*1024)throw Error('Chọn file .xlsx không quá 5 MB.');
 const bytes=new Uint8Array(await file.arrayBuffer());
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(v=>v.toString(16).padStart(2,'0')).join('');
 let total=0,tooLarge=false;
 const files=await new Promise<Record<string,Uint8Array>>((resolve,reject)=>unzip(bytes,{filter:f=>{total+=f.originalSize;if(total>20*1024*1024||f.originalSize>10*1024*1024){tooLarge=true;return false;}return /^xl\/(workbook.xml|_rels\/workbook.xml.rels|sharedStrings.xml|worksheets\/sheet\d+.xml)$/.test(f.name);}},(err,data)=>err?reject(Error('Không đọc được file Excel.')):resolve(data)));
 if(tooLarge)throw Error('File giải nén quá lớn; chia nhỏ dữ liệu.');
 if(!files['xl/workbook.xml']||!files['xl/_rels/workbook.xml.rels'])throw Error('Thiếu cấu trúc Excel.');
 const workbook=xml(files['xl/workbook.xml']);if(['1','true'].includes(workbook.querySelector('workbookPr')?.getAttribute('date1904')||''))throw Error('File dùng hệ ngày 1904; hãy xuất lại ngày dạng dd/MM/yyyy.');
 const strings=files['xl/sharedStrings.xml']?[...xml(files['xl/sharedStrings.xml']).getElementsByTagName('si')].map(text):[];
 const relations=xml(files['xl/_rels/workbook.xml.rels']);
 const sheet=[...workbook.getElementsByTagName('sheet')].filter(s=>s.getAttribute('state')!=='hidden');
 if(sheet.length!==1)throw Error('File cần một sheet dữ liệu hiển thị.');
 const target=[...relations.getElementsByTagName('Relationship')].find(r=>r.getAttribute('Id')===sheet[0].getAttribute('r:id'))?.getAttribute('Target')||'';
 const path=target.startsWith('/')?target.slice(1):'xl/'+target;
 if(!files[path])throw Error('Không tìm thấy sheet dữ liệu.');
 const parsed=[...xml(files[path]).getElementsByTagName('row')].map(row=>{
  const cells:string[]=[];
  for(const c of [...row.getElementsByTagName('c')]){if(c.querySelector('f'))throw Error('File có công thức; xuất dữ liệu thành giá trị trước khi nhập.');const letters=(c.getAttribute('r')||'').match(/^[A-Z]+/)?.[0];if(!letters)throw Error('Địa chỉ ô không hợp lệ.');const index=[...letters].reduce((v,l)=>v*26+l.charCodeAt(0)-64,0)-1;const raw=c.querySelector('v')?.textContent||'';cells[index]=c.getAttribute('t')==='s'?strings[Number(raw)]||'':c.getAttribute('t')==='inlineStr'?text(c):raw;}
  return {number:Number(row.getAttribute('r')),cells};
 }).filter(r=>r.cells.some(v=>v.trim()));
 const heading=parsed.shift();if(!heading)throw Error('File rỗng.');
 const columns=headers.map(h=>heading.cells.findIndex(v=>v.trim().normalize('NFC')===h));
 if(columns.some(i=>i<0)||new Set(heading.cells).size!==heading.cells.length)throw Error('Thiếu hoặc trùng cột trong mẫu Excel.');
 if(!parsed.length||parsed.length>HR_IMPORT_LIMIT)throw Error(`Mỗi lần nhập tối đa ${HR_IMPORT_LIMIT} dòng. Hãy chia file nếu vượt giới hạn.`);
 const date=(v:string)=>{const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);if(m)return `${m[3]}-${m[2]}-${m[1]}`;if(/^\d+(\.0+)?$/.test(v)){const n=Number(v);if(n>60&&n<100000)return new Date(Date.UTC(1899,11,30)+n*86400000).toISOString().slice(0,10);}return v;};
 const time=(v:string)=>{if(/^\d*\.\d+$/.test(v)||v==='0'){const n=Number(v)*1440;if(n>=0&&n<1440&&Math.abs(n-Math.round(n))<0.001)return `${String(Math.floor(Math.round(n)/60)).padStart(2,'0')}:${String(Math.round(n)%60).padStart(2,'0')}`;}return v;};
 return {fileHash:hash,rows:parsed.map(({number,cells})=>{const v=columns.map(i=>(cells[i]||'').trim());return {row:number,date:date(v[0]),code:v[1],name:v[2],leaveCode:v[3],leaveName:v[4],start:time(v[5]),end:time(v[6]),duration:time(v[7]),kind:['PN','VR','HL1'].includes(v[3])?'Nghỉ':v[3]==='15P'?'Đi trễ':v[3]==='TRVS'?'Đi trễ, về sớm':''};})};
}
