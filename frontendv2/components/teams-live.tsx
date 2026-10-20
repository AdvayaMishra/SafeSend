'use client'
/** Live workspace view. Rendered only when CAPABILITIES.teams is true. Buttons render only when the server-supplied `permissions` allow them; the server still enforces every action. */
import { useEffect, useState } from 'react'
import { Button, Field } from '@/components/shared'
import { ErrorNote, Loading, Panel, SelectBox } from '@/components/ui-kit'
import { RoleBadge } from '@/components/role-badge'
import { changeMemberRole, getWorkspace, inviteMember, removeMember,createWorkspace,acceptInvitation, type Role, type Workspace } from '@/lib/api/workspace'
import Link from 'next/link'
import {apiRequest} from '@/lib/api/client'

const ROLES: Role[] = ['ADMIN', 'MEMBER', 'AUDITOR']

export function TeamsLive() {
  const [ws, setWs] = useState<Workspace | null>(null)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('MEMBER')
  const [name,setName]=useState(''),[invite,setInvite]=useState(''),[fresh,setFresh]=useState('')
  const [choices,setChoices]=useState<Array<{workspace_id:string;workspaces:{name:string}}>>([])
  const load = async() => {try{
    const result=await apiRequest<{workspaces:typeof choices}>('/api/workspaces');setChoices(result.workspaces??[])
    const selected=sessionStorage.getItem('secureShareWorkspaceId')
    if(selected&&!result.workspaces.some(w=>w.workspace_id===selected))sessionStorage.removeItem('secureShareWorkspaceId')
    setWs(await getWorkspace());setError('')
  }catch(e){setWs(null);setError(e instanceof Error?e.message:'Failed to load workspace.')}}
  useEffect(() => { setInvite(new URLSearchParams(location.hash.slice(1)).get('invite')??sessionStorage.getItem('secureSharePendingInvite')??'');void load() }, [])
  const act = async (fn: () => Promise<unknown>) => { setError(''); try { await fn(); await load() } catch (e) { setError(e instanceof Error ? e.message : 'Action failed.') } }
  if (!ws && !error) return <Loading label="LOADING WORKSPACE"/>
  const invitation=invite&&<Panel title="Accept invitation" kicker="VERIFIED EMAIL"><Button onClick={()=>void act(async()=>{await acceptInvitation(invite);setInvite('');sessionStorage.removeItem('secureSharePendingInvite');history.replaceState(null,'',location.pathname)})}>Accept invitation</Button><p className="mt-3 text-sm text-[#94a3b8]">Sign in using the verified email that received the invitation.</p></Panel>
  if (!ws) return <><ErrorNote>{error}</ErrorNote><Link className="text-[#38bdf8]" href="/account">Sign in to your account</Link>{invitation}<Panel title="Create a workspace" kicker="TEAM"><Field label="Workspace name"><input value={name} onChange={e=>setName(e.target.value)} className="border bg-[#0b1424] p-3"/></Field><Button disabled={!name.trim()} onClick={()=>void act(()=>createWorkspace(name))}>Create workspace</Button></Panel></>
  const can = (p: string) => ws.permissions.includes(p)
  return <>
    {invitation}
    {choices.length>1&&<Field label="Current workspace"><select value={ws.id} onChange={e=>{sessionStorage.setItem('secureShareWorkspaceId',e.target.value);void load()}} className="border border-[#293953] bg-[#0b1424] p-3">{choices.map(w=><option key={w.workspace_id} value={w.workspace_id}>{w.workspaces.name}</option>)}</select></Field>}
    {error && <ErrorNote>{error}</ErrorNote>}
    <Panel title={ws.name} kicker="WORKSPACE" action={<RoleBadge role={ws.role}/>}>
      <table className="w-full text-left text-sm"><caption className="sr-only">Workspace members</caption>
        <thead className="font-mono text-[10px] tracking-widest text-[#64748b]"><tr><th className="pb-3">MEMBER</th><th className="pb-3">ROLE</th><th className="pb-3">JOINED</th><th className="pb-3"><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>{ws.members.map(m => <tr key={m.id} className="border-t border-[#172a46]">
          <td className="py-3">{m.email}</td>
          <td>{can('members:manage') && m.role !== 'OWNER' ? <SelectBox label={`Role for ${m.email}`} value={m.role} onChange={v => act(() => changeMemberRole(m.id, v as Role))} options={ROLES.map(r => [r, r.toLowerCase()] as [string, string])}/> : <RoleBadge role={m.role}/>}</td>
          <td className="text-xs text-[#64748b]">{new Date(m.joinedAt).toLocaleDateString()}</td>
          <td className="text-right">{can('members:manage') && m.role !== 'OWNER' && <button type="button" onClick={() => act(() => removeMember(m.id))} className="font-mono text-[10px] tracking-widest text-[#fca5a5]">REMOVE</button>}</td></tr>)}</tbody></table>
    </Panel>
    {can('members:invite') && <Panel title="Invite a member" kicker="INVITATIONS">
      <div className="grid max-w-xl gap-4"><Field label="Email"><input type="email" value={email} onChange={e => setEmail(e.target.value)} className="border px-3 py-3 text-sm outline-none"/></Field>
        <SelectBox label="Invitation role" value={role} onChange={v => setRole(v as Role)} options={ROLES.map(r => [r, r.toLowerCase()] as [string, string])}/>
        <Button onClick={() => act(async () => { const result=await inviteMember(email, role);setFresh(`${location.origin}/teams#invite=${encodeURIComponent(result.token)}`); setEmail('') })} disabled={!email}>CREATE INVITATION LINK</Button></div>
      {fresh&&<div className="mt-4"><p className="text-sm text-[#94a3b8]">Share this link with the recipient. Email delivery is not configured.</p><input aria-label="Invitation link" readOnly value={fresh} className="mt-2 w-full border bg-[#0b1424] p-3 text-xs"/></div>}
      {ws.invitations.length > 0 && <ul className="mt-6 grid gap-2 text-sm text-[#94a3b8]">{ws.invitations.map(i => <li key={i.id}>{i.email} · <RoleBadge role={i.role}/> · sent {new Date(i.sentAt).toLocaleDateString()}</li>)}</ul>}
    </Panel>}
    <Panel title="Create another workspace" kicker="WORKSPACES"><Field label="Workspace name"><input value={name} onChange={e=>setName(e.target.value)} className="border bg-[#0b1424] p-3"/></Field><Button disabled={!name.trim()} onClick={()=>void act(async()=>{const created=await createWorkspace(name);sessionStorage.setItem('secureShareWorkspaceId',created.id);setName('')})}>Create workspace</Button></Panel>
  </>
}
