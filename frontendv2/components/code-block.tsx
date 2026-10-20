'use client'
import { useState } from 'react'

export function CodeBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => { try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* clipboard unavailable */ } }
  return <figure className="border border-[#213858] bg-[#060d1b]">
    <figcaption className="flex items-center justify-between border-b border-[#213858] px-4 py-2 font-mono text-[10px] tracking-widest text-[#64748b]">{label}<button type="button" onClick={copy} className="text-[#38bdf8] hover:text-white">{copied ? 'COPIED' : 'COPY'}</button></figcaption>
    <pre className="overflow-x-auto p-4 font-mono text-xs leading-6 text-[#cbd5e1]"><code>{code}</code></pre>
  </figure>
}
