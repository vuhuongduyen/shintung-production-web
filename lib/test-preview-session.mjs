// Read server-validated preview identity only. Never read/persist browser tokens or credentials.
export async function readTestPreviewSession(request=fetch){
 const response=await request('/api/test-session',{method:'GET',cache:'no-store',credentials:'same-origin'});
 if(!response.ok)return null;
 const data=await response.json();
 return data?.reviewPreview===true&&data.authenticated===true&&typeof data.name==='string'&&data.name.trim()?data.name:null;
}
