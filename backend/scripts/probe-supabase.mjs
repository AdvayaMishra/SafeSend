import { config } from 'dotenv';
config({ path: '../frontendv2/.env.local', quiet: true });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error('Configure frontendv2/.env.local first');
for (const path of ['/auth/v1/settings', '/rest/v1/secrets?select=id&limit=1', '/storage/v1/bucket']) {
  try {
    const response = await fetch(`${url}${path}`, {
      headers: { apikey: key }, signal: AbortSignal.timeout(15000),
    });
    const data = await response.json();
    // Report only status and counts; never credentials, rows, user data or URLs.
    console.log(JSON.stringify({
      check: path.split('?')[0], status: response.status,
      ...(Array.isArray(data) ? { visibleRecords: data.length } : {}),
      ...(path.startsWith('/auth/') && response.ok ? {
        emailAuthEnabled: data.external?.email,
        signupDisabled: data.disable_signup,
        passkeysEnabled: data.passkeys_enabled,
      } : {}),
    }));
    const denied = path.startsWith('/rest/v1/secrets') && [401,403].includes(response.status);
    if ((!response.ok && !denied) || (path.startsWith('/rest/v1/secrets') && Array.isArray(data) && data.length > 0)) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(JSON.stringify({ check: path.split('?')[0], code: error.cause?.code ?? error.name }));
    process.exitCode = 1;
  }
}
