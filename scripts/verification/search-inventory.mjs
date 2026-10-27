import ts from 'typescript';
import {readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
const files=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(dir,e.name)):e.name.endsWith('.tsx')?[join(dir,e.name)]:[]);
const rows=[];
for(const file of [...files('app'),...files('components')]){
 const source=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const declarations=new Map();
 const collect=n=>{if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&n.initializer)declarations.set(n.name.text,n.initializer);ts.forEachChild(n,collect);};collect(source);
 const visit=node=>{
  if((ts.isJsxSelfClosingElement(node)||ts.isJsxOpeningElement(node))&&node.tagName.getText(source)==='StandardToolbar'){
   const attrs=node.attributes.properties;
   const name=attrs.find(a=>a.name?.getText(source)==='name')?.initializer?.getText(source)||'ONSPA';
   const items=attrs.find(a=>a.name?.getText(source)==='items');let body=items?.getText(source)||'';
   const explicit=[];let fields=0;const controls=[];const expanded=new Set();
   const scan=n=>{
    if(ts.isSpreadElement(n)&&ts.isIdentifier(n.expression)&&!expanded.has(n.expression.text)){const value=declarations.get(n.expression.text);if(value){expanded.add(n.expression.text);body+=' '+value.getText(source);scan(value);}}
    if(ts.isCallExpression(n)){
     const fn=n.expression.getText(source);
     if(/toolbar(?:Config)?\.action$/.test(fn)&&n.arguments[3]?.getText(source).match(/^['"]search['"]$/))explicit.push(n.arguments[1].getText(source).replace(/\s+/g,' ').slice(0,140));
     if(/toolbar(?:Config)?\.field$/.test(fn))fields++;
     if(/toolbar(?:Config)?\.(input|select)$/.test(fn))controls.push(fn.split('.').at(-1));
    }ts.forEachChild(n,scan);
   };if(items)scan(items);
   rows.push({file,line:source.getLineAndCharacterOfPosition(node.getStart(source)).line+1,name,explicitSearch:explicit,staticLookupField:/tra theo|搜尋欄位|查詢依據/i.test(body),fieldDeclarations:fields,inputDeclarations:controls.filter(x=>x==='input').length,selectDeclarations:controls.filter(x=>x==='select').length});
  }ts.forEachChild(node,visit);
 };visit(source);
}
writeFileSync('docs/SEARCH-ENTER-INVENTORY.json',JSON.stringify({note:'Static JSX declaration inventory, not runtime menu coverage. Dynamic fields/items and conditional rendering need runtime review. All StandardToolbar input declarations share the guarded Enter handler; selects retain native selection.',rows},null,2)+'\n');
console.log(JSON.stringify({toolbars:rows.length,explicit:rows.filter(x=>x.explicitSearch.length).length,lookupWithoutExplicit:rows.filter(x=>x.staticLookupField&&!x.explicitSearch.length).length}));
console.log(rows.filter(x=>x.explicitSearch.length||x.staticLookupField).map(x=>`${x.file}:${x.line} ${x.name} ${x.explicitSearch.length?'explicit':'generated'}`).join('\n'));
