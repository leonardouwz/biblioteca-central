import { randomUUID } from "crypto";
import { DatabaseSync } from "node:sqlite";
import { IBookRepository } from "../../domain/interfaces/IBookRepository";
import { Book } from "../../domain/entities/Book";
import { BookCopy } from "../../domain/entities/BookCopy";

interface BookRow {
  id: string;
  title: string;
  author: string;
}

interface BookCopyRow {
  id: string;
  book_id: string;
  status: BookCopy["status"];
}

const toBook = (row: BookRow): Book => ({ id: row.id, title: row.title, author: row.author });
const toCopy = (row: BookCopyRow): BookCopy => ({ id: row.id, bookId: row.book_id, status: row.status });

export class SqliteBookRepository implements IBookRepository {
  constructor(private readonly db: DatabaseSync) {}

  async findAll(): Promise<Book[]> {
    const rows = this.db.prepare("SELECT * FROM books").all() as unknown as BookRow[];
    return rows.map(toBook);
  }

  async findById(id: string): Promise<Book | null> {
    const row = this.db.prepare("SELECT * FROM books WHERE id = ?").get(id) as unknown as BookRow | undefined;
    return row ? toBook(row) : null;
  }

  async create(book: Omit<Book, "id">): Promise<Book> {
    const id = randomUUID();
    this.db.prepare("INSERT INTO books (id, title, author) VALUES (?, ?, ?)").run(id, book.title, book.author);
    return { id, ...book };
  }

  async update(id: string, book: Omit<Book, "id">): Promise<Book | null> {
    const result = this.db
      .prepare("UPDATE books SET title = ?, author = ? WHERE id = ?")
      .run(book.title, book.author, id);
    if (result.changes === 0) return null;
    return { id, ...book };
  }

  async delete(id: string): Promise<boolean> {
    this.db.prepare("DELETE FROM book_copies WHERE book_id = ?").run(id);
    const result = this.db.prepare("DELETE FROM books WHERE id = ?").run(id);
    return result.changes > 0;
  }

  async findCopiesByBookId(bookId: string): Promise<BookCopy[]> {
    const rows = this.db.prepare("SELECT * FROM book_copies WHERE book_id = ?").all(bookId) as unknown as BookCopyRow[];
    return rows.map(toCopy);
  }

  async findCopyById(copyId: string): Promise<BookCopy | null> {
    const row = this.db.prepare("SELECT * FROM book_copies WHERE id = ?").get(copyId) as unknown as BookCopyRow | undefined;
    return row ? toCopy(row) : null;
  }

  async findAvailableCopy(bookId: string): Promise<BookCopy | null> {
    const row = this.db
      .prepare("SELECT * FROM book_copies WHERE book_id = ? AND status = 'AVAILABLE' LIMIT 1")
      .get(bookId) as unknown as BookCopyRow | undefined;
    return row ? toCopy(row) : null;
  }

  async addCopies(bookId: string, quantity: number): Promise<BookCopy[]> {
    const insert = this.db.prepare("INSERT INTO book_copies (id, book_id, status) VALUES (?, ?, 'AVAILABLE')");
    const copies: BookCopy[] = [];
    this.db.exec("BEGIN");
    try {
      for (let i = 0; i < quantity; i++) {
        const id = randomUUID();
        insert.run(id, bookId);
        copies.push({ id, bookId, status: "AVAILABLE" });
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    return copies;
  }

  async setCopyStatus(copyId: string, status: BookCopy["status"]): Promise<void> {
    this.db.prepare("UPDATE book_copies SET status = ? WHERE id = ?").run(status, copyId);
  }
}
