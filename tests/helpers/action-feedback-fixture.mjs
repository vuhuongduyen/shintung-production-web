import {readFileSync} from 'node:fs';
import ts from 'typescript';

// Legacy business/render fixtures stub only the shared button boundary. Dedicated
// mounted action-feedback tests exercise its real events, disabled guard and UI.
export const clientActionAuditFixture = {recordClientAttempt(){},clearClientAttempts(){}};
export const actionFeedbackComponentFixture = {FeedbackActionButton: 'button'};
const compiled = {exports: {}};
const source = readFileSync(new URL('../../lib/action-feedback.ts', import.meta.url), 'utf8');
new Function('module', 'exports', 'require', ts.transpileModule(source, {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
}).outputText)(compiled, compiled.exports, name=>{if(name==='./client-action-audit')return clientActionAuditFixture;throw Error(name);});
export const actionFeedbackHelpers = compiled.exports;
