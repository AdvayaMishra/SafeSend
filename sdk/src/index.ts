export type Policy={expiresAt:string;maxViews?:number;burnAfterRead?:boolean;password?:string;accessStart?:string;accessEnd?:string;recipientEmail?:string;workspaceId?:string}
function b64(bytes:Uint8Array) {let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(text)}
const bytes=(s:string)=>Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0))
export class SecureShareClient {
  constructor(private apiUrl:string,private shareOrigin:string,private apiKey?:string) {}
  private async request(path:string,body?:unknown,headers:Record<string,string>={},method='POST') {
    const response=await fetch(`${this.apiUrl.replace(/\/$/,'')}/api/v1/secrets${path}`,{method,
      headers:{...(this.apiKey?{Authorization:`Bearer ${this.apiKey}`} :{}),...headers,...(body?{'Content-Type':'application/json'}:{})},
      body:body?JSON.stringify(body):undefined});
    const data=await response.json();if(!response.ok)throw new Error(data.message??`Request failed (${response.status})`);return data
  }
  async create(plaintext:string,policy:Policy) {
    const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt','decrypt'])
    const iv=crypto.getRandomValues(new Uint8Array(12))
    const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(plaintext))
    const result=await this.request('',{encryptedContent:b64(new Uint8Array(encrypted)),iv:b64(iv),
      expiresAt:policy.expiresAt,maxViews:policy.maxViews,burnAfterRead:policy.burnAfterRead,password:policy.password,
      accessStart:policy.accessStart,accessEnd:policy.accessEnd,recipientEmail:policy.recipientEmail,workspaceId:policy.workspaceId})
    const jwk=await crypto.subtle.exportKey('jwk',key)
    return {secretId:result.secretId,shareUrl:`${this.shareOrigin.replace(/\/$/,'')}/share/${result.secretId}#${jwk.k}`,managementToken:result.managementToken}
  }
  async open(shareUrl:string,password?:string) {
    const url=new URL(shareUrl),id=url.pathname.split('/').at(-1),fragment=url.hash.slice(1)
    if(!id||!/^[0-9a-f-]{36}$/i.test(id)||!fragment)throw new Error('Invalid SecureShare link')
    const key=await crypto.subtle.importKey('jwk',{kty:'oct',k:fragment,alg:'A256GCM',ext:true},{name:'AES-GCM'},false,['decrypt'])
    const result=await this.request(`/${id}/access`,{password})
    const decrypted=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(result.iv)},key,bytes(result.encryptedContent))
    return {plaintext:new TextDecoder().decode(decrypted),accessToken:result.accessToken}
  }
  async revoke(id:string,managementToken?:string) {
    if(!/^[0-9a-f-]{36}$/i.test(id))throw new Error('Invalid secret ID')
    return this.request(`/${id}/revoke`,undefined,managementToken?{'X-Management-Token':managementToken}:{})
  }
}
