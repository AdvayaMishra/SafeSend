'use client'
/** Live passkey management. Rendered only when CAPABILITIES.passkeys is true. */
import { useEffect, useState } from 'react'
import { Button, Field } from '@/components/shared'
import { ErrorNote, Loading, Panel } from '@/components/ui-kit'
import { describePasskeyError, listPasskeys, registerPasskey, removePasskey, type PasskeySummary } from '@/lib/api/account'

export function PasskeysLive() {
  const [keys, setKeys] = useState<PasskeySummary[] | null>(null)
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const load = () => listPasskeys().then(r => setKeys(r.passkeys)).catch(e => setError(e instanceof Error ? e.message : 'Failed to load passkeys.'))
  useEffect(() => { void load() }, [])
  const add = async () => { setBusy(true); setError(''); try { await registerPasskey(label.trim()); setLabel(''); await load() } catch (e) { setError(describePasskeyError(e)) } finally { setBusy(false) } }
  const remove = async (id: string) => { setError(''); try { await removePasskey(id); await load() } catch (e) { setError(e instanceof Error ? e.message : 'Could not remove passkey.') } }
  if (!keys && !error) return <Loading label="LOADING PASSKEYS"/>
  return <Panel title="Your passkeys" kicker="CREDENTIALS">
    {error && <ErrorNote>{error}</ErrorNote>}
    <ul className="mt-4 grid gap-3">{(keys ?? []).map(k => <li key={k.id} className="flex items-center justify-between gap-3 border border-[#213858] p-4 text-sm"><span>{k.label}<span className="ml-3 font-mono text-[10px] text-[#64748b]">added {new Date(k.createdAt).toLocaleDateString()}{k.lastUsedAt ? ` · last used ${new Date(k.lastUsedAt).toLocaleDateString()}` : ''}</span></span>
      <button type="button" onClick={() => remove(k.id)} disabled={keys?.length === 1} title={keys?.length === 1 ? 'Add another passkey before removing your last one.' : undefined} className="font-mono text-[10px] tracking-widest text-[#fca5a5] disabled:opacity-40">REMOVE</button></li>)}</ul>
    <div className="mt-6 grid max-w-md gap-4"><Field label="Device label" hint="For example: Work laptop, Phone."><input value={label} onChange={e => setLabel(e.target.value)} maxLength={60} className="border px-3 py-3 text-sm outline-none"/></Field><Button onClick={add} disabled={busy || !label.trim()}>{busy ? 'WAITING FOR DEVICE…' : 'ADD PASSKEY'}</Button></div>
  </Panel>
}
