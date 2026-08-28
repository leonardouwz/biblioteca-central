-- Esquema Postgres (Supabase) del Sistema de Gestión de Préstamos de Biblioteca.
-- Equivalente a database/schema.sql (SQLite), usado en producción.

CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL
);

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

CREATE INDEX IF NOT EXISTS idx_book_copies_book_id ON book_copies(book_id);
CREATE INDEX IF NOT EXISTS idx_loans_user_id ON loans(user_id);
CREATE INDEX IF NOT EXISTS idx_loans_book_copy_id ON loans(book_copy_id);
CREATE INDEX IF NOT EXISTS idx_debts_user_id ON debts(user_id);
