import {bomDate as calendarDate} from './bom-rules.mjs';
const codeKey=value=>String(value??'').trim().toUpperCase();
/** Read-only expansion: each edge retains the direct BOM's original values. */
export function buildBomHierarchy(root,catalog,{date,maxDepth=30,maxRows=10000}={}){
  const at=date||new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Ho_Chi_Minh'});
  const index=new Map(),nodes=[],warnings=[];
  for(const bom of catalog){const code=codeKey(bom.sku);index.set(code,[...(index.get(code)||[]),bom]);}
  const warn=(node,kind)=>{node.warning=kind;warnings.push({key:node.key,code:node.code,parentCode:node.parentCode,kind});};
  const rootNode={key:'root',parentKey:null,parentCode:null,code:root.sku,layer:0,item:null,bom:root,childKeys:[]};nodes.push(rootNode);
  function visit(bom,parent,path){
    if(bom.status!=='Đã xác nhận'){warn(parent,'unconfirmed');return;}
    if(parent.layer>=maxDepth){warn(parent,'depth');return;}
    const rows=bom.items||[];
    for(let i=0;i<rows.length;i++){
      const item=rows[i],from=calendarDate(item.effective),to=calendarDate(item.expiry);
      if(from===false||to===false){warnings.push({key:`${parent.key}/${i}`,code:item.code,parentCode:bom.sku,kind:'date'});continue;}
      if(from&&from>at||to&&to<=at)continue;
      if(nodes.length>=maxRows){warn(parent,'limit');return;}
      const node={key:`${parent.key}/${i}`,parentKey:parent.key,parentCode:bom.sku,code:item.code,layer:parent.layer+1,item,bom:null,childKeys:[]};
      nodes.push(node);parent.childKeys.push(node.key);
      const key=codeKey(item.code),matches=index.get(key)||[];
      if(!key){warn(node,'code');continue;}
      if(path.has(key)){warn(node,'cycle');continue;}
      if(matches.length>1){warn(node,'ambiguous');continue;}
      if(!matches.length){if(['Tự chế','Ủy thác'].includes(item.source))warn(node,'missing');continue;}
      node.bom=matches[0];visit(matches[0],node,new Set([...path,key]));
    }
  }
  visit(root,rootNode,new Set([codeKey(root.sku)]));
  return{nodes,warnings,date:at};
}

export function visibleBomHierarchy(nodes,expanded,maxLayer=Infinity){
  const visible=new Set();return nodes.filter(node=>{
    if(node.layer>maxLayer)return false;
    if(node.parentKey!==null&&(!visible.has(node.parentKey)||!expanded.has(node.parentKey)))return false;
    visible.add(node.key);return true;
  });
}
