import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from "@shared/schema";
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql, { schema });
