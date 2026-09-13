import { Request, Response } from "express";
import { LoanService } from "../../domain/services/LoanService";
import { CreateLoanDto } from "../dtos/CreateLoanDto";
import { handleBusinessError, badRequest } from "./handleBusinessError";

export class LoanController {
  constructor(private readonly loanService: LoanService) {}

  getAll = async (req: Request, res: Response): Promise<void> => {
    const overdueOnly = req.query.overdue === "true";
    res.status(200).json(await this.loanService.getAllLoans(overdueOnly));
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const { userId, bookId } = req.body as CreateLoanDto;

    if (!userId || typeof userId !== "string" || !bookId || typeof bookId !== "string") {
      badRequest(res, req.locale, "BODY_LOAN_INVALID");
      return;
    }

    try {
      res.status(201).json(await this.loanService.createLoan(userId, bookId));
    } catch (error) {
      handleBusinessError(res, error, req.locale);
    }
  };

  returnLoan = async (req: Request, res: Response): Promise<void> => {
    try {
      res.status(200).json(await this.loanService.returnLoan(req.params.id));
    } catch (error) {
      handleBusinessError(res, error, req.locale);
    }
  };
}
