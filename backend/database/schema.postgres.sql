-- Esquema Postgres (Supabase) del Sistema de Gestión de Préstamos de Biblioteca.
-- Equivalente a database/schema.sql (SQLite), usado en producción.

CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  cover_url TEXT,
  publish_year INTEGER
);
-- Migración aditiva para bases ya desplegadas antes de que existieran estas
-- columnas: Postgres soporta IF NOT EXISTS en ADD COLUMN, así que no hace
-- falta lógica condicional aparte (a diferencia de SQLite, ver Database.ts).
ALTER TABLE books ADD COLUMN IF NOT EXISTS cover_url TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS publish_year INTEGER;

CREATE TABLE IF NOT EXISTS book_copies (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('AVAILABLE', 'LOANED'))
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE TABLE IF NOT EXISTS loans (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  book_copy_id TEXT NOT NULL REFERENCES book_copies(id) ON DELETE CASCADE,
  loan_date TIMESTAMPTZ NOT NULL,
  due_date TIMESTAMPTZ NOT NULL,
  return_date TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'RETURNED'))
);

CREATE TABLE IF NOT EXISTS debts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  loan_id TEXT NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  paid BOOLEAN NOT NULL DEFAULT FALSE,
  paid_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('USUARIO', 'BIBLIOTECARIO', 'ADMINISTRADOR')),
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  hourly_late_fee_rate REAL NOT NULL,
  debt_multiplier REAL NOT NULL,
  max_active_loans INTEGER NOT NULL,
  loan_period_days INTEGER NOT NULL
);
INSERT INTO settings (id, hourly_late_fee_rate, debt_multiplier, max_active_loans, loan_period_days)
VALUES ('default', 5, 1, 3, 14)
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_book_copies_book_id ON book_copies(book_id);
CREATE INDEX IF NOT EXISTS idx_loans_user_id ON loans(user_id);
CREATE INDEX IF NOT EXISTS idx_loans_book_copy_id ON loans(book_copy_id);
CREATE INDEX IF NOT EXISTS idx_debts_user_id ON debts(user_id);
