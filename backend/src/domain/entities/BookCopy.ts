export type BookCopyStatus = "AVAILABLE" | "LOANED";

export interface BookCopy {
  id: string;
  bookId: string;
  status: BookCopyStatus;
}
