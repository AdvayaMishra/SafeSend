'use client'
import { useCallback, useEffect, useState } from 'react'
import { PageShell, Panel, StatCard, StatGrid, StatusBadge, PendingBackend, ToggleButton } from '@/components/ui-kit'
import { Button } from '@/components/shared'
import { probeApiHealth, probeDatabase, type ProbeResult } from '@/lib/api/ops'

type Check = { api: ProbeResult; db: ProbeResult }

export default function StatusPage() {
  const [history, setHistory] = useState<Check[]>([])
  const [busy, setBusy] = useState(false)
  const [auto, setAuto] = useState(false)

  const run = useCallback(async () => {
    setBusy(true)
    const [api, db] = await Promise.all([probeApiHealth(), probeDatabase()])
    setHistory(h => [{ api, db }, ...h].slice(0, 20))
    setBusy(false)
  }, [])
  useEffect(() => { void run() }, [run])
  useEffect(() => { if (!auto) return; const t = setInterval(() => void run(), 30000); return () => clearInterval(t) }, [auto, run])

  const latest = history[0]
  const lat = history.map(h => h.api.latencyMs).filter((n): n is number => n !== null).sort((a, b) => a - b)
  const median = lat.length ? lat[Math.floor(lat.length / 2)] : null
  const okRate = history.length ? Math.round(history.filter(h => h.api.ok).length / history.length * 100) : null
  const overall = !latest ? null : latest.api.ok && latest.db.ok ? 'ok' : latest.api.ok ? 'degraded' : 'down'

  return <PageShell kicker="Developers / Service status" title="Service" accent="status." intro="Live checks from this browser against the SafeSend API. Latency is measured here, so it includes your own network and is not a server-side metric.">
    <Panel title="Current status" kicker="LIVE CHECK" action={<div className="flex items-center gap-4"><span className="flex items-center gap-2 font-mono text-[10px] tracking-widest text-[#94a3b8]">AUTO 30S <ToggleButton on={auto} onChange={setAuto} label="Auto-refresh every 30 seconds"/></span><Button secondary onClick={() => void run()} disabled={busy} className="!min-h-10">{busy ? 'CHECKING…' : 'CHECK NOW'}</Button></div>}>
      <div role="status" aria-live="polite" className="flex flex-wrap items-center gap-4">
        {!overall ? <span className="text-sm text-[#64748b]">Running first check…</span> : <>
          <StatusBadge tone={overall === 'ok' ? 'ok' : overall === 'degraded' ? 'warn' : 'bad'}>{overall === 'ok' ? 'All systems operational' : overall === 'degraded' ? 'Degraded' : 'API unreachable'}</StatusBadge>
          <span className="text-sm text-[#94a3b8]">API: {latest.api.message} Data store: {latest.db.message}</span></>}
      </div>
      <div className="mt-8"><StatGrid>
        <StatCard label="API latency (last)" value={latest?.api.latencyMs != null ? `${latest.api.latencyMs} ms` : '—'}/>
        <StatCard label="Median latency" value={median != null ? `${median} ms` : '—'} hint={`${lat.length} checks this visit`}/>
        <StatCard label="Check success rate" value={okRate != null ? `${okRate}%` : '—'} hint="This visit only"/>
        <StatCard label="Last checked" value={latest ? new Date(latest.api.checkedAt).toLocaleTimeString() : '—'}/>
      </StatGrid></div>
    </Panel>
    <Panel title="Checks this visit" kicker="HISTORY">
      {history.length === 0 ? <p className="text-sm text-[#64748b]">No checks yet.</p> : <ul className="grid gap-2 font-mono text-xs">{history.map((h, i) => <li key={i} className="flex flex-wrap justify-between gap-3 border-b border-[#172a46] pb-2 last:border-0"><span className="text-[#94a3b8]">{new Date(h.api.checkedAt).toLocaleTimeString()}</span><span className={h.api.ok ? 'text-[#6ee7b7]' : 'text-[#fca5a5]'}>API {h.api.ok ? 'ok' : 'fail'}{h.api.latencyMs != null ? ` · ${h.api.latencyMs} ms` : ''}</span><span className={h.db.ok ? 'text-[#6ee7b7]' : 'text-[#fca5a5]'}>Data store {h.db.ok ? 'ok' : 'fail'}</span></li>)}</ul>}
      <p className="mt-5 text-xs text-[#64748b]">History is kept in memory for this visit only.</p>
    </Panel>
    <PendingBackend capability="observabilityMetrics" title="Error rates, server-side latency and incident history" contract={['GET /api/metrics  (authorized)', 'GET /api/incidents']}>
      The backend exposes only a health ping and a data-store check. Request error rates, server-measured latency percentiles and a record of past incidents need a metrics endpoint, and should be restricted to authorized operators rather than shown publicly.
    </PendingBackend>
  </PageShell>
}
