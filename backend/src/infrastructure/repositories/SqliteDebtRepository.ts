import { randomUUID } from "crypto";
import { DatabaseSync } from "node:sqlite";
import { IDebtRepository } from "../../domain/interfaces/IDebtRepository";
import { Debt } from "../../domain/entities/Debt";

interface DebtRow {
  id: string;
  user_id: string;
  loan_id: string;
  amount: number;
  created_at: string;
  paid: number;
  paid_at: string | null;
}

const toDebt = (row: DebtRow): Debt => ({
  id: row.id,
  userId: row.user_id,
  loanId: row.loan_id,
  amount: row.amount,
  createdAt: new Date(row.created_at),
  paid: row.paid === 1,
  paidAt: row.paid_at ? new Date(row.paid_at) : null,
});

export class SqliteDebtRepository implements IDebtRepository {
  constructor(private readonly db: DatabaseSync) {}

  async findAll(): Promise<Debt[]> {
    const rows = this.db.prepare("SELECT * FROM debts").all() as unknown as DebtRow[];
    return rows.map(toDebt);
  }

  async findByUserId(userId: string): Promise<Debt[]> {
    const rows = this.db.prepare("SELECT * FROM debts WHERE user_id = ?").all(userId) as unknown as DebtRow[];
    return rows.map(toDebt);
  }

  async hasUnpaidByUserId(userId: string): Promise<boolean> {
    const row = this.db
      .prepare("SELECT COUNT(*) as count FROM debts WHERE user_id = ? AND paid = 0")
      .get(userId) as { count: number };
    return row.count > 0;
  }

  async create(debt: Omit<Debt, "id">): Promise<Debt> {
    const id = randomUUID();
    this.db
      .prepare(
        "INSERT INTO debts (id, user_id, loan_id, amount, created_at, paid, paid_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
      .run(id, debt.userId, debt.loanId, debt.amount, debt.createdAt.toISOString(), debt.paid ? 1 : 0, null);
    return { id, ...debt };
  }

  async markPaid(id: string, paidAt: Date): Promise<Debt | null> {
    const result = this.db
      .prepare("UPDATE debts SET paid = 1, paid_at = ? WHERE id = ?")
      .run(paidAt.toISOString(), id);
    if (result.changes === 0) return null;
    const row = this.db.prepare("SELECT * FROM debts WHERE id = ?").get(id) as unknown as DebtRow;
    return toDebt(row);
  }
}
