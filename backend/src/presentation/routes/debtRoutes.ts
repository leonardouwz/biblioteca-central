import { Router } from "express";
import { DebtController } from "../controllers/DebtController";
import { requireAuth, STAFF } from "../middleware/requireAuth";

export function createDebtRoutes(debtController: DebtController, secret: string): Router {
  const router = Router();
  const staff = requireAuth(secret, ...STAFF);

  router.get("/debts", staff, debtController.getAll);
  router.post("/debts/:id/pay", staff, debtController.pay);
  return router;
}
