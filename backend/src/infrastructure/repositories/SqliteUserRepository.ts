import { randomUUID } from "crypto";
import { DatabaseSync } from "node:sqlite";
import { IUserRepository } from "../../domain/interfaces/IUserRepository";
import { User } from "../../domain/entities/User";

interface UserRow {
  id: string;
  name: string;
  email: string;
  status: User["status"];
}

const toUser = (row: UserRow): User => ({ id: row.id, name: row.name, email: row.email, status: row.status });

export class SqliteUserRepository implements IUserRepository {
  constructor(private readonly db: DatabaseSync) {}

  async findAll(): Promise<User[]> {
    const rows = this.db.prepare("SELECT * FROM users").all() as unknown as UserRow[];
    return rows.map(toUser);
  }

  async findById(id: string): Promise<User | null> {
    const row = this.db.prepare("SELECT * FROM users WHERE id = ?").get(id) as unknown as UserRow | undefined;
    return row ? toUser(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = this.db.prepare("SELECT * FROM users WHERE email = ?").get(email) as unknown as UserRow | undefined;
    return row ? toUser(row) : null;
  }

  async create(user: Omit<User, "id">): Promise<User> {
    const id = randomUUID();
    this.db
      .prepare("INSERT INTO users (id, name, email, status) VALUES (?, ?, ?, ?)")
      .run(id, user.name, user.email, user.status);
    return { id, ...user };
  }

  async update(id: string, user: Omit<User, "id">): Promise<User | null> {
    const result = this.db
      .prepare("UPDATE users SET name = ?, email = ?, status = ? WHERE id = ?")
      .run(user.name, user.email, user.status, id);
    if (result.changes === 0) return null;
    return { id, ...user };
  }

  async setStatus(id: string, status: User["status"]): Promise<User | null> {
    const result = this.db.prepare("UPDATE users SET status = ? WHERE id = ?").run(status, id);
    if (result.changes === 0) return null;
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = this.db.prepare("DELETE FROM users WHERE id = ?").run(id);
    return result.changes > 0;
  }
}
