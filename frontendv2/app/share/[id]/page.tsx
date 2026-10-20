'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { ArrowRight, LockKeyhole, Eye, Clock, AlertTriangle, ShieldCheck, Download, FileText, Image as ImageIcon, FileArchive, Check } from 'lucide-react'
import { Button } from '@/components/shared'
import { getSecretMeta, accessSecret, SecretMeta, getAttachments, downloadAttachment } from '@/lib/secure-share'
import { decryptMessage, importKeyFromUrlFragment, decryptFile } from '@/lib/encryption'
import {decryptedChunkStream,type ChunkManifest} from '@/lib/chunked-files'

const formatSize = (bytes: number) => bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`

type DecryptedAttachment = {
  id: string
  fileName: string
  mimeType: string
  fileSize: number
  keyStr: string
  ivBase64: string
  manifest?: ChunkManifest
}

export default function Viewer() {
  const { id } = useParams()
  const [meta, setMeta] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [password, setPassword] = useState('')
  const [isAccessing, setIsAccessing] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [errorCode, setErrorCode] = useState('')
  const [decryptedMessage, setDecryptedMessage] = useState<string | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<DecryptedAttachment[]>([])
  const [downloadingAttId, setDownloadingAttId] = useState<string | null>(null)
  const [dlProgress, setDlProgress] = useState<{ received: number; total: number | null } | null>(null)
  const [verifiedIds, setVerifiedIds] = useState<string[]>([])
  const [dlError, setDlError] = useState('')
  const [hasDashboardContext, setHasDashboardContext] = useState(false)

  useEffect(() => {
    if (typeof document !== 'undefined') {
      setHasDashboardContext(document.referrer.includes('/dashboard/') || document.referrer.includes('/send'))
    }
  }, [])

  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const res = await getSecretMeta(id as string)
        if (res.success) {
          setMeta(res)
        } else {
          setError(res.message || 'Message unavailable.')
        }
      } catch (err) {
        setError('Failed to fetch message details.')
      } finally {
        setLoading(false)
      }
    }
    fetchMeta()
  }, [id])

  const handleUnlock = async () => {
    setError('')
    const hashKey = window.location.hash.substring(1)
    if (!hashKey && !password) {
      setError('Decryption key missing from URL. Please ensure you copied the full link.')
      return
    }

    setIsAccessing(true)
    try {
      const res = await accessSecret(id as string, password)
      if (res.success) {
        try {
          const cryptoKey = await importKeyFromUrlFragment(hashKey)
          const plaintext = await decryptMessage(res.encryptedContent!, res.iv!, cryptoKey)
          setDecryptedMessage(plaintext)
          
          if (res.accessToken) setAccessToken(res.accessToken)

          if (res.destroyedAfterAccess) {
             setMeta((prev: any) => ({ ...prev, status: 'destroyed' }))
          } else if (res.viewsRemaining !== null) {
             setMeta((prev: any) => ({ ...prev, viewsRemaining: res.viewsRemaining }))
          }

          if (res.accessToken) {
            try {
              const attRes = await getAttachments(id as string, res.accessToken)
              if (attRes.success && attRes.attachments) {
                const decryptedAtts = []
                for (const att of attRes.attachments) {
                  if (att.encryptedKeyBundle) {
                    const bundleData = JSON.parse(att.encryptedKeyBundle)
                    const bundlePlain = await decryptMessage(bundleData.ciphertext, bundleData.iv, cryptoKey)
                    const bundleJson = JSON.parse(bundlePlain)
                    decryptedAtts.push({
                      id: att.id,
                      fileName: bundleJson.name,
                      mimeType: bundleJson.mimeType,
                      fileSize: bundleJson.size,
                      keyStr: bundleJson.key,
                      ivBase64: bundleJson.iv,
                      manifest: bundleJson.version===2?bundleJson:undefined
                    })
                  }
                }
                setAttachments(decryptedAtts)
              }
            } catch (err) {
              console.error('Failed to load attachments', err)
            }
          }
        } catch (decryptErr) {
          setError('Failed to decrypt message. The link might be invalid or corrupted.')
        }
      } else {
        if (res.code === 'INVALID_PASSWORD') {
          setPasswordError('Incorrect password.\nPlease try again.');
        } else {
          setErrorCode(res.code || '');
          setError(res.message || 'Access denied.');
        }
      }
    } catch (err) {
      setErrorCode(''); setError('Unable to contact SafeSend. Please try again.')
    } finally {
      setIsAccessing(false)
    }
  }

  const handleDownload = async (att: DecryptedAttachment) => {
    if (!accessToken) return
    setDownloadingAttId(att.id)
    setDlProgress(null)
    setDlError('')
    try {
      let decryptedBlob:Blob
      if(att.manifest) {
        if(typeof (window as any).showSaveFilePicker==='function') {
          const handle=await (window as any).showSaveFilePicker({suggestedName:att.fileName})
          const writer=await handle.createWritable()
          try {
            for await(const chunk of decryptedChunkStream(id as string,att.manifest,accessToken,{onProgress:(received,total)=>setDlProgress({received,total})}))await writer.write(chunk)
            await writer.close();setVerifiedIds(v=>v.includes(att.id)?v:[...v,att.id]);return
          }catch(error){await writer.abort();throw error}
        }
        const parts:Uint8Array<ArrayBuffer>[]=[]
        for await(const chunk of decryptedChunkStream(id as string,att.manifest,accessToken,{onProgress:(received,total)=>setDlProgress({received,total})}))parts.push(chunk as Uint8Array<ArrayBuffer>)
        decryptedBlob=new Blob(parts)
      } else {
      const encryptedBlob = await downloadAttachment(id as string, att.id, accessToken, { onProgress: (received, total) => setDlProgress({ received, total }) })
      const attKey = await importKeyFromUrlFragment(att.keyStr)
      decryptedBlob = await decryptFile(encryptedBlob, att.ivBase64, attKey)
      }
      // AES-GCM decryption only succeeds if the ciphertext is unmodified, so reaching this line is an integrity check.
      setVerifiedIds(v => v.includes(att.id) ? v : [...v, att.id])
      
      const blobUrl = URL.createObjectURL(decryptedBlob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = att.fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
    } catch (err) {
      setDlError(`Could not download or decrypt “${att.fileName}”. If the file arrived incomplete or was modified, decryption fails by design. Check your connection and try again; if it keeps failing, ask the sender to resend.`)
    } finally {
      setDownloadingAttId(null)
      setDlProgress(null)
    }
  }

  if (loading) {
    return <main className="mx-auto flex max-w-[1000px] flex-col items-center px-5 py-20 text-center"><div className="animate-pulse font-mono text-[#38bdf8]">LOADING SECURE CHANNEL...</div></main>
  }

  if (error && !decryptedMessage) {
    return (
      <main className="mx-auto flex max-w-[1000px] flex-col items-center px-5 py-20 text-center">
        <div className="w-full max-w-md">
          <div className="mx-auto grid h-24 w-24 place-items-center border border-[#7f1d1d] bg-[#0b172a] text-[#fca5a5]"><AlertTriangle size={32}/></div>
          <p className="mt-8 font-mono text-[10px] tracking-[.22em] text-[#fca5a5]">
            {errorCode === 'SECRET_EXPIRED' ? 'MESSAGE EXPIRED' : 
             errorCode === 'SECRET_DESTROYED' || errorCode === 'MAX_VIEWS_REACHED' ? 'MESSAGE UNAVAILABLE' : 
             errorCode === 'ACCESS_WINDOW_NOT_STARTED' ? 'ACCESS WINDOW NOT OPEN' :
             errorCode === 'ACCESS_WINDOW_ENDED' ? 'ACCESS WINDOW CLOSED' :
             errorCode === 'RATE_LIMITED' ? 'TOO MANY ATTEMPTS' :
             !errorCode ? 'CONNECTION ERROR' : 'ACCESS DENIED'}
          </p>
          <h2 className="mt-4 text-4xl font-light">
            {errorCode === 'SECRET_EXPIRED' ? 'Message expired' :
             errorCode === 'SECRET_DESTROYED' || errorCode === 'MAX_VIEWS_REACHED' ? 'Message unavailable' :
             errorCode === 'ACCESS_WINDOW_NOT_STARTED' ? 'Access window not open' :
             errorCode === 'ACCESS_WINDOW_ENDED' ? 'Access window closed' :
             errorCode === 'RATE_LIMITED' ? 'Too many attempts' :
             !errorCode ? 'Connection error' : 'Message unavailable'}
          </h2>
          <p className="mt-4 text-sm leading-6 text-[#94a3b8]">
            {errorCode === 'SECRET_EXPIRED' ? 'This secure message is no longer available.' :
             errorCode === 'SECRET_DESTROYED' || errorCode === 'MAX_VIEWS_REACHED' ? 'This message has been destroyed or reached its maximum view limit.' :
             errorCode === 'ACCESS_WINDOW_NOT_STARTED' ? 'This message cannot be accessed yet.' :
             errorCode === 'ACCESS_WINDOW_ENDED' ? 'The allowed access period has ended.' :
             errorCode === 'RATE_LIMITED' ? 'Please wait before trying again.' :
             !errorCode ? 'Unable to contact SafeSend. Please try again.' : error}
          </p>
          <p className="mt-5 border-t border-[#172a46] pt-5 text-xs leading-6 text-[#64748b]">
            {errorCode === 'RATE_LIMITED' ? 'Cooldowns grow with each wrong password. Wait, then enter the exact password from the sender.' :
             errorCode === 'ACCESS_WINDOW_NOT_STARTED' || errorCode === 'ACCESS_WINDOW_ENDED' ? 'The sender set a time window. Try again during that window, or ask them to adjust it.' :
             !errorCode ? 'Check your connection and reload. Your link is unchanged, and no view was used.' :
             error && /decrypt/i.test(error) ? 'The link may be missing the key after the # symbol. Ask the sender for the complete link.' :
             'This cannot be recovered. Ask the sender to create a new secure message.'}
            {' '}<a href="/docs#troubleshooting" className="underline underline-offset-4">More help</a>
          </p>
        </div>
      </main>
    )
  }

  if (decryptedMessage) {
    return (
      <main className="ss-app ss-viewer mx-auto max-w-[1000px] px-5 py-20 animate-fade-in">
        <div className="flex flex-col items-center text-center mb-16">
          <div className="mx-auto grid h-16 w-16 place-items-center border border-[#10b981] bg-[#0b172a] text-[#10b981] mb-6 rounded-full"><ShieldCheck size={24}/></div>
          <h2 className="text-3xl font-light tracking-tight">Message <span className="ss-gradient">unlocked.</span></h2>
          <p className="mt-2 text-sm text-[#94a3b8]">Decrypted locally in your browser.</p>
        </div>
        
        <div className="border border-[#213858] bg-[#0b172a] p-8 font-mono text-sm leading-relaxed whitespace-pre-wrap text-[#e2e8f0] shadow-2xl">
          {decryptedMessage}
        </div>
        
        {attachments.length > 0 && (
          <div className="mt-8">
            <h3 className="mb-4 text-lg font-light text-[#cbd5e1]">Attachments</h3>
            {dlError && <p role="alert" className="mb-3 border border-[#7f1d1d] px-4 py-3 text-sm text-[#fca5a5]">{dlError}</p>}
            <div className="grid gap-3">
              {attachments.map(att => (
                <div key={att.id} className="flex items-center justify-between border border-[#213858] bg-[#0b172a] p-4">
                  <div className="flex items-center gap-4">
                    <div className="text-[#38bdf8]">
                      {att.mimeType.startsWith('image/') ? <ImageIcon size={20}/> : 
                       att.mimeType === 'application/pdf' ? <FileText size={20}/> : 
                       att.mimeType === 'application/zip' ? <FileArchive size={20}/> : <FileText size={20}/>}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#e2e8f0]">{att.fileName}</p>
                      <p className="font-mono text-[10px] text-[#64748b]">{formatSize(att.fileSize)}{verifiedIds.includes(att.id) && <span className="ml-3 text-[#6ee7b7]">INTEGRITY VERIFIED (AES-GCM)</span>}</p>
                      {downloadingAttId === att.id && dlProgress && <div className="mt-2 h-1 w-40 bg-[#172a46]" role="progressbar" aria-label="Download progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={dlProgress.total ? Math.round(dlProgress.received / dlProgress.total * 100) : undefined}><div className={`h-full bg-[#38bdf8] ${dlProgress.total ? '' : 'animate-pulse w-full'}`} style={dlProgress.total ? { width: `${Math.min(100, dlProgress.received / dlProgress.total * 100)}%` } : undefined}/></div>}
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDownload(att)} 
                    disabled={downloadingAttId === att.id}
                    className="flex items-center gap-2 border border-[#213858] px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-[#38bdf8] transition-colors hover:bg-[#172a46] disabled:opacity-50"
                  >
                    {downloadingAttId === att.id ? (dlProgress && dlProgress.received < (dlProgress.total ?? Infinity) ? `Downloading ${dlProgress.total ? Math.round(dlProgress.received / dlProgress.total * 100) + '%' : formatSize(dlProgress.received)}` : 'Decrypting...') : <><Download size={14}/> Download</>}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-wrap justify-between items-center gap-4 border-t border-[#172a46] pt-6 font-mono text-[10px] uppercase tracking-widest text-[#64748b]">
           {meta?.viewsRemaining !== null && meta?.viewsRemaining !== undefined && <span>{meta.viewsRemaining} VIEWS REMAINING</span>}
           {meta?.status === 'destroyed' && <span className="text-[#fca5a5]">DESTROYED ON VIEW</span>}
           {meta?.expiresAt && <span>EXPIRES {new Date(meta.expiresAt).toLocaleString()}</span>}
        </div>
        {hasDashboardContext && (
          <div className="mt-8 text-center">
            <a href={`/dashboard/${id}`} className="font-mono text-[10px] uppercase tracking-widest text-[#64748b] hover:text-[#38bdf8] transition-colors">
              &larr; BACK TO SECURITY DASHBOARD
            </a>
          </div>
        )}
      </main>
    )
  }

  return (
    <main className="ss-app ss-viewer mx-auto flex max-w-[1000px] flex-col items-center px-5 py-20 text-center animate-fade-in relative">
      {hasDashboardContext && (
        <div className="absolute left-5 top-5 hidden md:block">
           <a href={`/dashboard/${id}`} className="font-mono text-[10px] uppercase tracking-widest text-[#64748b] hover:text-[#38bdf8] flex items-center gap-2 transition-colors">
             &larr; BACK TO SECURITY DASHBOARD
           </a>
        </div>
      )}
      <div className="w-full max-w-md">
        <div className="mx-auto grid h-24 w-24 place-items-center border border-[#2563eb] bg-[#0b172a] text-[#38bdf8]">
          <LockKeyhole size={32}/>
        </div>
        <p className="mt-8 font-mono text-[10px] tracking-[.22em] text-[#38bdf8]">LOCKED / SECURE CHANNEL</p>
        <h2 className="mt-4 text-4xl font-light">Secure message</h2>
        <p className="mt-4 text-sm leading-6 text-[#94a3b8]">This message is encrypted. You may need a password to unlock it.</p>
        
        {meta?.requiresPassword && (
          <input 
            value={password} 
            onChange={e=>{setPassword(e.target.value); setPasswordError('');}} 
            type="password" 
            placeholder="Enter password" 
            className="mt-10 w-full border border-[#213858] bg-[#0b172a] px-4 py-4 text-center font-mono outline-none focus:border-[#38bdf8] tracking-widest text-lg"
          />
        )}
        
        <Button onClick={handleUnlock} disabled={isAccessing} className="mt-6 w-full">
          {isAccessing ? 'DECRYPTING...' : 'UNLOCK'} <ArrowRight size={15}/>
        </Button>
        {passwordError && (
          <p className="mt-4 text-xs text-[#fca5a5] whitespace-pre-line">{passwordError}</p>
        )}
      </div>
    </main>
  )
}
