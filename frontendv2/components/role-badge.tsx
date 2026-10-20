import { StatusBadge } from '@/components/ui-kit'
import type { Role } from '@/lib/api/workspace'
const TONE = { OWNER: 'info', ADMIN: 'ok', MEMBER: 'neutral', AUDITOR: 'warn' } as const
export const RoleBadge = ({ role }: { role: Role }) => <StatusBadge tone={TONE[role]}>{role.toLowerCase()}</StatusBadge>
