import Link from 'next/link'
import { StatusBadge } from '@/components/ui-kit'
import { eventCategory, eventLabel, isFailureEvent, type SecretEvent } from '@/lib/secret-insights'

export type FlatEvent = SecretEvent & { secretId: string }

export function EventList({ events, empty }: { events: FlatEvent[]; empty?: string }) {
  if (!events.length) return <p className="text-sm text-[#64748b]">{empty ?? 'No events match the current filters.'}</p>
  return <ol className="space-y-5">{events.map((e, i) => <li key={`${e.secretId}-${e.id ?? i}-${e.created_at}`} className="ss-event flex flex-col justify-between gap-2 border-b border-[#172a46] pb-4 last:border-0 sm:flex-row sm:items-center">
    <div className="flex flex-wrap items-center gap-3">
      <span className={`text-sm font-medium ${isFailureEvent(e.event_type) || e.event_type === 'MESSAGE_DESTROYED' ? 'text-[#fca5a5]' : 'text-[#cbd5e1]'}`}>{eventLabel(e.event_type)}</span>
      <StatusBadge tone={isFailureEvent(e.event_type) ? 'bad' : 'neutral'}>{eventCategory(e.event_type)}</StatusBadge>
      <Link href={`/dashboard/${e.secretId}`} className="font-mono text-[10px] text-[#64748b] hover:text-[#38bdf8]">{e.secretId.slice(0, 8)}…</Link>
    </div>
    <time dateTime={e.created_at} className="font-mono text-[10px] text-[#64748b]">{new Date(e.created_at).toLocaleString()}</time>
  </li>)}</ol>
}

export const flattenEvents = (loaded: Array<{ secret: { id: string }; events: SecretEvent[] }>): FlatEvent[] =>
  loaded.flatMap(l => l.events.map(e => ({ ...e, secretId: l.secret.id }))).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
