import { randomUUID } from "crypto";
import { Pool } from "pg";
import { ILoanRepository } from "../../domain/interfaces/ILoanRepository";
import { Loan } from "../../domain/entities/Loan";

interface LoanRow {
  id: string;
  user_id: string;
  book_copy_id: string;
  loan_date: string;
  due_date: string;
  return_date: string | null;
  status: Loan["status"];
}

const toLoan = (row: LoanRow): Loan => ({
  id: row.id,
  userId: row.user_id,
  bookCopyId: row.book_copy_id,
  loanDate: new Date(row.loan_date),
  dueDate: new Date(row.due_date),
  returnDate: row.return_date ? new Date(row.return_date) : null,
  status: row.status,
});

export class PostgresLoanRepository implements ILoanRepository {
  constructor(private readonly pool: Pool) {}

  async findAll(): Promise<Loan[]> {
    const { rows } = await this.pool.query<LoanRow>("SELECT * FROM loans ORDER BY loan_date");
    return rows.map(toLoan);
  }

  async findById(id: string): Promise<Loan | null> {
    const { rows } = await this.pool.query<LoanRow>("SELECT * FROM loans WHERE id = $1", [id]);
    return rows[0] ? toLoan(rows[0]) : null;
  }

  async findByUserId(userId: string): Promise<Loan[]> {
    const { rows } = await this.pool.query<LoanRow>("SELECT * FROM loans WHERE user_id = $1", [userId]);
    return rows.map(toLoan);
  }

  async create(loan: Omit<Loan, "id">): Promise<Loan> {
    const id = randomUUID();
    await this.pool.query(
      "INSERT INTO loans (id, user_id, book_copy_id, loan_date, due_date, return_date, status) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [
        id,
        loan.userId,
        loan.bookCopyId,
        loan.loanDate.toISOString(),
        loan.dueDate.toISOString(),
        loan.returnDate ? loan.returnDate.toISOString() : null,
        loan.status,
      ]
    );
    return { id, ...loan };
  }

  async markReturned(id: string, returnDate: Date): Promise<Loan | null> {
    const result = await this.pool.query("UPDATE loans SET return_date = $1, status = 'RETURNED' WHERE id = $2", [
      returnDate.toISOString(),
      id,
    ]);
    if (result.rowCount === 0) return null;
    return this.findById(id);
  }
}
