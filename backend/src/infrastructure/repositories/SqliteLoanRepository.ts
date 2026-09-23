import { randomUUID } from "crypto";
import { DatabaseSync } from "node:sqlite";
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

export class SqliteLoanRepository implements ILoanRepository {
  constructor(private readonly db: DatabaseSync) {}

  async findAll(): Promise<Loan[]> {
    const rows = this.db.prepare("SELECT * FROM loans").all() as unknown as LoanRow[];
    return rows.map(toLoan);
  }

  async findById(id: string): Promise<Loan | null> {
    const row = this.db.prepare("SELECT * FROM loans WHERE id = ?").get(id) as unknown as LoanRow | undefined;
    return row ? toLoan(row) : null;
  }

  async findByUserId(userId: string): Promise<Loan[]> {
    const rows = this.db.prepare("SELECT * FROM loans WHERE user_id = ?").all(userId) as unknown as LoanRow[];
    return rows.map(toLoan);
  }

  async create(loan: Omit<Loan, "id">): Promise<Loan> {
    const id = randomUUID();
    this.db
      .prepare(
        "INSERT INTO loans (id, user_id, book_copy_id, loan_date, due_date, return_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
      .run(
        id,
        loan.userId,
        loan.bookCopyId,
        loan.loanDate.toISOString(),
        loan.dueDate.toISOString(),
        loan.returnDate ? loan.returnDate.toISOString() : null,
        loan.status
      );
    return { id, ...loan };
  }

  async markReturned(id: string, returnDate: Date): Promise<Loan | null> {
    const result = this.db
      .prepare("UPDATE loans SET return_date = ?, status = 'RETURNED' WHERE id = ?")
      .run(returnDate.toISOString(), id);
    if (result.changes === 0) return null;
    return this.findById(id);
  }
}
