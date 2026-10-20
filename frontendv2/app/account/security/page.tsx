'use client'
import { useEffect, useState } from 'react'
import { PageShell, Panel, PendingBackend, StatusBadge } from '@/components/ui-kit'
import { PasskeysLive } from '@/components/passkeys-live'
import { CAPABILITIES } from '@/lib/capabilities'
import { detectWebAuthn } from '@/lib/api/account'

export default function SecuritySettingsPage() {
  const [support, setSupport] = useState<{ webauthn: boolean; platformAuthenticator: boolean } | null>(null)
  useEffect(() => { void detectWebAuthn().then(setSupport) }, [])
  return <PageShell kicker="Account / Security settings" title="Account" accent="security." intro="Passkeys let you sign in with your device’s biometrics or screen lock instead of a password. Registration is verified by the server, never by this page alone.">
    <Panel title="This browser" kicker="PASSKEY SUPPORT">
      {!support ? <p className="text-sm text-[#64748b]">Checking…</p> : <ul className="grid gap-3 text-sm">
        <li className="flex items-center gap-3"><StatusBadge tone={support.webauthn ? 'ok' : 'bad'}>{support.webauthn ? 'Supported' : 'Unsupported'}</StatusBadge>WebAuthn (passkey standard)</li>
        <li className="flex items-center gap-3"><StatusBadge tone={support.platformAuthenticator ? 'ok' : 'neutral'}>{support.platformAuthenticator ? 'Available' : 'Not detected'}</StatusBadge>Built-in authenticator (Touch ID, Windows Hello, phone screen lock)</li></ul>}
      {support && !support.platformAuthenticator && <p className="mt-4 text-xs leading-5 text-[#64748b]">Without a built-in authenticator you can still use a hardware security key or a phone nearby, if your browser supports it.</p>}
    </Panel>
    {CAPABILITIES.passkeys ? <PasskeysLive/> : <PendingBackend capability="passkeys" title="Passkey registration and management" contract={['Supabase Auth native WebAuthn ceremonies', 'Project relying-party ID and origin configuration', 'Verified device registration and sign-in']}>
      The native Supabase Auth passkey adapter is prepared. Registration and sign-in remain gated until the project’s relying-party configuration and an actual device ceremony have been verified.
    </PendingBackend>}
    <Panel title="Recovery guidance" kicker="WHEN PASSKEYS ARE AVAILABLE">
      <ul className="grid max-w-3xl gap-3 text-sm leading-6 text-[#94a3b8]">
        <li>Register passkeys on at least two devices so losing one does not lock you out.</li>
        <li>Passkeys held in a platform keychain sync across that vendor’s devices; a hardware key does not, so keep it somewhere safe.</li>
        <li>Remove a passkey as soon as you lose or sell the device it lives on.</li>
        <li>Note that decryption keys for your secrets live only in their links and cannot be recovered by any sign-in method.</li>
      </ul>
    </Panel>
  </PageShell>
}
