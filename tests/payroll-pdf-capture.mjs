import assert from 'node:assert/strict';

const norm=s=>String(s).replace(/\s+/g,' ').trim();
const isId=s=>/^(?:NV-[AB]-\d+|OUT-[AB])$/.test(s);

// Return actual captured fragments, not a guessed whole-string draw operation.
export function captureEmployeeRows(pages){
 const rows=[];
 for(const [pageIndex,page] of pages.entries()){
  const cells=page.rects.map((r,index)=>({r,index,items:page.texts.filter(t=>t.y>=r.y&&t.y<=r.y+r.h&&t.x>=r.x-0.5&&t.x<=r.x+r.w+0.5).sort((a,b)=>a.y-b.y||a.x-b.x)}));
  // Each PDF table row draws contiguous cells at the same top and height.
  const groups=new Map();
  for(const c of cells){const key=`${c.r.y}:${c.r.h}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(c);}
  for(const group of groups.values()){
   group.sort((a,b)=>a.r.x-b.r.x);
   if(group.length<2)continue;
   const idCell=group[0],nameCell=group[1];
   const id=norm(idCell.items.map(t=>t.text).join(''));
   if(!isId(id))continue;
   const name=norm(nameCell.items.map(t=>t.text).join(' '));
   rows.push({id,name,pageIndex,idFragments:idCell.items,nameFragments:nameCell.items});
  }
 }
 return rows;
}

export function verifyPayrollCapture(pages,expected){
 assert.ok(pages.length>=4,'Expected paginated employee tables');
 for(const [pageIndex,page] of pages.entries()){
  const {width,height,texts,rects}=page;
  assert.ok(texts.length>0,`Empty page ${pageIndex+1}`);
  for(const t of texts){
   const left=t.align==='right'?t.x-t.width:t.align==='center'?t.x-t.width/2:t.x;
   const right=t.align==='right'?t.x:t.align==='center'?t.x+t.width/2:t.x+t.width;
   assert.ok(left>=-0.5&&right<=width+0.5&&t.y>=0&&t.y<=height,`Clipped text page ${pageIndex+1}: ${t.text}`);
  }
  for(const r of rects)assert.ok(r.x>=0&&r.y>=0&&r.x+r.w<=width+0.5&&r.y+r.h<=height+0.5,`Cell outside page ${pageIndex+1}`);
  const cells=rects.map(r=>({r,items:texts.filter(t=>t.y>=r.y&&t.y<=r.y+r.h&&t.x>=r.x-0.5&&t.x<=r.x+r.w+0.5).sort((a,b)=>a.y-b.y||a.x-b.x)}));
  if(texts.some(t=>/NV Line [AB]/.test(t.text)))assert.ok(cells.some(c=>norm(c.items.map(t=>t.text).join(' '))==='Mã NV'),`Missing repeated employee header page ${pageIndex+1}`);
  const footer=texts.filter(t=>/2026-10\s*·\s*\d+/.test(t.text));
  assert.equal(footer.length,1,`Missing page number page ${pageIndex+1}`);
  assert.equal(Number(footer[0].text.match(/·\s*(\d+)/)?.[1]),pageIndex+1,`Incorrect page number ${pageIndex+1}`);
  for(const t of texts.filter(t=>t.y<height-22&&t.y>100)){
   const matching=rects.filter(r=>t.y>=r.y&&t.y<=r.y+r.h&&t.x>=r.x-0.5&&t.x<=r.x+r.w+0.5);
   assert.equal(matching.length,1,`Ambiguous cell ownership: ${t.text}`);
   const cell=matching[0],left=t.align==='right'?t.x-t.width:t.align==='center'?t.x-t.width/2:t.x,right=t.align==='right'?t.x:t.align==='center'?t.x+t.width/2:t.x+t.width;
   assert.ok(left>=cell.x-0.5&&right<=cell.x+cell.w+0.5,`Text clipped inside cell: ${t.text}`);
  }
 }
 const rows=captureEmployeeRows(pages);
 assert.deepEqual(rows.map(r=>r.id),expected.map(e=>e.id),'Employee IDs missing, duplicated or out of order');
 for(let i=0;i<expected.length;i++)assert.equal(rows[i].name,expected[i].name,`Wrong employee name associated with ${expected[i].id}`);
 return true;
}
