import { Account } from "../entities/Account";

export interface IAccountRepository {
  findByEmail(email: string): Promise<Account | null>;
  countAll(): Promise<number>;
  create(account: Omit<Account, "id">): Promise<Account>;
}
