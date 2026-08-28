import { Loan } from "../entities/Loan";

export interface ILoanRepository {
  findAll(): Promise<Loan[]>;
  findById(id: string): Promise<Loan | null>;
  findByUserId(userId: string): Promise<Loan[]>;
  countActiveByUserId(userId: string): Promise<number>;
  create(loan: Omit<Loan, "id">): Promise<Loan>;
  markReturned(id: string, returnDate: Date): Promise<Loan | null>;
}
