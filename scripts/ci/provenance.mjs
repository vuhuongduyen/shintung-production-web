import {execFileSync} from 'node:child_process';
import {readFileSync,appendFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const sha=value=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value);
export function ciSource({cwd=process.cwd(),environment=process.env,event}={}){
 const git=(...args)=>execFileSync('git',args,{cwd,encoding:'utf8'}).trim();
 const checkout=git('rev-parse','HEAD'),tree=git('rev-parse','HEAD^{tree}');
 if(!sha(checkout)||!sha(tree)||checkout!==environment.GITHUB_SHA)throw Error('CI checkout does not match the event SHA');
 const name=environment.GITHUB_EVENT_NAME;
 if(!['pull_request','push'].includes(name))throw Error('Unsupported CI event');
 if(name==='pull_request'){
  const pr=event?.pull_request;
  if(!pr||!['main','staging'].includes(pr.base?.ref)||!sha(pr.base?.sha)||!sha(pr.head?.sha))throw Error('Invalid CI pull request source');
  // Revision walking treats a depth-one checkout as a root. Read the actual
  // commit object headers instead; no extra fetch or altered validation needed.
  const parents=git('cat-file','commit','HEAD').split('\n\n',1)[0].split('\n').filter(line=>/^parent [a-f0-9]{40}$/.test(line)).map(line=>line.slice(7));
  if(parents.length!==2||parents[0]!==pr.base.sha||parents[1]!==pr.head.sha)throw Error('CI merge parents do not match the pull request');
  return {event:name,checkout,tree,base:pr.base.sha,baseBranch:pr.base.ref,head:pr.head.sha};
 }
 if(environment.GITHUB_REF!=='refs/heads/main')throw Error('Unexpected CI push target');
 return {event:name,checkout,tree,base:null,baseBranch:'main',head:checkout};
}

export function reportCiSource(options){
 const source=ciSource(options),output=JSON.stringify(source);
 if(options.environment.GITHUB_STEP_SUMMARY)appendFileSync(options.environment.GITHUB_STEP_SUMMARY,'### Nguồn mã được kiểm tra\n\n```json\n'+JSON.stringify(source,null,2)+'\n```\n');
 return 'CI SOURCE: '+output;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const event=process.env.GITHUB_EVENT_PATH?JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH,'utf8')):{};
 console.log(reportCiSource({cwd:process.cwd(),environment:process.env,event}));
}
