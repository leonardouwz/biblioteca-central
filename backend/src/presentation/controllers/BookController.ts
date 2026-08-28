import { Request, Response } from "express";
import { BookService } from "../../domain/services/BookService";
import { BusinessError } from "../../domain/errors/BusinessError";
import { CreateBookDto, UpdateBookDto, AddStockDto } from "../dtos/BookDtos";

export class BookController {
  constructor(private readonly bookService: BookService) {}

  getAll = async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json(await this.bookService.getAllBooks());
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    try {
      res.status(200).json(await this.bookService.getBookById(req.params.id));
    } catch (error) {
      this.handleError(res, error);
    }
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const { title, author, initialCopies } = req.body as CreateBookDto;

    if (typeof title !== "string" || typeof author !== "string" || typeof initialCopies !== "number") {
      res.status(400).json({ error: "title (string), author (string) e initialCopies (number) son requeridos." });
      return;
    }

    try {
      res.status(201).json(await this.bookService.createBook(title, author, initialCopies));
    } catch (error) {
      this.handleError(res, error);
    }
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { title, author } = req.body as UpdateBookDto;

    if (typeof title !== "string" || typeof author !== "string") {
      res.status(400).json({ error: "title (string) y author (string) son requeridos." });
      return;
    }

    try {
      res.status(200).json(await this.bookService.updateBook(req.params.id, title, author));
    } catch (error) {
      this.handleError(res, error);
    }
  };

  addStock = async (req: Request, res: Response): Promise<void> => {
    const { quantity } = req.body as AddStockDto;

    if (typeof quantity !== "number") {
      res.status(400).json({ error: "quantity (number) es requerido." });
      return;
    }

    try {
      res.status(200).json(await this.bookService.addStock(req.params.id, quantity));
    } catch (error) {
      this.handleError(res, error);
    }
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    try {
      await this.bookService.deleteBook(req.params.id);
      res.status(204).send();
    } catch (error) {
      this.handleError(res, error);
    }
  };

  private handleError(res: Response, error: unknown): void {
    if (error instanceof BusinessError) {
      const status = error.message === "El libro no existe." ? 404 : 422;
      res.status(status).json({ error: error.message });
      return;
    }
    console.error(error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
}
