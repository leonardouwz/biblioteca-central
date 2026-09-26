import { DatabaseSync } from "node:sqlite";
import fs from "fs";
import path from "path";

const DEFAULT_DB_PATH = path.join(__dirname, "..", "..", "..", "..", "database", "biblioteca.sqlite");
const DEFAULT_SCHEMA_PATH = path.join(__dirname, "..", "..", "..", "..", "database", "schema.sql");

interface ColumnInfoRow {
  name: string;
}

/**
 * Migración aditiva mínima para SQLite: `CREATE TABLE IF NOT EXISTS` no
 * agrega columnas a una tabla que ya existe, y el SQLite embebido en
 * node:sqlite no soporta `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
 * (a diferencia de Postgres, ver schema.postgres.sql) — así que se chequea
 * a mano con PRAGMA table_info antes de alterar. Sin librería de
 * migraciones: alcanza para agregar columnas nullable; si el proyecto
 * necesitara renombrar/borrar columnas o versionar migraciones, ahí sí
 * conviene una herramienta real (ej. better-sqlite3-migrate, Drizzle).
 */
function ensureColumn(db: DatabaseSync, table: string, column: string, ddlType: string): void {
  const existing = db.prepare(`PRAGMA table_info(${table})`).all() as unknown as ColumnInfoRow[];
  if (!existing.some((col) => col.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddlType}`);
  }
}

export function createDatabaseConnection(): DatabaseSync {
  const dbPath = process.env.DATABASE_PATH || DEFAULT_DB_PATH;
  const schemaPath = process.env.SCHEMA_PATH || DEFAULT_SCHEMA_PATH;

  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(fs.readFileSync(schemaPath, "utf8"));

  ensureColumn(db, "books", "cover_url", "TEXT");
  ensureColumn(db, "books", "publish_year", "INTEGER");

  return db;
}
