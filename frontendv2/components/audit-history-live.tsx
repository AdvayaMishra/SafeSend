'use client'
import {useEffect,useState} from 'react'
import {getAuditLog,type AuditEntry} from '@/lib/api/security'
import {Panel,ErrorNote} from '@/components/ui-kit'
export function AuditHistoryLive() {
  const [entries,setEntries]=useState<AuditEntry[]>([]),[error,setError]=useState(''),[loaded,setLoaded]=useState(false),[truncated,setTruncated]=useState(false),[query,setQuery]=useState('')
  useEffect(()=>{let active=true;void getAuditLog().then(data=>{if(active){setEntries(data.entries);setTruncated(!!data.truncated);setLoaded(true)}}).catch(e=>{if(active){setError(e instanceof Error?e.message:'Audit history unavailable.');setLoaded(true)}});return()=>{active=false}},[])
  const visible=entries.filter(e=>`${e.type} ${e.category} ${e.id}`.toLowerCase().includes(query.toLowerCase()))
  const download=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(visible,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='secureshare-authorized-audit.json';a.click();URL.revokeObjectURL(url)}
  return <Panel title="Account and workspace audit history" kicker="HASH-LINKED RECORDS">
    {error&&<ErrorNote>{error}</ErrorNote>}
    {!loaded&&<p>Loading audit history…</p>}
    {loaded&&!error&&<><div className="mb-4 flex flex-wrap gap-4"><input aria-label="Search account audit" placeholder="Search event type or ID" value={query} onChange={e=>setQuery(e.target.value)} className="border bg-[#0b1424] p-3 text-sm"/><button onClick={download} className="text-xs text-[#38bdf8]">EXPORT AUTHORIZED JSON</button></div>
      {truncated&&<p className="mb-4 text-sm text-[#fbbf24]">This history is capped. Integrity verification refuses truncated chains.</p>}
      {!visible.length?<p className="text-sm text-[#94a3b8]">No matching audit records.</p>:<ul className="grid max-h-[480px] gap-3 overflow-auto">{visible.map(e=><li key={e.id} className="border border-[#213858] p-3"><p className="text-sm">{e.type.replaceAll('_',' ')}</p><p className="text-xs text-[#94a3b8]">{e.category} · {new Date(e.occurredAt).toLocaleString()}</p><p className="mt-2 break-all font-mono text-[10px] text-[#64748b]">SHA-256 {e.hash}</p></li>)}</ul>}
    </>}
  </Panel>
}
