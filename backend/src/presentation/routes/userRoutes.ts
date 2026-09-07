import { Router } from "express";
import { UserController } from "../controllers/UserController";
import { requireAuth, STAFF } from "../middleware/requireAuth";

export function createUserRoutes(userController: UserController, secret: string): Router {
  const router = Router();
  const staff = requireAuth(secret, ...STAFF);
  const admin = requireAuth(secret, "ADMINISTRADOR");

  router.get("/users", staff, userController.getAll);
  router.get("/users/:id", staff, userController.getById);
  router.get("/users/:id/loans", staff, userController.getLoans);
  router.get("/users/:id/debts", staff, userController.getDebts);
  router.post("/users", staff, userController.create);
  router.put("/users/:id", staff, userController.update);
  router.put("/users/:id/status", staff, userController.setStatus);
  router.delete("/users/:id", admin, userController.remove);
  return router;
}
