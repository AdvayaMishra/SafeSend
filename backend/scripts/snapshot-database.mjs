import { databaseClient } from './database-client.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
const client = databaseClient();
try {
  await client.connect();
  await client.query('begin read only');
  const queries = {
    tables: "select schemaname,tablename,rowsecurity from pg_tables where schemaname='public' order by tablename",
    policies: "select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname in ('public','storage') order by 1,2,3",
    grants: "select table_schema,table_name,grantee,privilege_type from information_schema.role_table_grants where table_schema in ('public','storage') order by 1,2,3,4",
    constraints: "select c.relname as table_name, con.conname,pg_get_constraintdef(con.oid) as definition from pg_constraint con join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' order by 1,2",
    columns: "select table_name,column_name,data_type,is_nullable,column_default from information_schema.columns where table_schema='public' order by table_name,ordinal_position",
    functions: "select p.proname,pg_get_function_identity_arguments(p.oid) as arguments,p.prosecdef as security_definer,p.proacl::text as grants from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by 1",
    buckets: "select id,public,file_size_limit,allowed_mime_types from storage.buckets",
  };
  const snapshot = {};
  for (const [name, sql] of Object.entries(queries)) snapshot[name] = (await client.query(sql)).rows;
  await client.query('rollback');
  mkdirSync('../supabase/snapshots', { recursive: true });
  const file = `../supabase/snapshots/schema-${Date.now()}.json`;
  writeFileSync(file, JSON.stringify(snapshot, null, 2));
  console.log(JSON.stringify({ file, tables: snapshot.tables.length,
    rlsDisabled: snapshot.tables.filter(x => !x.rowsecurity).length,
    policies: snapshot.policies, constraints: snapshot.constraints,
    functions: snapshot.functions }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ check: 'schema snapshot', code: error.code ?? 'FAILED' }));
  process.exitCode = 1;
} finally { await client.end(); }
