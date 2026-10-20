/**
 * Backend capability registry.
 * `true`  = the backend implements it today (verified against backend/src/routes/*.ts).
 * `false` = no backend support yet; the UI shows an "awaiting backend" state and typed API
 *           clients refuse to call endpoints that do not exist.
 * Flip a flag only after the backend ships the matching endpoint.
 */
export const CAPABILITIES = {
  health: true,
  secretDashboard: true,
  attachments: true,
  scheduledRelease: true, // maps to the existing accessStart field
  threatIntelligence: true,
  auditIntegrity: true,
  recipientPolicies: true,
  accessSuspension: true,
  secretRevocation: true,
  teams: true,
  apiKeys: true,
  passkeys: false,
  notifications: true,
  analyticsService: true,
  observabilityMetrics: false,
} as const

export type CapabilityName = keyof typeof CAPABILITIES

export const isSupported = (name: CapabilityName): boolean => CAPABILITIES[name]
