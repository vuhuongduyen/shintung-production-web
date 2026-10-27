import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { configuration,root } from './database.mjs';
configuration();
const mode=process.argv[2]||'dev';
if(!['dev','build'].includes(mode))throw new Error('Unknown command');
// Discard generated bundles and dependency transforms before every release build.
if(mode==='build')for(const dir of ['dist','node_modules/.vite','node_modules/.vite-temp'])rmSync(resolve(root,dir),{recursive:true,force:true});
const forwarded=process.argv.slice(3);
const args=mode==='build'?['node_modules/vinext/dist/cli.js','build']:['node_modules/vite/bin/vite.js',...(forwarded.length?forwarded:['--host','127.0.0.1','--port','5173','--strictPort'])];
const child=spawn(process.execPath,args,{cwd:root,stdio:'inherit',env:{...process.env,WRANGLER_SEND_METRICS:'false',WRANGLER_LOG_PATH:'.wrangler/wrangler.log'}});
child.on('error',e=>{console.error(e);process.exitCode=1});child.on('exit',code=>process.exitCode=code??1);
process.on('SIGINT',()=>child.kill('SIGINT'));process.on('SIGTERM',()=>child.kill('SIGTERM'));
