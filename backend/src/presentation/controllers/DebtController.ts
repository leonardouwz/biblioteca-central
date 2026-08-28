import { Request, Response } from "express";
import { DebtService } from "../../domain/services/DebtService";
import { BusinessError } from "../../domain/errors/BusinessError";

export class DebtController {
  constructor(private readonly debtService: DebtService) {}

  getAll = async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json(await this.debtService.getAllDebts());
  };

  pay = async (req: Request, res: Response): Promise<void> => {
    try {
      res.status(200).json(await this.debtService.markAsPaid(req.params.id));
    } catch (error) {
      if (error instanceof BusinessError) {
        res.status(404).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: "Error interno del servidor." });
    }
  };
}
