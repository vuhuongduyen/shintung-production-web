import {env} from 'cloudflare:workers';
import {siteApi} from '../../../../worker/site-api.mjs';
// Health checks only list metadata. Never create/delete objects on a GET.
export async function GET(request: Request) {return siteApi(request,env);}
