import { Request, Response } from "express";
import { DebtService } from "../../domain/services/DebtService";
import { handleBusinessError } from "./handleBusinessError";

export class DebtController {
  constructor(private readonly debtService: DebtService) {}

  getAll = async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json(await this.debtService.getAllDebts());
  };

  pay = async (req: Request, res: Response): Promise<void> => {
    try {
      res.status(200).json(await this.debtService.markAsPaid(req.params.id));
    } catch (error) {
      handleBusinessError(res, error, req.locale);
    }
  };
}
