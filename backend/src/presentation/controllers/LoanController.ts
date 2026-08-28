import { Request, Response } from "express";
import { LoanService } from "../../domain/services/LoanService";
import { BusinessError } from "../../domain/errors/BusinessError";
import { CreateLoanDto } from "../dtos/CreateLoanDto";

export class LoanController {
  constructor(private readonly loanService: LoanService) {}

  getAll = async (req: Request, res: Response): Promise<void> => {
    const overdueOnly = req.query.overdue === "true";
    res.status(200).json(await this.loanService.getAllLoans(overdueOnly));
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const { userId, bookId } = req.body as CreateLoanDto;

    if (!userId || typeof userId !== "string" || !bookId || typeof bookId !== "string") {
      res.status(400).json({ error: "userId y bookId son requeridos y deben ser strings." });
      return;
    }

    try {
      res.status(201).json(await this.loanService.createLoan(userId, bookId));
    } catch (error) {
      this.handleError(res, error);
    }
  };

  returnLoan = async (req: Request, res: Response): Promise<void> => {
    try {
      res.status(200).json(await this.loanService.returnLoan(req.params.id));
    } catch (error) {
      this.handleError(res, error);
    }
  };

  private handleError(res: Response, error: unknown): void {
    if (error instanceof BusinessError) {
      const status = error.message.endsWith("no existe.") ? 404 : 422;
      res.status(status).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "Error interno del servidor." });
  }
}
