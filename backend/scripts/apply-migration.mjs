import { databaseClient } from './database-client.mjs';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const name = process.argv[2];
if (!/^20261020\d{6}_[a-z_]+\.sql$/.test(name ?? '')) throw new Error('Specify a reviewed migration filename');
if (name.startsWith('20261020000100')) throw new Error('New-install baseline is not applicable to this existing database');
const sql = readFileSync(`../supabase/migrations/${name}`, 'utf8');
const hash = createHash('sha256').update(sql).digest('hex');
const client = databaseClient();
try {
  await client.connect();
  await client.query('begin');
  await client.query("select pg_advisory_xact_lock(hashtext('secureshare-migrations'))");
  await client.query('create schema if not exists secureshare_private');
  await client.query('revoke all on schema secureshare_private from public,anon,authenticated');
  await client.query(`create table if not exists secureshare_private.migrations (
    name text primary key, sha256 text not null, applied_at timestamptz not null default now())`);
  const previous = await client.query('select sha256 from secureshare_private.migrations where name=$1',[name]);
  if (previous.rowCount && previous.rows[0].sha256 !== hash) throw new Error('Applied migration checksum mismatch');
  if (!previous.rowCount) {
    await client.query(sql);
    await client.query('insert into secureshare_private.migrations(name,sha256) values($1,$2)',[name,hash]);
  }
  await client.query('commit');
  console.log(JSON.stringify({ migration: name, status: previous.rowCount ? 'already applied' : 'applied', sha256: hash }));
} catch (error) {
  await client.query('rollback').catch(()=>{});
  console.error(JSON.stringify({ migration:name, code:error.code ?? 'MIGRATION_FAILED' }));
  process.exitCode=1;
} finally { await client.end(); }
