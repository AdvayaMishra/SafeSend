/**
 * Browser-local list of secret IDs created in this browser.
 * Stores ONLY the public secret id and creation time — never keys, links, messages or passwords.
 */
const KEY = 'secureShareSecretRegistry'
export type RegistryEntry = { id: string; createdAt: string }

export function listRegistry(): RegistryEntry[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter((e): e is RegistryEntry => typeof e?.id === 'string' && typeof e?.createdAt === 'string')
  } catch { return [] }
}
export function addToRegistry(id: string): void {
  try {
    const next = [{ id, createdAt: new Date().toISOString() }, ...listRegistry().filter(e => e.id !== id)].slice(0, 100)
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch { /* storage unavailable */ }
}
export function removeFromRegistry(id: string): void {
  try {
    const remaining=listRegistry().filter(e=>e.id!==id)
    localStorage.setItem(KEY,JSON.stringify(remaining))
    if(localStorage.getItem('secureShareLastSecretId')===id) {
      if(remaining.length)localStorage.setItem('secureShareLastSecretId',remaining[0].id)
      else localStorage.removeItem('secureShareLastSecretId')
    }
  } catch { /* ignore */ }
}
