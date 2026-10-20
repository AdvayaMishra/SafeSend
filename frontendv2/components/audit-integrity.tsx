'use client'
/** Hash-chain verification. The verdict is ONLY what the server returns; the client never computes or implies trust. */
import { useState } from 'react'
import { ShieldAlert, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/shared'
import { ErrorNote, Panel, PendingBackend, StatusBadge } from '@/components/ui-kit'
import { CAPABILITIES } from '@/lib/capabilities'
import { verifyAuditChain, type AuditVerification } from '@/lib/api/security'

export function AuditIntegrity() {
  const [result, setResult] = useState<AuditVerification | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const run = async () => { setBusy(true); setError(''); try { setResult(await verifyAuditChain()) } catch (e) { setError(e instanceof Error ? e.message : 'Verification failed to run.') } finally { setBusy(false) } }
  if (!CAPABILITIES.auditIntegrity) return <>
    <Panel title="Integrity verification" kicker="HASH CHAIN"><div className="flex items-center gap-3"><StatusBadge tone="neutral">Not verified</StatusBadge><span className="text-sm text-[#94a3b8]">The backend does not return integrity data, so the events below are shown without any tamper-evidence claim.</span></div></Panel>
    <PendingBackend capability="auditIntegrity" title="Tamper-evident audit log" contract={['GET /api/audit  →  entries[] with hash and prevHash', 'GET /api/audit/verify  →  verified, entriesChecked, firstFailureId']}>Verification must be computed and signed server-side. A browser-only check cannot prove that server records are trustworthy, so this interface only displays results the server returns.</PendingBackend>
  </>
  return <Panel title="Integrity verification" kicker="HASH CHAIN" action={<Button onClick={run} disabled={busy} secondary>{busy ? 'VERIFYING…' : 'VERIFY NOW'}</Button>}>
    {error && <ErrorNote>{error}</ErrorNote>}
    {!result && !error && <p className="text-sm text-[#64748b]">No verification has been run in this session.</p>}
    {result && (result.verified
      ? <p className="flex items-center gap-3 text-sm text-[#6ee7b7]"><ShieldCheck size={18}/>Server reports the chain is intact ({result.entriesChecked} entries, checked {new Date(result.checkedAt).toLocaleString()}).</p>
      : <p role="alert" className="flex items-start gap-3 border border-[#7f1d1d] p-4 text-sm text-[#fca5a5]"><ShieldAlert size={18} className="mt-0.5 shrink-0"/>Server reports a verification failure{result.firstFailureId ? ` at entry ${result.firstFailureId}` : ''}. Treat records after this point as untrusted and contact your administrator.</p>)}
  </Panel>
}
