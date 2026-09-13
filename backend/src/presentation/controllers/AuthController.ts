import { Request, Response } from "express";
import { AuthService } from "../../domain/services/AuthService";
import { verifyToken } from "../../domain/services/authTokens";
import { t } from "../../domain/i18n/t";
import { RegisterDto, LoginDto } from "../dtos/AuthDtos";
import { handleBusinessError, badRequest } from "./handleBusinessError";

export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly secret: string
  ) {}

  register = async (req: Request, res: Response): Promise<void> => {
    const { email, password, role } = req.body as RegisterDto;
    if (typeof email !== "string" || typeof password !== "string") {
      badRequest(res, req.locale, "BODY_AUTH_INVALID");
      return;
    }
    try {
      res.status(201).json(await this.authService.register(email, password, role));
    } catch (error) {
      handleBusinessError(res, error, req.locale);
    }
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body as LoginDto;
    if (typeof email !== "string" || typeof password !== "string") {
      badRequest(res, req.locale, "BODY_AUTH_INVALID");
      return;
    }
    try {
      res.status(200).json(await this.authService.login(email, password));
    } catch (error) {
      handleBusinessError(res, error, req.locale);
    }
  };

  /** Devuelve el payload del token (o 401). Útil para que el frontend revalide la sesión. */
  me = async (req: Request, res: Response): Promise<void> => {
    const token = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
    const payload = verifyToken(token, this.secret);
    if (!payload) {
      res.status(401).json({ code: "AUTH_SESSION_INVALID", error: t("AUTH_SESSION_INVALID", req.locale) });
      return;
    }
    res.status(200).json(payload);
  };
}
