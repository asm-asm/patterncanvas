const enc = new TextEncoder();
export const hex = bytes => [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
export function randomLicense() {
  const value=hex(crypto.getRandomValues(new Uint8Array(20))).toUpperCase();
  return `PC-IOS-${value.match(/.{4}/g).join('-')}`;
}
export function normalizeLicense(value) {
  if(typeof value!=='string'||value.length>100)return null;
  const compact=value.trim().toUpperCase().replace(/[\s-]/g,'');
  return /^PCIOS[0-9A-F]{40}$/.test(compact)?`PC-IOS-${compact.slice(5).match(/.{4}/g).join('-')}`:null;
}
export async function digest(secret,value) {
  if(!secret||secret.length<32)throw Error('Secret not configured');
  const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return hex(new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(value))));
}
async function encryptionKey(secret) {
  if(!/^[0-9a-f]{64}$/i.test(secret||''))throw Error('Encryption not configured');
  return crypto.subtle.importKey('raw',Uint8Array.from(secret.match(/../g),b=>parseInt(b,16)),'AES-GCM',false,['encrypt','decrypt']);
}
export async function seal(secret,value,aad) {
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode(aad)},await encryptionKey(secret),enc.encode(value));
  return `${hex(iv)}.${hex(new Uint8Array(cipher))}`;
}
export async function unseal(secret,value,aad) {
  const [iv,cipher]=value.split('.').map(v=>Uint8Array.from(v.match(/../g),b=>parseInt(b,16)));
  return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:enc.encode(aad)},await encryptionKey(secret),cipher));
}
