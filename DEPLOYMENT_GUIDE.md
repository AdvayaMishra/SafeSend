# Deployment guide

No production deployment or paid infrastructure change has been performed. The archived
Azure workflow targeted a production slot automatically on main pushes; it was inspected
and deliberately not activated in this new checkout. Deployment still requires approval.

## Vercel frontend

Project root: frontendv2. Its vercel.json selects Next.js, npm ci and npm run build.
Configure NEXT_PUBLIC_API_URL to the approved Azure HTTPS origin and public Supabase
URL/publishable key. Never expose server credentials in frontend variables or build logs.
Default third-party pageview telemetry is disabled; account security analytics use
authorized backend events. Passkey capability remains gated.

## Azure backend

Use Node 24. Run npm ci, npm run build, then npm start from backend/. Dockerfile and
.dockerignore are provided as an alternative packaging path; the image was not built
or deployed in this session. Configure PORT for the selected App Service mode.

Required backend settings:

- SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (server-only).
- FRONTEND_URL: exact comma-separated HTTPS frontend origin allowlist.
- EVENT_HMAC_KEY: stable random secret for source labels; isolate test environments.
- AUDIT_SIGNING_KEY and AUDIT_CHECKPOINT_FILE: stable signer and writable durable state.
- OPERATIONS_TOKEN: separate secret for /api/metrics.
- ENABLE_LIFECYCLE_WORKER=false by default during review; enable after approving retention.
- TRUST_PROXY_HOPS=0 locally. For Azure, verify the actual proxy/network path and set
  only the trusted hop count (maximum 2). Do not blindly trust client-forwarded headers;
  otherwise all users may be grouped under a proxy address or attackers may spoof sources.

The runtime uses Supabase HTTPS and does not require the database password. DATABASE_URL
and DATABASE_CA_FILE are for migration/rehearsal scripts. Do not bake any env files into
images or artifacts. Keep keys in managed application secrets; rotate through an approved
process. Back up signed checkpoints independently of the database and backend deployment.

## Supabase and retention

Use a separate production project. Review DATABASE_MIGRATIONS.md and its ledger
distinction before applying anything. Current development tables/storage are locked
down and verified; do not reopen public access to make a UI work.

Configure the approved Auth site URL, redirect allowlist and email delivery through
Supabase management access. Real signup/confirmation/reset email delivery is not tested.
Native passkeys additionally need a stable RP ID/origins and real-device verification;
the development project's passkeys_enabled currently reads false.

The optional lifecycle worker marks batches expired, erases ciphertext and generates
notifications; idempotency is tested with disposable fixtures. It is not automatically
enabled against existing development records. From backend/, run
`node scripts/cleanup-expired-storage.mjs` for a dry run. Its --apply mode deletes only
expired/elapsed-grace attachments and stale upload chunks; it was NOT run. Review and
approve retention before scheduling that destructive mode.

Use one designated lifecycle worker or database locks as implemented for competing
expiry batches. Persist checkpoint files across restarts. Source/rate metadata also
needs an approved production retention schedule. Process-local metrics and log alerts
need collection into the chosen monitoring service; no external alert delivery is set up.

## Release gates

Pass the recorded suites in a separate deployment-test project, verify mailbox and
Auth redirects, establish durable independent audit checkpoint storage, complete
pagination/load tests and production monitoring, confirm storage retention/backups,
and test real devices/cameras. Obtain explicit production approval before deployment.
