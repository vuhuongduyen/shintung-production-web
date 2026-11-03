import ts from 'typescript';
import {createHash} from 'node:crypto';
// Ignore explanatory copy only; preserve callback/disabled expressions, other
// action props and the permission argument. No Git history is required at runtime.
export function actionPropsFingerprint(file,source){
 const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),actions=[],jsx=[];
 const text=node=>node?.getText(ast).replace(/\s+/g,' ')||'';
 function visit(node){
  if(ts.isJsxAttribute(node)&&['onClick','disabled'].includes(node.name.getText(ast)))jsx.push(text(node));
  if(ts.isCallExpression(node)&&/\.action$/.test(text(node.expression))){
   const props=node.arguments[0];
   actions.push(JSON.stringify([props&&ts.isObjectLiteralExpression(props)?props.properties.filter(p=>p.name?.getText(ast)!=='disabledExplanation').map(text):text(props),text(node.arguments[2])]));
  }
  ts.forEachChild(node,visit);
 }
 visit(ast);const hash=items=>createHash('sha256').update(JSON.stringify(items.sort())).digest('hex');
 return {count:actions.length,sha256:hash(actions),jsxCount:jsx.length,jsxSha256:hash(jsx)};
}
