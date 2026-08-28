import { Router } from "express";
import { BookController } from "../controllers/BookController";

export function createBookRoutes(bookController: BookController): Router {
  const router = Router();
  router.get("/books", bookController.getAll);
  router.get("/books/:id", bookController.getById);
  router.post("/books", bookController.create);
  router.put("/books/:id", bookController.update);
  router.post("/books/:id/stock", bookController.addStock);
  router.delete("/books/:id", bookController.remove);
  return router;
}
