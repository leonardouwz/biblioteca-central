import { IBookRepository } from "../interfaces/IBookRepository";
import { Book } from "../entities/Book";
import { BusinessError } from "../errors/BusinessError";

export interface BookSummary extends Book {
  totalCopies: number;
  availableCopies: number;
}

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

  async createBook(title: string, author: string, initialCopies: number): Promise<BookSummary> {
    this.validate(title, author, initialCopies);
    const book = await this.bookRepository.create({ title, author });
    if (initialCopies > 0) {
      await this.bookRepository.addCopies(book.id, initialCopies);
    }
    return this.withStock(book);
  }

  async updateBook(id: string, title: string, author: string): Promise<Book> {
    if (!title.trim() || !author.trim()) {
      throw new BusinessError("BOOK_TITLE_AUTHOR_REQUIRED");
    }
    const updated = await this.bookRepository.update(id, { title, author });
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
    if (quantity <= 0) {
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

  private validate(title: string, author: string, initialCopies: number): void {
    if (!title.trim() || !author.trim()) {
      throw new BusinessError("BOOK_TITLE_AUTHOR_REQUIRED");
    }
    if (initialCopies < 0) {
      throw new BusinessError("BOOK_COPIES_NEGATIVE");
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
