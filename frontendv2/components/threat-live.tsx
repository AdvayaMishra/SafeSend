'use client'
/** Live threat view. Rendered only when CAPABILITIES.threatIntelligence is true; every value comes from the API. */
import { useEffect, useState } from 'react'
import { ErrorNote, Loading, Panel, StatCard, StatGrid, StatusBadge } from '@/components/ui-kit'
import { getThreatOverview, type Severity, type ThreatIncident, type ThreatOverview } from '@/lib/api/security'

const SEVERITIES: Severity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
const tone = (s: Severity) => (s === 'LOW' ? 'info' : s === 'MEDIUM' ? 'warn' : 'bad') as 'info' | 'warn' | 'bad'

export function ThreatLive() {
  const [data, setData] = useState<ThreatOverview | null>(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<Severity | 'ALL'>('ALL')
  const [selected, setSelected] = useState<ThreatIncident | null>(null)
  useEffect(() => { getThreatOverview('7d').then(setData).catch(e => setError(e instanceof Error ? e.message : 'Failed to load threat data.')) }, [])
  if (error) return <ErrorNote>{error}</ErrorNote>
  if (!data) return <Loading label="LOADING THREAT OVERVIEW"/>
  const incidents = data.incidents.filter(i => filter === 'ALL' || i.severity === filter)
  return <>
    {data.truncated&&<p className="text-sm text-[#fbbf24]">Results are capped. Risk and incident counts describe the loaded records.</p>}
    <StatGrid>
      <StatCard label="Risk score" value={`${data.riskScore} / 100`}/>
      <StatCard label="Risk level" value={data.riskLevel}/>
      <StatCard label="Incidents" value={String(data.incidents.length)}/>
      <StatCard label="Active defenses" value={String(data.activeDefenses.length)}/>
    </StatGrid>
    <Panel title="Incidents" kicker="THREAT HISTORY" action={<select aria-label="Filter by severity" value={filter} onChange={e => setFilter(e.target.value as Severity | 'ALL')} className="border border-[#213858] bg-[#061225] px-3 py-2 text-sm"><option value="ALL">All severities</option>{SEVERITIES.map(s => <option key={s}>{s}</option>)}</select>}>
      {incidents.length === 0 ? <p className="text-sm text-[#64748b]">No incidents match this filter.</p> : <ul className="grid gap-3">{incidents.map(i => <li key={i.id}><button type="button" onClick={() => setSelected(i)} className="flex w-full items-center justify-between gap-3 border border-[#213858] p-4 text-left hover:border-[#3b82f6]"><span className="text-sm">{i.summary}</span><StatusBadge tone={tone(i.severity)}>{i.severity}</StatusBadge></button></li>)}</ul>}
    </Panel>
    {selected && <Panel title={selected.summary} kicker={`INCIDENT · ${selected.rule}`} action={<button type="button" onClick={() => setSelected(null)} className="font-mono text-[10px] tracking-widest text-[#38bdf8]">CLOSE</button>}>
      <p className="text-sm leading-6 text-[#cbd5e1]">{selected.explanation}</p>
      <p className="mt-4 font-mono text-[10px] text-[#64748b]">{new Date(selected.occurredAt).toLocaleString()}{selected.actionTaken ? ` · Action: ${selected.actionTaken}` : ''}</p>
    </Panel>}
    <Panel title="Active defensive actions" kicker="RESTRICTIONS">{data.activeDefenses.length === 0 ? <p className="text-sm text-[#64748b]">None active.</p> : <ul className="grid gap-2 text-sm">{data.activeDefenses.map(d => <li key={d.id}>{d.label}{d.expiresAt ? ` — until ${new Date(d.expiresAt).toLocaleString()}` : ''}</li>)}</ul>}</Panel>
    <Panel title="Detection rules" kicker="HOW RISK IS DETERMINED"><ul className="grid gap-4">{data.rules.map(r => <li key={r.id}><p className="text-sm font-medium">{r.title}</p><p className="mt-1 text-sm leading-6 text-[#94a3b8]">{r.description}</p></li>)}</ul></Panel>
  </>
}
