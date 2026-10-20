'use client'
import { useEffect,useState } from 'react'
import { getNotifications,markNotificationRead,type AppNotification } from '@/lib/api/workspace'
import { ErrorNote,Panel,EmptyState } from '@/components/ui-kit'
import { Button } from '@/components/shared'
import {apiRequest} from '@/lib/api/client'
export function NotificationsLive() {
  const [notes,setNotes]=useState<AppNotification[]>([]),[error,setError]=useState(''),[loaded,setLoaded]=useState(false)
  const [preferences,setPreferences]=useState<Record<string,boolean>|null>(null)
  const load=async()=>{try{const [notes,prefs]=await Promise.all([getNotifications(),apiRequest<{preferences:Record<string,boolean>}>('/api/notifications/preferences')]);setNotes(notes.notifications);setPreferences(prefs.preferences);setError('')}catch(e){setError(e instanceof Error?e.message:'Unable to load notifications.')}finally{setLoaded(true)}}
  useEffect(()=>{void load()},[])
  const mark=async(id:string)=>{try{await markNotificationRead(id);await load()}catch(e){setError(e instanceof Error?e.message:'Unable to save read state.')}}
  const preference=async(name:string,value:boolean)=>{try{await apiRequest('/api/notifications/preferences',{method:'PATCH',body:{[name]:value}});await load()}catch(e){setError(e instanceof Error?e.message:'Unable to save preference.')}}
  return <Panel title="Account notifications" kicker="SAVED ACTIVITY">
    {error&&<ErrorNote>{error}</ErrorNote>}
    {!loaded&&<p>Loading notifications…</p>}
    {loaded&&!error&&!notes.length&&<EmptyState title="No saved notifications">Threat and workspace notices appear here.</EmptyState>}
    <ul className="grid gap-3">{notes.map(n=><li key={n.id} className="flex items-center justify-between gap-4 border border-[#213858] p-4"><div><p>{n.title}</p><p className="text-sm text-[#94a3b8]">{n.body}</p><time className="text-xs text-[#64748b]">{new Date(n.createdAt).toLocaleString()}</time></div>{!n.read&&<Button secondary onClick={()=>void mark(n.id)}>Mark read</Button>}</li>)}</ul>
    {preferences&&<fieldset className="mt-6 grid gap-3 text-sm"><legend className="mb-3 text-[#94a3b8]">In-app notification preferences</legend>{[['threat_alerts','Threat alerts'],['access_notifications','Access activity'],['expiration_notices','Expiration notices']].map(([name,label])=><label key={name} className="flex gap-3"><input type="checkbox" checked={preferences[name]??false} onChange={e=>void preference(name,e.target.checked)}/>{label}</label>)}</fieldset>}
  </Panel>
}
