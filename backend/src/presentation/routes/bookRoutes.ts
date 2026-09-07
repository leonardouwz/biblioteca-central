import { Router } from "express";
import { BookController } from "../controllers/BookController";
import { requireAuth, STAFF } from "../middleware/requireAuth";

export function createBookRoutes(bookController: BookController, secret: string): Router {
  const router = Router();
  const auth = requireAuth(secret);
  const staff = requireAuth(secret, ...STAFF);

  router.get("/books", auth, bookController.getAll);
  router.get("/books/:id", auth, bookController.getById);
  router.post("/books", staff, bookController.create);
  router.put("/books/:id", staff, bookController.update);
  router.post("/books/:id/stock", staff, bookController.addStock);
  router.delete("/books/:id", staff, bookController.remove);
  return router;
}
