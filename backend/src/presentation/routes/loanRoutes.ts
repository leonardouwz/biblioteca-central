import { Router } from "express";
import { LoanController } from "../controllers/LoanController";
import { requireAuth, STAFF } from "../middleware/requireAuth";

export function createLoanRoutes(loanController: LoanController, secret: string): Router {
  const router = Router();
  const staff = requireAuth(secret, ...STAFF);

  router.get("/loans", staff, loanController.getAll); // lista de TODOS los préstamos: solo personal (el socio usa /me)
  router.post("/loans", staff, loanController.create);
  router.post("/loans/:id/return", staff, loanController.returnLoan);
  return router;
}
