import {readdirSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=process.cwd();let serverFound=false;
function walk(folder,privateSide){for(const item of readdirSync(folder,{withFileTypes:true})){const name=resolve(folder,item.name);if(item.isDirectory())walk(name,privateSide);else {const text=readFileSync(name).toString('utf8');if(text.includes('sourceBase64')){if(!privateSide)throw Error('Source snapshot leaked to client output: '+name);serverFound=true;}}}}
walk(resolve(root,'dist/client'),false);walk(resolve(root,'dist/server'),true);
if(!serverFound)throw Error('Private Worker source snapshot is absent.');
console.log('Source snapshot is present only in server output; public client assets contain no source package.');
