import { createClient, type SupabaseClient } from '@supabase/supabase-js'
let client: SupabaseClient | undefined
export function authClient() {
  if (!client) {
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL
    const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    if(!url||!key) throw new Error('Account authentication is not configured.')
    client=createClient(url,key,{auth:{experimental:{passkey:true}}})
  }
  return client
}
export async function authHeaders(secretId?: string): Promise<Record<string,string>> {
  const headers: Record<string,string>={}
  if(typeof window==='undefined') return headers
  if(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    const {data:{session}}=await authClient().auth.getSession()
    if(session) headers.Authorization=`Bearer ${session.access_token}`
  }
  if(secretId) {
    try { const capability=sessionStorage.getItem(`secureShareManagement:${secretId}`)
      if(capability) headers['X-Management-Token']=capability } catch {}
  }
  try{const workspace=sessionStorage.getItem('secureShareWorkspaceId');if(workspace)headers['X-Workspace-ID']=workspace}catch{}
  return headers
}
export function rememberManagement(id:string,value:string) {
  try { sessionStorage.setItem(`secureShareManagement:${id}`,value) } catch {}
}
