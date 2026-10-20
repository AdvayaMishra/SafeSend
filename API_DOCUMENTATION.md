# API documentation

OpenAPI inventory: backend/openapi.json, served at GET /api/openapi.json. Regenerate
from backend/ with `npm run openapi`. Core routes support /api/secrets and /api/v1/secrets.
Platform routes below also support /api/v1 aliases.

Authentication: `Authorization: Bearer <Supabase access token>` for accounts; scoped
`Bearer ss_...` for developer secret/audit APIs. Personal anonymous management uses
X-Management-Token. X-Workspace-ID selects a current membership; the backend verifies
that selection. Recipients' attachment bearer tokens are separate from account tokens.

## Encrypted secrets and attachments

| Method | Route under /api/secrets | Behavior |
| --- | --- | --- |
| GET | / | Authenticated accessible IDs; capped at 1,000 |
| POST | / | Ciphertext/iv/expiry, optional password, windows, view limit, recipientEmail/workspaceId; returns secretId and one-time managementToken |
| GET | /:id | Safe public metadata; lifecycle/policy errors |
| POST | /:id/access | Verify password/recipient, atomically consume a view; returns ciphertext, iv, remaining views and attachment accessToken |
| GET | /:id/dashboard | Authorized policy and event history |
| POST | /:id/revoke | Authorized revocation, ciphertext erasure and token invalidation |
| PATCH | /:id/policy | Authorized `{ suspended: boolean }` |
| POST | /:id/attachments | Sender-authorized multipart file and encryptedKeyBundle; encrypted bytes only |
| GET | /:id/attachments | Recipient delivery-token metadata list |
| GET | /:id/attachments/:attachmentId/download | Recipient delivery-token legacy encrypted download |
| POST | /:id/uploads | Sender creates session with totalChunks and totalBytes |
| GET | /:id/uploads/:session | Sender obtains committed chunk indices/hashes |
| PUT | /:id/uploads/:session/chunks/:index | Ciphertext bytes; application/octet-stream and X-Chunk-SHA256 |
| POST | /:id/uploads/:session/complete | encryptedKeyBundle; atomic complete-count/byte validation |
| DELETE | /:id/uploads/:session | Soft-abort incomplete upload |
| GET | /:id/uploads/:session/chunks/:index | Recipient encrypted chunk download |

AES-GCM IVs are base64 12-byte nonces. Encryption keys never appear in API bodies.
File cap: 25 MB plaintext in the chunk flow, 1 MB chunks plus GCM tags. Legacy uploads
have a 25 MB ciphertext cap. Chunk downloads validate hashes and GCM before yielding.

## Accounts and platform

| Methods | /api route | Access and purpose |
| --- | --- | --- |
| GET | /account | Verified server session identity |
| GET, POST | /workspaces | Membership list / create `{ name }` |
| GET | /workspaces/current | Workspace, role, permissions, members, pending invites |
| POST | /workspaces/current/invitations | Owner/admin `{ email, role }`; raw invitation token shown once, manual delivery |
| POST | /workspaces/invitations/accept | `{ token }`; matching verified email; one use |
| PATCH, DELETE | /workspaces/current/members/:id | Owner role change/removal; owner/self escalation prohibited |
| GET, POST | /keys | Owned summaries / `{ name, scopes }`; raw key shown once |
| DELETE | /keys/:id | Revoke owned key |
| POST | /keys/:id/rotate | Atomically replace and revoke old key |
| GET | /keys/:id/usage | Owned key's recorded scoped requests |
| GET | /audit, /audit/verify | Authorized chains / integrity and signed local checkpoints |
| GET | /threats?range=24h\|7d\|30d | Scoped incidents, risks, explanations, active defenses and rules |
| GET | /analytics?since=ISO_TIMESTAMP | Scoped events/counts; explicit truncated flag |
| GET | /notifications | Persisted notices for current account |
| POST | /notifications/:id/read | Persist own read status |
| GET, PATCH | /notifications/preferences | In-app booleans; email_delivery=true rejected |
| GET | /health, /test-db | Liveness / real backend database query |
| GET | /metrics | X-Operations-Token required; current-process counts/latency |

Scopes: secrets:create (creation and sender upload), secrets:read, secrets:revoke
(revocation/policy changes), audit:read. Keys cannot manage accounts, workspaces or
other keys, or satisfy verified-recipient email policies. Key requests are rate limited
and usage is recorded without bodies or URLs. An account session is required for key
issuance/rotation; raw key values are never recoverable from the database.

Errors: `{ success:false, code, message }`, HTTP 400 invalid input, 401 authentication,
403 authorization/policy, 409 state conflict, 410 expiry/consumption/revocation,
429 temporary protection, 503 dependency failure. Correlation is in X-Request-ID.

Native passkey helpers are prepared against Supabase Auth, not custom /api/passkeys
routes, and remain gated. No published npm package or deployed API is claimed.
