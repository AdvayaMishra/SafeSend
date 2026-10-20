'use client'
import {useEffect,useState} from 'react'
import {authClient} from '@/lib/auth'
import {apiRequest} from '@/lib/api/client'
import {Field} from '@/components/shared'
export function WorkspacePicker({value,onChange}:{value:string;onChange:(id:string)=>void}) {
  const [items,setItems]=useState<Array<{workspace_id:string;role:string;workspaces:{id:string;name:string}}>>([])
  useEffect(()=>{let active=true;void authClient().auth.getSession().then(async({data})=>{
    if(!data.session)return
    try{const result=await apiRequest<{workspaces:typeof items}>('/api/workspaces');if(active)setItems(result.workspaces??[])}catch{}
  });return()=>{active=false}},[])
  if(!items.length)return null
  return <Field label="Workspace"><select value={value} onChange={e=>onChange(e.target.value)} className="border border-[#293953] bg-[#0b1424] p-3 text-sm"><option value="">Personal secret</option>{items.filter(w=>w.role!=='auditor').map(w=><option key={w.workspace_id} value={w.workspace_id}>{w.workspaces.name}</option>)}</select></Field>
}
