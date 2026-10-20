# Security architecture

## Encryption and sharing

Messages and legacy attachments use browser AES-256-GCM. Decryption keys stay in URL
fragments and client memory. The SDK/CLI use the same local encryption model. Optional
access passwords reach the backend over HTTPS and are stored as Argon2 hashes; they
are distinct from encryption keys. Secrets, keys, passwords and full share URLs are
excluded from request logs. Default third-party pageview telemetry was removed.

New chunked files use a fresh per-file AES key, random 8-byte nonce prefix and 32-bit
chunk counter. AES-GCM additional data binds session, index and total chunk count.
An encrypted manifest authenticates file metadata and ciphertext hashes. Retries reuse
cached ciphertext; resumed transfers skip matching committed chunks. The immutable
File object and per-secret cache prevent changing plaintext under a reused nonce.
Resume state stays in memory while the page is open. No cross-reload resume is claimed.

## Database and authorization

All 21 application tables have RLS enabled. PUBLIC/anon/authenticated roles have no
direct table access; public RPC execute privileges are revoked. The backend service
role is the trusted enforcement boundary. Browser SQL denial was tested with two JWT
identities; account/workspace authorization was also tested through the real APIs.

Supabase Auth verifies session tokens server-side. Profiles are bound to verified Auth
user IDs, not client-supplied IDs. No automatic email-based legacy-account relinking.
Workspace roles are read on each authorized request. Owners/admins manage workspace
secrets; members manage their own; auditors read activity. Only owners change/remove
members. Members cannot promote themselves. Management capabilities cannot bypass
workspace removal. Verified-recipient policies require a confirmed session email;
an API key does not count as recipient email verification.

Anonymous personal sender capabilities are random, stored as SHA-256 digests in the
database and held in tab session storage. They are not decryption keys. Legacy anonymous
records with no ownership proof are not automatically claimed by anyone with an ID.
Legacy encrypted files remain readable through their existing share links, but public
unauthorized dashboard/upload access was intentionally removed.

## Atomic access and files

PostgreSQL locks the secret row while checking policies, consuming a view, issuing a
hashed delivery token and recording success. Concurrent one-view tests admit exactly
one reader. Burned ciphertext is erased while the successful transaction returns its
original encrypted snapshot. A ten-minute delivery grant permits that recipient's
attachment delivery after burn; revocation/suspension/expiry still deny delivery.
Storage is private, service-only and size/type restricted. Sender authorization runs
before buffering uploads. Chunk finalization checks expected chunk count and bytes.

## Threats, audit and notifications

Configurable sliding windows detect failed passwords, frequency, multiple targets,
policy denials, expired accesses and rejected attachment requests. The source label is
a keyed HMAC of the network address, a weak grouping signal rather than an identity.
Defenses are temporary. Suspicion never destroys a secret. Original legacy rule names
are normalized explicitly; unknown types are not interpreted as frequency rules.

Audit events append transactionally to per-secret and workspace chains with sequence numbers,
canonical JSONB serialization, previous hash and SHA-256 hash. Normal service credentials
cannot update/delete rows. Verification compares event fields with canonical content
and checks links/sequence. Backend HMAC checkpoints detect changes against previously
observed chains, including tail truncation for accessible secrets.

Workspace creation, invitations and membership changes are audited by database triggers.
Their actor label is the backend service; individual human actor attribution is not
claimed by these triggers. Authorized history/export includes canonical payloads and hashes.

Checkpoints are local backend files, not an independent external trust anchor. A party
controlling both database and signing environment can forge records/checkpoints.
Workspace deletion is not exposed; immutable audit references are retained. Old events
predating chain installation are not retrospectively certified.

Notifications are persistent, account-scoped and in-app. Access/expiry preferences and
threat preferences are enforced; invitations use manual one-time links. Email delivery
is not configured and cannot be enabled through a fake preference toggle.

## Operational limits and release gates

Logs contain request IDs, methods, route templates, status and latency. Metrics require
a separate operations token and cover the current process. Rate counters are shared in
PostgreSQL. No external monitoring service, paid infrastructure or production deployment
was configured. Retention dry-run was verified; destructive storage cleanup was not run.

Native passkey support was verified in [Supabase's documentation](https://supabase.com/docs/guides/auth/passkeys)
and the installed SDK. The adapter is prepared, but this project's passkeys_enabled is
false and actual device registration/sign-in is unverified, so UI remains gated.
Production RP/redirect/SMTP settings need management access. No custom authentication
bridge or duplicate public-key store was introduced.

Large-account lists/events are capped and labelled; audit verification rejects capped
results. Production needs complete pagination, durable independently managed checkpoint
storage, mailbox tests, infrastructure monitoring, retention scheduling and load testing.
