import { CAPABILITIES, type CapabilityName } from '@/lib/capabilities'
import { authHeaders } from '@/lib/auth'

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

/** Thrown when a feature has no backend endpoint yet. UI maps this to an "awaiting backend" state. */
export class BackendUnavailableError extends Error {
  readonly capability: CapabilityName
  constructor(capability: CapabilityName) {
    super(`The backend does not support "${capability}" yet.`)
    this.name = 'BackendUnavailableError'
    this.capability = capability
  }
}

export class ApiError extends Error {
  readonly status: number
  readonly code?: string
  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export function assertSupported(capability: CapabilityName): void {
  if (!CAPABILITIES[capability]) throw new BackendUnavailableError(capability)
}

type RequestOptions = { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown; signal?: AbortSignal }

/** JSON request helper with normalized errors. Never logs URLs, bodies or responses. */
export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: opts.method ?? 'GET',
      headers: { ...await authHeaders(), ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: 'omit',
      signal: opts.signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new ApiError('Unable to reach the SafeSend API.', 0)
  }
  let data: unknown = null
  try { data = await res.json() } catch { /* non-JSON body */ }
  const body = (data ?? {}) as { message?: string; code?: string }
  if (!res.ok) throw new ApiError(body.message || `Request failed (HTTP ${res.status}).`, res.status, body.code)
  return data as T
}
