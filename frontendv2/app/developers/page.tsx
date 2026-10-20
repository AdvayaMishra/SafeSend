'use client'
import Link from 'next/link'
import { PageShell, Panel, PendingBackend, StatusBadge } from '@/components/ui-kit'
import { CodeBlock } from '@/components/code-block'
import { ApiKeysLive } from '@/components/api-keys-live'
import { CAPABILITIES } from '@/lib/capabilities'
import {AccountGate} from '@/components/account-gate'

const ENDPOINTS: Array<[string, string, string, string]> = [
  ['POST', '/api/secrets', 'None', 'Create a secret from client-side ciphertext, IV and policy.'],
  ['GET', '/api/secrets/:id', 'None', 'Public metadata for a secret (status and limits).'],
  ['POST', '/api/secrets/:id/access', 'Password, if set', 'Open a secret. Counts as a view and returns ciphertext plus a short-lived access token.'],
  ['GET', '/api/secrets/:id/dashboard', 'Owner session or management token', 'Authorized policy snapshot and event history.'],
  ['POST', '/api/secrets/:id/attachments', 'Sender authorization', 'Upload one encrypted attachment (multipart, 25 MB max).'],
  ['GET', '/api/secrets/:id/attachments', 'Bearer access token', 'List attachments after opening a secret.'],
  ['GET', '/api/secrets/:id/attachments/:attachmentId/download', 'Bearer access token', 'Download one encrypted attachment.'],
  ['GET', '/api/health', 'None', 'Liveness check.'],
]

const CREATE_EXAMPLE = `// Browser or Node 20+. Encryption happens here; the server only ever sees ciphertext.
const API = 'https://YOUR_API_HOST'
const b64 = (u8) => btoa(String.fromCharCode(...u8))

const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
const iv = crypto.getRandomValues(new Uint8Array(12))
const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode('my secret')))

const res = await fetch(\`\${API}/api/secrets\`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    encryptedContent: b64(ciphertext),
    iv: b64(iv),
    expiresAt: new Date(Date.now() + 24 * 3600e3).toISOString(),
    maxViews: 1,
    burnAfterRead: true,
    // password: 'optional — sent to the server and stored as an Argon2 hash'
  }),
})
const { secretId } = await res.json()

// The decryption key goes in the URL fragment and is never sent to the server.
const { k } = await crypto.subtle.exportKey('jwk', key)
console.log(\`https://YOUR_APP_HOST/share/\${secretId}#\${k}\`)`

const CURL_EXAMPLE = `# Service health
curl https://YOUR_API_HOST/api/health

# Policy snapshot and events for a secret
curl https://YOUR_API_HOST/api/secrets/SECRET_ID/dashboard`

export default function DevelopersPage() {
  return <PageShell kicker="Developers / API & SDK" title="Build on" accent="SafeSend." intro="Versioned encrypted-secret APIs, scoped keys, and local SDK/CLI source. Sign in to create, rotate and revoke developer keys." wide>
    <Panel title="API overview" kicker="REAL ENDPOINTS">
      <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><caption className="sr-only">SafeSend API endpoints</caption>
        <thead className="font-mono text-[10px] tracking-widest text-[#64748b]"><tr><th className="pb-3 pr-4">METHOD</th><th className="pb-3 pr-4">PATH</th><th className="pb-3 pr-4">AUTH</th><th className="pb-3">PURPOSE</th></tr></thead>
        <tbody>{ENDPOINTS.map(([m, p, a, d]) => <tr key={m + p} className="border-t border-[#172a46] align-top"><td className="py-3 pr-4"><StatusBadge tone={m === 'GET' ? 'info' : 'ok'}>{m}</StatusBadge></td><td className="py-3 pr-4 font-mono text-xs text-[#e2e8f0]">{p}</td><td className="py-3 pr-4 text-xs text-[#94a3b8]">{a}</td><td className="py-3 text-xs leading-5 text-[#94a3b8]">{d}</td></tr>)}</tbody></table></div>
      <p className="mt-5 text-xs leading-5 text-[#64748b]">Browser requests only work from origins the backend allows (CORS). Full request and error details are in the <Link href="/docs#api-reference" className="text-[#38bdf8] underline underline-offset-4">API reference</Link>.</p>
    </Panel>

    {CAPABILITIES.apiKeys ? <AccountGate><ApiKeysLive/></AccountGate> : <PendingBackend capability="apiKeys" title="API keys, scopes and usage statistics" contract={['GET /api/keys', 'POST /api/keys  →  raw key returned once', 'DELETE /api/keys/:id']}>
      Key creation, scoped permissions, revocation and usage statistics need authenticated accounts. Today the API accepts unauthenticated requests, so there is nothing to issue a key against. When this ships, a raw key will be shown only once at creation.
    </PendingBackend>}

    <Panel title="SDK and CLI" kicker="STATUS">
      <p className="max-w-3xl text-sm leading-6 text-[#94a3b8]">SDK source is available in sdk/ and the local command-line entry point is cli/secureshare.mjs. Build with npm run build --prefix sdk. The SDK encrypts locally before calling /api/v1/secrets. No package has been published to a registry.</p>
    </Panel>

    <div className="grid gap-7 lg:grid-cols-2">
      <Panel title="Create a secret" kicker="JAVASCRIPT"><CodeBlock code={CREATE_EXAMPLE} label="create-secret.mjs"/></Panel>
      <Panel title="Inspect a secret" kicker="CURL"><CodeBlock code={CURL_EXAMPLE} label="shell"/><p className="mt-5 text-xs leading-5 text-[#64748b]">Replace the placeholder host with your own deployment. Never paste a full secret link (including the part after #) into logs, tickets or chat tools you do not control.</p></Panel>
    </div>
  </PageShell>
}
