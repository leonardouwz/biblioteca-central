import { Router } from "express";
import { UserController } from "../controllers/UserController";

export function createUserRoutes(userController: UserController): Router {
  const router = Router();
  router.get("/users", userController.getAll);
  router.get("/users/:id", userController.getById);
  router.get("/users/:id/loans", userController.getLoans);
  router.get("/users/:id/debts", userController.getDebts);
  router.post("/users", userController.create);
  router.put("/users/:id", userController.update);
  router.put("/users/:id/status", userController.setStatus);
  router.delete("/users/:id", userController.remove);
  return router;
}
