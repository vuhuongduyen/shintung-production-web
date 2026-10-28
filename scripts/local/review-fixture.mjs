// Synthetic component preview only: no application worker, DB, accounts or warehouse API.
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {resolve} from 'node:path';
import {configuration,root} from './database.mjs';
configuration();
const server=await createServer({configFile:false,root:resolve(root,'tests/fixtures'),plugins:[react()],server:{host:'127.0.0.1',port:5174,strictPort:true,fs:{allow:[root],deny:['**/.env*','**/.git/**','**/.local-data/**','**/backups/**','**/handoff/**','**/.sites-runtime/**']}}});
await server.listen();
console.log('Synthetic UI fixture at local port 5174 /report-review.html. No public test URL is provisioned.');
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await server.close();process.exit(0);});
