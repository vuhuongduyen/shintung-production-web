import type {Plugin} from 'vite';
import {createSourceSnapshot} from '../scripts/source-snapshot.mjs';
export function sourceSyncSnapshot():Plugin {
 const name='virtual:onspa-source-snapshot',id='\0'+name;let snapshot:unknown=null;
 return {name:'onspa-private-source-snapshot',configResolved(config){if(config.command==='build')snapshot=createSourceSnapshot(config.root);},resolveId(source){if(source===name)return id;},load(source){if(source===id)return `export default ${JSON.stringify(snapshot)};`;}};
}
