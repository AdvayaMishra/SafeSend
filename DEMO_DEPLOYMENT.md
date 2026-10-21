# Vercel + Render demo deployment

Status: deployment configuration prepared; creating these files does not deploy services.

Use Vercel Hobby and a Render Free web service for a development demo. The existing Supabase development project supplies the database, authentication, and storage. Do not create another database or run migrations just to deploy the existing application.

## Backend

The root `render.yaml` defines a Node 24 service with `backend` as its root, `npm ci && npm run build` as its build command, `npm start` as its start command, and `/api/health` as its health check. It requests the Free compute plan and generates separate backend security keys. Reuse existing services if the account already contains this project.

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

After the checks pass, add the verified public frontend URL to the GitHub README and repository website field. Do not publish a guessed service URL as a working demo.

## Free-hosting limitations

Render Free services sleep after inactivity and can take about a minute to wake. Their local files are lost on restart, redeploy, or sleep. The demo checkpoint path is explicitly ephemeral: hash-linked database events persist in Supabase, but local checkpoint history does not provide durable independent audit anchoring. Keep that limitation visible until durable independent storage is configured.

No paid storage, service upgrades, custom domain purchase, or paid monitoring is included. Check account spending settings before deployment: selecting a free compute plan alone does not guarantee zero usage charges if the account permits overages.

References: https://render.com/docs/blueprint-spec, https://render.com/docs/free, https://vercel.com/docs/git.
