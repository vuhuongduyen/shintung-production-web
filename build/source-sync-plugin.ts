import type {Plugin} from 'vite';
export function sourceSyncSnapshot():Plugin { const name='virtual:onspa-source-snapshot',id='\0'+name; return {name:'local-source-placeholder',resolveId(source){if(source===name)return id;},load(source){if(source===id)return 'export default null;';}};}
