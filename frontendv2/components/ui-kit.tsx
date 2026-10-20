'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useId, type ReactNode } from 'react'
import { AlertTriangle, Info, Loader2, Hourglass } from 'lucide-react'
import { groupForPath } from '@/components/nav-data'
import { CAPABILITIES, type CapabilityName } from '@/lib/capabilities'

/** Page wrapper: matches existing page header typography and adds group-scoped sub-navigation. */
export function PageShell({ kicker, title, accent, intro, children, wide = false }: { kicker: string; title: string; accent: string; intro: string; children: ReactNode; wide?: boolean }) {
  const pathname = usePathname()
  const group = groupForPath(pathname)
  return <main className={`ss-app ss-dashboard mx-auto ${wide ? 'max-w-[1320px]' : 'max-w-[1280px]'} px-5 py-14 lg:px-8`}>
    {group && <nav aria-label={`${group.label} sections`} className="mb-10 flex flex-wrap gap-x-7 gap-y-2 border-b border-[#172a46] pb-3">
      <span className="font-mono text-[10px] tracking-[.18em] text-[#64748b]">{group.label.toUpperCase()}</span>
      {group.items.map(i => <Link key={i.href} href={i.href} aria-current={pathname === i.href ? 'page' : undefined} className={`font-mono text-[10px] tracking-[.14em] transition-colors hover:text-white ${pathname === i.href ? 'text-[#38bdf8]' : 'text-[#8b9ab4]'}`}>{i.label.toUpperCase()}</Link>)}
    </nav>}
    <p className="font-mono text-[10px] uppercase tracking-[.2em] text-[#38bdf8]">{kicker}</p>
    <h1 className="mt-4 text-4xl font-light tracking-[-.04em] sm:text-5xl">{title} <span className="ss-gradient">{accent}</span></h1>
    <p className="ss-page-intro">{intro}</p>
    <div className="mt-12 grid gap-7">{children}</div>
  </main>
}

export function Panel({ title, kicker, action, children }: { title?: string; kicker?: string; action?: ReactNode; children: ReactNode }) {
  return <section className="ss-event-panel border border-[#213858] bg-[#0b172a] p-6 sm:p-8">
    {(title || action) && <div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div>{kicker && <p className="font-mono text-[10px] tracking-[.18em] text-[#38bdf8]">{kicker}</p>}{title && <h2 className="mt-2 text-xl font-light">{title}</h2>}</div>{action}</div>}
    {children}
  </section>
}

export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <div className="border border-[#172a46] bg-[#0b172a]/50 p-6 flex flex-col justify-center">
    <div className="text-2xl md:text-3xl font-light mb-2 text-white">{value}</div>
    <div className="font-mono text-[10px] tracking-widest text-[#64748b] uppercase">{label}</div>
    {hint && <p className="mt-2 text-xs text-[#64748b]">{hint}</p>}
  </div>
}
export const StatGrid = ({ children }: { children: ReactNode }) => <div className="ss-stats grid grid-cols-2 gap-4 md:grid-cols-4">{children}</div>

type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'neutral'
const TONES: Record<Tone, string> = {
  ok: 'border-[#10b981]/50 text-[#6ee7b7]', warn: 'border-[#f59e0b]/50 text-[#fbbf24]', bad: 'border-[#ef4444]/50 text-[#fca5a5]',
  info: 'border-[#38bdf8]/50 text-[#7dd3fc]', neutral: 'border-[#213858] text-[#94a3b8]',
}
export const StatusBadge = ({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) =>
  <span className={`inline-flex items-center rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-widest ${TONES[tone]}`}>{children}</span>

export function PendingBackend({ capability, title, children, contract }: { capability: CapabilityName; title: string; children: ReactNode; contract?: string[] }) {
  if (CAPABILITIES[capability]) return null
  return <div role="status" className="border border-[#f59e0b]/40 bg-[#f59e0b]/5 p-6">
    <div className="flex items-center gap-3"><Hourglass size={16} className="text-[#fbbf24]"/><StatusBadge tone="warn">Awaiting backend support</StatusBadge></div>
    <h3 className="mt-4 text-lg font-light">{title}</h3>
    <div className="mt-2 max-w-3xl text-sm leading-6 text-[#94a3b8]">{children}</div>
    {contract && <div className="mt-4"><p className="font-mono text-[10px] tracking-widest text-[#64748b]">PROPOSED ENDPOINTS</p><ul className="mt-2 grid gap-1">{contract.map(c => <li key={c} className="font-mono text-xs text-[#cbd5e1]">{c}</li>)}</ul></div>}
  </div>
}

export const Loading = ({ label = 'LOADING' }: { label?: string }) => <div role="status" className="flex items-center gap-3 py-8 font-mono text-xs tracking-widest text-[#38bdf8]"><Loader2 size={14} className="animate-spin"/>{label}…</div>
export const ErrorNote = ({ children }: { children: ReactNode }) => <p role="alert" className="flex items-start gap-3 border border-[#7f1d1d] px-4 py-3 text-sm text-[#fca5a5]"><AlertTriangle size={16} className="mt-0.5 shrink-0"/><span>{children}</span></p>
export const EmptyState = ({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) =>
  <div className="grid place-items-center border border-dashed border-[#213858] px-6 py-14 text-center"><h3 className="text-lg font-light">{title}</h3><p className="mt-2 max-w-md text-sm leading-6 text-[#64748b]">{children}</p>{action && <div className="mt-6">{action}</div>}</div>

/** Accessible tooltip: opens on hover and keyboard focus. */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const id = useId()
  return <span className="group relative inline-flex align-middle">
    <button type="button" aria-label={label} aria-describedby={id} className="text-[#64748b] hover:text-[#38bdf8]"><Info size={13}/></button>
    <span id={id} role="tooltip" className="pointer-events-none invisible absolute left-1/2 top-full z-30 mt-2 w-64 -translate-x-1/2 rounded-lg border border-[#293953] bg-[#0b1424] p-3 text-xs font-normal normal-case leading-5 tracking-normal text-[#b5c6e2] opacity-0 shadow-xl transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">{children}</span>
  </span>
}

/** ON/OFF toggle matching the existing send-page controls, with proper semantics. */
export const ToggleButton = ({ on, onChange, label, disabled = false }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) =>
  <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)} className="border border-[#213858] px-3 py-2 font-mono text-[10px] tracking-widest text-[#38bdf8]">{on ? 'ON' : 'OFF'}</button>

export const SelectBox = ({ value, onChange, label, options }: { value: string; onChange: (v: string) => void; label: string; options: Array<[string, string]> }) =>
  <select aria-label={label} value={value} onChange={e => onChange(e.target.value)} className="border border-[#213858] bg-[#061225] px-3 py-2 text-sm outline-none">{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
