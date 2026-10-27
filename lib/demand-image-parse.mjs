// Table OCR coordinates preserve separate rows, including repeated SKUs.
export function imageDate(text){const m=String(text||'').match(/(\d{1,2})(?:\s*[/.-]\s*|\s+)(\d{1,2})(?:\s*[/.-]\s*|\s+)(20\d{2})/);if(!m)return '';const iso=`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;return Number.isFinite(Date.parse(iso))&&new Date(iso).toISOString().slice(0,10)===iso?iso:'';}
export function tableLines(pixels,width,height){
 const dark=(x,y)=>{const i=(y*width+x)*4;return pixels[i]+pixels[i+1]+pixels[i+2]<300;};
 const positions=(length,count)=>{const found=[];let prior=-2;for(let p=0;p<length;p++){if(count(p)>.65){if(p>prior+1)found.push(p);prior=p;}}return found;};
 const xs=positions(width,x=>{let n=0;for(let y=0;y<height;y++)if(dark(x,y))n++;return n/height;});
 const ys=positions(height,y=>{let n=0;for(let x=0;x<width;x++)if(dark(x,y))n++;return n/width;});
 return {xs,ys};
}
export function parseDemandImage(data,grid,width,height){
 const words=(data.blocks||[]).flatMap(b=>(b.paragraphs||[]).flatMap(p=>(p.lines||[]).flatMap(l=>l.words||[])));
 const xs=grid.xs,ys=grid.ys;
 if(xs.length<4||ys.length<3)throw Error('Chưa nhận diện được cột và dòng. Hãy tải hình bảng đầy đủ, rõ nét như mẫu, có đường kẻ cột.');
 // Ignore a cropped outer edge; the first internal border separates SKU/name.
 const borders=[0,...xs.filter(x=>x>width*.025&&x<width*.98),width];
 if(borders.length<5)throw Error('Hình thiếu cột SKU, tên, số lượng hoặc ngày giao.');
 const rows=[];let week='';
 const boundaries=[0,...ys.filter(y=>y>3&&y<height-3),height];
 const inCell=(x0,x1,y0,y1)=>words.filter(w=>{const x=(w.bbox.x0+w.bbox.x1)/2,y=(w.bbox.y0+w.bbox.y1)/2;return x>=x0&&x<x1&&y>=y0&&y<y1;}).sort((a,b)=>a.bbox.x0-b.bbox.x0).map(w=>w.text).join(' ').trim();
 for(let i=0;i<boundaries.length-1;i++){
  const y0=boundaries[i],y1=boundaries[i+1];if(y1-y0<8)continue;
  const full=inCell(0,width,y0,y1);
  if(i===0)week=imageDate(full);
  const raw=inCell(0,borders[1],y0,y1),sku=raw.replace(/[^A-Z0-9]/gi,'').toUpperCase();
  if(i===0||!full)continue;
  const qtyText=inCell(borders[2],borders[3],y0,y1).replace(/[\s,]/g,'');
  const qty=/^\d+(?:\.\d+)?$/.test(qtyText)?Number(qtyText):'';
  const delivery=imageDate(inCell(borders.at(-2),width,y0,y1));
  rows.push({sku,qty,delivery,requestDate:'',type:'Bù tải',priority:'Thường',order:'',note:'',sourceLine:i,raw});
 }
 if(!rows.length)throw Error('Chưa đọc được mã SKU. Hãy tải hình rõ hơn, không cắt mất cột mã.');
 return {week,rows:rows.map(r=>({...r,requestDate:week}))};
}

export function matchImageSku(code,catalog){
 const exact=catalog.filter(r=>!r._deleted&&String(r.code).toUpperCase()===code.toUpperCase());if(exact.length===1)return {sku:exact[0].code,review:''};
 const fold=s=>String(s).toUpperCase().replace(/[IL]/g,'1').replace(/O/g,'0');
 const possible=catalog.filter(r=>!r._deleted&&[code,code.replace(/1(?=[IL])/g,'')].some(value=>fold(r.code)===fold(value)));
 return possible.length===1?{sku:possible[0].code,review:`Đọc từ hình: ${code}. Kiểm tra mã đã ghép ${possible[0].code}.`}:{sku:code,review:'Chưa khớp mã SKU. Kiểm tra và sửa mã.'};
}
