import { apiRequest, assertSupported } from './client'

/* Threat intelligence — PROPOSED contract, no backend endpoint exists yet. */
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type ThreatIncident = {
  id: string; severity: Severity; rule: string; summary: string; explanation: string
  occurredAt: string; secretId?: string; actionTaken?: string
}
export type ThreatOverview = {
  truncated?: boolean
  riskScore: number; riskLevel: Severity
  incidents: ThreatIncident[]
  activeDefenses: Array<{ id: string; label: string; expiresAt?: string }>
  rules: Array<{ id: string; title: string; description: string }>
}
export const getThreatOverview = (range: '24h' | '7d' | '30d') => {
  assertSupported('threatIntelligence')
  return apiRequest<ThreatOverview>(`/api/threats?range=${range}`)
}

/* Tamper-evident audit — PROPOSED contract. Integrity verdicts must come from the server only. */
export type AuditEntry = { id: string; category: string; type: string; occurredAt: string; detail?: string; hash: string; prevHash: string | null }
export type AuditVerification = { verified: boolean; checkedAt: string; entriesChecked: number; firstFailureId?: string }
export const getAuditLog = () => { assertSupported('auditIntegrity'); return apiRequest<{ entries: AuditEntry[];truncated?:boolean }>('/api/audit') }
export const verifyAuditChain = () => { assertSupported('auditIntegrity'); return apiRequest<AuditVerification>('/api/audit/verify') }
