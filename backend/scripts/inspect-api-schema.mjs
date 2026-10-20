import 'dotenv/config';
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Configure backend Supabase environment');
try {
  const response = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/openapi+json' },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    console.error(JSON.stringify({ check: 'server schema access', status: response.status }));
    process.exitCode = 1;
  } else {
    const schema = await response.json();
    const tables = Object.fromEntries(Object.entries(schema.definitions ?? {}).map(([name, value]) =>
      [name, Object.keys(value.properties ?? {})]));
    console.log(JSON.stringify({ check: 'server schema access', tables }, null, 2));
  }
} catch (error) {
  console.error(JSON.stringify({ check: 'server schema access', code: error.cause?.code ?? error.name }));
  process.exitCode = 1;
}
