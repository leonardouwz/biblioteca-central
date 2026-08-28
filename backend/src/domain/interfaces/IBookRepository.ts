import { Book } from "../entities/Book";
import { BookCopy } from "../entities/BookCopy";

export interface IBookRepository {
  findAll(): Promise<Book[]>;
  findById(id: string): Promise<Book | null>;
  create(book: Omit<Book, "id">): Promise<Book>;
  update(id: string, book: Omit<Book, "id">): Promise<Book | null>;
  delete(id: string): Promise<boolean>;

  findCopiesByBookId(bookId: string): Promise<BookCopy[]>;
  findCopyById(copyId: string): Promise<BookCopy | null>;
  findAvailableCopy(bookId: string): Promise<BookCopy | null>;
  addCopies(bookId: string, quantity: number): Promise<BookCopy[]>;
  setCopyStatus(copyId: string, status: BookCopy["status"]): Promise<void>;
}
