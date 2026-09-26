import { IBookRepository } from "../interfaces/IBookRepository";
import { Book } from "../entities/Book";
import { BusinessError } from "../errors/BusinessError";

export interface BookSummary extends Book {
  totalCopies: number;
  availableCopies: number;
}

// Tope defensivo: sin esto, `addCopies` inserta una fila por unidad en un
// loop `for` — un request directo a la API con `quantity: 1e30` (JSON no
// tiene límite de tamaño de número) lo dejaría corriendo casi para siempre.
const MAX_STOCK_QUANTITY = 10_000;
const MIN_PUBLISH_YEAR = 1000;

const isValidQuantity = (value: number): boolean =>
  Number.isInteger(value) && Number.isFinite(value) && value >= 0 && value <= MAX_STOCK_QUANTITY;

const isValidPublishYear = (value: number): boolean =>
  Number.isInteger(value) && value >= MIN_PUBLISH_YEAR && value <= new Date().getFullYear() + 1;

export class BookService {
  constructor(private readonly bookRepository: IBookRepository) {}

  async getAllBooks(): Promise<BookSummary[]> {
    const books = await this.bookRepository.findAll();
    return Promise.all(books.map((book) => this.withStock(book)));
  }

  async getBookById(id: string): Promise<BookSummary> {
    const book = await this.bookRepository.findById(id);
    if (!book) {
      throw new BusinessError("BOOK_NOT_FOUND");
    }
    return this.withStock(book);
  }

  async createBook(
    title: string,
    author: string,
    initialCopies: number,
    coverUrl: string | null = null,
    publishYear: number | null = null
  ): Promise<BookSummary> {
    this.validate(title, author, initialCopies, publishYear);
    const book = await this.bookRepository.create({ title, author, coverUrl, publishYear });
    if (initialCopies > 0) {
      await this.bookRepository.addCopies(book.id, initialCopies);
    }
    return this.withStock(book);
  }

  async updateBook(
    id: string,
    title: string,
    author: string,
    coverUrl: string | null = null,
    publishYear: number | null = null
  ): Promise<Book> {
    if (!title.trim() || !author.trim()) {
      throw new BusinessError("BOOK_TITLE_AUTHOR_REQUIRED");
    }
    if (publishYear !== null && !isValidPublishYear(publishYear)) {
      throw new BusinessError("BOOK_PUBLISH_YEAR_INVALID");
    }
    const updated = await this.bookRepository.update(id, { title, author, coverUrl, publishYear });
    if (!updated) {
      throw new BusinessError("BOOK_NOT_FOUND");
    }
    return updated;
  }

  async addStock(bookId: string, quantity: number): Promise<BookSummary> {
    const book = await this.bookRepository.findById(bookId);
    if (!book) {
      throw new BusinessError("BOOK_NOT_FOUND");
    }
    if (!isValidQuantity(quantity) || quantity === 0) {
      throw new BusinessError("BOOK_QUANTITY_INVALID");
    }
    await this.bookRepository.addCopies(bookId, quantity);
    return this.withStock(book);
  }

  async deleteBook(id: string): Promise<void> {
    const copies = await this.bookRepository.findCopiesByBookId(id);
    if (copies.some((copy) => copy.status === "LOANED")) {
      throw new BusinessError("BOOK_HAS_LOANED_COPIES");
    }
    const deleted = await this.bookRepository.delete(id);
    if (!deleted) {
      throw new BusinessError("BOOK_NOT_FOUND");
    }
  }

  private validate(title: string, author: string, initialCopies: number, publishYear: number | null): void {
    if (!title.trim() || !author.trim()) {
      throw new BusinessError("BOOK_TITLE_AUTHOR_REQUIRED");
    }
    if (!isValidQuantity(initialCopies)) {
      throw new BusinessError("BOOK_COPIES_NEGATIVE");
    }
    if (publishYear !== null && !isValidPublishYear(publishYear)) {
      throw new BusinessError("BOOK_PUBLISH_YEAR_INVALID");
    }
  }

  private async withStock(book: Book): Promise<BookSummary> {
    const copies = await this.bookRepository.findCopiesByBookId(book.id);
    return {
      ...book,
      totalCopies: copies.length,
      availableCopies: copies.filter((c) => c.status === "AVAILABLE").length,
    };
  }
}
