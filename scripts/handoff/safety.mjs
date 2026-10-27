import { readdirSync,readFileSync,lstatSync } from 'node:fs';
import { resolve,relative } from 'node:path';
export function rejectSecrets(value,location='data'){
 if(value&&typeof value==='object')for(const [key,item]of Object.entries(value)){
  if(/password|passwd|secret|token|api.?key|private.?key|credential|authorization/i.test(key)&&item!==null&&item!=='')throw new Error(`Sensitive field: ${location}.${key}`);
  rejectSecrets(item,`${location}.${key}`);
 }
 if(typeof value==='string'&&(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(value)||/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|AKIA[A-Z0-9]{16})\b/.test(value)))throw new Error(`Secret pattern: ${location}`);
}
export function checkSource(text,file){
 rejectSecrets(text,file);
 if(/(?:password|passwd|api[_-]?key|secret|access[_-]?token)\s*[:=]\s*["'][^"'\n]{12,}["']/i.test(text))throw new Error(`Possible hard-coded secret: ${file}`);
 if(/https?:\/\/[^\s/]+:[^\s/]+@/i.test(text))throw new Error(`Credential URL: ${file}`);
}
const directories=['app','build','components','db','drizzle','hooks','lib','public','scripts','seed','config','docs','tests','types','worker','vendor','examples'];
const files=['README.md','AGENTS.md','package.json','package-lock.json','vite.config.ts','next.config.ts','tsconfig.json','postcss.config.mjs','eslint.config.mjs','drizzle.config.ts','components.json','.gitignore','.npmrc'];
export function sourceFiles(root){
 const result=[];
 function walk(path){const stat=lstatSync(path);if(stat.isSymbolicLink())throw new Error(`Symlink excluded: ${path}`);if(stat.isDirectory()){for(const name of readdirSync(path))walk(resolve(path,name));return;}
  const name=relative(root,path).replaceAll('\\','/');
  if(name.startsWith('public/ocr/'))return; // Rebuilt from pinned npm dependencies.
  // These are source dependencies, not generated handoff archives.
  if(['scripts/handoff/safety.mjs','scripts/handoff/source-only.mjs'].includes(name)){result.push(name);return;}
  if(/(?:^|\/)(?:node_modules|\.git|\.local-data|\.sites-runtime|\.wrangler|dist|backups|handoff)(?:\/|$)|(?:^|\/)\.env|\.dev\.vars|\.(?:sqlite(?:-wal|-shm)?|db|pem|key|p12|pfx|zip|tgz|log)$/i.test(name))return;
  result.push(name);
 }
 const available=new Set(readdirSync(root));for(const name of [...directories,...files])if(available.has(name))walk(resolve(root,name));
 // Include only sanitized Site identity. Original hosting.json is handled explicitly.
 return result.sort();
}
