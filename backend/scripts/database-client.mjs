import 'dotenv/config';
import pg from 'pg';
import { readFileSync } from 'node:fs';
export function databaseClient() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL missing');
  return new pg.Client({ connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: true, ...(process.env.DATABASE_CA_FILE
      ? { ca: readFileSync(process.env.DATABASE_CA_FILE, 'utf8') } : {}) },
    connectionTimeoutMillis: 15000 });
}
