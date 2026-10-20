# SafeSend

Development integration for the recovered SafeSend backend and the supplied
expanded frontend. The frontend's design, fragment-key sharing and AES-GCM encryption
are preserved. No production deployment was performed.

Implemented: secured Supabase tables/storage, atomic secret access, sender management,
verified recipients, accounts, workspaces/roles/invitations, scoped developer keys,
threat detection, audit chains, in-app notifications, account analytics and encrypted
chunk uploads. SDK and CLI source are included.

Passkeys remain disabled in the remote project. A native Supabase Auth adapter is
prepared, but its device ceremony is unverified. Email delivery, production Auth
redirects, independent audit anchoring and deployment remain release gates.

## Local development

Node 24 was used for verification. Install with `npm ci --prefix backend` and
`npm ci --prefix frontendv2`. Use npm lockfiles; archived pnpm resolution is historical.

The ignored `backend/.env` and `frontendv2/.env.local` are already configured locally.
For a fresh checkout, use `.env.example` and backend/.env.example. Never put a server
key, database password, signing key or operations token in NEXT_PUBLIC variables.

Run `npm run dev --prefix backend` and `npm run dev --prefix frontendv2` in separate
terminals. Defaults: backend port 5000; frontend http://localhost:3000.

Sign-in is at /account. Anonymous sharing works. Sender management for anonymous
secrets uses an opaque capability held only in that tab's session storage. Sign in
before creating a secret for account-based management across devices.

## Validation

Backend: `npm run build --prefix backend`. Frontend: `npm run typecheck --prefix
frontendv2`, `npm test --prefix frontendv2`, `npm run build --prefix frontendv2`.
SDK: `npm test --prefix sdk`. Database integration tests run from backend/ with
`npm run test:integration`; these use disposable development fixtures, never production.

See [INTEGRATION_PROGRESS.md](INTEGRATION_PROGRESS.md), [TEST_REPORT.md](TEST_REPORT.md),
[SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md), [DATABASE_MIGRATIONS.md](DATABASE_MIGRATIONS.md),
[API_DOCUMENTATION.md](API_DOCUMENTATION.md) and [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md).
