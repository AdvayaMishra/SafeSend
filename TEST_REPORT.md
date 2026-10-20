# Test report — 2026-10-20

Executed against local application builds and the explicitly confirmed development
Supabase project. This is not a production-readiness certification.

| Check | Result |
| --- | --- |
| Backend TypeScript/build | Passed |
| Integrated frontend typecheck and production build | Passed; account route included |
| Frontend crypto suite | Passed: message/file round trips, fragment-key import and wrong-key rejection |
| Frontend insights suite | Passed, including disabled-feature gating |
| SDK build and local encryption/key-isolation tests | Passed |
| All 21 tables: RLS, browser-role denial and backend reads | Passed |
| Public RPC browser-execute denial | Passed |
| Live anonymous secrets REST access | HTTP 401 after lockdown; initial exposure reproduced before changes |
| Private bucket and actual anonymous upload/download denial | Passed |
| Thirteen-file fresh-schema migration rehearsal | Passed; 21 tables, zero RLS-disabled tables; entire rehearsal rolled back |
| Full isolated integration runner | Passed: platform, chunks, CLI and core |
| Subsequent targeted file/core regressions | Passed after attachment-abuse/rate-limit changes |
| Final platform regression | Passed including key rotation, member removal, preferences, expiry, operations auth, OpenAPI/CORS/versioned aliases |
| Real browser anonymous creation, authorized sender dashboard, recipient decrypt | Passed |
| Browser account form and signed-out workspace gate | Verified visible; no fabricated signed-in state |
| Mobile/desktop layout inspection | Performed; default/narrow and 1280px account/workspace navigation checked |
| Storage cleanup dry run | Passed; zero objects removed |
| Final production dependency audits | Zero advisories in backend and frontend |
| Credential scan of 135 non-ignored files | No configured server credential matches |

Core tests cover concurrency (one successful reader out of 12 requests with maxViews=1),
password cooldowns without destruction, scheduled access, expiration, revocation,
suspension, sender authorization, legacy encrypted attachments after burn, two real Auth
identities, verified recipient isolation, local decrypt and wrong-key rejection.

Platform tests cover invitation mismatch/replay, workspace isolation, auditor read-only
permissions, member ownership, management-capability denial after membership removal,
scoped/versioned keys, atomic rotation/revocation, hash-chain verification, tamper
detection and mutation denial, incident persistence, notifications/read state, account
analytics, preferences, idempotent expiration/ciphertext erasure, metrics auth and CORS.

Chunk tests cover scheduled sender upload, cancel/resume without resending completed
chunks, authenticated ordering/hashes, atomic completion, burn delivery, corruption
rejection and direct anonymous Storage denial. CLI tests capture output internally and
verify stdin-based create/open round trips without printing plaintext or link keys.

Early failures were corrected: a legacy-rule-name compatibility bug caused incorrect
frequency defenses; a test tamper shim affected its later storage-denial probe; a
release-time fixture depended on sub-second DB/local clock agreement. Tests were
rerun after the fixes. Network suites now isolate source-HMAC keys per backend process.

Initial sandbox frontend build hit a Turbopack process error. Production builds passed
outside the sandbox. Node's existing module-type warning in the crypto test is non-fatal.

Fixtures: temporary Auth users, ciphertext secrets and uploaded files are removed.
Append-only audit evidence and its isolated workspace references are retained; test
workspaces have no remaining user members. Existing user content is not deleted by tests.

## Not verified / not performed

Physical passkey registration/sign-in, real mailbox confirmation/reset delivery, camera
QR scanning, save-file-picker disk UX on every browser, cross-reload upload resume,
large-account/load testing, external audit anchoring/monitoring, Docker image build,
production deployment and destructive retention apply. Native passkeys are disabled
in the project and in the UI. These limitations are not reported as successful tests.
