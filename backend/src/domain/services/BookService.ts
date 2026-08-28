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
      throw new BusinessError("El libro no existe.");
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
      throw new BusinessError("Título y autor son requeridos.");
    }
    const updated = await this.bookRepository.update(id, { title, author });
    if (!updated) {
      throw new BusinessError("El libro no existe.");
    }
    return updated;
  }

  async addStock(bookId: string, quantity: number): Promise<BookSummary> {
    const book = await this.bookRepository.findById(bookId);
    if (!book) {
      throw new BusinessError("El libro no existe.");
    }
    if (quantity <= 0) {
      throw new BusinessError("La cantidad a agregar debe ser mayor a cero.");
    }
    await this.bookRepository.addCopies(bookId, quantity);
    return this.withStock(book);
  }

  async deleteBook(id: string): Promise<void> {
    const copies = await this.bookRepository.findCopiesByBookId(id);
    if (copies.some((copy) => copy.status === "LOANED")) {
      throw new BusinessError("No se puede eliminar un libro con copias actualmente prestadas.");
    }
    const deleted = await this.bookRepository.delete(id);
    if (!deleted) {
      throw new BusinessError("El libro no existe.");
    }
  }

  private validate(title: string, author: string, initialCopies: number): void {
    if (!title.trim() || !author.trim()) {
      throw new BusinessError("Título y autor son requeridos.");
    }
    if (initialCopies < 0) {
      throw new BusinessError("Las copias no pueden ser negativas.");
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
