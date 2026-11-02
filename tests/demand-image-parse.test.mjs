import test from 'node:test';import assert from 'node:assert/strict';
import {imageDate,parseDemandImage,matchImageSku} from '../lib/demand-image-parse.mjs';
const word=(text,x,y)=>({text,bbox:{x0:x,y0:y,x1:x+15,y1:y+8}});
test('table coordinates select quantity column, preserve duplicate SKU and blank delivery',()=>{
 const data={blocks:[{paragraphs:[{lines:[{words:[word('TUAN KE HOACH 44: 26 10 2026 - 01 11 2026',200,2),word('102XS04001',10,25),word('SQC 40',120,25),word('4000',350,25),word('30/10/2026',580,25),word('102XS04001',10,48),word('SQC 40',120,48),word('500',350,48)]}]}]}]};
 const parsed=parseDemandImage(data,{xs:[100,330,410,570,660],ys:[0,20,43,66]},662,68);
 assert.equal(parsed.week,'2026-10-26');assert.equal(parsed.rows.length,2);assert.deepEqual(parsed.rows.map(r=>r.qty),[4000,500]);assert.equal(parsed.rows[1].delivery,'');assert.ok(parsed.rows.every(r=>r.type==='Bù tải'&&r.requestDate==='2026-10-26'));
});
test('dates and SKU ambiguity are handled without silently choosing among multiple codes',()=>{
 assert.equal(imageDate('31/02/2026'),'');assert.equal(imageDate('26/10/2026'),'2026-10-26');
 assert.equal(matchImageSku('102X105001',[{code:'102XL05001'}]).sku,'102XL05001');
 assert.equal(matchImageSku('102X105001',[{code:'102XL05001'},{code:'102XI05001'}]).sku,'102X105001');
 assert.throws(()=>parseDemandImage({blocks:[]},{xs:[],ys:[]},100,100),/Chưa nhận diện/);
});
test('user image OCR with an extra 1 before L resolves to the unique SKU master code',()=>{
 const catalog=[{code:'102XL05001'},{code:'102XI06001'}];
 assert.equal(matchImageSku('102X1L05001',catalog).sku,'102XL05001');
 assert.equal(matchImageSku('102X106001',catalog).sku,'102XI06001');
 assert.equal(matchImageSku('102XL05001',catalog).sku,'102XL05001');
});
