import 'dotenv/config';
import pg from 'pg';
import { readFileSync } from 'node:fs';

if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL in the backend environment');
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true,
    ...(process.env.DATABASE_CA_FILE ? { ca: readFileSync(process.env.DATABASE_CA_FILE, 'utf8') } : {}) },
  connectionTimeoutMillis: 10000,
});
try {
  await client.connect();
  await client.query('BEGIN READ ONLY');
  const tables = await client.query(`select schemaname, tablename, rowsecurity
    from pg_tables where schemaname in ('public','supabase_migrations') order by 1,2`);
  const policies = await client.query(`select schemaname, tablename, policyname, roles, cmd
    from pg_policies where schemaname in ('public','storage') order by 1,2,3`);
  const columns = await client.query(`select table_name,column_name,data_type,is_nullable
    from information_schema.columns where table_schema='public' order by table_name,ordinal_position`);
  const buckets = await client.query('select id,public,file_size_limit,allowed_mime_types from storage.buckets');
  console.log(JSON.stringify({ tables: tables.rows, policies: policies.rows, columns: columns.rows, buckets: buckets.rows }, null, 2));
  await client.query('ROLLBACK');
} catch (error) {
  // Do not emit connection strings or server error details.
  console.error(JSON.stringify({ check: 'database inspection', code: error.code ?? 'CONNECTION_FAILED' }));
  process.exitCode = 1;
} finally { await client.end(); }
