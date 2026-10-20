'use client'
import { useMemo, useState } from 'react'
import { PageShell, Panel, StatCard, StatGrid, PendingBackend, StatusBadge } from '@/components/ui-kit'
import { RegistryGate } from '@/components/registry-state'
import { RangeTabs, inRange, type RangeKey } from '@/components/charts'
import { EventList, flattenEvents } from '@/components/event-list'
import { ThreatLive } from '@/components/threat-live'
import { CAPABILITIES } from '@/lib/capabilities'
import {AccountGate} from '@/components/account-gate'
import { useRegistrySecrets } from '@/lib/use-registry-secrets'

const RULES = [
  ['Failed-password cooldown', 'After every 3 failed password attempts on a secret, password attempts are blocked for an escalating period: 15 minutes, then 45 minutes, 135 minutes, and 405 minutes.'],
  ['Temporary source protection', 'Repeated suspicious activity can trigger a ten-minute source cooldown. Suspicious traffic does not permanently destroy a secret.'],
  ['Policy enforcement', 'Secrets are refused once they expire, outside their access window, or after their view limit. These refusals are not recorded as events.'],
]

export default function ThreatsPage() {
  const { status, data } = useRegistrySecrets()
  const [range, setRange] = useState<RangeKey>('7d')
  const signals = useMemo(() => flattenEvents(data.loaded).filter(e => (e.event_type === 'FAILED_PASSWORD' || e.event_type === 'COOLDOWN_STARTED') && inRange(e.created_at, range)), [data.loaded, range])
  const cooling = data.loaded.filter(l => l.secret.cooldownUntil && new Date(l.secret.cooldownUntil) > new Date())

  return <PageShell kicker="Security / Threat intelligence" title="Threat" accent="intelligence." intro="Rule-based risk scores and incidents for secrets you own or can access through your workspace. Sign in to view account intelligence; browser-local signals remain available below.">
    {CAPABILITIES.threatIntelligence ? <AccountGate><ThreatLive/></AccountGate> : <PendingBackend capability="threatIntelligence" title="Risk scoring and incidents" contract={['GET /api/threats?range=24h|7d|30d  →  riskScore, riskLevel, incidents[], activeDefenses[], rules[]']}>
      A threat dashboard with LOW / MEDIUM / HIGH / CRITICAL classification needs a server-side detection engine. The interface is built and typed, and will activate once that endpoint exists. Until then no risk score is shown, because inventing one would be misleading.
    </PendingBackend>}
    <Panel title="Protections enforced today" kicker="DETECTION RULES">
      <ul className="grid gap-5">{RULES.map(([t, d]) => <li key={t}><p className="text-sm font-medium text-[#e5efff]">{t}</p><p className="mt-1 text-sm leading-6 text-[#94a3b8]">{d}</p></li>)}</ul>
    </Panel>
    <RegistryGate status={status} data={data}>
      <Panel title="Observed signals" kicker="RAW BACKEND DATA · SECRETS FROM THIS BROWSER" action={<RangeTabs value={range} onChange={setRange}/>}>
        <StatGrid>
          <StatCard label="Failed passwords" value={String(signals.filter(s => s.event_type === 'FAILED_PASSWORD').length)}/>
          <StatCard label="Cooldowns started" value={String(signals.filter(s => s.event_type === 'COOLDOWN_STARTED').length)}/>
          <StatCard label="Active restrictions" value={String(cooling.length)}/>
          <StatCard label="Secrets with failures" value={String(data.loaded.filter(l => l.secret.failedAttempts > 0).length)}/>
        </StatGrid>
        {cooling.length > 0 && <div className="mt-8"><p className="mb-3 font-mono text-[10px] tracking-widest text-[#fbbf24]">TEMPORARY RESTRICTIONS</p><ul className="grid gap-2 text-sm text-[#cbd5e1]">{cooling.map(l => <li key={l.secret.id}><StatusBadge tone="warn">Cooldown</StatusBadge> <span className="ml-2 font-mono text-xs">{l.secret.id.slice(0, 8)}…</span> — password attempts blocked until {new Date(l.secret.cooldownUntil as string).toLocaleString()}</li>)}</ul></div>}
        <div className="mt-8"><p className="mb-4 font-mono text-[10px] tracking-widest text-[#38bdf8]">SIGNAL TIMELINE</p><EventList events={signals} empty="No failed-password signals in this range."/></div>
      </Panel>
    </RegistryGate>
  </PageShell>
}
