'use client'
import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { PageShell, Panel, SelectBox } from '@/components/ui-kit'
import { RegistryGate } from '@/components/registry-state'
import { RangeTabs, inRange, type RangeKey } from '@/components/charts'
import { EventList, flattenEvents } from '@/components/event-list'
import { AuditIntegrity } from '@/components/audit-integrity'
import {AccountGate} from '@/components/account-gate'
import {AuditHistoryLive} from '@/components/audit-history-live'
import { useRegistrySecrets } from '@/lib/use-registry-secrets'
import { EVENT_CATEGORIES, eventCategory, eventLabel } from '@/lib/secret-insights'

function download(name: string, mime: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
const csvCell = (v: string) => `"${(/^[=+\-@]/.test(v) ? "'" + v : v).replace(/"/g, '""')}"`

export default function AuditPage() {
  const { status, data } = useRegistrySecrets()
  const [range, setRange] = useState<RangeKey>('all')
  const [category, setCategory] = useState('all')
  const [secretId, setSecretId] = useState('all')
  const [query, setQuery] = useState('')

  const all = useMemo(() => flattenEvents(data.loaded), [data.loaded])
  const events = useMemo(() => all.filter(e =>
    inRange(e.created_at, range) && (category === 'all' || eventCategory(e.event_type) === category) && (secretId === 'all' || e.secretId === secretId) &&
    (!query || eventLabel(e.event_type).toLowerCase().includes(query.toLowerCase()) || e.secretId.startsWith(query.trim()))), [all, range, category, secretId, query])

  const exportJson = () => download('secureshare-events.json', 'application/json', JSON.stringify({ exportedAt: new Date().toISOString(), note: 'Events as returned by the server. Not signed or integrity-verified.', events: events.map(e => ({ secretId: e.secretId, type: e.event_type, category: eventCategory(e.event_type), at: e.created_at })) }, null, 2))
  const exportCsv = () => download('secureshare-events.csv', 'text/csv', ['secret_id,type,category,timestamp', ...events.map(e => [e.secretId, e.event_type, eventCategory(e.event_type), e.created_at].map(csvCell).join(','))].join('\n'))

  return <PageShell kicker="Security / Audit logs" title="Audit" accent="logs." intro="Every lifecycle, access and protection event the backend has recorded for secrets created in this browser, with filtering and export.">
    <AccountGate><AuditIntegrity/><AuditHistoryLive/></AccountGate>
    <RegistryGate status={status} data={data}>
      <Panel title="Security event timeline" kicker={`${events.length} OF ${all.length} EVENTS`} action={<RangeTabs value={range} onChange={setRange}/>}>
        <div className="mb-8 flex flex-wrap items-center gap-3">
          <SelectBox label="Category" value={category} onChange={setCategory} options={[['all', 'All categories'], ...EVENT_CATEGORIES.map(c => [c, c] as [string, string])]}/>
          <SelectBox label="Secret" value={secretId} onChange={setSecretId} options={[['all', 'All secrets'], ...data.loaded.map(l => [l.secret.id, `${l.secret.id.slice(0, 8)}…`] as [string, string])]}/>
          <input aria-label="Search events" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search type or secret ID" className="min-w-[200px] flex-1 border px-3 py-2 text-sm outline-none"/>
          <button type="button" onClick={exportCsv} disabled={!events.length} className="flex items-center gap-2 border border-[#213858] px-3 py-2 font-mono text-[10px] tracking-widest text-[#38bdf8] disabled:opacity-50"><Download size={13}/>CSV</button>
          <button type="button" onClick={exportJson} disabled={!events.length} className="flex items-center gap-2 border border-[#213858] px-3 py-2 font-mono text-[10px] tracking-widest text-[#38bdf8] disabled:opacity-50"><Download size={13}/>JSON</button>
        </div>
        <EventList events={events}/>
        <p className="mt-8 text-xs leading-5 text-[#64748b]">Exports contain the filtered events above exactly as the server returned them. They are unsigned and carry no integrity guarantee.</p>
      </Panel>
    </RegistryGate>
  </PageShell>
}
