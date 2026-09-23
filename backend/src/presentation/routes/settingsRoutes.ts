import { Router } from "express";
import { SettingsController } from "../controllers/SettingsController";
import { requireAuth, STAFF } from "../middleware/requireAuth";

export function createSettingsRoutes(settingsController: SettingsController, secret: string): Router {
  const router = Router();
  const staff = requireAuth(secret, ...STAFF); // bibliotecario también necesita conocer la política vigente
  const admin = requireAuth(secret, "ADMINISTRADOR"); // solo admin la modifica

  router.get("/settings", staff, settingsController.get);
  router.put("/settings", admin, settingsController.update);
  return router;
}
