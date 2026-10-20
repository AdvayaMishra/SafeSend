'use client'
/** Dependency-free charts built from divs. Each chart ships an sr-only data table for assistive tech. */

export type RangeKey = '24h' | '7d' | '30d' | 'all'
export const RANGE_MS: Record<RangeKey, number | null> = { '24h': 864e5, '7d': 7 * 864e5, '30d': 30 * 864e5, all: null }
export const inRange = (iso: string, range: RangeKey, now = Date.now()) => { const w = RANGE_MS[range]; return w === null || now - new Date(iso).getTime() <= w }

export function RangeTabs({ value, onChange }: { value: RangeKey; onChange: (r: RangeKey) => void }) {
  return <div role="group" aria-label="Time range" className="flex border border-[#213858]">
    {(['24h', '7d', '30d', 'all'] as RangeKey[]).map(r => <button key={r} type="button" aria-pressed={value === r} onClick={() => onChange(r)} className={`px-3 py-2 font-mono text-[10px] tracking-widest ${value === r ? 'bg-[#2563eb] text-white' : 'text-[#94a3b8] hover:text-white'}`}>{r === 'all' ? 'ALL' : r.toUpperCase()}</button>)}
  </div>
}

export type Bucket = { label: string; a: number; b: number }
export function StackedBars({ buckets, aLabel, bLabel, title }: { buckets: Bucket[]; aLabel: string; bLabel: string; title: string }) {
  const max = Math.max(1, ...buckets.map(x => x.a + x.b))
  return <figure>
    <div role="img" aria-label={`${title}: ${buckets.reduce((s, x) => s + x.a, 0)} ${aLabel}, ${buckets.reduce((s, x) => s + x.b, 0)} ${bLabel}`} className="flex h-44 items-end gap-1 border-b border-[#213858] pb-px">
      {buckets.map((x, i) => <div key={i} title={`${x.label}: ${x.a} ${aLabel}, ${x.b} ${bLabel}`} className="flex h-full min-w-0 flex-1 flex-col justify-end">
        <div className="bg-[#ef4444]/70" style={{ height: `${(x.b / max) * 100}%` }}/><div className="bg-[#38bdf8]/80" style={{ height: `${(x.a / max) * 100}%` }}/>
      </div>)}
    </div>
    <div className="mt-2 flex justify-between font-mono text-[10px] text-[#64748b]"><span>{buckets[0]?.label}</span><span>{buckets[buckets.length - 1]?.label}</span></div>
    <figcaption className="mt-3 flex gap-5 font-mono text-[10px] tracking-widest text-[#94a3b8]"><span><i className="mr-2 inline-block h-2 w-2 bg-[#38bdf8]/80"/>{aLabel}</span><span><i className="mr-2 inline-block h-2 w-2 bg-[#ef4444]/70"/>{bLabel}</span></figcaption>
    <table className="sr-only"><caption>{title}</caption><thead><tr><th>Period</th><th>{aLabel}</th><th>{bLabel}</th></tr></thead><tbody>{buckets.map((x, i) => <tr key={i}><td>{x.label}</td><td>{x.a}</td><td>{x.b}</td></tr>)}</tbody></table>
  </figure>
}

export function HBars({ rows, title }: { rows: Array<{ label: string; value: number }>; title: string }) {
  const max = Math.max(1, ...rows.map(r => r.value))
  return <div role="list" aria-label={title} className="grid gap-3">{rows.map(r => <div role="listitem" key={r.label} className="grid grid-cols-[130px_1fr_32px] items-center gap-3 text-xs text-[#cbd5e1]">
    <span className="truncate">{r.label}</span><div className="h-2 bg-[#172a46]"><div className="h-full bg-[#38bdf8]" style={{ width: `${(r.value / max) * 100}%` }}/></div><span className="text-right font-mono text-[#94a3b8]">{r.value}</span></div>)}</div>
}

/** Buckets events into hourly (24h) or daily buckets for the chosen range. */
export function bucketize(items: Array<{ at: string; kind: 'a' | 'b' }>, range: RangeKey, now = Date.now()): Bucket[] {
  const hourly = range === '24h'
  const step = hourly ? 36e5 : 864e5
  const earliest = items.length ? Math.min(...items.map(i => new Date(i.at).getTime())) : now
  const count = range === 'all' ? Math.min(60, Math.max(1, Math.ceil((now - earliest) / step) + 1)) : hourly ? 24 : range === '7d' ? 7 : 30
  const buckets: Bucket[] = Array.from({ length: count }, (_, i) => {
    const t = new Date(now - (count - 1 - i) * step)
    return { label: hourly ? t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : t.toLocaleDateString([], { month: 'short', day: 'numeric' }), a: 0, b: 0 }
  })
  for (const it of items) {
    const idx = count - 1 - Math.floor((now - new Date(it.at).getTime()) / step)
    if (idx >= 0 && idx < count) buckets[idx][it.kind]++
  }
  return buckets
}
