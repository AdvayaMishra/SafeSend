'use client'
import { StatusBadge } from '@/components/ui-kit'

export type PolicyValues = { usePassword: boolean; once: boolean; maxViews: string; expiration: string; useAccessWindow: boolean }
export const PRESETS: Array<{ id: string; label: string; description: string; values: PolicyValues }> = [
  { id: 'standard', label: 'Standard', description: 'Password, 3 views, 24 hours', values: { usePassword: true, once: false, maxViews: '3', expiration: '24 hours', useAccessWindow: false } },
  { id: 'handoff', label: 'One-time handoff', description: 'Password, view once, 1 hour', values: { usePassword: true, once: true, maxViews: '3', expiration: '1 hour', useAccessWindow: false } },
  { id: 'confidential', label: 'Confidential', description: 'Password, 3 views, 6 hours', values: { usePassword: true, once: false, maxViews: '3', expiration: '6 hours', useAccessWindow: false } },
  { id: 'scheduled', label: 'Scheduled release', description: 'Opens at a time you pick', values: { usePassword: true, once: false, maxViews: '3', expiration: '3 days', useAccessWindow: true } },
]

/** Presets only fill in controls that already exist and work; they never add policy the backend cannot enforce. */
export function PolicyPresets({ onApply }: { onApply: (v: PolicyValues) => void }) {
  return <div role="group" aria-label="Access policy presets" className="grid gap-2 sm:grid-cols-2">
    {PRESETS.map(p => <button key={p.id} type="button" onClick={() => onApply(p.values)} className="border border-[#213858] bg-[#0b172a] p-3 text-left hover:border-[#3b82f6]"><span className="block text-sm text-[#e2e8f0]">{p.label}</span><span className="mt-1 block text-[11px] text-[#64748b]">{p.description}</span></button>)}
  </div>
}

const UNAVAILABLE = [
  ['Recipient-specific access', 'Restrict a secret to named recipients.'],
  ['Verified email access', 'Require the recipient to confirm an email address.'],
  ['Access suspension', 'Pause and resume access without destroying the secret.'],
  ['Manual revocation', 'Destroy a secret on demand after sharing.'],
]
/** Listed for transparency only: no toggles, because none of these can be enforced by the current backend. */
export function UnavailablePolicies() {
  return <details className="border-t border-[#172a46] pt-6">
    <summary className="cursor-pointer font-mono text-[10px] tracking-widest text-[#64748b] hover:text-white">MORE POLICIES · NOT YET AVAILABLE</summary>
    <ul className="mt-4 grid gap-3">{UNAVAILABLE.map(([t, d]) => <li key={t} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span><span className="text-[#cbd5e1]">{t}</span><span className="ml-3 text-xs text-[#64748b]">{d}</span></span><StatusBadge tone="warn">Awaiting backend</StatusBadge></li>)}</ul>
  </details>
}
