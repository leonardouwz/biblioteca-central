import { Request, Response } from "express";
import { BookService } from "../../domain/services/BookService";
import { CreateBookDto, UpdateBookDto, AddStockDto } from "../dtos/BookDtos";
import { handleBusinessError, badRequest } from "./handleBusinessError";

export class BookController {
  constructor(private readonly bookService: BookService) {}

  getAll = async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json(await this.bookService.getAllBooks());
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    try {
      res.status(200).json(await this.bookService.getBookById(req.params.id));
    } catch (error) {
      handleBusinessError(res, error, req.locale);
    }
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const { title, author, initialCopies, coverUrl, publishYear } = req.body as CreateBookDto;

    if (typeof title !== "string" || typeof author !== "string" || typeof initialCopies !== "number") {
      badRequest(res, req.locale, "BODY_BOOK_CREATE_INVALID");
      return;
    }

    try {
      res
        .status(201)
        .json(
          await this.bookService.createBook(
            title,
            author,
            initialCopies,
            typeof coverUrl === "string" ? coverUrl : null,
            typeof publishYear === "number" ? publishYear : null
          )
        );
    } catch (error) {
      handleBusinessError(res, error, req.locale);
    }
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { title, author, coverUrl, publishYear } = req.body as UpdateBookDto;

    if (typeof title !== "string" || typeof author !== "string") {
      badRequest(res, req.locale, "BODY_BOOK_UPDATE_INVALID");
      return;
    }

    try {
      res
        .status(200)
        .json(
          await this.bookService.updateBook(
            req.params.id,
            title,
            author,
            typeof coverUrl === "string" ? coverUrl : null,
            typeof publishYear === "number" ? publishYear : null
          )
        );
    } catch (error) {
      handleBusinessError(res, error, req.locale);
    }
  };

  addStock = async (req: Request, res: Response): Promise<void> => {
    const { quantity } = req.body as AddStockDto;

    if (typeof quantity !== "number") {
      badRequest(res, req.locale, "BODY_STOCK_INVALID");
      return;
    }

    try {
      res.status(200).json(await this.bookService.addStock(req.params.id, quantity));
    } catch (error) {
      handleBusinessError(res, error, req.locale);
    }
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    try {
      await this.bookService.deleteBook(req.params.id);
      res.status(204).send();
    } catch (error) {
      handleBusinessError(res, error, req.locale);
    }
  };
}
