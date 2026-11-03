import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceFromSku, syncBomCatalogSources} from '../lib/bom-source.mjs';
import {buildBomHierarchy} from '../lib/bom-hierarchy.mjs';

test('BOM source follows current approved SKU, updates tree and preserves historical rows and stored data', () => {
  const bom = {sku:'ROOT', status:'Đã xác nhận', items:[
    {code:'MAT', source:'Tự chế', qty:'1', denominator:'10', waste:'2%', expiry:'—'},
    {code:'MAT', source:'Tự chế', qty:'0.1', denominator:'1', expiry:'29/09/2026'},
    {code:'OTHER', source:'Mua', qty:'2', expiry:'01/10/2026'},
  ]};
  const before = JSON.stringify(bom);
  const masters = [{code:'MAT', mode:'Mua hàng'}, {code:'OTHER', mode:'Gia công'}];
  let current = syncBomCatalogSources([bom], masters, '2026-09-30');
  assert.equal(current[0].items[0].source,'Mua');
  assert.equal(current[0].items[1].source,'Tự chế');
  assert.equal(current[0].items[2].source,'Ủy thác');
  const tree = buildBomHierarchy(current[0], current, {date:'2026-09-30'});
  assert.equal(tree.nodes[1].item.source,'Mua');
  assert.deepEqual([current[0].items[0].qty,current[0].items[0].denominator,current[0].items[0].waste],['1','10','2%']);
  masters[0].mode = 'Gia công';
  current = syncBomCatalogSources([bom], masters, '2026-09-30');
  assert.equal(current[0].items[0].source,'Ủy thác');
  assert.equal(JSON.stringify(bom),before);
  assert.equal(sourceFromSku({status:'Chờ xác nhận',mode:'Gia công',currentData:{mode:'Mua hàng'}}),'Mua');
  assert.equal(sourceFromSku({status:'Chờ xác nhận',mode:'Gia công'}),null);
  assert.equal(sourceFromSku({mode:'Tự sản xuất'}),'Tự chế');
});

test('separate BOM and parent-child lookup share current sources and SKU Master labels, including stopped rows',async()=>{
 const {projectBomSources,bomSourceLabel,bomSourceResolver}=await import('../lib/bom-source.mjs');
 const bom={sku:'ROOT',itemType:'Hàng tự chế',status:'Đã xác nhận',items:[
  {code:'PART',source:'Tự chế',qty:'2',denominator:'10',waste:'3%',expiry:'29/09/2026'},
  {code:'CURRENT',source:'Mua',qty:'1',expiry:'—'},
 ]};
 const masters=[{code:'ROOT',mode:'Gia công'},{code:'PART',mode:'Mua hàng'},{code:'CURRENT',mode:'Gia công'}];
 const before=JSON.stringify(bom),current=projectBomSources(bom,masters),source=bomSourceResolver(masters);
 assert.equal(current.source,'Ủy thác');assert.equal(bomSourceLabel(current.source),'Gia công');
 for(const item of current.items)assert.equal(bomSourceLabel(item.source),bomSourceLabel(source(item.code)));
 assert.equal(current.items[0].source,'Mua');assert.equal(bomSourceLabel(current.items[0].source),'Mua ngoài');
 const tree=buildBomHierarchy(current,[current],{date:'2026-09-30'});
 assert.equal(tree.nodes[1].item.source,current.items[1].source);
 masters[1].mode='Tự sản xuất';assert.equal(projectBomSources(bom,masters).items[0].source,'Tự chế');
 assert.equal(JSON.stringify(bom),before);assert.equal(current.items[0].qty,'2');assert.equal(current.items[0].denominator,'10');assert.equal(current.items[0].waste,'3%');
 assert.equal(bomSourceResolver([{code:'PART',status:'Chờ xác nhận',mode:'Mua hàng'}])('PART','Tự chế'),'');
});
