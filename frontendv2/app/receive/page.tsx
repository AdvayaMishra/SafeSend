'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, QrCode, X, Upload } from 'lucide-react'
import { Button, Field } from '@/components/shared'
import { BrowserQRCodeReader } from '@zxing/browser'

export default function Receive() {
  const router = useRouter()
  const [scan, setScan] = useState(false)
  const [isUploadingQR, setIsUploadingQR] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [link, setLink] = useState('')
  const [error, setError] = useState('')

  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploadingQR(true)
    setError('')

    try {
      const objectUrl = URL.createObjectURL(file)
      const codeReader = new BrowserQRCodeReader()
      
      const img = new Image()
      img.src = objectUrl
      await new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; })

      try {
        const result = await codeReader.decodeFromImageElement(img)
        const urlText = result.getText()
        
        try {
          const url = new URL(urlText)
          if (url.pathname.startsWith('/share/')) {
            router.push(url.pathname + url.hash)
          } else {
            setError('INVALID SAFESEND QR CODE.')
          }
        } catch {
          if (urlText.startsWith('/share/')) {
            router.push(urlText)
          } else {
            setError('INVALID SAFESEND QR CODE.')
          }
        }
      } catch (decodeErr) {
        setError('COULD NOT READ QR CODE. PLEASE TRY ANOTHER IMAGE.')
      }
      
      URL.revokeObjectURL(objectUrl)
    } catch (err) {
      setError('COULD NOT READ QR CODE. PLEASE TRY ANOTHER IMAGE.')
    } finally {
      setIsUploadingQR(false)
      if (e.target) e.target.value = ''
    }
  }

  const handleAccess = () => {
    try {
      const url = new URL(link)
      if (url.pathname.startsWith('/share/')) {
        router.push(url.pathname + url.hash)
      } else {
        setError('Invalid SafeSend link format.')
      }
    } catch {
      if (link.startsWith('/share/')) {
        router.push(link)
      } else {
        setError('Invalid URL. Please paste a valid link.')
      }
    }
  }
  
  const startScanner = async () => {
    setScan(true)
    setError('')
    try {
      const codeReader = new BrowserQRCodeReader()
      const videoElement = document.getElementById('qr-video') as HTMLVideoElement
      await codeReader.decodeOnceFromVideoDevice(undefined, videoElement)
        .then((result) => {
          setLink(result.getText())
          setScan(false)
        })
        .catch(err => {
          console.error(err)
        })
    } catch (err) {
      setError('Camera access denied or unavailable.')
      setScan(false)
    }
  }

  return (
    <main className="ss-app ss-receive mx-auto max-w-[1280px] px-5 py-14 lg:px-8">
      <p className="font-mono text-[10px] uppercase tracking-[.2em] text-[#38bdf8]">Open transmission / 03</p>
      <h2 className="mt-4 text-4xl font-light sm:text-6xl">Your secure <span className="ss-gradient">access portal.</span></h2><p className="ss-page-intro">Open an encrypted message privately. Your decryption key stays in this browser.</p>
      
      <div className="ss-receive-panel mt-12 max-w-xl grid gap-6">
        <Field label="Enter your SafeSend link">
          <input 
            value={link} 
            onChange={e => setLink(e.target.value)} 
            placeholder="https://..." 
            className="border border-[#213858] bg-[#0b172a] px-4 py-4 outline-none focus:border-[#38bdf8] font-mono"
          />
        </Field>
        {error && <p className="text-[#fca5a5] text-sm">{error}</p>}
        <Button onClick={handleAccess} className="w-full">UNLOCK SECURE MESSAGE <ArrowRight size={15}/></Button>
        
        <div className="flex items-center gap-4">
          <span className="h-px flex-1 bg-[#172a46]"/>
          <span className="font-mono text-[10px] text-[#64748b]">OR</span>
          <span className="h-px flex-1 bg-[#172a46]"/>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Button secondary onClick={startScanner} className="w-full"><QrCode size={16}/> SCAN QR CODE</Button>
          <Button secondary onClick={() => fileInputRef.current?.click()} className="w-full" disabled={isUploadingQR}>
            <Upload size={16}/> {isUploadingQR ? 'READING QR IMAGE...' : 'UPLOAD QR IMAGE'}
          </Button>
          <input 
            type="file" 
            accept="image/*" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
        </div>
      </div>

      {scan && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#020617]/90 p-5 backdrop-blur-sm">
          <div className="w-full max-w-md border border-[#213858] bg-[#0b172a] p-6 shadow-2xl">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-mono text-[10px] tracking-widest text-[#38bdf8]">CAMERA / ACTIVE</p>
                <h3 className="mt-2 text-2xl font-light">Scan secure link</h3>
              </div>
              <button onClick={() => setScan(false)} aria-label="Close scanner" className="text-[#64748b] hover:text-white transition-colors">
                <X/>
              </button>
            </div>
            
            <div className="relative mt-6 grid h-72 place-items-center overflow-hidden border border-[#2563eb] bg-[#030b1b]">
              <video id="qr-video" className="w-full h-full object-cover"></video>
              <div className="absolute inset-10 border border-[#38bdf8] pointer-events-none opacity-50"/>
            </div>
            
            <Button secondary onClick={() => setScan(false)} className="mt-5 w-full">CANCEL</Button>
          </div>
        </div>
      )}
    </main>
  )
}
