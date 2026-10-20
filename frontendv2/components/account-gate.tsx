'use client'
import {useEffect,useState,type ReactNode} from 'react'
import Link from 'next/link'
import {authClient} from '@/lib/auth'
import {Panel,Loading,ErrorNote} from '@/components/ui-kit'
export function AccountGate({children}:{children:ReactNode}) {
  const [ready,setReady]=useState(false),[signedIn,setSignedIn]=useState(false),[error,setError]=useState('')
  useEffect(()=>{
    try {
      if(location.pathname==='/teams'){
        const invite=new URLSearchParams(location.hash.slice(1)).get('invite')
        if(invite)sessionStorage.setItem('secureSharePendingInvite',invite)
      }
      const client=authClient();let active=true
      void client.auth.getSession().then(({data,error})=>{if(!active)return;if(error)setError(error.message);setSignedIn(!!data.session);setReady(true)})
      const {data:{subscription}}=client.auth.onAuthStateChange((_event,session)=>{if(active){setSignedIn(!!session);setReady(true)}})
      return()=>{active=false;subscription.unsubscribe()}
    }catch(e){setError(e instanceof Error?e.message:'Account authentication unavailable.');setReady(true)}
  },[])
  if(!ready)return <Loading label="CHECKING ACCOUNT"/>
  if(error)return <ErrorNote>{error}</ErrorNote>
  if(!signedIn)return <Panel title="Sign in to continue" kicker="ACCOUNT ACCESS"><p className="text-sm text-[#94a3b8]">Account and workspace data requires a verified server session.</p><Link href="/account" className="mt-4 inline-block text-sm text-[#38bdf8]">Open account sign-in</Link></Panel>
  return <>{children}</>
}
