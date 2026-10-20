import { authHeaders, rememberManagement } from './auth'

export type PendingBackendIntegration = {
  ok: false
  code: 'PENDING_BACKEND_INTEGRATION'
  message: string
}

export type CreateSecretInput = {
  message: string
  password?: string
  expiresAt?: string
  accessStart?: string
  accessEnd?: string
  maxViews: number | 'unlimited'
  viewOnce: boolean
  recipientEmail?: string
  workspaceId?: string
}

export type AccessResult = {
  success: boolean
  message?: string
  encryptedContent?: string
  iv?: string
  viewsRemaining?: number | null
  destroyedAfterAccess?: boolean
  accessToken?: string
}

export type SecretMeta = { id: string; status: 'active' | 'expired' | 'locked'; viewsRemaining: number | 'unlimited'; expiresAt: string }
export type DashboardData = { meta: SecretMeta; events: Array<{ label: string; detail: string; time: string }> }

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export type DownloadOptions = { onProgress?: (received: number, total: number | null) => void; signal?: AbortSignal }
export type UploadOptions = { onProgress?: (fraction: number) => void; signal?: AbortSignal }

/** Upload an already-encrypted attachment with real byte-level progress and cancellation (same endpoint as uploadAttachment). */
export async function uploadAttachmentWithProgress(id: string, encryptedBlob: Blob, encryptedKeyBundle: string, originalName: string, opts: UploadOptions = {}): Promise<{ success: boolean; message?: string }> {
  const headers=await authHeaders(id)
  return new Promise((resolve, reject) => {
    if (opts.signal?.aborted) { reject(new DOMException('Upload cancelled', 'AbortError')); return }
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_URL}/api/secrets/${id}/attachments`)
    for(const [name,value] of Object.entries(headers)) xhr.setRequestHeader(name,value)
    xhr.upload.onprogress = e => { if (e.lengthComputable) opts.onProgress?.(e.loaded / e.total) }
    xhr.onload = () => {
      try { resolve(JSON.parse(xhr.responseText)) } catch { resolve({ success: false, message: xhr.responseText || `HTTP ${xhr.status}` }) }
    }
    xhr.onerror = () => reject(new Error('Network error while uploading. Check your connection and retry.'))
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'))
    opts.signal?.addEventListener('abort', () => xhr.abort(), { once: true })
    const form = new FormData()
    form.append('file', new Blob([encryptedBlob], { type: 'application/octet-stream' }), originalName || 'encrypted.bin')
    form.append('encryptedKeyBundle', encryptedKeyBundle)
    xhr.send(form)
  })
}

export const secureShareApi = {
  createSecret: async (input: CreateSecretInput & { encryptedContent: string; iv: string }) => {
    const res = await fetch(`${API_URL}/api/secrets`, {
      method: 'POST',
      headers: { ...await authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        encryptedContent: input.encryptedContent,
        iv: input.iv,
        password: input.password,
        expiresAt: input.expiresAt,
        accessStart: input.accessStart,
        accessEnd: input.accessEnd,
        maxViews: input.maxViews === 'unlimited' ? null : input.maxViews,
        burnAfterRead: input.viewOnce
        ,recipientEmail: input.recipientEmail || undefined
        ,workspaceId: input.workspaceId || undefined
      })
    });
    const result=await res.json()
    if(result.success&&result.secretId&&result.managementToken) rememberManagement(result.secretId,result.managementToken)
    return result;
  },
  getSecretMeta: async (id: string) => {
    const res = await fetch(`${API_URL}/api/secrets/${id}`);
    return res.json();
  },
  accessSecret: async (id: string, password?: string) => {
    const res = await fetch(`${API_URL}/api/secrets/${id}/access`, {
      method: 'POST',
      headers: { ...await authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    return res.json();
  },
  uploadAttachment: async (id: string, encryptedBlob: Blob, encryptedKeyBundle: string, originalName?: string) => {
    const formData = new FormData();
    const encryptedFile = new Blob([encryptedBlob], { type: 'application/octet-stream' });
    formData.append('file', encryptedFile, originalName || 'encrypted.bin');
    formData.append('encryptedKeyBundle', encryptedKeyBundle);
    const res = await fetch(`${API_URL}/api/secrets/${id}/attachments`, {
      method: 'POST',
      headers: await authHeaders(id),
      body: formData
    });
    
    const text = await res.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = {
        success: false,
        message: text || `HTTP ${res.status}`
      };
    }
    return data;
  },
  getAttachments: async (id: string, accessToken: string) => {
    const res = await fetch(`${API_URL}/api/secrets/${id}/attachments`, {
      headers: { 'Authorization': 'Bearer ' + accessToken }
    });
    return res.json();
  },
  downloadAttachment: async (id: string, attachmentId: string, accessToken: string, opts?: DownloadOptions) => {
    const res = await fetch(`${API_URL}/api/secrets/${id}/attachments/${attachmentId}/download`, {
      headers: { 'Authorization': 'Bearer ' + accessToken },
      signal: opts?.signal
    });
    if (!res.ok) throw new Error('Failed to download attachment');
    if (!opts?.onProgress || !res.body) return res.blob()
    // Stream the body so progress can be reported. `total` is null when the server sends no Content-Length.
    const total = Number(res.headers.get('content-length')) || null
    const reader = res.body.getReader()
    const chunks: BlobPart[] = []
    let received = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value as BlobPart)
      received += value.length
      opts.onProgress(received, total)
    }
    return new Blob(chunks)
  },
  getDashboardData: async (id: string) => {
    const res = await fetch(`${API_URL}/api/secrets/${id}/dashboard`, {headers:await authHeaders(id)});
    return res.json();
  },
}

export const createSecret = secureShareApi.createSecret
export const getSecretMeta = secureShareApi.getSecretMeta
export const accessSecret = secureShareApi.accessSecret
export const getDashboardData = secureShareApi.getDashboardData
export const uploadAttachment = secureShareApi.uploadAttachment
export const getAttachments = secureShareApi.getAttachments
export const downloadAttachment = secureShareApi.downloadAttachment

export function scorePassword(password: string) {
  if (!password) return 0
  const lower = password.toLowerCase()
  const common = ['password', 'welcome', 'admin', 'qwerty', 'letmein', 'monkey', 'iloveyou']
  let score = Math.min(45, password.length * 3)
  if (/[a-z]/.test(password)) score += 7
  if (/[A-Z]/.test(password)) score += 7
  if (/\d/.test(password)) score += 7
  if (/[^A-Za-z0-9]/.test(password)) score += 7
  if (common.some((word) => lower.includes(word))) score -= 55
  if (/(.)\1{2,}/.test(password)) score -= 20
  if (/012|123|234|345|456|567|678|789|abc|qwe|asd|zxc/i.test(password)) score -= 25
  if (/password|welcome|admin|qwerty/i.test(password)) score -= 20
  return Math.max(0, Math.min(100, score))
}

export function generatePassword() {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const specials = '!@#$%^&*()-_=+[]{}?';
  const all = upper + lower + numbers + specials;
  
  const pick = (chars: string) => {
    const limit = 256 - (256 % chars.length);
    const array = new Uint8Array(1);
    while (true) {
      crypto.getRandomValues(array);
      if (array[0] < limit) {
        return chars[array[0] % chars.length];
      }
    }
  };

  const getLength = () => {
    const array = new Uint8Array(1);
    while (true) {
      crypto.getRandomValues(array);
      if (array[0] < 255) {
        return 16 + (array[0] % 5);
      }
    }
  };
  
  const len = getLength();
  
  const password = [
    pick(upper),
    pick(lower),
    pick(numbers),
    pick(specials)
  ];
  
  while (password.length < len) {
    password.push(pick(all));
  }
  
  for (let i = password.length - 1; i > 0; i--) {
    const array = new Uint8Array(1);
    const limit = 256 - (256 % (i + 1));
    let j = -1;
    while (j === -1) {
      crypto.getRandomValues(array);
      if (array[0] < limit) {
        j = array[0] % (i + 1);
      }
    }
    const temp = password[i];
    password[i] = password[j] as string;
    password[j] = temp as string;
  }
  
  return password.join('');
}
export function passwordLabel(score: number) { if (score < 35) return 'Weak'; if (score < 65) return 'Moderate'; if (score < 85) return 'Strong'; return 'Very strong' }


