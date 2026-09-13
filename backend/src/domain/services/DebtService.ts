import { IDebtRepository } from "../interfaces/IDebtRepository";
import { Debt } from "../entities/Debt";
import { BusinessError } from "../errors/BusinessError";

export class DebtService {
  constructor(private readonly debtRepository: IDebtRepository) {}

  async getAllDebts(): Promise<Debt[]> {
    return this.debtRepository.findAll();
  }

  async markAsPaid(id: string): Promise<Debt> {
    const updated = await this.debtRepository.markPaid(id, new Date());
    if (!updated) {
      throw new BusinessError("DEBT_NOT_FOUND");
    }
    return updated;
  }
}
