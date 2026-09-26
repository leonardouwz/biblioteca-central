export interface CreateBookDto {
  title: string;
  author: string;
  initialCopies: number;
  coverUrl?: string | null;
  publishYear?: number | null;
}

export interface UpdateBookDto {
  title: string;
  author: string;
  coverUrl?: string | null;
  publishYear?: number | null;
}

export interface AddStockDto {
  quantity: number;
}
