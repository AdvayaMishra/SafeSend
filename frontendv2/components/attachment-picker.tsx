'use client'

import { useEffect, useRef, useState } from 'react'
import { FileArchive, FileText, Image as ImageIcon, Paperclip, X } from 'lucide-react'

type AttachmentStatus = 'selected' | 'preparing' | 'uploading' | 'complete' | 'error' | 'removed'
type Attachment = { id: string; file: File; name: string; mimeType: string; size: number; previewUrl?: string; status: AttachmentStatus; error?: string }

const ACCEPT = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/plain', 'application/zip']
const MAX = 25 * 1024 * 1024
const formatSize = (bytes: number) => bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`

export function AttachmentPicker({ onFilesChange }: { onFilesChange?: (files: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<Attachment[]>([])
  const [dragging, setDragging] = useState(false)

  // Notify parent on valid changes
  useEffect(() => {
    onFilesChange?.(items.filter(i => i.status === 'selected').map(i => i.file))
  }, [items, onFilesChange])

  // Cleanup object urls on unmount ONLY
  useEffect(() => {
    return () => {
      items.forEach(item => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
      })
    }
  }, [items])

  const addFiles = (files: File[]) => setItems(current => [...current, ...files.map(file => {
    const valid = ACCEPT.includes(file.type) && file.size <= MAX
    return { id: `${file.name}-${file.lastModified}-${Math.random()}`, file, name: file.name, mimeType: file.type, size: file.size, previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined, status: valid ? 'selected' : 'error', error: valid ? undefined : file.size > MAX ? 'Over 25 MB limit' : 'File type not supported' } as Attachment
  })])

  const remove = (id: string) => setItems(current => {
    const item = current.find(i => i.id === id)
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl)
    return current.filter(i => i.id !== id)
  })
  
  const total = items.reduce((sum, item) => sum + item.size, 0)
  return <section className="grid gap-4 border-t border-[#172a46] pt-7" aria-labelledby="attachments-title">
    <div className="flex items-end justify-between gap-4"><div><p className="font-mono text-[10px] tracking-[.18em] text-[#38bdf8]">OPTIONAL</p><h3 id="attachments-title" className="mt-2 text-xl font-light">Attachments</h3></div><span className="font-mono text-[10px] tracking-widest text-[#64748b]">{items.length} SELECTED / {formatSize(total)}</span></div>
    <button type="button" onClick={() => inputRef.current?.click()} onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); addFiles(Array.from(e.dataTransfer.files)) }} className={`grid min-h-28 place-items-center border border-dashed px-5 py-6 text-center transition-colors ${dragging ? 'border-[#38bdf8] bg-[#0b223d]' : 'border-[#294568] bg-[#061225] hover:border-[#38bdf8]'}`}><Paperclip className="text-[#38bdf8]" size={19}/><span className="text-sm text-[#cbd5e1]">Drop files here or <span className="text-[#38bdf8]">browse</span></span><span className="font-mono text-[10px] tracking-widest text-[#64748b]">PNG JPG WEBP PDF TXT ZIP / MAX 25 MB EACH</span></button>
    <input ref={inputRef} type="file" multiple accept={ACCEPT.join(',')} className="sr-only" onChange={e => addFiles(Array.from(e.target.files ?? []))}/>
    {items.length > 0 && <div className="grid gap-2">{items.map(item => <div key={item.id} className="flex items-center gap-3 border border-[#213858] bg-[#0b172a] p-3"><div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden border border-[#294568] bg-[#061225] text-[#38bdf8]">{item.previewUrl ? <img src={item.previewUrl} alt="" className="h-full w-full object-cover"/> : item.mimeType === 'application/pdf' || item.mimeType === 'text/plain' ? <FileText size={17}/> : item.mimeType === 'application/zip' ? <FileArchive size={17}/> : <ImageIcon size={17}/>}</div><div className="min-w-0 flex-1"><p className="truncate text-sm text-[#e2e8f0]">{item.name}</p><p className={`font-mono text-[10px] tracking-widest ${item.status === 'error' ? 'text-[#fca5a5]' : 'text-[#64748b]'}`}>{item.status === 'error' ? item.error : `SELECTED / ${formatSize(item.size)}`}</p></div><button type="button" onClick={() => remove(item.id)} aria-label={`Remove ${item.name}`} className="text-[#64748b] hover:text-[#fca5a5]"><X size={16}/></button></div>)}</div>}
    <p className="text-xs leading-5 text-[#64748b]">Attachments share this message&apos;s security controls and are encrypted before upload. Supported: PNG, JPEG, WebP, PDF, plain text and ZIP, up to 25 MB each. Files over 4 MB upload in encrypted chunks; cancel and retry resumes completed chunks while this page stays open.</p>
  </section>
}
