'use client'
import { Button } from '@/components/shared'

export type QueueItem = { name: string; size: number; phase: 'queued' | 'encrypting' | 'uploading' | 'done' | 'failed' | 'cancelled'; progress: number; attempts: number; error?: string }
const size = (b: number) => b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`

function label(i: QueueItem) {
  switch (i.phase) {
    case 'queued': return 'Waiting'
    case 'encrypting': return 'Encrypting in your browser'
    case 'uploading': return i.progress >= 1 ? 'Waiting for server confirmation' : `Uploading ${Math.round(i.progress * 100)}%`
    case 'done': return 'Uploaded'
    case 'failed': return 'Failed'
    case 'cancelled': return 'Cancelled'
  }
}

/** Encryption is a single WebCrypto call, so its progress cannot be measured: it shows as indeterminate. */
export function UploadQueue({ items, uploading, onCancel, onRetry, onSkip }: { items: QueueItem[]; uploading: boolean; onCancel: () => void; onRetry: () => void; onSkip: () => void }) {
  const remaining = items.filter(i => i.phase !== 'done').length
  return <section aria-labelledby="queue-title" className="grid gap-4 border border-[#213858] bg-[#0b172a] p-5">
    <div><p className="font-mono text-[10px] tracking-[.18em] text-[#38bdf8]">SECRET CREATED</p><h3 id="queue-title" className="mt-2 text-lg font-light">Uploading encrypted attachments</h3>
      <p className="mt-1 text-xs leading-5 text-[#64748b]">Your link appears once every attachment is uploaded, or when you choose to finish without the rest.</p></div>
    <ul className="grid gap-3">{items.map((i, idx) => <li key={idx} className="grid gap-2">
      <div className="flex items-center justify-between gap-3 text-sm"><span className="truncate text-[#e2e8f0]">{i.name}<span className="ml-2 font-mono text-[10px] text-[#64748b]">{size(i.size)}</span></span>
        <span className={`shrink-0 font-mono text-[10px] tracking-widest ${i.phase === 'failed' ? 'text-[#fca5a5]' : i.phase === 'done' ? 'text-[#6ee7b7]' : 'text-[#94a3b8]'}`}>{label(i)}{i.attempts > 1 && i.phase !== 'done' ? ` · attempt ${i.attempts}` : ''}</span></div>
      <div className="h-1 bg-[#172a46]" role="progressbar" aria-label={`${i.name} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={i.phase === 'encrypting' ? undefined : Math.round((i.phase === 'done' ? 1 : i.progress) * 100)}>
        <div className={`h-full ${i.phase === 'failed' ? 'bg-[#ef4444]' : 'bg-[#38bdf8]'} ${i.phase === 'encrypting' ? 'w-1/3 animate-pulse' : ''}`} style={i.phase === 'encrypting' ? undefined : { width: `${(i.phase === 'done' ? 1 : i.progress) * 100}%` }}/></div>
      {i.error && <p role="alert" className="text-xs text-[#fca5a5]">{i.error}</p>}
    </li>)}</ul>
    <div className="flex flex-wrap gap-3" aria-live="polite">
      {uploading ? <Button secondary onClick={onCancel}>CANCEL UPLOAD</Button> : remaining > 0 && <>
        <Button onClick={onRetry}>RETRY {remaining} REMAINING</Button>
        <Button secondary onClick={onSkip}>FINISH WITHOUT THEM</Button></>}
    </div>
  </section>
}
