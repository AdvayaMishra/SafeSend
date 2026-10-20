import { Home, ShieldAlert, ScrollText, BarChart3, Users, Archive, Code2, BookOpen, Activity, KeyRound, Bell, type LucideIcon } from 'lucide-react'

export type NavItem = { href: string; label: string; description: string; icon: LucideIcon }
export type NavGroup = { id: string; label: string; items: NavItem[] }

export const NAV_GROUPS: NavGroup[] = [
  { id: 'security', label: 'Security', items: [
    { href: '/threats', label: 'Threat intelligence', description: 'Suspicious access signals', icon: ShieldAlert },
    { href: '/audit', label: 'Audit logs', description: 'Event history and integrity', icon: ScrollText },
    { href: '/analytics', label: 'Analytics', description: 'Access trends and breakdowns', icon: BarChart3 },
  ] },
  { id: 'workspace', label: 'Workspace', items: [
    { href: '/secrets', label: 'Secret management', description: 'Secrets created in this browser', icon: Archive },
    { href: '/teams', label: 'Teams', description: 'Members, roles and invitations', icon: Users },
  ] },
  { id: 'developers', label: 'Developers', items: [
    { href: '/developers', label: 'API & SDK', description: 'Endpoints, keys and examples', icon: Code2 },
    { href: '/docs', label: 'Documentation', description: 'Security model and guides', icon: BookOpen },
    { href: '/status', label: 'Service status', description: 'API health and latency', icon: Activity },
  ] },
  { id: 'account', label: 'Account', items: [
    { href: '/account', label: 'Sign in', description: 'Account and session management', icon: KeyRound },
    { href: '/account/security', label: 'Security settings', description: 'Passkeys and recovery', icon: KeyRound },
    { href: '/notifications', label: 'Notifications', description: 'Alerts and activity notices', icon: Bell },
  ] },
]

export const groupForPath = (pathname: string | null) =>
  NAV_GROUPS.find(g => g.items.some(i => pathname === i.href || pathname?.startsWith(i.href + '/')))
export { Home }
