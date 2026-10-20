'use client'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ChevronDown, Fingerprint, Menu, X } from 'lucide-react'
import { NAV_GROUPS, groupForPath } from '@/components/nav-data'

export function Mark() { return <div className="flex items-center gap-3"><div className="grid h-8 w-8 place-items-center border border-[#2563eb] bg-[#0b172a] shadow-[0_0_24px_rgba(37,99,235,.25)]"><Fingerprint size={16} className="text-[#38bdf8]" /></div><span className="font-mono text-sm font-semibold tracking-[.2em]">SAFE<span className="text-[#38bdf8]">SEND</span></span></div> }
export function Button({ children, onClick, secondary=false, className='', disabled=false, type='button' }: { children: React.ReactNode; onClick?:()=>void; secondary?:boolean; className?:string; disabled?:boolean; type?:'button'|'submit' }) { return <button type={type} disabled={disabled} onClick={onClick} className={`flex min-h-12 items-center justify-center gap-3 border px-5 text-xs font-semibold tracking-[.14em] transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38bdf8] ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${secondary?'border-[#213858] bg-[#0b172a]/70 text-[#cbd5e1] hover:border-[#3b82f6]':'border-[#3b82f6] bg-[#2563eb] text-white hover:bg-[#3b82f6]'} ${className}`}>{children}</button> }
export function Field({ label, children, hint }: { label:string; children:React.ReactNode; hint?:string }) { return <label className="grid gap-2"><span className="font-mono text-[10px] uppercase tracking-[.16em] text-[#94a3b8]">{label}</span>{children}{hint&&<span className="text-xs text-[#64748b]">{hint}</span>}</label> }
export function Globe({ small=false }: { small?:boolean }) { return <div className={`relative ${small?'h-64 w-64':'h-[480px] w-[480px] max-w-full'}`} aria-label="Digital Earth visualization"><div className="absolute inset-[12%] rounded-full bg-[#0a1628] shadow-[inset_-28px_-18px_50px_rgba(0,0,0,.8),0_0_70px_rgba(37,99,235,.28)]"/><div className="globe-orbit absolute inset-[12%] rounded-full border border-[#2563eb]/50 before:absolute before:inset-[14%] before:rounded-full before:border-x before:border-[#38bdf8]/30 after:absolute after:inset-[28%] after:rounded-full after:border-y after:border-[#2563eb]/40"/><div className="globe-orbit reverse absolute inset-[5%] rounded-full border border-[#38bdf8]/20"/><div className="absolute inset-[20%] rounded-full opacity-80" style={{backgroundImage:'radial-gradient(#38bdf8 1px,transparent 1px)',backgroundSize:'14px 14px',maskImage:'radial-gradient(circle,#000 40%,transparent 72%)'}}/><span className="absolute left-[8%] top-[20%] font-mono text-[9px] tracking-widest text-[#38bdf8]">NETWORK READY</span><span className="absolute right-[1%] bottom-[24%] font-mono text-[9px] tracking-widest text-[#3b82f6]">ACTIVE</span></div> }

const nav: [string, string][] = [] // Global header should not have generic links, dashboard is context specific




export function Header() {
  const [open,setOpen]=useState(false)
  const [menu,setMenu]=useState<string|null>(null)
  const navRef=useRef<HTMLDivElement>(null)
  const pathname=usePathname()
  const [storedId,setStoredId]=useState<string|null>(null)
  useEffect(()=>{try{setStoredId(localStorage.getItem('secureShareLastSecretId'))}catch{}},[pathname])
  useEffect(()=>{setMenu(null);setOpen(false)},[pathname])
  useEffect(()=>{
    const onDown=(e:MouseEvent)=>{if(navRef.current&&!navRef.current.contains(e.target as Node))setMenu(null)}
    const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')setMenu(null)}
    document.addEventListener('mousedown',onDown);document.addEventListener('keydown',onKey)
    return()=>{document.removeEventListener('mousedown',onDown);document.removeEventListener('keydown',onKey)}
  },[])
  const dashboardId=pathname?.match(/^\/dashboard\/(.+)$/)?.[1] || storedId
  const links=[['/send','Create secret'],['/receive','Open secret'],...(dashboardId?[[`/dashboard/${dashboardId}`,'Dashboard']]:[])]
  return <header className="sticky top-0 z-50 border-b border-[#24314b]/80 bg-[#070c19]/90 backdrop-blur-xl"><div className="mx-auto flex h-[76px] max-w-[1320px] items-center justify-between px-6 lg:px-12"><Link href="/" aria-label="SafeSend home"><Mark/></Link><div ref={navRef} className="hidden items-center gap-7 lg:flex"><nav aria-label="Main" className="flex items-center gap-7">{links.map(([href,label])=><Link key={href} href={href} className={`text-xs font-medium transition-colors hover:text-white ${pathname===href?'text-[#a9c7ff]':'text-[#8b9ab4]'}`}>{label}</Link>)}</nav><span className="h-4 w-px bg-[#293953]" aria-hidden="true"/><nav aria-label="Platform" className="flex items-center gap-6">{NAV_GROUPS.map(g=>{const active=groupForPath(pathname)?.id===g.id;return <div key={g.id} className="relative"><button type="button" aria-haspopup="true" aria-expanded={menu===g.id} onClick={()=>setMenu(menu===g.id?null:g.id)} className={`flex items-center gap-1 text-xs font-medium transition-colors hover:text-white ${active?'text-[#a9c7ff]':'text-[#8b9ab4]'}`}>{g.label}<ChevronDown size={12} className={`transition-transform ${menu===g.id?'rotate-180':''}`}/></button>{menu===g.id&&<div className="absolute right-0 top-full mt-4 w-72 rounded-xl border border-[#293953] bg-[#0b1424] p-2 shadow-2xl">{g.items.map(i=><Link key={i.href} href={i.href} className="flex items-start gap-3 rounded-lg p-3 hover:bg-[#13213a]"><i.icon size={16} className="mt-0.5 shrink-0 text-[#38bdf8]"/><span><span className="block text-xs font-medium text-[#e5efff]">{i.label}</span><span className="mt-1 block text-[11px] text-[#7184a4]">{i.description}</span></span></Link>)}</div>}</div>})}</nav></div><button className="rounded-lg border border-[#293953] p-2 lg:hidden" onClick={()=>setOpen(!open)} aria-label="Toggle navigation" aria-expanded={open}>{open?<X/>:<Menu/>}</button></div>{open&&<nav aria-label="Mobile" className="grid max-h-[calc(100vh-76px)] gap-4 overflow-y-auto border-t border-[#25334c] bg-[#0b1424] px-6 py-6 lg:hidden">{links.map(([href,label])=><Link key={href} href={href} onClick={()=>setOpen(false)} className="text-sm text-[#b5c6e2]">{label}</Link>)}{NAV_GROUPS.map(g=><div key={g.id} className="grid gap-3 border-t border-[#1d2a40] pt-4"><span className="font-mono text-[10px] tracking-[.18em] text-[#64748b]">{g.label.toUpperCase()}</span>{g.items.map(i=><Link key={i.href} href={i.href} onClick={()=>setOpen(false)} className="text-sm text-[#b5c6e2]">{i.label}</Link>)}</div>)}</nav>}</header>
}
export function Footer(){return <footer className="border-t border-[#24314b] bg-[#070b16] px-6 py-9"><div className="mx-auto flex max-w-[1220px] flex-wrap items-center justify-between gap-5"><Link href="/"><Mark/></Link><span className="font-mono text-[10px] tracking-[.15em] text-[#6f829f]">ENCRYPT LOCALLY · SHARE SECURELY · STAY IN CONTROL</span><span className="font-mono text-[10px] text-[#627592]">© {new Date().getFullYear()} SAFESEND</span></div></footer>}
