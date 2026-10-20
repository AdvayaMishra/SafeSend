import 'dotenv/config';
import assert from 'node:assert/strict';
import pg from 'pg';
import { readFileSync } from 'node:fs';

if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL in backend/.env');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true,
    ...(process.env.DATABASE_CA_FILE ? { ca: readFileSync(process.env.DATABASE_CA_FILE, 'utf8') } : {}) },
  connectionTimeoutMillis: 10000 });
try {
  await client.connect();
  await client.query('BEGIN READ ONLY');
  const tableNames=(await client.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows.map(r=>r.tablename);
  for (const name of tableNames) {
    const result = await client.query(`select c.relrowsecurity as rls,
      has_table_privilege('anon',c.oid,'SELECT') as anon_select,
      has_table_privilege('anon',c.oid,'INSERT') as anon_insert,
      has_table_privilege('authenticated',c.oid,'SELECT') as user_select,
      has_table_privilege('authenticated',c.oid,'UPDATE') as user_update,
      has_table_privilege('service_role',c.oid,'SELECT') as server_select
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=$1`, [name]);
    assert.equal(result.rowCount, 1, `${name}: table required`);
    assert.deepEqual(result.rows[0], { rls: true, anon_select: false, anon_insert: false,
      user_select: false, user_update: false, server_select: true }, `${name}: baseline authorization`);
  }
  const bucket = await client.query("select public from storage.buckets where id='secure-attachments'");
  assert.equal(bucket.rowCount, 1, 'private bucket required');
  assert.equal(bucket.rows[0].public, false, 'bucket must be private');
  const exposed=await client.query("select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE'))");
  assert.equal(exposed.rowCount,0,'no direct browser-callable public RPC bypasses');
  await client.query('ROLLBACK');
  console.log(`Verified ${tableNames.length} tables: RLS, browser-role denial, backend reads; private bucket; no browser-executable public RPCs.`);
} catch (error) {
  console.error(error instanceof assert.AssertionError ? error.message
    : JSON.stringify({ check: 'database authorization', code: error.code ?? 'CONNECTION_FAILED' }));
  process.exitCode = 1;
} finally { await client.end(); }
