'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, Eye, EyeOff, RefreshCw, ShieldCheck, Download } from 'lucide-react'
import { Button, Field } from '@/components/shared'
import { AttachmentPicker } from '@/components/attachment-picker'
import { generatePassword, passwordLabel, scorePassword, createSecret, uploadAttachmentWithProgress } from '@/lib/secure-share'
import { addToRegistry } from '@/lib/secret-registry'
import { InfoTip } from '@/components/ui-kit'
import { UploadQueue, type QueueItem } from '@/components/upload-queue'
import { PolicyPresets, UnavailablePolicies, type PolicyValues } from '@/components/access-policy-panel'
import { FirstUseGuide, KeyFragmentNotice } from '@/components/onboarding'
import { generateEncryptionKey, exportKeyToUrlFragment, encryptMessage, encryptFile } from '@/lib/encryption'
import { QRCodeSVG } from 'qrcode.react'
import { uploadChunkedFile } from '@/lib/chunked-files'
import {WorkspacePicker} from '@/components/workspace-picker'

export default function Send() {
  const [message, setMessage] = useState('')
  const [recipientEmail,setRecipientEmail]=useState('')
  const [workspaceId,setWorkspaceId]=useState('')
  const [attachments, setAttachments] = useState<File[]>([])
  const [uploadStatus, setUploadStatus] = useState('')
  const [usePassword, setUsePassword] = useState(true)
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [once, setOnce] = useState(false)
  const [maxViews, setMaxViews] = useState('3')
  const [expiration, setExpiration] = useState('24 hours')
  
  const [useAccessWindow, setUseAccessWindow] = useState(false)
  const [accessStart, setAccessStart] = useState('')
  const [accessEnd, setAccessEnd] = useState('')

  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const [successData, setSuccessData] = useState<{ id: string, key: string } | null>(null)
  
  const [copied, setCopied] = useState(false)

  // Attachment upload pipeline state (encrypt once, retry uploads without re-encrypting)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [pending, setPending] = useState<{ id: string, key: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [skipped, setSkipped] = useState(0)
  const prepared = useRef(new Map<number, { blob: Blob, bundle: string }>())
  const doneRef = useRef(new Set<number>())
  const filesRef = useRef<File[]>([])
  const secretKey = useRef<CryptoKey | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const patchItem = (i: number, patch: Partial<QueueItem> | ((it: QueueItem) => Partial<QueueItem>)) =>
    setQueue(q => q.map((it, idx) => idx === i ? { ...it, ...(typeof patch === 'function' ? patch(it) : patch) } : it))

  const applyPreset = (v: PolicyValues) => {
    setUsePassword(v.usePassword); setOnce(v.once); setMaxViews(v.maxViews); setExpiration(v.expiration); setUseAccessWindow(v.useAccessWindow)
  }

  const finish = (id: string, key: string, skippedCount = 0) => {
    setSkipped(skippedCount); setPending(null); setQueue([]); setSuccessData({ id, key })
  }

  const runUploads = async (id: string, key: string) => {
    const files = filesRef.current
    const controller = new AbortController()
    abortRef.current = controller
    setUploading(true)
    let allDone = true
    for (let i = 0; i < files.length; i++) {
      if (doneRef.current.has(i)) continue
      if (controller.signal.aborted) { allDone = false; break }
      const att = files[i]
      try {
        if(att.size>4*1024*1024) {
          patchItem(i,it=>({phase:'uploading',progress:0,attempts:it.attempts+1,error:undefined}))
          await uploadChunkedFile(id,att,secretKey.current as CryptoKey,{signal:controller.signal,onProgress:f=>patchItem(i,{progress:f})})
          doneRef.current.add(i);patchItem(i,{phase:'done',progress:1});continue
        }
        let prep = prepared.current.get(i)
        if (!prep) {
          patchItem(i, { phase: 'encrypting', progress: 0, error: undefined })
          const attKey = await generateEncryptionKey()
          const { ciphertext, iv } = await encryptFile(att, attKey)
          const bundle = { key: await exportKeyToUrlFragment(attKey), iv, name: att.name, mimeType: att.type, size: att.size }
          const enc = await encryptMessage(JSON.stringify(bundle), secretKey.current as CryptoKey)
          prep = { blob: ciphertext, bundle: JSON.stringify({ ciphertext: enc.ciphertext, iv: enc.iv }) }
          prepared.current.set(i, prep)
        }
        patchItem(i, it => ({ phase: 'uploading', progress: 0, attempts: it.attempts + 1, error: undefined }))
        const res = await uploadAttachmentWithProgress(id, prep.blob, prep.bundle, att.name, { signal: controller.signal, onProgress: f => patchItem(i, { progress: f }) })
        if (!res.success) throw new Error(res.message || `Failed to upload ${att.name}`)
        doneRef.current.add(i)
        patchItem(i, { phase: 'done', progress: 1 })
      } catch (err) {
        allDone = false
        if (err instanceof DOMException && err.name === 'AbortError') patchItem(i, { phase: 'cancelled' })
        else patchItem(i, { phase: 'failed', error: err instanceof Error ? err.message : 'Upload failed.' })
        break
      }
    }
    setUploading(false)
    if (allDone) finish(id, key)
  }

  // Generate strong password by default
  useEffect(() => {
    if (usePassword && !password) setPassword(generatePassword())
  }, [usePassword])

  const score = useMemo(() => scorePassword(password), [password])
  
  const getExpiresAt = () => {
    const now = new Date()
    let hours = 24
    if (expiration === '10 minutes') hours = 1/6
    else if (expiration === '1 hour') hours = 1
    else if (expiration === '6 hours') hours = 6
    else if (expiration === '3 days') hours = 24 * 3
    else if (expiration === '7 days') hours = 24 * 7
    return new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString()
  }

  const submit = async () => {
    if (!message.trim() && attachments.length === 0) { setError('Write a secure message or add an attachment before continuing.'); return }
    if (usePassword && !password) { setError('Password is required when password protection is enabled.'); return }
    if (useAccessWindow && accessStart && accessEnd && new Date(accessEnd) <= new Date(accessStart)) { setError('The access window must end after it starts.'); return }
    setError('')
    setIsSubmitting(true)
    setUploadStatus('Encrypting message...')

    try {
      const key = await generateEncryptionKey()
      const { ciphertext, iv } = await encryptMessage(message, key)
      const keyString = await exportKeyToUrlFragment(key)

      setUploadStatus('Creating secure link...')
      const res = await createSecret({
        message: 'unused',
        encryptedContent: ciphertext,
        iv: iv,
        password: usePassword ? password : undefined,
        expiresAt: getExpiresAt(),
        accessStart: useAccessWindow && accessStart ? new Date(accessStart).toISOString() : undefined,
        accessEnd: useAccessWindow && accessEnd ? new Date(accessEnd).toISOString() : undefined,
        maxViews: once ? 1 : (maxViews === 'unlimited' ? 'unlimited' : parseInt(maxViews, 10)),
        viewOnce: once,
        recipientEmail: recipientEmail.trim() || undefined,
        workspaceId: workspaceId || undefined
      } as any)

      if (res.success) {
        addToRegistry(res.secretId)
        try { localStorage.setItem('secureShareLastSecretId', res.secretId) } catch (e) {}
        setUploadStatus('')
        if (attachments.length > 0) {
          secretKey.current = key
          filesRef.current = attachments
          prepared.current.clear(); doneRef.current.clear()
          setQueue(attachments.map(f => ({ name: f.name, size: f.size, phase: 'queued', progress: 0, attempts: 0 })))
          setPending({ id: res.secretId, key: keyString })
          setUploadStatus('Uploading attachments...')
          await runUploads(res.secretId, keyString)
        } else {
          setSuccessData({ id: res.secretId, key: keyString })
        }
      } else {
        setError(res.message || 'Failed to create secret')
        setUploadStatus('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.')
      setUploadStatus('');
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (successData) {
    const shareUrl = `${window.location.origin}/share/${successData.id}#${successData.key}`
    const handleCopy = async () => {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }

    const downloadQR = () => {
      const svg = document.getElementById('qr-code-svg')
      if (svg) {
        const svgData = new XMLSerializer().serializeToString(svg)
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        const img = new Image()
        img.onload = () => {
          canvas.width = img.width
          canvas.height = img.height
          ctx?.drawImage(img, 0, 0)
          const pngFile = canvas.toDataURL('image/png')
          const downloadLink = document.createElement('a')
          downloadLink.download = `secureshare-${successData.id}.png`
          downloadLink.href = pngFile
          downloadLink.click()
        }
        img.src = 'data:image/svg+xml;base64,' + btoa(svgData)
      }
    }

    return (
      <main className="ss-app ss-success mx-auto max-w-[900px] px-5 py-20 text-center animate-fade-in">
        <div className="mx-auto grid h-24 w-24 place-items-center border border-[#2563eb] bg-[#0b172a] text-[#38bdf8]">
          <Check size={32}/>
        </div>
        <p className="mt-8 font-mono text-[10px] tracking-[.22em] text-[#38bdf8]">SAFESEND LINK CREATED</p>
        <h2 className="mt-4 text-4xl font-light sm:text-6xl">Share result.</h2>
        
        {skipped > 0 && <p role="status" className="mx-auto mt-8 max-w-xl border border-[#f59e0b]/40 px-4 py-3 text-sm text-[#fbbf24]">{skipped} attachment{skipped > 1 ? 's were' : ' was'} not uploaded and will not be available to the recipient.</p>}
        <div className="mt-10 mx-auto max-w-xl">
          <div className="flex border border-[#213858] bg-[#0b172a]">
            <input readOnly value={shareUrl} className="flex-1 bg-transparent px-4 py-3 text-sm font-mono text-[#cbd5e1] outline-none truncate" />
            <button onClick={handleCopy} className="border-l border-[#213858] px-4 hover:bg-[#172a46] text-[#38bdf8] text-xs font-bold tracking-wider uppercase transition-colors">
              {copied ? 'COPIED' : 'COPY'}
            </button>
          </div>
        </div>

        <div className="mt-12 flex flex-col md:flex-row items-center justify-center gap-16">
          <div className="flex flex-col gap-4 text-left font-mono text-xs text-[#94a3b8]">
            <div className="flex items-center gap-3"><ShieldCheck size={16} className="text-[#38bdf8]"/> {usePassword ? 'Password protected' : 'No password'}</div>
            <div className="flex items-center gap-3"><ShieldCheck size={16} className="text-[#38bdf8]"/> {once ? 'View once' : `${maxViews} maximum views`}</div>
            <div className="flex items-center gap-3"><ShieldCheck size={16} className="text-[#38bdf8]"/> Expires in {expiration}</div>
          </div>
          
          <div className="flex flex-col items-center">
            <div className="bg-white p-4 mb-4">
              <QRCodeSVG id="qr-code-svg" value={shareUrl} size={140} level="M" />
            </div>
            <button onClick={downloadQR} className="text-xs font-mono text-[#38bdf8] hover:text-white uppercase tracking-widest flex items-center gap-2">
              <Download size={14} /> Download QR
            </button>
          </div>
        </div>

        <KeyFragmentNotice/>

        <div className="mt-16 flex justify-center gap-4">
          <Button secondary onClick={() => { setSuccessData(null); setMessage(''); setPassword(''); setSkipped(0) }}>CREATE ANOTHER</Button>
          <Link href={`/dashboard/${successData.id}`}>
            <Button>SECURITY DASHBOARD</Button>
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="ss-app mx-auto max-w-[1280px] px-5 py-14 lg:px-8">
      <p className="font-mono text-[10px] uppercase tracking-[.2em] text-[#38bdf8]">Create transmission / 02</p>
      <h2 className="mt-4 text-4xl font-light tracking-[-.04em] sm:text-6xl">Create something <span className="ss-gradient">only they can see.</span></h2><p className="ss-page-intro">Encrypted in your browser. Delivered on your terms. Set the rules before your secret leaves this device.</p>
      <FirstUseGuide />
      
      <div className="mt-12 grid items-start gap-7 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,.7fr)]">
        <section className="ss-editor grid gap-7">
          <Field label="Secure message" hint={`${message.length} / 10,000 characters`}>
            <textarea value={message} onChange={e=>setMessage(e.target.value.slice(0,10000))} rows={9} placeholder="Write something only the recipient should see..." className="resize-none border border-[#213858] bg-[#0b172a] p-4 leading-6 outline-none focus:border-[#38bdf8]"/>
          </Field>
          
          <AttachmentPicker onFilesChange={setAttachments} />

          <div className="flex items-center justify-between border-t border-[#172a46] pt-6">
            <span className="font-mono text-[10px] uppercase tracking-[.16em] text-[#94a3b8]">PASSWORD PROTECTION <InfoTip label="About password protection">Recipients must enter this password to open the message. Repeated wrong attempts trigger temporary cooldowns. Share it through a different channel than the link.</InfoTip></span>
            <button type="button" onClick={()=>setUsePassword(!usePassword)} className="border border-[#213858] px-3 py-2 font-mono text-[10px] tracking-widest text-[#38bdf8]">{usePassword?'ON':'OFF'}</button>
          </div>
          
          {usePassword && (
            <Field label="Password">
              <div className="relative">
                <input value={password} onChange={e=>setPassword(e.target.value)} type={show?'text':'password'} placeholder="Create a strong password" className="w-full border border-[#213858] bg-[#0b172a] px-4 py-4 pr-12 outline-none focus:border-[#38bdf8] font-mono"/>
                <button type="button" aria-label={show?'Hide password':'Show password'} onClick={()=>setShow(!show)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#64748b]">
                  {show?<EyeOff size={17}/>:<Eye size={17}/>}
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <button type="button" onClick={() => { setPassword(generatePassword()); setShow(true) }} className="font-mono text-[10px] uppercase tracking-widest text-[#38bdf8] hover:text-white">Suggest Strong Password</button>
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#64748b]">Use a unique passphrase</span>
              </div>
              <div className="mt-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest">
                <span className={score>64?'text-[#38bdf8]':'text-[#f59e0b]'}>{passwordLabel(score)}</span>
                <span className="text-[#64748b]">{score} / 100</span>
              </div>
              <div className="mt-2 h-1 bg-[#172a46]">
                <div className="h-full bg-[#38bdf8] transition-all" style={{width:`${score}%`}}/>
              </div>
              <p className="mt-3 text-xs leading-5 text-[#64748b]">Requirements: 12+ characters, mixed case, number, and symbol. Strength also penalizes predictable patterns.</p>
            </Field>
          )}

          <div className="grid gap-5 border-t border-[#172a46] pt-6">
            <p className="font-mono text-[10px] tracking-widest text-[#38bdf8]">ACCESS CONTROL</p>
            <PolicyPresets onApply={applyPreset} />
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#cbd5e1]">View Once <InfoTip label="About view once">The message is destroyed right after the first successful open. Use it for credentials and one-time codes.</InfoTip></span>
              <button type="button" onClick={()=>setOnce(!once)} className="border border-[#213858] px-3 py-2 font-mono text-[10px] tracking-widest text-[#38bdf8]">{once?'ON':'OFF'}</button>
            </div>
            {once && <p className="text-xs text-[#94a3b8]">Message will be destroyed after the first successful view.</p>}
            
            {!once && (
              <Field label="Maximum views">
                <select value={maxViews} onChange={e=>setMaxViews(e.target.value)} className="border border-[#213858] bg-[#061225] px-4 py-3 outline-none">
                  <option value="3">3 views</option>
                  <option value="5">5 views</option>
                  <option value="10">10 views</option>
                  <option value="unlimited">Unlimited</option>
                </select>
              </Field>
            )}
            
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-[#cbd5e1]">Access Window <InfoTip label="About the access window">The link exists now but only opens between these times. Set just a start time for a scheduled release. The message still expires at the time set below.</InfoTip></span>
              <button type="button" onClick={()=>setUseAccessWindow(!useAccessWindow)} className="border border-[#213858] px-3 py-2 font-mono text-[10px] tracking-widest text-[#38bdf8]">{useAccessWindow?'ON':'OFF'}</button>
            </div>
            {useAccessWindow && <p className="text-xs text-[#64748b]">Leave End empty to release at the start time with no closing time.</p>}
            {useAccessWindow && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Start"><input type="datetime-local" value={accessStart} onChange={e=>setAccessStart(e.target.value)} className="w-full border border-[#213858] bg-[#0b172a] px-3 py-2 text-xs outline-none focus:border-[#38bdf8]" /></Field>
                <Field label="End"><input type="datetime-local" value={accessEnd} onChange={e=>setAccessEnd(e.target.value)} className="w-full border border-[#213858] bg-[#0b172a] px-3 py-2 text-xs outline-none focus:border-[#38bdf8]" /></Field>
              </div>
            )}
          </div>

          <div className="grid gap-5 border-t border-[#172a46] pt-6">
            <p className="font-mono text-[10px] tracking-widest text-[#38bdf8]">TIME CONTROL</p>
            <Field label="Message expiration" hint="After this time the message is destroyed even if it was never opened.">
              <select value={expiration} onChange={e=>setExpiration(e.target.value)} className="border border-[#213858] bg-[#061225] px-4 py-3 outline-none">
                <option>10 minutes</option><option>1 hour</option><option>6 hours</option><option>24 hours</option><option>3 days</option><option>7 days</option>
              </select>
            </Field>
          </div>

          <WorkspacePicker value={workspaceId} onChange={setWorkspaceId}/>
          <Field label="Verified recipient email (optional)" hint="The recipient must sign in with this verified email before the backend releases ciphertext. Keep the decryption key in the share link."><input type="email" value={recipientEmail} onChange={e=>setRecipientEmail(e.target.value)} placeholder="recipient@example.com" className="border px-3 py-3 text-sm outline-none"/></Field>

          {pending && <UploadQueue items={queue} uploading={uploading} onCancel={() => abortRef.current?.abort()} onRetry={() => void runUploads(pending.id, pending.key)} onSkip={() => finish(pending.id, pending.key, queue.filter(q => q.phase !== 'done').length)} />}

          {error && <p role="alert" className="border border-[#7f1d1d] px-4 py-3 text-sm text-[#fca5a5]">{error}</p>}
          <Button onClick={submit} className="w-full sm:w-fit" disabled={isSubmitting || !!pending}>
            {isSubmitting ? (uploadStatus || 'ENCRYPTING...') : 'CREATE SECURE MESSAGE'} <ArrowRight size={15}/>
          </Button>
        </section>

        <aside className="ss-policy-card border border-[#172a46] bg-[#0b172a] p-6 lg:p-8">
          <ShieldCheck className="text-[#38bdf8]"/>
          <p className="ss-kicker mt-8">LIVE POLICY PREVIEW</p><h3 className="mt-3 text-2xl font-light">Your security, configured.</h3>
          <p className="mt-3 text-sm leading-6 text-[#94a3b8]">Your message will be encrypted in your browser using AES-GCM before being sent to the SafeSend backend.</p>
          <div className="mt-8 grid gap-4 border-t border-[#172a46] pt-6 text-xs text-[#64748b]">
            <span className="flex items-center gap-2"><Check size={14} className="text-[#38bdf8]"/> AES-256-GCM Encryption</span>
            <span className="flex items-center gap-2"><Check size={14} className="text-[#38bdf8]"/> {usePassword ? 'Password Authentication' : 'No Password Required'}</span>
            <span className="flex items-center gap-2"><Check size={14} className="text-[#38bdf8]"/> {once ? 'Burn after read' : `${maxViews} maximum views`}</span>
            <span className="flex items-center gap-2"><Check size={14} className="text-[#38bdf8]"/> Expires in {expiration}</span>
            {useAccessWindow && accessStart && <span className="flex items-center gap-2"><Check size={14} className="text-[#38bdf8]"/> Opens {new Date(accessStart).toLocaleString()}</span>}
          </div>
        </aside>
      </div>
    </main>
  )
}

