'use client'
/** Live API key management. Rendered only when CAPABILITIES.apiKeys is true. The raw key exists only in component state until dismissed; it is never persisted or re-fetched. */
import { useEffect, useState } from 'react'
import { Button, Field } from '@/components/shared'
import { ErrorNote, Loading, Panel, StatusBadge } from '@/components/ui-kit'
import { CodeBlock } from '@/components/code-block'
import { createApiKey, listApiKeys, revokeApiKey,rotateApiKey, type ApiKeySummary, type ApiScope } from '@/lib/api/account'

export const SCOPES: Array<[ApiScope, string]> = [['secrets:create', 'Create secrets'], ['secrets:read', 'Read secret status'], ['secrets:revoke', 'Revoke secrets'], ['audit:read', 'Read audit events']]

export function ApiKeysLive() {
  const [keys, setKeys] = useState<ApiKeySummary[] | null>(null)
  const [name, setName] = useState('')
  const [scopes, setScopes] = useState<ApiScope[]>(['secrets:create'])
  const [fresh, setFresh] = useState<string | null>(null)
  const [error, setError] = useState('')
  const load = () => listApiKeys().then(r => setKeys(r.keys)).catch(e => setError(e instanceof Error ? e.message : 'Failed to load keys.'))
  useEffect(() => { void load() }, [])
  const create = async () => { setError(''); try { const r = await createApiKey(name.trim(), scopes); setFresh(r.key); setName(''); await load() } catch (e) { setError(e instanceof Error ? e.message : 'Could not create key.') } }
  const revoke = async (id: string) => { setError(''); try { await revokeApiKey(id); await load() } catch (e) { setError(e instanceof Error ? e.message : 'Could not revoke key.') } }
  const rotate=async(id:string)=>{setError('');try{const r=await rotateApiKey(id);setFresh(r.key);await load()}catch(e){setError(e instanceof Error?e.message:'Could not rotate key.')}}
  if (!keys && !error) return <Loading label="LOADING API KEYS"/>
  return <Panel title="API keys" kicker="ACCESS">
    {error && <ErrorNote>{error}</ErrorNote>}
    {fresh && <div role="alert" className="mb-6 grid gap-3 border border-[#f59e0b]/40 bg-[#f59e0b]/5 p-4"><p className="text-sm text-[#fbbf24]">Copy this key now. It is shown only once and cannot be retrieved later.</p><CodeBlock code={fresh} label="NEW API KEY"/><Button secondary onClick={() => setFresh(null)} className="w-fit">I HAVE STORED IT</Button></div>}
    <ul className="grid gap-3">{(keys ?? []).map(k => <li key={k.id} className="flex flex-wrap items-center justify-between gap-3 border border-[#213858] p-4 text-sm"><span><span className="font-mono text-xs">{k.name} · {k.prefix}…</span><span className="ml-3 text-xs text-[#64748b]">{k.scopes.join(', ')}</span></span>{k.revokedAt ? <StatusBadge tone="bad">Revoked</StatusBadge> : <span className="flex gap-4"><button onClick={()=>void rotate(k.id)} className="font-mono text-[10px] text-[#38bdf8]">ROTATE</button><button type="button" onClick={() => revoke(k.id)} className="font-mono text-[10px] tracking-widest text-[#fca5a5]">REVOKE</button></span>}</li>)}</ul>
    <div className="mt-6 grid max-w-xl gap-4"><Field label="Key name"><input value={name} onChange={e => setName(e.target.value)} className="border px-3 py-3 text-sm outline-none"/></Field>
      <fieldset className="grid gap-2"><legend className="mb-1 font-mono text-[10px] uppercase tracking-[.16em] text-[#94a3b8]">Scopes</legend>{SCOPES.map(([s, d]) => <label key={s} className="flex items-center gap-3 text-sm text-[#cbd5e1]"><input type="checkbox" checked={scopes.includes(s)} onChange={e => setScopes(e.target.checked ? [...scopes, s] : scopes.filter(x => x !== s))}/>{d}<span className="font-mono text-[10px] text-[#64748b]">{s}</span></label>)}</fieldset>
      <Button onClick={create} disabled={!name.trim() || scopes.length === 0}>CREATE KEY</Button></div>
  </Panel>
}
