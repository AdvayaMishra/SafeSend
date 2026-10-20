import assert from 'node:assert/strict'
const store = new Map<string, string>()
;(globalThis as any).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) }

const { effectiveStatus, eventCategory, policySummary } = await import('../lib/secret-insights.ts')
const { addToRegistry, listRegistry, removeFromRegistry } = await import('../lib/secret-registry.ts')
const { bucketize, inRange } = await import('../components/charts.tsx')
const { BackendUnavailableError } = await import('../lib/api/client.ts')
const { listPasskeys } = await import('../lib/api/account.ts')
const { assertSupported } = await import('../lib/api/client.ts')

const base = { id: 'a', createdAt: '2026-10-20T00:00:00Z', expiresAt: '2099-01-01T00:00:00Z', accessStart: null, accessEnd: null, maxViews: 3, viewCount: 1, viewOnce: false, failedAttempts: 0, cooldownUntil: null, status: 'active', destroyedAt: null }
const now = Date.parse('2026-10-20T12:00:00Z')

// status derivation
assert.equal(effectiveStatus(base, now), 'active')
assert.equal(effectiveStatus({ ...base, status: 'destroyed' }, now), 'destroyed')
assert.equal(effectiveStatus({ ...base, expiresAt: '2026-10-20T11:00:00Z' }, now), 'expired')
assert.equal(effectiveStatus({ ...base, cooldownUntil: '2026-10-20T13:00:00Z' }, now), 'cooling down')
assert.equal(effectiveStatus({ ...base, accessStart: '2026-10-21T00:00:00Z' }, now), 'scheduled')
// destroyed beats everything
assert.equal(effectiveStatus({ ...base, destroyedAt: '2026-10-20T01:00:00Z', cooldownUntil: '2099-01-01T00:00:00Z' }, now), 'destroyed')

// categories & policy text
assert.equal(eventCategory('FAILED_PASSWORD'), 'Authentication')
assert.equal(eventCategory('SOMETHING_NEW'), 'Other')
assert.deepEqual(policySummary(base), ['1/3 views'])
assert.deepEqual(policySummary({ ...base, viewOnce: true }), ['View once'])
assert.match(policySummary({ ...base, maxViews: null })[0], /unlimited/)

// registry stores ids only, dedupes, removes
addToRegistry('x1'); addToRegistry('x2'); addToRegistry('x1')
assert.deepEqual(listRegistry().map(e => e.id), ['x1', 'x2'])
assert.ok(!JSON.stringify([...store.values()]).includes('#'), 'registry must never hold link fragments')
removeFromRegistry('x1')
assert.deepEqual(listRegistry().map(e => e.id), ['x2'])
store.set('secureShareSecretRegistry', 'not json'); assert.deepEqual(listRegistry(), [])

// bucketing: counts preserved, out-of-range dropped
const items = [
  { at: new Date(now - 1000).toISOString(), kind: 'a' as const }, { at: new Date(now - 2 * 864e5).toISOString(), kind: 'b' as const },
  { at: new Date(now - 40 * 864e5).toISOString(), kind: 'a' as const },
]
const b7 = bucketize(items, '7d', now)
assert.equal(b7.length, 7); assert.equal(b7.reduce((s, x) => s + x.a + x.b, 0), 2)
assert.equal(bucketize(items, '24h', now).length, 24)
assert.equal(bucketize(items, 'all', now).reduce((s, x) => s + x.a + x.b, 0), 3)
assert.equal(inRange(new Date(now - 1000).toISOString(), '24h', now), true)
assert.equal(inRange(new Date(now - 3 * 864e5).toISOString(), '24h', now), false)

// unsupported features must refuse to call the network
await assert.rejects(() => Promise.resolve().then(() => listPasskeys()), BackendUnavailableError)
assert.throws(()=>assertSupported('observabilityMetrics'),BackendUnavailableError)
console.log('insights tests passed')
