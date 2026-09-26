import { randomUUID } from "crypto";
import { Pool } from "pg";
import { IBookRepository } from "../../domain/interfaces/IBookRepository";
import { Book } from "../../domain/entities/Book";
import { BookCopy } from "../../domain/entities/BookCopy";

interface BookRow {
  id: string;
  title: string;
  author: string;
  cover_url: string | null;
  publish_year: number | null;
}

interface BookCopyRow {
  id: string;
  book_id: string;
  status: BookCopy["status"];
}

const toBook = (row: BookRow): Book => ({
  id: row.id,
  title: row.title,
  author: row.author,
  coverUrl: row.cover_url,
  publishYear: row.publish_year,
});
const toCopy = (row: BookCopyRow): BookCopy => ({ id: row.id, bookId: row.book_id, status: row.status });

export class PostgresBookRepository implements IBookRepository {
  constructor(private readonly pool: Pool) {}

  async findAll(): Promise<Book[]> {
    const { rows } = await this.pool.query<BookRow>("SELECT * FROM books ORDER BY title");
    return rows.map(toBook);
  }

  async findById(id: string): Promise<Book | null> {
    const { rows } = await this.pool.query<BookRow>("SELECT * FROM books WHERE id = $1", [id]);
    return rows[0] ? toBook(rows[0]) : null;
  }

  async create(book: Omit<Book, "id">): Promise<Book> {
    const id = randomUUID();
    await this.pool.query(
      "INSERT INTO books (id, title, author, cover_url, publish_year) VALUES ($1, $2, $3, $4, $5)",
      [id, book.title, book.author, book.coverUrl, book.publishYear]
    );
    return { id, ...book };
  }

  async update(id: string, book: Omit<Book, "id">): Promise<Book | null> {
    const result = await this.pool.query(
      "UPDATE books SET title = $1, author = $2, cover_url = $3, publish_year = $4 WHERE id = $5",
      [book.title, book.author, book.coverUrl, book.publishYear, id]
    );
    if (result.rowCount === 0) return null;
    return { id, ...book };
  }

  async delete(id: string): Promise<boolean> {
    await this.pool.query("DELETE FROM book_copies WHERE book_id = $1", [id]);
    const result = await this.pool.query("DELETE FROM books WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async findCopiesByBookId(bookId: string): Promise<BookCopy[]> {
    const { rows } = await this.pool.query<BookCopyRow>("SELECT * FROM book_copies WHERE book_id = $1", [bookId]);
    return rows.map(toCopy);
  }

  async findCopyById(copyId: string): Promise<BookCopy | null> {
    const { rows } = await this.pool.query<BookCopyRow>("SELECT * FROM book_copies WHERE id = $1", [copyId]);
    return rows[0] ? toCopy(rows[0]) : null;
  }

  async findAvailableCopy(bookId: string): Promise<BookCopy | null> {
    const { rows } = await this.pool.query<BookCopyRow>(
      "SELECT * FROM book_copies WHERE book_id = $1 AND status = 'AVAILABLE' LIMIT 1",
      [bookId]
    );
    return rows[0] ? toCopy(rows[0]) : null;
  }

  async addCopies(bookId: string, quantity: number): Promise<BookCopy[]> {
    const client = await this.pool.connect();
    const copies: BookCopy[] = [];
    try {
      await client.query("BEGIN");
      for (let i = 0; i < quantity; i++) {
        const id = randomUUID();
        await client.query("INSERT INTO book_copies (id, book_id, status) VALUES ($1, $2, 'AVAILABLE')", [
          id,
          bookId,
        ]);
        copies.push({ id, bookId, status: "AVAILABLE" });
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    return copies;
  }

  async setCopyStatus(copyId: string, status: BookCopy["status"]): Promise<void> {
    await this.pool.query("UPDATE book_copies SET status = $1 WHERE id = $2", [status, copyId]);
  }
}
