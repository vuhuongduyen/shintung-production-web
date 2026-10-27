import {isSuperAdmin,storeFile} from '../lib/file-store.mjs';
import type {D1Database,R2Bucket} from '@cloudflare/workers-types';

type Bindings={DB:D1Database;FILES:R2Bucket};
// Principal must come from verified server authentication, never body.updatedBy/login headers.
export function fileService(env:Bindings){
 if(!env.DB?.prepare||!env.FILES?.put)throw Error('Missing DB / FILES bindings');
 async function authorize(principal:{login:string}|null){if(!await isSuperAdmin(env.DB,principal))throw Error('Super Admin authentication required');return principal!.login;}
 return {
  async upload(input:Parameters<typeof storeFile>[2],principal:{login:string}|null){return storeFile(env.DB,env.FILES,input,await authorize(principal));},
  async download(id:string,principal:{login:string}|null){await authorize(principal);const metadata=await env.DB.prepare('SELECT * FROM file_objects WHERE file_id=?').bind(id).first<{object_key:string;original_name:string}>();if(!metadata)return null;const object=await env.FILES.get(metadata.object_key);return object?{metadata,object}:null;},
 };
}
