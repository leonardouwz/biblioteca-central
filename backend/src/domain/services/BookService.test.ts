import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "crypto";
import { BookService } from "./BookService";
import { BusinessError } from "../errors/BusinessError";
import { IBookRepository } from "../interfaces/IBookRepository";
import { Book } from "../entities/Book";
import { BookCopy } from "../entities/BookCopy";

/** Repo en memoria — solo lo necesario para probar la validación de cantidad. */
class FakeBookRepository implements IBookRepository {
  private readonly books: Book[] = [];
  private readonly copies: BookCopy[] = [];

  async findAll(): Promise<Book[]> {
    return this.books;
  }
  async findById(id: string): Promise<Book | null> {
    return this.books.find((b) => b.id === id) ?? null;
  }
  async create(book: Omit<Book, "id">): Promise<Book> {
    const created = { id: randomUUID(), ...book };
    this.books.push(created);
    return created;
  }
  async update(id: string, book: Omit<Book, "id">): Promise<Book | null> {
    const existing = this.books.find((b) => b.id === id);
    if (!existing) return null;
    Object.assign(existing, book);
    return existing;
  }
  async delete(): Promise<boolean> {
    return false;
  }
  async findCopiesByBookId(bookId: string): Promise<BookCopy[]> {
    return this.copies.filter((c) => c.bookId === bookId);
  }
  async findCopyById(copyId: string): Promise<BookCopy | null> {
    return this.copies.find((c) => c.id === copyId) ?? null;
  }
  async findAvailableCopy(): Promise<BookCopy | null> {
    return null;
  }
  async addCopies(bookId: string, quantity: number): Promise<BookCopy[]> {
    const created: BookCopy[] = [];
    // Misma implementación (con bug) que los repos reales: sin el guard de
    // BookService, un `quantity` no entero/no finito puede colgar este loop.
    for (let i = 0; i < quantity; i++) {
      const copy = { id: randomUUID(), bookId, status: "AVAILABLE" as const };
      this.copies.push(copy);
      created.push(copy);
    }
    return created;
  }
  async setCopyStatus(): Promise<void> {}
}

// Regresión: `addStock`/`createBook` no validaban que `quantity` fuera un
// entero finito y acotado — un valor como `Infinity` colgaría `addCopies`
// (loop `for` sin límite superior), y un decimal creaba un número de copias
// inconsistente con lo pedido.
test("addStock: rechaza cantidades no enteras, no finitas o fuera de rango", async () => {
  const repo = new FakeBookRepository();
  const service = new BookService(repo);
  const book = await service.createBook("Libro", "Autor", 1);

  await assert.rejects(() => service.addStock(book.id, 1.5), BusinessError);
  await assert.rejects(() => service.addStock(book.id, Infinity), BusinessError);
  await assert.rejects(() => service.addStock(book.id, -1), BusinessError);
  await assert.rejects(() => service.addStock(book.id, 0), BusinessError);
  await assert.rejects(() => service.addStock(book.id, 1e30), BusinessError);

  const result = await service.addStock(book.id, 3);
  assert.equal(result.totalCopies, 4); // 1 inicial + 3 agregadas
});

test("createBook: initialCopies=0 es válido (libro sin stock inicial)", async () => {
  const service = new BookService(new FakeBookRepository());
  const book = await service.createBook("Libro", "Autor", 0);
  assert.equal(book.totalCopies, 0);
});

test("createBook: coverUrl/publishYear son opcionales; se guardan si vienen", async () => {
  const service = new BookService(new FakeBookRepository());

  const withoutMetadata = await service.createBook("Libro", "Autor", 0);
  assert.equal(withoutMetadata.coverUrl, null);
  assert.equal(withoutMetadata.publishYear, null);

  const withMetadata = await service.createBook(
    "1984",
    "George Orwell",
    0,
    "https://covers.openlibrary.org/b/id/15257377-M.jpg",
    1949
  );
  assert.equal(withMetadata.coverUrl, "https://covers.openlibrary.org/b/id/15257377-M.jpg");
  assert.equal(withMetadata.publishYear, 1949);
});

test("createBook/updateBook: rechazan un publishYear fuera de rango o no entero", async () => {
  const service = new BookService(new FakeBookRepository());
  const nextYear = new Date().getFullYear() + 2;

  await assert.rejects(() => service.createBook("Libro", "Autor", 0, null, 999), BusinessError);
  await assert.rejects(() => service.createBook("Libro", "Autor", 0, null, nextYear), BusinessError);
  await assert.rejects(() => service.createBook("Libro", "Autor", 0, null, 1999.5), BusinessError);

  const book = await service.createBook("Libro", "Autor", 0);
  await assert.rejects(() => service.updateBook(book.id, "Libro", "Autor", null, 500), BusinessError);
});

test("updateBook: actualiza coverUrl/publishYear junto con título/autor", async () => {
  const service = new BookService(new FakeBookRepository());
  const book = await service.createBook("Libro", "Autor", 0);

  const updated = await service.updateBook(book.id, "Libro Editado", "Autor Editado", "https://example.com/cover.jpg", 2001);
  assert.equal(updated.title, "Libro Editado");
  assert.equal(updated.coverUrl, "https://example.com/cover.jpg");
  assert.equal(updated.publishYear, 2001);
});
