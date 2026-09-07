import { randomUUID } from "crypto";
import { DatabaseSync } from "node:sqlite";
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

export class SqliteAccountRepository implements IAccountRepository {
  constructor(private readonly db: DatabaseSync) {}

  async findByEmail(email: string): Promise<Account | null> {
    const row = this.db
      .prepare("SELECT * FROM accounts WHERE email = ?")
      .get(email) as unknown as AccountRow | undefined;
    return row ? toAccount(row) : null;
  }

  async countAll(): Promise<number> {
    const row = this.db.prepare("SELECT COUNT(*) AS n FROM accounts").get() as unknown as { n: number };
    return row.n;
  }

  async create(account: Omit<Account, "id">): Promise<Account> {
    const id = randomUUID();
    this.db
      .prepare("INSERT INTO accounts (id, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(id, account.email, account.passwordHash, account.role, account.createdAt.toISOString());
    return { id, ...account };
  }
}
