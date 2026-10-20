# SecureShare Frontend Expansion Report

Scope: frontend only (`frontendv2/`). The backend was read (cloned from GitHub) but not modified. The existing visual design, encryption, URL-fragment keys and API contracts are unchanged.

## Key finding
The backend implements only: create/get/access secret, per-secret dashboard (policy snapshot + event types and timestamps), encrypted attachments (upload/list/download), `/api/health` and `/api/test-db`. It has **no** accounts or auth, teams, API keys, passkeys, threat scoring, audit hash chain, analytics, notifications, recipient policies, suspension, or revoke/destroy endpoint. Features that need those are built as typed integration boundaries and shown as **awaiting backend support**. Nothing is mocked or simulated.

Capability flags live in `lib/capabilities.ts`. Typed clients in `lib/api/*` throw `BackendUnavailableError` while a flag is `false`, so the app cannot call endpoints that do not exist. When the backend ships one, flip the flag and the prebuilt live view renders.

## 1. Fully functional (real backend data)
| Feature | Route | Notes |
|---|---|---|
| Grouped navigation | header + per-section sub-nav | Existing links untouched; hamburger breakpoint moved from `md` to `lg` to fit the new menus |
| Secret management | `/secrets` | Status, policy summary, expiry, failed attempts, activity, search/filter/sort. Covers secrets created **in this browser** (IDs tracked locally; no keys or links stored) |
| Audit log timeline + export | `/audit` | Real events, category/secret/range/text filters, CSV and JSON export (CSV formula-injection guarded). Exports are labelled unsigned |
| Security analytics | `/analytics` | Access trend (success vs failed), event breakdown, lifecycle counts, range filters, empty states. No chart library |
| Threat signals + protection rules | `/threats` | Raw failed-password/cooldown signals and active cooldowns, plus the real cooldown/destroy rules. **No risk score is shown** |
| Service status | `/status` | Real probes of `/api/health` and `/api/test-db`; latency measured in the browser and labelled as such |
| Notifications (derived) | `/notifications` | Built from real events; read state is session-only and labelled |
| Access policy presets, tooltips, scheduled-release guidance | `/send` | Presets only fill existing controls; added access-window end>start validation |
| Large-file UX | `/send`, `/share/[id]` | Real upload progress (XHR), cancel, retry without re-encrypting, "finish without remaining", size/type info, download progress, AES-GCM integrity-verified badge. Fixes a prior flaw where an attachment failure lost the link |
| Onboarding & docs | `/docs`, first-use guide, key-fragment notices, error recovery text | Docs describe what the server can and cannot see |
| Developer portal (docs part) | `/developers` | Real endpoint table, working JS and curl examples |
| Passkey browser support check | `/account/security` | Real WebAuthn feature detection |

## 2. UI built, awaiting backend support
| Feature | What exists | Needed from backend |
|---|---|---|
| Threat intelligence (risk score, severity, incidents, rules) | `ThreatLive`, `lib/api/security.ts` | `GET /api/threats` |
| Audit integrity (hash chain, verify) | `AuditIntegrity`; shows "Not verified" until server returns a verdict | `GET /api/audit`, `/api/audit/verify` |
| Recipient / verified-email access, suspension, revocation | Listed as unavailable on `/send` (no fake toggles); revoke notice on `/secrets` | Policy fields + `POST /api/secrets/:id/revoke` |
| Teams, roles, invitations | `TeamsLive`, `RoleBadge`; actions gated by server-sent `permissions` | Auth + `/api/workspaces/*` |
| API keys, scopes, usage | `ApiKeysLive` (raw key shown once, never persisted) | Auth + `/api/keys` |
| Passkeys | `PasskeysLive`, WebAuthn registration + error mapping | Accounts + `/api/passkeys/*` |
| Persistent notifications, preferences, threat/invitation alerts | Documented contract | `/api/notifications*` |
| Error rate, server latency, incidents | Pending panel | Authorized `/api/metrics`, `/api/incidents` |
| Account-wide analytics | Pending panel | `/api/analytics` |
Proposed endpoint shapes are suggestions in `lib/api/*.ts`, not existing contracts.

## 3. Tests
Passed:
- `npx tsc --noEmit` clean; `npm run build` succeeds (15 routes).
- `npm run test:crypto` (existing, 5 assertions).
- `npm run test:insights` (new): status derivation, event categories, policy text, registry (ids only, dedupe, corrupt storage), bucketing, range filter, and that unsupported API clients refuse to call the network.
- Integration check (not committed): mock server with the backend's exact dashboard shape drove `loadRegistrySecrets`; partial failures surfaced; a failing health probe reported failure rather than success.
- Production-server smoke test: all 15 routes return HTTP 200.

Not performed (no browser in the sandbox):
- Visual, responsive, keyboard-only and screen-reader checks; colour-contrast measurement. Accessibility is by construction only (roles, labels, `aria-live`, progressbars, sr-only data tables, focus states reused from the app).
- End-to-end flows against a live backend: attachment upload progress/cancel/retry, download progress, QR, send/receive.
- WebAuthn registration and the other gated live views (never rendered, since their flags are off).

## 4. Known limitations
- Secret history, analytics, audit and notifications cover only secrets created in this browser; clearing site data loses the list (the secrets themselves are unaffected).
- Encryption is a single WebCrypto call, so encryption progress is indeterminate; uploads are not resumable and there is no streaming encryption. Files are held in memory (25 MB backend cap).
- Policy denials for closed windows or exhausted views are not logged by the backend, so they cannot be charted.
- Adding `tsx` as a devDependency was needed for the new test.

## 5. Backend observations (not changed)
- `GET /api/secrets/:id/dashboard` and `/api/secrets/:id` are unauthenticated, so anyone holding a secret ID can read its status and event history.
- Attachment file names, MIME types, sizes and the uploader IP are stored in plaintext server-side (disclosed in `/docs`).
- The backend logs attachment upload requests including file names.
- `ip_address` is stored on attachments.
