import Link from 'next/link'
import { EmptyState, ErrorNote, Loading } from '@/components/ui-kit'
import type { RegistryLoad } from '@/lib/secret-insights'

/** Shared loading / empty / partial-failure handling for pages fed by this browser's secrets. */
export function RegistryGate({ status, data, children }: { status: 'loading' | 'ready'; data: RegistryLoad; children: React.ReactNode }) {
  if (status === 'loading') return <Loading label="LOADING SECRET ACTIVITY"/>
  if (data.registered === 0) return <EmptyState title="No secrets tracked in this browser yet" action={<Link href="/send" className="primary-link">Create a secret</Link>}>Activity appears here for secrets you create in this browser. SafeSend has no accounts yet, so it cannot list secrets created elsewhere.</EmptyState>
  return <>{data.failed.length > 0 && <ErrorNote>{data.failed.length} of {data.registered} tracked secrets could not be loaded ({data.failed[0].message}). Totals below exclude them.</ErrorNote>}{children}</>
}
