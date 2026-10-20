import { API_URL } from './client'

export type ProbeResult = { ok: boolean; latencyMs: number | null; checkedAt: string; message: string }

async function probe(path: string, okMessage: string, failMessage: string): Promise<ProbeResult> {
  const started = performance.now()
  const checkedAt = new Date().toISOString()
  try {
    const res = await fetch(`${API_URL}${path}`, { cache: 'no-store' })
    const latencyMs = Math.round(performance.now() - started)
    const ok = res.ok
    return { ok, latencyMs, checkedAt, message: ok ? okMessage : failMessage }
  } catch {
    return { ok: false, latencyMs: null, checkedAt, message: 'Unreachable from this browser.' }
  }
}

/** GET /api/health — latency is measured in this browser, not reported by the server. */
export const probeApiHealth = () => probe('/api/health', 'API responded normally.', 'API responded with an error.')
/** GET /api/test-db — only the reachable/unreachable verdict is surfaced, never infrastructure detail. */
export const probeDatabase = () => probe('/api/test-db', 'Data store reachable.', 'Data store check failed.')
