'use client'
import { useEffect,useState } from 'react'
import Link from 'next/link'
import { authClient } from '@/lib/auth'
import { PageShell,Panel } from '@/components/ui-kit'
import { Button,Field } from '@/components/shared'
import {CAPABILITIES} from '@/lib/capabilities'
import {signInWithPasskey} from '@/lib/api/account'
export default function AccountPage() {
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[signedIn,setSignedIn]=useState<string|null>(null)
  const [message,setMessage]=useState(''),[busy,setBusy]=useState(false),[recovering,setRecovering]=useState(false)
  useEffect(()=>{
    const client=authClient()
    void client.auth.getSession().then(({data})=>setSignedIn(data.session?.user.email??null))
    const {data:{subscription}}=client.auth.onAuthStateChange((event,session)=>{
      setSignedIn(session?.user.email??null);if(event==='PASSWORD_RECOVERY')setRecovering(true)
    })
    return()=>subscription.unsubscribe()
  },[])
  async function act(action:'login'|'register'|'reset'|'logout'|'update') {
    setBusy(true);setMessage('')
    try {
      const client=authClient(),redirectTo=`${location.origin}/account`
      const result=action==='login'?await client.auth.signInWithPassword({email,password}):
        action==='register'?await client.auth.signUp({email,password,options:{emailRedirectTo:redirectTo}}):
        action==='reset'?await client.auth.resetPasswordForEmail(email,{redirectTo}):
        action==='update'?await client.auth.updateUser({password}):await client.auth.signOut()
      if(result.error) throw result.error
      setPassword('')
      setMessage(action==='register'?'Registration submitted. Check your email for verification.':action==='reset'?
        'If this account exists, a recovery email will be sent.':action==='update'?'Password updated.':'Account session updated.')
      if(action==='update')setRecovering(false)
    } catch(error) {setMessage(error instanceof Error?error.message:'Account request failed.')} finally {setBusy(false)}
  }
  return <PageShell kicker="Account" title="Your" accent="account." intro="Sign in to manage workspace secrets and verified recipient access. Anonymous sharing remains available.">
    <Panel title={signedIn?'Signed in':'Sign in or register'} kicker="SUPABASE AUTH">
      {signedIn?<><p className="mb-4 text-sm text-[#94a3b8]">{signedIn}</p><div className="flex flex-wrap gap-4"><Button disabled={busy} onClick={()=>void act('logout')}>Sign out</Button><Link href="/account/security" className="p-3 text-[#38bdf8]">Security settings</Link><Link href="/teams" className="p-3 text-[#38bdf8]">Workspaces and invitations</Link></div></>:<form className="grid max-w-md gap-4" onSubmit={e=>{e.preventDefault();void act('login')}}>
        <Field label="Email"><input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} className="border border-[#293953] bg-[#0b1424] p-3"/></Field>
        <Field label="Password"><input type="password" required minLength={8} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} className="border border-[#293953] bg-[#0b1424] p-3"/></Field>
        <Button type="submit" disabled={busy}>Sign in</Button>{CAPABILITIES.passkeys&&<Button secondary disabled={busy} onClick={()=>{setBusy(true);void signInWithPasskey().catch(e=>setMessage(e instanceof Error?e.message:'Passkey sign-in failed.')).finally(()=>setBusy(false))}}>Sign in with passkey</Button>}<Button secondary disabled={busy||!email||password.length<8} onClick={()=>void act('register')}>Create account</Button>
        <Button secondary disabled={busy||!email} onClick={()=>void act('reset')}>Send password reset email</Button>
      </form>}
      {recovering&&<div className="mt-5 grid max-w-md gap-4"><Field label="New password"><input type="password" minLength={8} value={password} onChange={e=>setPassword(e.target.value)} className="border border-[#293953] bg-[#0b1424] p-3"/></Field><Button disabled={busy||password.length<8} onClick={()=>void act('update')}>Save new password</Button></div>}
      {message&&<p role="status" className="mt-5 text-sm text-[#94a3b8]">{message}</p>}
    </Panel>
  </PageShell>
}
