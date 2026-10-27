const secret=/(password|passwd|pwd|secret|token|credential|authorization|cookie|salt|api.?key|private.?key|base64|hash|mật.?khẩu|密碼)/i;
const skip=/^(history|audit|sourceSnapshots|currentData|file|files|content|html|binary)$/i;
// Bounded business input snapshots, never credentials or binary uploads.
export function auditSubmittedInput(value){
 let budget=24000,limited=false;
 function copy(v,depth=0){
  if(depth>7||budget<=0){limited=true;return '[Đã rút gọn]';}
  if(typeof v==='string'){const n=Math.min(2000,budget);budget-=Math.min(v.length,n);if(v.length>n)limited=true;return v.slice(0,n);}
  if(v===null||typeof v==='number'||typeof v==='boolean')return v;
  if(Array.isArray(v)){if(v.length>100)limited=true;return v.slice(0,100).map(x=>copy(x,depth+1));}
  if(v&&typeof v==='object'){const entries=Object.entries(v).filter(([k])=>!secret.test(k)&&!skip.test(k));if(entries.length>100)limited=true;return Object.fromEntries(entries.slice(0,100).map(([k,x])=>[k,copy(x,depth+1)]));}
  return null;
 }
 const fields=copy(value);return {fields,limited};
}
