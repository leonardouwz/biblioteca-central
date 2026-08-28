import { DatabaseSync } from "node:sqlite";
import fs from "fs";
import path from "path";

const DEFAULT_DB_PATH = path.join(__dirname, "..", "..", "..", "..", "database", "biblioteca.sqlite");
const DEFAULT_SCHEMA_PATH = path.join(__dirname, "..", "..", "..", "..", "database", "schema.sql");

export function createDatabaseConnection(): DatabaseSync {
  const dbPath = process.env.DATABASE_PATH || DEFAULT_DB_PATH;
  const schemaPath = process.env.SCHEMA_PATH || DEFAULT_SCHEMA_PATH;

  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(fs.readFileSync(schemaPath, "utf8"));

  return db;
}
