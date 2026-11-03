import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildBomHierarchy,visibleBomHierarchy} from '../lib/bom-hierarchy.mjs';
const bom=(sku,items=[])=>({sku,name:sku,status:'Đã xác nhận',items});
const item=(code,extra={})=>({stt:'0010',code,qty:'0,136',denominator:'10',waste:'285%',source:'Mua',...extra});
test('existing separate BOM chain keeps all direct values and does not mutate the source',()=>{
  const catalog=JSON.parse(readFileSync(new URL('../app/bom-data.json',import.meta.url),'utf8')).map(row=>({...row,status:'Đã xác nhận'}));
  const before=JSON.stringify(catalog),root=catalog.find(row=>row.sku==='102XS02001');
  const tree=buildBomHierarchy(root,catalog,{date:'2026-09-30'});
  assert.equal(tree.nodes[0].layer,0);assert.equal(tree.nodes[0].code,root.sku);
  const node=tree.nodes.find(row=>row.code==='2016G001'&&row.parentCode==='3060301B');
  assert.equal(node.layer,3);assert.equal(node.item.qty,'0,014');assert.equal(node.item.denominator,'1');assert.equal(node.item.waste,'262,600%');
  assert.deepEqual(node.item,catalog.find(row=>row.sku==='3060301B').items[0]);assert.equal(JSON.stringify(catalog),before);
});
test('shared codes stay separate per branch, cycles stop, collapse and layer filters preserve ancestors',()=>{
  const a=bom('A',[item('B'),item('B')]),b=bom('B',[item('C')]),c=bom('C',[item('A')]);
  const tree=buildBomHierarchy(a,[a,b,c]);assert.equal(tree.nodes.length,7);assert.equal(tree.warnings.filter(w=>w.kind==='cycle').length,2);
  assert.equal(new Set(tree.nodes.map(n=>n.key)).size,7);
  assert.deepEqual(visibleBomHierarchy(tree.nodes,new Set()).map(n=>n.code),['A']);
  const expanded=new Set(tree.nodes.map(n=>n.key));assert.equal(visibleBomHierarchy(tree.nodes,expanded,1).length,3);
  expanded.delete('root/0');assert.equal(visibleBomHierarchy(tree.nodes,expanded).length,5);
});
test('current effective rows only; unresolved and unconfirmed BOMs are not guessed',()=>{
  const a=bom('A',[item('past',{expiry:'30/09/2026'}),item('future',{effective:'01/10/2026'}),item('bad',{effective:'31/02/2026'}),item('B'),item('D'),item('missing',{source:'Tự chế'})]);
  const b={...bom('B',[item('hidden')]),status:'Chờ xác nhận'};
  const tree=buildBomHierarchy(a,[a,b,bom('D'),bom('D')],{date:'2026-09-30'});
  assert.deepEqual(tree.nodes.map(n=>n.code),['A','B','D','missing']);
  assert.deepEqual(tree.warnings.map(w=>w.kind),['date','unconfirmed','ambiguous','missing']);
});
