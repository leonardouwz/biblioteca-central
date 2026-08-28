import { Request, Response } from "express";
import { UserService } from "../../domain/services/UserService";
import { BusinessError } from "../../domain/errors/BusinessError";
import { CreateUserDto, UpdateUserDto, SetUserStatusDto } from "../dtos/UserDtos";

export class UserController {
  constructor(private readonly userService: UserService) {}

  getAll = async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json(await this.userService.getAllUsers());
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    try {
      res.status(200).json(await this.userService.getUserById(req.params.id));
    } catch (error) {
      this.handleError(res, error);
    }
  };

  getLoans = async (req: Request, res: Response): Promise<void> => {
    try {
      res.status(200).json(await this.userService.getUserLoans(req.params.id));
    } catch (error) {
      this.handleError(res, error);
    }
  };

  getDebts = async (req: Request, res: Response): Promise<void> => {
    try {
      res.status(200).json(await this.userService.getUserDebts(req.params.id));
    } catch (error) {
      this.handleError(res, error);
    }
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const { name, email } = req.body as CreateUserDto;

    if (typeof name !== "string" || typeof email !== "string") {
      res.status(400).json({ error: "name (string) y email (string) son requeridos." });
      return;
    }

    try {
      res.status(201).json(await this.userService.createUser(name, email));
    } catch (error) {
      this.handleError(res, error);
    }
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { name, email } = req.body as UpdateUserDto;

    if (typeof name !== "string" || typeof email !== "string") {
      res.status(400).json({ error: "name (string) y email (string) son requeridos." });
      return;
    }

    try {
      res.status(200).json(await this.userService.updateUser(req.params.id, name, email));
    } catch (error) {
      this.handleError(res, error);
    }
  };

  setStatus = async (req: Request, res: Response): Promise<void> => {
    const { status } = req.body as SetUserStatusDto;

    if (status !== "ACTIVE" && status !== "INACTIVE") {
      res.status(400).json({ error: "status debe ser ACTIVE o INACTIVE." });
      return;
    }

    try {
      res.status(200).json(await this.userService.setStatus(req.params.id, status));
    } catch (error) {
      this.handleError(res, error);
    }
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    try {
      await this.userService.deleteUser(req.params.id);
      res.status(204).send();
    } catch (error) {
      this.handleError(res, error);
    }
  };

  private handleError(res: Response, error: unknown): void {
    if (error instanceof BusinessError) {
      const status = error.message === "El usuario no existe." ? 404 : 422;
      res.status(status).json({ error: error.message });
      return;
    }
    console.error(error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
}
