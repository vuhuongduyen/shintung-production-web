// getRandomValues also works in HTTP development previews.
export function productionRequestId() {
 if(typeof globalThis.crypto?.randomUUID==='function')return globalThis.crypto.randomUUID();
 const bytes=new Uint8Array(16);globalThis.crypto.getRandomValues(bytes);
 return [...bytes].map(v=>v.toString(16).padStart(2,'0')).join('');
}
