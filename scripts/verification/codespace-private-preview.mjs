// Explicit QA transport only. Never import from app, Worker, Vite or deployment.
import {createServer} from 'node:http';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {dailyOutputLoopback} from './daily-output-loopback.mjs';
import {configuration,root} from '../local/database.mjs';

export const previewCodespace='spooky-poltergeist-p7pj9xpvjj96f9rj5';
export const previewOrigin=`https://${previewCodespace}-5173.app.github.dev`;
const expectedHost=new URL(previewOrigin).host;
const rewrittenHost='localhost:5173',rewrittenOrigin='http://localhost:5173';
const loopback=new Set(['127.0.0.1','::1','::ffff:127.0.0.1']);
const safeMethods=new Set(['GET','HEAD']);
const methods=new Set([...safeMethods,'POST','PUT','PATCH','DELETE']);
const maximumBody=16*1024*1024;
const dropHeaders=new Set(['host','connection','keep-alive','transfer-encoding','upgrade','trailer','te','proxy-authorization','proxy-authenticate','authorization','forwarded','cf-connecting-ip','cf-access-jwt-assertion']);
const denied=code=>Object.assign(new Error('Synthetic preview rejects this request.'),{status:403,code});
const hostClass=value=>value===undefined?'missing':value===expectedHost?'expected-codespace':value==='localhost:5173'?'localhost-5173':value==='127.0.0.1:5173'?'loopback-5173':value==='localhost'?'localhost':value==='127.0.0.1'?'loopback':'other';
const originClass=value=>value===undefined?'missing':value===previewOrigin?'expected-https':value==='null'?'null':value==='http://localhost:5173'?'http-localhost-5173':value==='http://127.0.0.1:5173'?'http-loopback-5173':value==='https://localhost:5173'?'https-localhost-5173':value==='http://localhost'?'http-localhost':value==='https://localhost'?'https-localhost':'other';
// Fixed labels only: never echo arbitrary headers, URL/query, cookies or bodies.
export function previewDiagnostic(req,code){
 const safeCode=new Set(['PEER_NOT_LOOPBACK','HOST_MISMATCH','DUPLICATE_AUTHORITY','BODY_ON_SAFE_METHOD','ORIGIN_MISMATCH','ORIGIN_REQUIRED','PATH_INVALID','FORWARDED_AUTHORITY_MISMATCH','FETCH_METADATA_REQUIRED','FETCH_METADATA_REJECTED']).has(code)?code:'GUARD_REJECTED';
 return {code:safeCode,transport:{peer:loopback.has(req.socket.remoteAddress)?'loopback':'other',host:hostClass(req.headers.host),origin:originClass(req.headers.origin),forwardedHost:hostClass(req.headers['x-forwarded-host']),forwardedProto:['http','https'].includes(req.headers['x-forwarded-proto'])?req.headers['x-forwarded-proto']:req.headers['x-forwarded-proto']===undefined?'missing':'other',originalHost:hostClass(req.headers['x-original-host']),forwardedOrigin:originClass(req.headers['x-forwarded-origin']),originalOrigin:originClass(req.headers['x-original-origin']),fetchSite:['same-origin','same-site','cross-site','none'].includes(req.headers['sec-fetch-site'])?req.headers['sec-fetch-site']:req.headers['sec-fetch-site']===undefined?'missing':'other'}};
}

// Two fixed transports, not a general trust-proxy switch. The second matches
// the owner's actual Private Codespace probe. No header chooses a target URL.
export function previewTarget(req){
 if(!loopback.has(req.socket.remoteAddress))throw denied('PEER_NOT_LOOPBACK');
 const occurrences=name=>req.rawHeaders.filter((_,i)=>i%2===0&&req.rawHeaders[i].toLowerCase()===name).length;
 if(occurrences('host')!==1||occurrences('origin')>1)throw denied('DUPLICATE_AUTHORITY');
 let requestOrigin;
 if(req.headers.host===expectedHost)requestOrigin=previewOrigin;
 else if(req.headers.host===rewrittenHost){
  if(req.headers['x-forwarded-host']!==expectedHost||req.headers['x-forwarded-proto']!=='https'||occurrences('x-forwarded-host')!==1||occurrences('x-forwarded-proto')!==1)throw denied('FORWARDED_AUTHORITY_MISMATCH');
  requestOrigin=rewrittenOrigin;
 }else throw denied('HOST_MISMATCH');
 if(safeMethods.has(req.method)&&(req.headers['transfer-encoding']||req.headers['content-length']!==undefined&&!/^0+$/.test(req.headers['content-length'])))throw denied('BODY_ON_SAFE_METHOD');
 if(!methods.has(req.method))throw Object.assign(new Error('Method not supported.'),{status:405});
 const origin=req.headers.origin;
 if(origin!==undefined&&origin!==requestOrigin)throw denied('ORIGIN_MISMATCH');
 if(!safeMethods.has(req.method)&&origin!==requestOrigin)throw denied('ORIGIN_REQUIRED');
 // The proxy has lost the original browser Origin. Forwarded Host alone cannot
 // prove a browser write is same-origin. Fail closed without browser-controlled
 // Fetch Metadata; same-site is deliberately NOT accepted as same-origin.
 if(requestOrigin===rewrittenOrigin&&(origin!==undefined||!safeMethods.has(req.method))){
  if(req.headers['sec-fetch-site']===undefined)throw denied('FETCH_METADATA_REQUIRED');
  if(req.headers['sec-fetch-site']!=='same-origin'||occurrences('sec-fetch-site')!==1)throw denied('FETCH_METADATA_REJECTED');
 }
 const path=req.url;
 if(typeof path!=='string'||!path.startsWith('/')||path.startsWith('//')||/[\\\x00-\x20\x7f#]/.test(path))throw denied('PATH_INVALID');
 const target=new URL(path,requestOrigin);
 if(target.origin!==requestOrigin)throw denied('PATH_INVALID');
 return target;
}
export function previewRedirectAllowed(location,path='/'){
 // Preserve relative redirects against the fixed external URL. Never send a
 // browser to an absolute localhost/foreign URL returned by a Worker.
 try{return new URL(location,new URL(path,previewOrigin)).origin===previewOrigin;}catch{return false;}
}
export function previewHeaders(req){
 const headers=new Headers(),connectionHeaders=new Set(String(req.headers.connection||'').toLowerCase().split(',').map(s=>s.trim()));
 // Ignore transport credentials/forwarding claims, never impersonate a user.
 for(const [name,value]of Object.entries(req.headers))if(value!==undefined&&!dropHeaders.has(name)&&!connectionHeaders.has(name)&&!name.startsWith('x-forwarded-')&&!name.startsWith('x-github-')&&!name.startsWith('x-original-'))headers.set(name,Array.isArray(value)?value.join(', '):value);
 return headers;
}
function sendError(res,status,diagnostic=null){
 if(res.headersSent){res.destroy();return;}
 res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','connection':'close'});
 res.end(JSON.stringify({...(status===403&&diagnostic?diagnostic:{}),error:status===413?'Synthetic preview request is too large.':status===405?'Method not supported.':status===403?'Synthetic preview rejected this private transport; check the code and safe transport labels.':'Synthetic preview could not confirm this response. A write may have committed; keep the same retry attempt.'}));
}
// Tests use an ephemeral port, while the explicit Codespace CLI uses only5173.
export async function codespacePrivatePreview({port=0}={}){
 configuration();
 if(![0,5173].includes(port))throw Error('Only ephemeral test port or fixed private5173 is supported.');
 const qa=await dailyOutputLoopback();
 const server=createServer(async(req,res)=>{
  try{
   const target=previewTarget(req),headers=previewHeaders(req);
   let size=0;const chunks=[];
   if(!safeMethods.has(req.method)){
    const length=req.headers['content-length'];
    if(length!==undefined&&(!/^\d+$/.test(length)||Number(length)>maximumBody)){sendError(res,413);req.resume();return;}
    for await(const chunk of req){size+=chunk.length;if(size>maximumBody){sendError(res,413);req.resume();return;}chunks.push(chunk);}
   }
   // dispatchFetch preserves the validated transport URL. Received Origin and
   // cookies stay untouched; Worker same-origin/auth/permission checks still run.
   const response=await qa.runtime.dispatchFetch(target.href,{method:req.method,headers,redirect:'manual',...(!safeMethods.has(req.method)?{body:Buffer.concat(chunks)}:{})});
   const location=response.headers.get('location');
   if(location&&!previewRedirectAllowed(location,req.url)){await response.body?.cancel();sendError(res,502);return;}
   res.statusCode=response.status;
   for(const [name,value]of response.headers)if(name!=='set-cookie'&&!dropHeaders.has(name))res.setHeader(name,value);
   const cookies=response.headers.getSetCookie();if(cookies.length)res.setHeader('set-cookie',cookies);
   const vary=response.headers.get('vary');if(vary!=='*')res.setHeader('Vary',[vary,'Origin','Sec-Fetch-Site'].filter(Boolean).join(', '));
   res.setHeader('X-ONSPA-Preview','SYNTHETIC; volatile DB/FILES; no production');
   if(req.method==='HEAD'){await response.body?.cancel();res.end();return;}
   if(!response.body){res.end();return;}
   await pipeline(Readable.from(response.body),res);
  }catch(error){sendError(res,[403,405,413].includes(error?.status)?error.status:502,error?.status===403?previewDiagnostic(req,error.code):null);}
 });
 server.on('upgrade',(_req,socket)=>{socket.end('HTTP/1.1 405 Method Not Allowed\r\nConnection: close\r\n\r\n');});
 try{
  await new Promise((accept,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',accept);});
 }catch(error){await qa.close();throw error;}
 return {...qa,server,url:`http://127.0.0.1:${server.address().port}`,previewOrigin,externalAccessVerified:false,
  close:async()=>{await new Promise((accept,reject)=>{server.close(error=>error?reject(error):accept());server.closeIdleConnections();});await qa.close();}};
}
async function build(){await new Promise((accept,reject)=>{const child=spawn(process.execPath,['scripts/local/run.mjs','build'],{cwd:root,stdio:'inherit',env:{...process.env,CLOUDFLARE_CF_FETCH_ENABLED:'false',WRANGLER_SEND_METRICS:'false'}});child.once('error',reject);child.once('exit',code=>code===0?accept():reject(Error('Build failed; preview was not started.')));});}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 if(process.argv.length!==3||process.argv[2]!=='--synthetic-codespace-private'||process.env.CODESPACE_NAME!==previewCodespace)throw Error('Explicit synthetic opt-in in the existing approved Codespace is required. No new Codespace is created.');
 configuration();
 // Rebuild this checkout before serving: never silently use a stale saved build.
 await build();
 const qa=await codespacePrivatePreview({port:5173});
 console.log(JSON.stringify({previewOrigin,externalAccessVerified:false,synthetic:true,volatileDatabase:true,files:'volatile local R2',accounts:qa.accounts,password:qa.password,limits:'Keep port5173 Private. Verify source SHA and browser access separately before sharing. Ordinary synthetic auth, no Admin injection or cookie rewrite; no real Google/production acceptance. Stop loses only this synthetic fixture.'}));
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await qa.close();process.exit(0);});
}
