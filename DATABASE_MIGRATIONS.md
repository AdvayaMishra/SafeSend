# Database migrations

Project xpwolujykahuddtqzzzf was explicitly confirmed DEVELOPMENT. Remote schema was
inspected before changes. It contained 20 application tables with RLS disabled and
three storage policies granting anonymous bucket access.

## Applied to the existing development project

| Version | Change |
| --- | --- |
| 20261020000200 | Enable RLS and revoke direct browser-table privileges; service-only storage policies; private bucket restrictions/indexes |
| 20261020000300 | Atomic consumption/password-failure functions; hashed delivery-token metadata; management-token digest |
| 20261020000400 | Atomic workspace creation/invitation acceptance, API usage and shared rate counters |
| 20261020000500 | Transactional audit chains and mutation prevention |
| 20261020000600 | Sliding-window threat detection and source defenses |
| 20261020000700 | Chunk storage metadata and atomic upload completion |
| 20261020000800 | Preference-aware access/expiry notifications and expiration transition |
| 20261020000900 | Erase ciphertext during future burn/expiry transitions |
| 20261020001000 | Atomic key rotation and threat-notification preferences |
| 20261020001100 | Reconcile original legacy rule names/thresholds and deactivate duplicate defaults |
| 20261020001200 | Transactional workspace/membership/invitation audit chains |

There are now 21 application tables. Existing rows were preserved by schema changes.
Ordinary application test flows consumed/revoked only their disposable fixtures.

Migration execution: from backend/, `node scripts/apply-migration.mjs FILENAME.sql`.
The runner locks, checks the SHA-256 ledger, runs a transaction and records successful
application in **secureshare_private.migrations**. It refuses the new-install baseline.
Do not edit applied migrations; add a new reviewed reconciliation migration.

## Fresh-project reproducibility

00100_core_foundation.sql and 00150_existing_platform_baseline.sql are fresh-project
bootstrap files, not applied over this existing project. Then apply 00200 onward in
order. Supabase's storage schema and roles must already exist. The original backend/
supabase/migrations files remain historical references and are not the canonical chain.

`node scripts/rehearse-migrations.mjs` executed all 13 SQL files in isolated schemas
inside one transaction, confirmed 21 tables with RLS and rolled everything back. This
tests fresh SQL structure without dropping, replacing or mutating the real app tables.

CLI login/link is not configured. The runner's ledger is separate from the Supabase
CLI ledger: **do not blindly run supabase db push against this project**. Inspect and
reconcile CLI migration history first if adopting CLI deployment later.

## Connectivity and recovery

The local pooler DATABASE_URL uses the supplied password without placeholder brackets.
TLS verification is enabled with DATABASE_CA_FILE. The public CA was obtained from the
[certificate URL in Supabase's dashboard source](https://github.com/supabase/supabase/blob/master/apps/studio/hooks/custom-content/custom-content.json).
SHA-256 fingerprint: 80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA.

Read-only inspection scripts: inspect-database.mjs, snapshot-database.mjs and
inspect-api-schema.mjs. Schema snapshots are ignored local recovery evidence, not
full data backups. All-table grants/RPC verification: verify-database-authorization.mjs.

Failed migrations roll back. After successful migrations, prefer a reviewed forward
repair. Preserve original schema snapshots and take a real backup before any future
destructive changes. Never recover by disabling RLS or reopening anonymous access.
