# Vercel + Render demo deployment

Status as of 2026-10-21: public development demo deployed and checked.

- Website: https://safesend-three.vercel.app
- API: https://safesend-api-62wd.onrender.com
- Backend plan: Render Free, Singapore; automatic deploys are disabled.
- Frontend: Vercel project adv-codes/safesend, deployed through the CLI. GitHub auto-deployment is not connected; a push alone does not update the live demo.
- Server-only Supabase credentials were stored on Render with explicit user approval. No database password was uploaded, and no new migrations were applied for deployment.

Hosted checks passed: public frontend/API/database HTTP checks, exact-origin CORS allow/deny, encrypted message roundtrip, access-password enforcement, unauthorized dashboard denial, sender revocation, chunked file upload/resume/authentication, burn-after-read file delivery, tamper rejection, and anonymous storage denial. Test fixtures were removed; append-only audit evidence is retained.

Account email redirects, actual mailbox delivery, and physical passkeys were not verified in this deployment. Supabase management access is still needed to configure the production Auth site/redirect settings. This is not a completed production release.

Use Vercel Hobby and a Render Free web service for a development demo. The existing Supabase development project supplies the database, authentication, and storage. Do not create another database or run migrations just to deploy the existing application.

## Backend

The root `render.yaml` defines a Node 24 service with `backend` as its root, `npm ci --include=dev && npm run build && npm prune --omit=dev` as its build command, `npm start` as its start command, and `/api/health` as its health check. It requests the Free compute plan and generates separate backend security keys. Reuse existing services if the account already contains this project.

Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY using the existing ignored backend environment file through the hosting connection. Set FRONTEND_URL to the exact stable frontend HTTPS origin. Never commit these credentials or put the service-role key in the browser configuration. Render supplies PORT. The API uses Supabase HTTPS; database passwords and CA files are not required for its runtime.

TRUST_PROXY_HOPS starts at zero. Verify the actual proxy path before trusting forwarded client addresses; until then, source-based limits may group requests under a proxy address. Keep the optional expiration worker disabled during initial deployment.

## Frontend

Import the existing GitHub repository on Vercel, select the master branch and `frontendv2` root, and use the included vercel.json. Set:

- NEXT_PUBLIC_API_URL: the actual deployed Render HTTPS origin, with no /api suffix.
- NEXT_PUBLIC_SUPABASE_URL: the existing project's Supabase HTTPS URL.
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: the project's public publishable key.

Redeploy after changing frontend environment values, which are included at build time. Use the stable public frontend origin in backend FRONTEND_URL; arbitrary preview origins are not automatically allowed.

## Verification before advertising a live demo

Check the deployed API's /api/health and /api/test-db. Verify CORS from the actual frontend, create/open a disposable encrypted secret, test expiry/revocation and an encrypted attachment, and confirm authorized dashboards work. Configure the Supabase Auth site URL and allowed callback URLs to match the frontend recovery flow, then verify account sign-in and email flows. Do not claim passkeys or unverified email delivery work.

The verified public frontend URL is included in the README and repository website field. Re-run hosted checks after future deployments.

## Free-hosting limitations

Render Free services sleep after inactivity and can take about a minute to wake. Their local files are lost on restart, redeploy, or sleep. The demo checkpoint path is explicitly ephemeral: hash-linked database events persist in Supabase, but local checkpoint history does not provide durable independent audit anchoring. Keep that limitation visible until durable independent storage is configured.

No paid storage, service upgrades, custom domain purchase, or paid monitoring is included. Check account spending settings before deployment: selecting a free compute plan alone does not guarantee zero usage charges if the account permits overages.

References: https://render.com/docs/blueprint-spec, https://render.com/docs/free, https://vercel.com/docs/git.
