import { apiRequest, assertSupported } from './client'

/* Teams & RBAC — PROPOSED contract. The backend is the source of truth for `permissions`. */
export type Role = 'OWNER' | 'ADMIN' | 'MEMBER' | 'AUDITOR'
export type Member = { id: string; email: string; role: Role; joinedAt: string }
export type Workspace = { id: string; name: string; role: Role; permissions: string[]; members: Member[]; invitations: Array<{ id: string; email: string; role: Role; sentAt: string }> }
export const getWorkspace = () => { assertSupported('teams'); return apiRequest<Workspace>('/api/workspaces/current') }
export const inviteMember = (email: string, role: Role) => { assertSupported('teams'); return apiRequest<{ id: string; token:string; delivery:string }>('/api/workspaces/current/invitations', { method: 'POST', body: { email, role } }) }
export const changeMemberRole = (memberId: string, role: Role) => { assertSupported('teams'); return apiRequest<Member>(`/api/workspaces/current/members/${memberId}`, { method: 'PATCH', body: { role } }) }
export const removeMember = (memberId: string) => { assertSupported('teams'); return apiRequest<{ success: boolean }>(`/api/workspaces/current/members/${memberId}`, { method: 'DELETE' }) }
export const createWorkspace = (name: string) => apiRequest<{ id:string }>('/api/workspaces',{method:'POST',body:{name}})
export const acceptInvitation = (token: string) => apiRequest<{success:boolean}>('/api/workspaces/invitations/accept',{method:'POST',body:{token}})

/* Notifications — PROPOSED contract. */
export type NotificationKind = 'THREAT' | 'EXPIRY' | 'ACCESS' | 'INVITATION' | 'SECURITY'
export type AppNotification = { id: string; kind: NotificationKind; title: string; body: string; createdAt: string; read: boolean }
export const getNotifications = () => { assertSupported('notifications'); return apiRequest<{ notifications: AppNotification[] }>('/api/notifications') }
export const markNotificationRead = (id: string) => { assertSupported('notifications'); return apiRequest<{ success: boolean }>(`/api/notifications/${id}/read`, { method: 'POST' }) }
