'use client'
import {useEffect,useState} from 'react'
import {apiRequest} from '@/lib/api/client'
import {Panel,ErrorNote,StatGrid,StatCard} from '@/components/ui-kit'
import {RangeTabs,HBars,type RangeKey} from '@/components/charts'
type Analytics={secretCount:number;eventCount:number;counts:Record<string,number>;events:Array<{event_type:string;created_at:string}>;truncated:boolean}
export function AnalyticsLive() {
  const [range,setRange]=useState<RangeKey>('7d'),[data,setData]=useState<Analytics|null>(null),[error,setError]=useState('')
  useEffect(()=>{let cancelled=false;setData(null);setError('')
    const days=range==='24h'?1:range==='7d'?7:range==='30d'?30:36500
    void apiRequest<Analytics>(`/api/analytics?since=${encodeURIComponent(new Date(Date.now()-days*86400000).toISOString())}`)
      .then(r=>{if(!cancelled)setData(r)}).catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:'Analytics unavailable.')})
    return()=>{cancelled=true}
  },[range])
  function download() {if(!data)return;const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='secureshare-account-analytics.json';a.click();URL.revokeObjectURL(url)}
  return <Panel title="Account and workspace analytics" kicker="AUTHORIZED SERVER DATA" action={<RangeTabs value={range} onChange={setRange}/>}> 
    {error?<ErrorNote>{error}</ErrorNote>:!data?<p>Loading account analytics…</p>:<>
      <StatGrid><StatCard label="Accessible secrets" value={String(data.secretCount)}/><StatCard label="Events loaded" value={String(data.eventCount)}/><StatCard label="Successful access" value={String(data.counts.ACCESS_SUCCESS??0)}/><StatCard label="Policy denials" value={String(data.counts.SECURITY_POLICY_DENIED??0)}/></StatGrid>
      <div className="mt-5"><HBars title="Recorded event types" rows={Object.entries(data.counts).map(([label,value])=>({label:label.replaceAll('_',' '),value}))}/></div>
      {data.truncated&&<p className="mt-3 text-sm text-[#fbbf24]">This result is capped. Counts cover the loaded records and are not account totals.</p>}
      <button onClick={download} className="mt-4 text-xs text-[#38bdf8]">EXPORT AUTHORIZED JSON</button>
    </>}
  </Panel>
}
