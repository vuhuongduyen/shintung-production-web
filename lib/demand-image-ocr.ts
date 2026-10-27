import {tableLines,parseDemandImage} from './demand-image-parse.mjs';
export async function readDemandImage(file:File,progress:(value:string)=>void){
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>12*1024*1024)throw Error('Chọn hình PNG, JPG hoặc WEBP không quá 12 MB.');
 const bitmap=await createImageBitmap(file);let worker:any;
 try{
 if(bitmap.width*bitmap.height>20000000)throw Error('Hình quá lớn. Hãy cắt riêng bảng Demand event rồi tải lại.');
 const scale=Math.min(3,2400/bitmap.width),canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
 const ctx=canvas.getContext('2d')!;ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);const raw=ctx.getImageData(0,0,canvas.width,canvas.height),grid=tableLines(raw.data,canvas.width,canvas.height);
 const blackX=new Set<number>(),blackY=new Set<number>();for(const x of grid.xs)for(let n=-2;n<5;n++)blackX.add(x+n);for(const y of grid.ys)for(let n=-2;n<5;n++)blackY.add(y+n);
 for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){const i=(y*canvas.width+x)*4,v=blackX.has(x)||blackY.has(y)||raw.data[i]+raw.data[i+1]+raw.data[i+2]>360?255:0;raw.data[i]=raw.data[i+1]=raw.data[i+2]=v;raw.data[i+3]=255;}ctx.putImageData(raw,0,0);
 progress('Đang đọc hình…');const {createWorker,PSM}=await import('tesseract.js');
 worker=await createWorker('eng',1,{workerPath:'/ocr/worker.min.js',corePath:'/ocr',langPath:'/ocr',logger:m=>{if(m.status==='recognizing text')progress(`Đang đọc hình… ${Math.round(m.progress*100)}%`);}});
 await worker.setParameters({tessedit_pageseg_mode:PSM.SINGLE_BLOCK,preserve_interword_spaces:'1'});
 const {data}=await worker.recognize(canvas,{}, {blocks:true,text:true});
 return parseDemandImage(data,grid,canvas.width,canvas.height);
 }finally{bitmap.close();if(worker)await worker.terminate();}
}
