import type {D1Database,R2Bucket} from '@cloudflare/workers-types';
export function isSuperAdmin(db:D1Database,session:{login:string}|null):Promise<boolean>;
export function storeFile(db:D1Database,bucket:R2Bucket,input:{module:string;name:string;recordId:string;base64:string;contentType?:string},actor:string):Promise<{file_id:string;object_key:string;original_name:string;content_type:string;size:number;module:string;record_id:string;uploaded_by:string;uploaded_at:string;checksum:string;status:string}>;
