import { randomUUID } from "crypto";
import { Pool } from "pg";
import { IAccountRepository } from "../../domain/interfaces/IAccountRepository";
import { Account } from "../../domain/entities/Account";

interface AccountRow {
  id: string;
  email: string;
  password_hash: string;
  role: Account["role"];
  created_at: string;
}

const toAccount = (row: AccountRow): Account => ({
  id: row.id,
  email: row.email,
  passwordHash: row.password_hash,
  role: row.role,
  createdAt: new Date(row.created_at),
});

export class PostgresAccountRepository implements IAccountRepository {
  constructor(private readonly pool: Pool) {}

  async findByEmail(email: string): Promise<Account | null> {
    const { rows } = await this.pool.query<AccountRow>("SELECT * FROM accounts WHERE email = $1", [email]);
    return rows[0] ? toAccount(rows[0]) : null;
  }

  async countAll(): Promise<number> {
    const { rows } = await this.pool.query<{ n: string }>("SELECT COUNT(*) AS n FROM accounts");
    return Number(rows[0].n);
  }

  async create(account: Omit<Account, "id">): Promise<Account> {
    const id = randomUUID();
    await this.pool.query(
      "INSERT INTO accounts (id, email, password_hash, role, created_at) VALUES ($1, $2, $3, $4, $5)",
      [id, account.email, account.passwordHash, account.role, account.createdAt.toISOString()]
    );
    return { id, ...account };
  }
}
