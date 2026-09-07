import { Router } from "express";
import { LoanController } from "../controllers/LoanController";
import { requireAuth, STAFF } from "../middleware/requireAuth";

export function createLoanRoutes(loanController: LoanController, secret: string): Router {
  const router = Router();
  const auth = requireAuth(secret);
  const staff = requireAuth(secret, ...STAFF);

  router.get("/loans", auth, loanController.getAll);
  router.post("/loans", staff, loanController.create);
  router.post("/loans/:id/return", staff, loanController.returnLoan);
  return router;
}
