import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

dotenv.config({
  path: fileURLToPath(new URL('../../../.env', import.meta.url)),
});

const { Pool } = pg;

export const pool = new Pool({
  host: '127.0.0.1',
  port: 55434,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
});