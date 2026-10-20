'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { KeyRound, X } from 'lucide-react'

const KEY = 'secureShareOnboardingDismissed'

/** Dismissible first-use guidance; remembers dismissal in this browser only. */
export function FirstUseGuide() {
  const [show, setShow] = useState(false)
  useEffect(() => { try { setShow(localStorage.getItem(KEY) !== '1') } catch { setShow(true) } }, [])
  if (!show) return null
  const dismiss = () => { setShow(false); try { localStorage.setItem(KEY, '1') } catch { /* ignore */ } }
  return <aside aria-label="Getting started" className="mt-8 flex items-start justify-between gap-4 border border-[#213858] bg-[#0b172a]/70 p-4">
    <ol className="grid gap-1 text-xs leading-5 text-[#94a3b8] sm:grid-cols-3 sm:gap-6">
      <li><span className="text-[#38bdf8]">1.</span> Write your message and set the rules. It is encrypted in your browser first.</li>
      <li><span className="text-[#38bdf8]">2.</span> Share the full link. The part after # is the key and never reaches our servers.</li>
      <li><span className="text-[#38bdf8]">3.</span> Track activity from the dashboard. <Link href="/docs#security-model" className="underline underline-offset-4">How it works</Link></li>
    </ol>
    <button type="button" onClick={dismiss} aria-label="Dismiss getting started tips" className="shrink-0 text-[#64748b] hover:text-white"><X size={16}/></button>
  </aside>
}

export function KeyFragmentNotice() {
  return <div role="note" className="mx-auto mt-8 flex max-w-xl items-start gap-3 border border-[#213858] bg-[#0b172a]/70 p-4 text-left text-xs leading-5 text-[#94a3b8]">
    <KeyRound size={16} className="mt-0.5 shrink-0 text-[#38bdf8]"/>
    <p>The part of the link after <span className="font-mono text-[#cbd5e1]">#</span> is the decryption key. Browsers never send it to the server, and SafeSend cannot recover it. Share the whole link: if the key is cut off or lost, nobody can read the message. Anyone who has the full link (and the password, if set) can open it, so send the password through a different channel.</p>
  </div>
}
