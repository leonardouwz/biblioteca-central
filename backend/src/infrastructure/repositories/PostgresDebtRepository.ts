import { randomUUID } from "crypto";
import { Pool } from "pg";
import { IDebtRepository } from "../../domain/interfaces/IDebtRepository";
import { Debt } from "../../domain/entities/Debt";

interface DebtRow {
  id: string;
  user_id: string;
  loan_id: string;
  amount: number;
  created_at: string;
  paid: boolean;
  paid_at: string | null;
}

const toDebt = (row: DebtRow): Debt => ({
  id: row.id,
  userId: row.user_id,
  loanId: row.loan_id,
  amount: Number(row.amount),
  createdAt: new Date(row.created_at),
  paid: row.paid,
  paidAt: row.paid_at ? new Date(row.paid_at) : null,
});

export class PostgresDebtRepository implements IDebtRepository {
  constructor(private readonly pool: Pool) {}

  async findAll(): Promise<Debt[]> {
    const { rows } = await this.pool.query<DebtRow>("SELECT * FROM debts ORDER BY created_at");
    return rows.map(toDebt);
  }

  async findByUserId(userId: string): Promise<Debt[]> {
    const { rows } = await this.pool.query<DebtRow>("SELECT * FROM debts WHERE user_id = $1", [userId]);
    return rows.map(toDebt);
  }

  async hasUnpaidByUserId(userId: string): Promise<boolean> {
    const { rows } = await this.pool.query<{ count: string }>(
      "SELECT COUNT(*) as count FROM debts WHERE user_id = $1 AND paid = FALSE",
      [userId]
    );
    return Number(rows[0].count) > 0;
  }

  async create(debt: Omit<Debt, "id">): Promise<Debt> {
    const id = randomUUID();
    await this.pool.query(
      "INSERT INTO debts (id, user_id, loan_id, amount, created_at, paid, paid_at) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [id, debt.userId, debt.loanId, debt.amount, debt.createdAt.toISOString(), debt.paid, null]
    );
    return { id, ...debt };
  }

  async markPaid(id: string, paidAt: Date): Promise<Debt | null> {
    const result = await this.pool.query("UPDATE debts SET paid = TRUE, paid_at = $1 WHERE id = $2", [
      paidAt.toISOString(),
      id,
    ]);
    if (result.rowCount === 0) return null;
    const { rows } = await this.pool.query<DebtRow>("SELECT * FROM debts WHERE id = $1", [id]);
    return toDebt(rows[0]);
  }
}
