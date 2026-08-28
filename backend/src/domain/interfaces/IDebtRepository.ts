import { Debt } from "../entities/Debt";

export interface IDebtRepository {
  findAll(): Promise<Debt[]>;
  findByUserId(userId: string): Promise<Debt[]>;
  hasUnpaidByUserId(userId: string): Promise<boolean>;
  create(debt: Omit<Debt, "id">): Promise<Debt>;
  markPaid(id: string, paidAt: Date): Promise<Debt | null>;
}
