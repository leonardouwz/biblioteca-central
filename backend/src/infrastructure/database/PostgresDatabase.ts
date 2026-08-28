import { Pool } from "pg";
import fs from "fs";
import path from "path";

const SCHEMA_PATH = path.join(__dirname, "..", "..", "..", "database", "schema.postgres.sql");

export async function createPostgresPool(): Promise<Pool> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL no está configurada.");
  }

  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  await pool.query(fs.readFileSync(SCHEMA_PATH, "utf8"));
  return pool;
}
