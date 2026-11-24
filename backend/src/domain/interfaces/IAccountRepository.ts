import { Account, LoginMethod } from "../entities/Account";

export interface IAccountRepository {
  findByEmail(email: string): Promise<Account | null>;
  countAll(): Promise<number>;
  create(account: Omit<Account, "id">): Promise<Account>;
  recordLogin(id: string, method: LoginMethod, at: Date): Promise<void>;
}
