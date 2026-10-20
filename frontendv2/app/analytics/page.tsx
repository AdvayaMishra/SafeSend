'use client'
import { useMemo, useState } from 'react'
import { PageShell, Panel, StatCard, StatGrid, PendingBackend, StatusBadge } from '@/components/ui-kit'
import { RegistryGate } from '@/components/registry-state'
import { RangeTabs, StackedBars, HBars, bucketize, inRange, type RangeKey } from '@/components/charts'
import { useRegistrySecrets } from '@/lib/use-registry-secrets'
import { effectiveStatus, eventLabel } from '@/lib/secret-insights'
import { flattenEvents } from '@/components/event-list'
import { AnalyticsLive } from '@/components/analytics-live'
import {AccountGate} from '@/components/account-gate'

export default function AnalyticsPage() {
  const { status, data } = useRegistrySecrets()
  const [range, setRange] = useState<RangeKey>('7d')

  const m = useMemo(() => {
    const events = flattenEvents(data.loaded).filter(e => inRange(e.created_at, range))
    const count = (t: string) => events.filter(e => e.event_type === t).length
    const states = data.loaded.map(l => effectiveStatus(l.secret))
    const byType = new Map<string, number>()
    events.forEach(e => byType.set(e.event_type, (byType.get(e.event_type) ?? 0) + 1))
    return {
      events, success: count('ACCESS_SUCCESS'), failed: count('FAILED_PASSWORD'), cooldowns: count('COOLDOWN_STARTED'),
      destroyedEvents: count('MESSAGE_DESTROYED'), expiredEvents: count('MESSAGE_EXPIRED'),
      buckets: bucketize(events.filter(e => e.event_type === 'ACCESS_SUCCESS' || e.event_type === 'FAILED_PASSWORD').map(e => ({ at: e.created_at, kind: e.event_type === 'ACCESS_SUCCESS' ? 'a' as const : 'b' as const })), range),
      breakdown: [...byType.entries()].map(([t, v]) => ({ label: eventLabel(t), value: v })).sort((a, b) => b.value - a.value),
      active: states.filter(s => s === 'active' || s === 'cooling down' || s === 'scheduled').length,
      expired: states.filter(s => s === 'expired').length, destroyed: states.filter(s => s === 'destroyed').length,
    }
  }, [data.loaded, range])

  return <PageShell kicker="Security / Analytics" title="Security" accent="analytics." intro="Access activity for secrets created in this browser, computed from the event history the backend returns. Nothing here is estimated or simulated.">
    <AccountGate><AnalyticsLive/></AccountGate>
    <RegistryGate status={status} data={data}>
      <Panel title="Access activity" kicker="TREND" action={<RangeTabs value={range} onChange={setRange}/>}>
        <StatGrid>
          <StatCard label="Successful access" value={String(m.success)}/>
          <StatCard label="Failed password attempts" value={String(m.failed)}/>
          <StatCard label="Cooldowns triggered" value={String(m.cooldowns)}/>
          <StatCard label="Events in range" value={String(m.events.length)}/>
        </StatGrid>
        <div className="mt-8">{m.success + m.failed === 0 ? <p className="text-sm text-[#64748b]">No access attempts in this range.</p> : <StackedBars title="Access attempts over time" buckets={m.buckets} aLabel="Successful" bLabel="Failed"/>}</div>
      </Panel>
      <div className="grid gap-7 lg:grid-cols-2">
        <Panel title="Secret lifecycle" kicker="EXPIRATION & DESTRUCTION">
          <StatGrid>
            <StatCard label="Active" value={String(m.active)}/><StatCard label="Expired" value={String(m.expired)}/><StatCard label="Destroyed" value={String(m.destroyed)}/><StatCard label="Tracked" value={String(data.loaded.length)}/>
          </StatGrid>
          <p className="mt-5 text-xs leading-5 text-[#64748b]">Expiry and destruction events in range: {m.expiredEvents} expired, {m.destroyedEvents} destroyed. Status counts are current, not range-filtered.</p>
        </Panel>
        <Panel title="Event breakdown" kicker="BY TYPE">
          {m.breakdown.length ? <HBars title="Events by type" rows={m.breakdown}/> : <p className="text-sm text-[#64748b]">No events in this range.</p>}
        </Panel>
      </div>
      <Panel title="Not yet measured" kicker="LIMITS OF CURRENT DATA">
        <div className="grid gap-5 text-sm leading-6 text-[#94a3b8]">
          <p><StatusBadge tone="neutral">Policy denials</StatusBadge> Account analytics includes recorded policy denials. The browser view covers only tracked secrets.</p>
          <p><StatusBadge tone="neutral">Threat severity</StatusBadge> Open the threat dashboard for backend risk scores and incident explanations.</p>
        </div>
      </Panel>
    </RegistryGate>
    <PendingBackend capability="analyticsService" title="Account-wide analytics" contract={['GET /api/analytics?range=24h|7d|30d']}>Analytics across all of your secrets, workspaces and devices needs an authenticated analytics endpoint. Until then, this page covers only secrets created in this browser.</PendingBackend>
  </PageShell>
}
