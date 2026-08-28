import { Router } from "express";
import { DebtController } from "../controllers/DebtController";

export function createDebtRoutes(debtController: DebtController): Router {
  const router = Router();
  router.get("/debts", debtController.getAll);
  router.post("/debts/:id/pay", debtController.pay);
  return router;
}
