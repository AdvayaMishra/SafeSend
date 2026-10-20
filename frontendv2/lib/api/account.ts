import {apiRequest,assertSupported} from './client'
import {authClient} from '@/lib/auth'
export type ApiScope='secrets:create'|'secrets:read'|'secrets:revoke'|'audit:read'
export type ApiKeySummary={id:string;name:string;prefix:string;scopes:ApiScope[];createdAt:string;lastUsedAt:string|null;revokedAt:string|null}
export const listApiKeys=()=>{assertSupported('apiKeys');return apiRequest<{keys:ApiKeySummary[]}>('/api/keys')}
export const createApiKey=(name:string,scopes:ApiScope[])=>{assertSupported('apiKeys');return apiRequest<{key:string;summary:ApiKeySummary}>('/api/keys',{method:'POST',body:{name,scopes}})}
export const revokeApiKey=(id:string)=>{assertSupported('apiKeys');return apiRequest<{success:boolean}>(`/api/keys/${id}`,{method:'DELETE'})}
export const rotateApiKey=(id:string)=>apiRequest<{key:string;summary:ApiKeySummary}>(`/api/keys/${id}/rotate`,{method:'POST'})

// Native Supabase Auth WebAuthn integration. Kept gated until project RP settings
// and an actual authenticator ceremony have been verified. No duplicate key store.
export type PasskeySummary={id:string;label:string;createdAt:string;lastUsedAt:string|null}
const passkey=(value:{id:string;friendly_name?:string;created_at:string;last_used_at?:string}):PasskeySummary=>({
  id:value.id,label:value.friendly_name??'Passkey',createdAt:value.created_at,lastUsedAt:value.last_used_at??null})
export async function listPasskeys() {
  assertSupported('passkeys');const {data,error}=await authClient().auth.passkey.list();if(error)throw error
  return {passkeys:(data??[]).map(passkey)}
}
export async function removePasskey(id:string) {
  assertSupported('passkeys');const {error}=await authClient().auth.passkey.delete({passkeyId:id});if(error)throw error
  return {success:true}
}
export async function registerPasskey(label:string) {
  assertSupported('passkeys');const client=authClient();const {data,error}=await client.auth.registerPasskey()
  if(error)throw error
  if(label){const renamed=await client.auth.passkey.update({passkeyId:data.id,friendlyName:label});if(renamed.error)throw renamed.error;return passkey(renamed.data)}
  return passkey(data)
}
export async function signInWithPasskey() {
  assertSupported('passkeys');const {data,error}=await authClient().auth.signInWithPasskey();if(error)throw error;return data
}
export async function detectWebAuthn():Promise<{webauthn:boolean;platformAuthenticator:boolean}> {
  if(typeof window==='undefined'||!('PublicKeyCredential' in window))return {webauthn:false,platformAuthenticator:false}
  try{return {webauthn:true,platformAuthenticator:await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()}}
  catch{return {webauthn:true,platformAuthenticator:false}}
}
export function describePasskeyError(error:unknown) {
  const name=error instanceof DOMException?error.name:''
  if(name==='NotAllowedError')return 'The device request was cancelled or timed out.'
  if(name==='SecurityError')return 'Passkeys require the configured secure origin.'
  return error instanceof Error?error.message:'Passkey request failed.'
}
