# Contributing to SafeSend

Thanks for helping improve SafeSend. This is a development application with security-sensitive features; keep changes focused and describe their effect on access and encryption.

## Run locally

Follow the [README](README.md#getting-started). Use your own development Supabase project and local environment files. Never include working credentials, database dumps, real secrets, or complete sharing URLs in a contribution.

Install dependencies using `npm ci --prefix backend` and `npm ci --prefix frontendv2`. Run the two development servers separately. Keep the existing npm lockfiles consistent with intentional dependency changes.

## Before submitting a pull request

1. Explain the problem and the behavior after the change.
2. Keep unrelated formatting, dependency upgrades, and product changes separate.
3. Run checks appropriate to the change; the README lists build, typecheck, and test commands.
4. For UI changes, include screenshots with dummy content and describe the browser/viewport used.
5. Document configuration changes and any remaining limitations.

Documentation-only changes need link and command review, not a full database integration run. Database-backed tests must use a dedicated development/test project.

## Security and database changes

Preserve browser-side encryption and keep fragment keys out of server requests, logging, and telemetry. Enforce permissions in the backend, including workspace membership on each protected operation. Never fix an access issue by disabling RLS or opening a storage bucket.

Read [DATABASE_MIGRATIONS.md](DATABASE_MIGRATIONS.md) before changing SQL. Add a reviewed migration instead of editing an already-applied one. Do not run production migrations, destructive cleanup, or deployments as part of routine testing.

## Bug reports

Include the affected feature, reproducible steps using dummy content, expected and actual behavior, browser/OS, and sanitized errors. A request ID is useful; passwords, tokens, recipient addresses, and complete share links are not.

For potential vulnerabilities, use [SECURITY.md](SECURITY.md) rather than publishing exploit details in an issue.
