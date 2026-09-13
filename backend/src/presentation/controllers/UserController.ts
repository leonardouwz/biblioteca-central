import { Request, Response } from "express";
import { UserService } from "../../domain/services/UserService";
import { CreateUserDto, UpdateUserDto, SetUserStatusDto } from "../dtos/UserDtos";
import { handleBusinessError, badRequest } from "./handleBusinessError";

export class UserController {
  constructor(private readonly userService: UserService) {}

  getAll = async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json(await this.userService.getAllUsers());
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    try {
      res.status(200).json(await this.userService.getUserById(req.params.id));
    } catch (error) {
      handleBusinessError(res, error, req.locale);
    }
  };

  getLoans = async (req: Request, res: Response): Promise<void> => {
    try {
      res.status(200).json(await this.userService.getUserLoans(req.params.id));
    } catch (error) {
      handleBusinessError(res, error, req.locale);
    }
  };

  getDebts = async (req: Request, res: Response): Promise<void> => {
    try {
      res.status(200).json(await this.userService.getUserDebts(req.params.id));
    } catch (error) {
      handleBusinessError(res, error, req.locale);
    }
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const { name, email } = req.body as CreateUserDto;

    if (typeof name !== "string" || typeof email !== "string") {
      badRequest(res, req.locale, "BODY_USER_INVALID");
      return;
    }

    try {
      res.status(201).json(await this.userService.createUser(name, email));
    } catch (error) {
      handleBusinessError(res, error, req.locale);
    }
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { name, email } = req.body as UpdateUserDto;

    if (typeof name !== "string" || typeof email !== "string") {
      badRequest(res, req.locale, "BODY_USER_INVALID");
      return;
    }

    try {
      res.status(200).json(await this.userService.updateUser(req.params.id, name, email));
    } catch (error) {
      handleBusinessError(res, error, req.locale);
    }
  };

  setStatus = async (req: Request, res: Response): Promise<void> => {
    const { status } = req.body as SetUserStatusDto;

    if (status !== "ACTIVE" && status !== "INACTIVE") {
      badRequest(res, req.locale, "BODY_STATUS_INVALID");
      return;
    }

    try {
      res.status(200).json(await this.userService.setStatus(req.params.id, status));
    } catch (error) {
      handleBusinessError(res, error, req.locale);
    }
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    try {
      await this.userService.deleteUser(req.params.id);
      res.status(204).send();
    } catch (error) {
      handleBusinessError(res, error, req.locale);
    }
  };
}
