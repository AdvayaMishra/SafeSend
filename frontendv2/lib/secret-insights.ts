import { getDashboardData } from '@/lib/secure-share'
import { listRegistry } from '@/lib/secret-registry'
import {authHeaders} from '@/lib/auth'
import {API_URL} from '@/lib/api/client'

export type SecretRecord = {
  id: string; createdAt: string; expiresAt: string | null; accessStart: string | null; accessEnd: string | null
  maxViews: number | null; viewCount: number; viewOnce: boolean; failedAttempts: number
  cooldownUntil: string | null; status: string; destroyedAt: string | null
  isSuspended?: boolean
  canManage?: boolean
}
export type SecretEvent = { id?: string | number; event_type: string; created_at: string }
export type LoadedSecret = { secret: SecretRecord; events: SecretEvent[] }
export type RegistryLoad = { loaded: LoadedSecret[]; failed: Array<{ id: string; message: string }>; registered: number }

/** Fetches the real dashboard payload for every secret created in this browser. No data is synthesized. */
export async function loadRegistrySecrets(): Promise<RegistryLoad> {
  const entries = listRegistry()
  const headers=await authHeaders()
  let accountError=''
  if(headers.Authorization) {
    try {const response=await fetch(`${API_URL}/api/secrets`,{headers});const data=await response.json()
      if(!response.ok)throw new Error(data.message??'Account secrets could not be loaded.')
      for(const record of data.secrets??[])if(!entries.some(e=>e.id===record.id))entries.push({id:record.id,createdAt:''})
      if(data.truncated)accountError='Account history is capped at 1,000 accessible secrets.'
    }catch(error){accountError=error instanceof Error?error.message:'Account history could not be loaded.'}
  }
  const results = await Promise.allSettled(entries.map(e => getDashboardData(e.id)))
  const loaded: LoadedSecret[] = []
  const failed: RegistryLoad['failed'] = []
  if(accountError)failed.push({id:'account',message:accountError})
  results.forEach((r, i) => {
    const id = entries[i].id
    if (r.status === 'fulfilled' && r.value?.success) loaded.push({ secret: r.value.secret as SecretRecord, events: (r.value.events ?? []) as SecretEvent[] })
    else failed.push({ id, message: r.status === 'fulfilled' ? (r.value?.message || 'Unavailable') : 'Could not reach the server' })
  })
  return { loaded, failed, registered: entries.length }
}

export type EventCategory = 'Lifecycle' | 'Access' | 'Authentication' | 'Protection' | 'Other'
export const EVENT_CATEGORIES: EventCategory[] = ['Lifecycle', 'Access', 'Authentication', 'Protection', 'Other']

const CATEGORY_BY_TYPE: Record<string, EventCategory> = {
  MESSAGE_CREATED: 'Lifecycle', MESSAGE_EXPIRED: 'Lifecycle', MESSAGE_DESTROYED: 'Lifecycle',
  ACCESS_SUCCESS: 'Access', FAILED_PASSWORD: 'Authentication', COOLDOWN_STARTED: 'Protection',
}
export const eventCategory = (type: string): EventCategory => CATEGORY_BY_TYPE[type] ?? 'Other'
export const eventLabel = (type: string) => type.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase())
export const isFailureEvent = (type: string) => type === 'FAILED_PASSWORD' || type === 'COOLDOWN_STARTED'

export type EffectiveStatus = 'active' | 'scheduled' | 'cooling down' | 'expired' | 'destroyed' | 'revoked' | 'suspended'
export function effectiveStatus(s: SecretRecord, now = Date.now()): EffectiveStatus {
  if(s.status==='revoked')return 'revoked'
  if (s.status === 'destroyed' || s.destroyedAt) return 'destroyed'
  if (s.status === 'expired' || (s.expiresAt && new Date(s.expiresAt).getTime() <= now)) return 'expired'
  if(s.isSuspended)return 'suspended'
  if (s.cooldownUntil && new Date(s.cooldownUntil).getTime() > now) return 'cooling down'
  if (s.accessStart && new Date(s.accessStart).getTime() > now) return 'scheduled'
  return 'active'
}

export function policySummary(s: SecretRecord): string[] {
  const parts: string[] = []
  parts.push(s.viewOnce ? 'View once' : s.maxViews ? `${s.viewCount}/${s.maxViews} views` : `${s.viewCount} views (unlimited)`)
  if (s.accessStart) parts.push(`Opens ${new Date(s.accessStart).toLocaleString()}`)
  if (s.accessEnd) parts.push(`Closes ${new Date(s.accessEnd).toLocaleString()}`)
  return parts
}
