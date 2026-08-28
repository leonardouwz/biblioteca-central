import { Router } from "express";
import { LoanController } from "../controllers/LoanController";

export function createLoanRoutes(loanController: LoanController): Router {
  const router = Router();
  router.get("/loans", loanController.getAll);
  router.post("/loans", loanController.create);
  router.post("/loans/:id/return", loanController.returnLoan);
  return router;
}
