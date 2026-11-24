import { Router } from "express";
import { AuthController } from "../controllers/AuthController";
import { rateLimit } from "../middleware/security";

export function createAuthRoutes(authController: AuthController): Router {
  const router = Router();
  router.post("/auth/register", rateLimit(5, 60 * 60_000), authController.register); // 5 cuentas/hora por IP
  router.post("/auth/login", rateLimit(10, 15 * 60_000), authController.login); // 10 intentos/15 min por IP
  router.get("/auth/me", authController.me);
  return router;
}
