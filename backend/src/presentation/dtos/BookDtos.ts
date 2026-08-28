export interface CreateBookDto {
  title: string;
  author: string;
  initialCopies: number;
}

export interface UpdateBookDto {
  title: string;
  author: string;
}

export interface AddStockDto {
  quantity: number;
}
