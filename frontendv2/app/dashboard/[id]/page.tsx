'use client'
import Link from 'next/link'
import { Activity, ShieldCheck, Eye, Clock3, AlertTriangle } from 'lucide-react'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { getDashboardData } from '@/lib/secure-share'

export default function Dashboard() {
  const { id } = useParams()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (id === 'not-found') {
      setLoading(false);
      return;
    }
    const fetchDashboard = async () => {
      try {
        const res = await getDashboardData(id as string)
        if (res.success) {
          setData(res)
        } else {
          setError(res.message || 'Failed to load dashboard data.')
        }
      } catch (err) {
        setError('Error connecting to server.')
      } finally {
        setLoading(false)
      }
    }
    fetchDashboard()
  }, [id])

  if (loading) return <main className="mx-auto max-w-[1280px] px-5 py-14 lg:px-8 text-center animate-pulse font-mono text-[#38bdf8]">LOADING DASHBOARD...</main>
  
  if (id === 'not-found') return (
    <main className="mx-auto max-w-[1280px] px-5 py-24 lg:px-8 text-center">
      <h2 className="text-xl font-light mb-4">NO ACTIVE SECURITY DASHBOARD</h2>
      <p className="text-[#64748b] mb-8">Create a secure message first.</p>
      <Link href="/" className="inline-flex min-h-12 items-center justify-center border px-5 text-xs font-semibold tracking-[.14em] transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38bdf8] border-[#3b82f6] bg-[#2563eb] text-white hover:bg-[#3b82f6]">CREATE MESSAGE</Link>
    </main>
  )

  if (error || !data) return (
    <main className="mx-auto max-w-[1280px] px-5 py-14 lg:px-8 text-center">
      <h2 className="text-2xl font-light text-[#fca5a5]">{error}</h2>
    </main>
  )

  const { secret, events } = data
  const isActive = secret.status === 'active'

  return (
    <main className="ss-app ss-dashboard mx-auto max-w-[1280px] px-5 py-14 lg:px-8 animate-fade-in">
      <div className="flex flex-col items-center mb-16 relative">
        <div className="absolute left-0 top-0 hidden md:block">
           <Link href={`/share/${id}`} className="font-mono text-[10px] uppercase tracking-widest text-[#64748b] hover:text-white flex items-center gap-2 transition-colors">
             &larr; VIEW MESSAGE
           </Link>
        </div>
        <p className="font-mono text-[10px] tracking-[.2em] text-[#38bdf8] flex items-center gap-2 mt-8 md:mt-0">
          <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-[#10b981]' : 'bg-[#ef4444]'}`}></span>
          {secret.status.toUpperCase()}
        </p>
        <h2 className="mt-4 text-4xl font-light sm:text-6xl text-center">Security <span className="ss-gradient">command center.</span></h2><p className="ss-page-intro text-center mx-auto">Your secret’s current access policy and recorded lifecycle events.</p>
      </div>

      <div className="ss-stats grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
        <StatBlock label="Access Mode" value={secret.viewOnce ? 'View once' : 'Controlled'} />
        <StatBlock label="Views" value={`${secret.viewCount ?? 0} ${secret.maxViews ? `/ ${secret.maxViews}` : ''}`} />
        <StatBlock label="Failed Attempts" value={String(secret.failedAttempts ?? 0)} />
        <StatBlock label="Expires" value={secret.expiresAt ? new Date(secret.expiresAt).toLocaleString() : 'Not set'} />
      </div>

      <div className="ss-event-panel max-w-4xl mx-auto border border-[#213858] bg-[#0b172a] p-6 sm:p-9">
        <h3 className="font-mono text-xs tracking-widest text-[#38bdf8] mb-8 uppercase">Access Activity</h3>
        
        <div className="space-y-6">
          {(!events || events.length === 0) && <p className="text-[#64748b] text-sm">No events recorded.</p>}
          {(events || []).map((evt: any, i: number) => (
            <div key={i} className="ss-event flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-4 border-b border-[#172a46] last:border-0">
              <div>
                <p className={`text-sm font-medium ${String(evt.event_type || '').includes('FAILED') || String(evt.event_type || '').includes('DESTROYED') || String(evt.event_type || '').includes('EXPIRED') ? 'text-[#fca5a5]' : 'text-[#cbd5e1]'}`}>
                  {String(evt.event_type || 'UNKNOWN EVENT').replace(/_/g, ' ')}
                </p>
              </div>
              <span className="font-mono text-[10px] text-[#64748b]">{new Date(evt.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}

function StatBlock({ label, value }: { label: string, value: string }) {
  return (
    <div className="border border-[#172a46] bg-[#0b172a]/50 p-6 flex flex-col items-center justify-center text-center">
      <div className="text-xl md:text-3xl font-light mb-2 text-white">{value}</div>
      <div className="font-mono text-[10px] tracking-widest text-[#64748b] uppercase">{label}</div>
    </div>
  )
}
