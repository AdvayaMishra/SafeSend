'use client'
import { PageShell, Panel, PendingBackend } from '@/components/ui-kit'
import { TeamsLive } from '@/components/teams-live'
import { RoleBadge } from '@/components/role-badge'
import { CAPABILITIES } from '@/lib/capabilities'
import {AccountGate} from '@/components/account-gate'
import type { Role } from '@/lib/api/workspace'

const ROLE_NOTES: Array<[Role, string]> = [
  ['OWNER', 'Full control of the workspace, including membership and deletion.'],
  ['ADMIN', 'Manages members, invitations and workspace settings.'],
  ['MEMBER', 'Creates and manages their own secrets within the workspace.'],
  ['AUDITOR', 'Read-only access to workspace activity and audit records.'],
]

export default function TeamsPage() {
  return <PageShell kicker="Workspace / Teams" title="Team" accent="workspaces." intro="Shared workspaces with role-based access. Every action is authorized by the backend; this interface only hides controls that your role does not allow.">
    {CAPABILITIES.teams ? <AccountGate><TeamsLive/></AccountGate> : <>
      <PendingBackend capability="teams" title="Workspaces, members and invitations" contract={['GET /api/workspaces/current', 'POST /api/workspaces/current/invitations', 'PATCH /api/workspaces/current/members/:id', 'DELETE /api/workspaces/current/members/:id']}>
        SafeSend has no accounts or sessions yet, so there is no one to sign in as and no workspace to show. Membership, invitations, workspace activity and settings need authentication and permission checks on the server first.
      </PendingBackend>
      <Panel title="Planned role model" kicker="PROPOSED, NOT ENFORCED">
        <ul className="grid gap-4">{ROLE_NOTES.map(([r, d]) => <li key={r} className="flex flex-wrap items-center gap-4"><RoleBadge role={r}/><span className="text-sm text-[#94a3b8]">{d}</span></li>)}</ul>
        <p className="mt-6 text-xs text-[#64748b]">These descriptions are a proposal for the backend to implement. Nothing here grants or restricts access today.</p>
      </Panel>
    </>}
  </PageShell>
}
