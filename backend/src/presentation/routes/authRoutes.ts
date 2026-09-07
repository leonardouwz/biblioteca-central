import { Router } from "express";
import { AuthController } from "../controllers/AuthController";

export function createAuthRoutes(authController: AuthController): Router {
  const router = Router();
  router.post("/auth/register", authController.register);
  router.post("/auth/login", authController.login);
  router.get("/auth/me", authController.me);
  return router;
}
