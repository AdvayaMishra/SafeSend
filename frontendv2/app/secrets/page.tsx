'use client'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { PageShell, Panel, SelectBox, StatusBadge, EmptyState, PendingBackend } from '@/components/ui-kit'
import { RegistryGate } from '@/components/registry-state'
import { EventList } from '@/components/event-list'
import { useRegistrySecrets } from '@/lib/use-registry-secrets'
import { removeFromRegistry } from '@/lib/secret-registry'
import { effectiveStatus, policySummary, type EffectiveStatus } from '@/lib/secret-insights'
import { authHeaders } from '@/lib/auth'
import { API_URL } from '@/lib/api/client'

const TONE: Record<EffectiveStatus, 'ok' | 'warn' | 'bad' | 'info'> = { active: 'ok', scheduled: 'info', 'cooling down': 'warn', expired: 'bad', destroyed: 'bad',revoked:'bad',suspended:'warn' }

export default function SecretsPage() {
  const { status, data, reload } = useRegistrySecrets()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('newest')
  const [actionError,setActionError]=useState('')
  const policyAction=async(id:string,action:'revoke'|'suspend'|'resume')=>{
    setActionError('')
    try{const r=await fetch(`${API_URL}/api/secrets/${id}/${action==='revoke'?'revoke':'policy'}`,{
      method:action==='revoke'?'POST':'PATCH',headers:{...await authHeaders(id),'Content-Type':'application/json'},
      body:action==='revoke'?undefined:JSON.stringify({suspended:action==='suspend'})})
      if(!r.ok){const b=await r.json();throw new Error(b.message??'Policy update failed.')}
      await reload()
    }catch(e){setActionError(e instanceof Error?e.message:'Policy update failed.')}
  }

  const rows = useMemo(() => data.loaded
    .map(l => ({ ...l, state: effectiveStatus(l.secret) }))
    .filter(r => (filter === 'all' || r.state === filter) && (!query || r.secret.id.startsWith(query.trim())))
    .sort((a, b) => sort === 'newest' ? +new Date(b.secret.createdAt) - +new Date(a.secret.createdAt) : +new Date(a.secret.expiresAt ?? 0) - +new Date(b.secret.expiresAt ?? 0)), [data.loaded, query, filter, sort])

  return <PageShell kicker="Workspace / Secret management" title="Secret" accent="management." intro="Secrets created in this browser, with their live status and access policy. SafeSend never stores readable content, so a secret’s message cannot be recovered from here or from the server.">
    {actionError&&<p role="alert" className="text-sm text-[#fca5a5]">{actionError}</p>}
    <RegistryGate status={status} data={data}>
      <Panel title="Your secrets" kicker={`${rows.length} OF ${data.loaded.length}`} action={<button type="button" onClick={() => void reload()} className="font-mono text-[10px] tracking-widest text-[#38bdf8]">REFRESH</button>}>
        <div className="mb-6 flex flex-wrap gap-3">
          <input aria-label="Search by secret ID" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by secret ID" className="min-w-[200px] flex-1 border px-3 py-2 text-sm outline-none"/>
          <SelectBox label="Status" value={filter} onChange={setFilter} options={[['all', 'All statuses'], ['active', 'Active'], ['scheduled', 'Scheduled'], ['cooling down', 'Cooling down'], ['expired', 'Expired'], ['destroyed', 'Destroyed']]}/>
          <SelectBox label="Sort" value={sort} onChange={setSort} options={[['newest', 'Newest first'], ['expiry', 'Expiring soonest']]}/>
        </div>
        {rows.length === 0 ? <EmptyState title="No secrets match">Try clearing the search or status filter.</EmptyState> : <ul className="grid gap-4">{rows.map(r => <li key={r.secret.id} className="border border-[#213858] bg-[#0b172a]/60 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3"><StatusBadge tone={TONE[r.state]}>{r.state}</StatusBadge><span className="font-mono text-xs text-[#cbd5e1]">{r.secret.id}</span></div>
            <div className="flex gap-5 font-mono text-[10px] tracking-widest"><Link href={`/dashboard/${r.secret.id}`} className="text-[#38bdf8] hover:text-white">DASHBOARD</Link><button type="button" onClick={() => { removeFromRegistry(r.secret.id); void reload() }} className="text-[#64748b] hover:text-white" title="Removes this secret from the list in this browser only. It does not revoke or delete it.">STOP TRACKING</button></div>
          </div>
          <dl className="mt-4 grid gap-x-8 gap-y-2 text-xs text-[#94a3b8] sm:grid-cols-2">
            <div><dt className="inline text-[#64748b]">Policy: </dt><dd className="inline">{policySummary(r.secret).join(' · ')}</dd></div>
            <div><dt className="inline text-[#64748b]">Expires: </dt><dd className="inline">{r.secret.expiresAt ? new Date(r.secret.expiresAt).toLocaleString() : 'Not set'}</dd></div>
            <div><dt className="inline text-[#64748b]">Created: </dt><dd className="inline">{new Date(r.secret.createdAt).toLocaleString()}</dd></div>
            <div><dt className="inline text-[#64748b]">Failed attempts: </dt><dd className="inline">{r.secret.failedAttempts}</dd></div>
          </dl>
          {r.secret.canManage&&['active','scheduled','cooling down','suspended'].includes(r.state)&&<div className="mt-4 flex gap-5 text-xs"><button onClick={()=>void policyAction(r.secret.id,r.secret.isSuspended?'resume':'suspend')} className="text-[#38bdf8]">{r.secret.isSuspended?'RESUME':'SUSPEND'}</button><button onClick={()=>void policyAction(r.secret.id,'revoke')} className="text-[#fca5a5]">REVOKE</button></div>}
          <details className="mt-4"><summary className="cursor-pointer font-mono text-[10px] tracking-widest text-[#64748b] hover:text-white">ACTIVITY ({r.events.length})</summary><div className="mt-5"><EventList events={r.events.map(e => ({ ...e, secretId: r.secret.id }))} empty="No events recorded."/></div></details>
        </li>)}</ul>}
        <p className="mt-6 text-xs text-[#64748b]">“Stop tracking” only clears the entry from this browser’s list.</p>
      </Panel>
    </RegistryGate>
  </PageShell>
}
