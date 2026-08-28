import { randomUUID } from "crypto";
import { Pool } from "pg";
import { IUserRepository } from "../../domain/interfaces/IUserRepository";
import { User } from "../../domain/entities/User";

interface UserRow {
  id: string;
  name: string;
  email: string;
  status: User["status"];
}

const toUser = (row: UserRow): User => ({ id: row.id, name: row.name, email: row.email, status: row.status });

export class PostgresUserRepository implements IUserRepository {
  constructor(private readonly pool: Pool) {}

  async findAll(): Promise<User[]> {
    const { rows } = await this.pool.query<UserRow>("SELECT * FROM users ORDER BY name");
    return rows.map(toUser);
  }

  async findById(id: string): Promise<User | null> {
    const { rows } = await this.pool.query<UserRow>("SELECT * FROM users WHERE id = $1", [id]);
    return rows[0] ? toUser(rows[0]) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const { rows } = await this.pool.query<UserRow>("SELECT * FROM users WHERE email = $1", [email]);
    return rows[0] ? toUser(rows[0]) : null;
  }

  async create(user: Omit<User, "id">): Promise<User> {
    const id = randomUUID();
    await this.pool.query("INSERT INTO users (id, name, email, status) VALUES ($1, $2, $3, $4)", [
      id,
      user.name,
      user.email,
      user.status,
    ]);
    return { id, ...user };
  }

  async update(id: string, user: Omit<User, "id">): Promise<User | null> {
    const result = await this.pool.query("UPDATE users SET name = $1, email = $2, status = $3 WHERE id = $4", [
      user.name,
      user.email,
      user.status,
      id,
    ]);
    if (result.rowCount === 0) return null;
    return { id, ...user };
  }

  async setStatus(id: string, status: User["status"]): Promise<User | null> {
    const result = await this.pool.query("UPDATE users SET status = $1 WHERE id = $2", [status, id]);
    if (result.rowCount === 0) return null;
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query("DELETE FROM users WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }
}
