'use client'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { PageShell, Panel, PendingBackend, StatusBadge, EmptyState } from '@/components/ui-kit'
import { RegistryGate } from '@/components/registry-state'
import { useRegistrySecrets } from '@/lib/use-registry-secrets'
import { effectiveStatus, eventLabel } from '@/lib/secret-insights'
import { flattenEvents } from '@/components/event-list'
import { CAPABILITIES } from '@/lib/capabilities'
import { NotificationsLive } from '@/components/notifications-live'
import {AccountGate} from '@/components/account-gate'

type Kind = 'ACCESS' | 'EXPIRY' | 'SECURITY'
type Note = { id: string; kind: Kind; title: string; body: string; at: string; secretId: string }
const KIND_LABEL: Record<Kind, string> = { ACCESS: 'Access activity', EXPIRY: 'Secret expiration', SECURITY: 'Security notice' }
const MS_HOUR = 36e5

export default function NotificationsPage() {
  const { status, data } = useRegistrySecrets()
  const [filter, setFilter] = useState<Kind | 'ALL'>('ALL')
  const [read, setRead] = useState<string[]>([]) // session-only: resets on reload

  const notes = useMemo<Note[]>(() => {
    const now = Date.now()
    const out: Note[] = []
    for (const l of data.loaded) {
      const st = effectiveStatus(l.secret, now)
      const exp = l.secret.expiresAt ? new Date(l.secret.expiresAt).getTime() : null
      if (st === 'active' && exp && exp - now < MS_HOUR) out.push({ id: `exp-${l.secret.id}`, kind: 'EXPIRY', title: 'Secret expires within the hour', body: `Expires ${new Date(exp).toLocaleTimeString()}. It will be destroyed even if unopened.`, at: new Date(now).toISOString(), secretId: l.secret.id })
    }
    for (const e of flattenEvents(data.loaded).slice(0, 50)) {
      const kind: Kind | null = e.event_type === 'ACCESS_SUCCESS' ? 'ACCESS' : e.event_type === 'MESSAGE_EXPIRED' ? 'EXPIRY' : ['FAILED_PASSWORD', 'COOLDOWN_STARTED', 'MESSAGE_DESTROYED'].includes(e.event_type) ? 'SECURITY' : null
      if (kind) out.push({ id: `${e.secretId}-${e.id ?? e.created_at}-${e.event_type}`, kind, title: eventLabel(e.event_type), body: `Secret ${e.secretId.slice(0, 8)}…`, at: e.created_at, secretId: e.secretId })
    }
    return out.sort((a, b) => +new Date(b.at) - +new Date(a.at))
  }, [data.loaded])

  const visible = notes.filter(n => filter === 'ALL' || n.kind === filter)
  const unread = notes.filter(n => !read.includes(n.id)).length

  return <PageShell kicker="Account / Notifications" title="Notification" accent="center." intro="Activity notices derived from the events the backend has recorded for secrets created in this browser.">
    {CAPABILITIES.notifications?<AccountGate><NotificationsLive/></AccountGate>:<PendingBackend capability="notifications" title="Alerts, invitations and preferences" contract={['GET /api/notifications', 'POST /api/notifications/:id/read', 'GET|PATCH /api/notifications/preferences']}>
      Threat alerts, workspace invitations, saved read state and delivery preferences need accounts and a notification service. Until then the list below is rebuilt from live data each time you open this page, and read marks last only for this visit.
    </PendingBackend>}
    <RegistryGate status={status} data={data}>
      <Panel title="Recent notices" kicker={`${unread} UNREAD`} action={<div className="flex flex-wrap items-center gap-3">
        <select aria-label="Filter notifications" value={filter} onChange={e => setFilter(e.target.value as Kind | 'ALL')} className="border border-[#213858] bg-[#061225] px-3 py-2 text-sm"><option value="ALL">All notices</option>{(Object.keys(KIND_LABEL) as Kind[]).map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select>
        <button type="button" onClick={() => setRead(notes.map(n => n.id))} disabled={unread === 0} className="font-mono text-[10px] tracking-widest text-[#38bdf8] disabled:opacity-40">MARK ALL READ</button></div>}>
        {visible.length === 0 ? <EmptyState title="You’re all caught up">{notes.length === 0 ? 'Notices appear here when your secrets are opened, expire, or see failed password attempts.' : 'No notices in this category.'}</EmptyState> :
          <ul className="grid gap-3">{visible.map(n => { const isRead = read.includes(n.id); return <li key={n.id}>
            <Link href={`/dashboard/${n.secretId}`} onClick={() => setRead(r => r.includes(n.id) ? r : [...r, n.id])} className={`flex flex-wrap items-center justify-between gap-3 border p-4 hover:border-[#3b82f6] ${isRead ? 'border-[#172a46] opacity-70' : 'border-[#213858] bg-[#0b172a]'}`}>
              <span className="flex items-center gap-3">{!isRead && <span className="h-2 w-2 rounded-full bg-[#38bdf8]" aria-label="Unread"/>}<span><span className="block text-sm text-[#e2e8f0]">{n.title}</span><span className="mt-1 block text-xs text-[#64748b]">{n.body}</span></span></span>
              <span className="flex items-center gap-3"><StatusBadge tone={n.kind === 'SECURITY' ? 'bad' : n.kind === 'EXPIRY' ? 'warn' : 'neutral'}>{KIND_LABEL[n.kind]}</StatusBadge><time dateTime={n.at} className="font-mono text-[10px] text-[#64748b]">{new Date(n.at).toLocaleString()}</time></span>
            </Link></li> })}</ul>}
      </Panel>
    </RegistryGate>
  </PageShell>
}
