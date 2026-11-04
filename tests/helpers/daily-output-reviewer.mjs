import {siteApi} from '../../worker/site-api.mjs';
import {tokenHash} from '../../worker/password-auth.mjs';
export async function reviewer({db,bucket,put},handler=siteApi){
 const login='SYNTHETIC-REVIEWER',token='e'.repeat(64);await put('users',login,{login,role:'SUPER_ADMIN',active:true});
 await db.batch([db.prepare('INSERT INTO auth_accounts VALUES(?,?,?,?,1,?)').bind(login,'unused-synthetic','unused-salt',100000,'SYNTHETIC'),db.prepare('INSERT INTO auth_sessions VALUES(?,?,?,?,NULL,?)').bind(await tokenHash(token),login,1,Date.now()+600000,'SYNTHETIC')]);
 return async(path,body)=>{const r=await handler(new Request('https://test.invalid'+path,{method:body?'POST':'GET',headers:{cookie:'__Host-onspa_session='+token,...(body?{origin:'https://test.invalid','content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})}),{DB:db,FILES:bucket});return {status:r.status,body:await r.json()};};
}
