import { Request, Response } from "express";
import { AuthService } from "../../domain/services/AuthService";
import { BusinessError } from "../../domain/errors/BusinessError";
import { verifyToken } from "../../domain/services/authTokens";
import { RegisterDto, LoginDto } from "../dtos/AuthDtos";

export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly secret: string
  ) {}

  register = async (req: Request, res: Response): Promise<void> => {
    const { email, password, role } = req.body as RegisterDto;
    if (typeof email !== "string" || typeof password !== "string") {
      res.status(400).json({ error: "email (string) y password (string) son requeridos." });
      return;
    }
    try {
      res.status(201).json(await this.authService.register(email, password, role));
    } catch (error) {
      this.handleError(res, error);
    }
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body as LoginDto;
    if (typeof email !== "string" || typeof password !== "string") {
      res.status(400).json({ error: "email (string) y password (string) son requeridos." });
      return;
    }
    try {
      res.status(200).json(await this.authService.login(email, password));
    } catch (error) {
      this.handleError(res, error);
    }
  };

  /** Devuelve el payload del token (o 401). Útil para que el frontend revalide la sesión. */
  me = async (req: Request, res: Response): Promise<void> => {
    const token = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
    const payload = verifyToken(token, this.secret);
    if (!payload) {
      res.status(401).json({ error: "Sesión inválida o expirada." });
      return;
    }
    res.status(200).json(payload);
  };

  private handleError(res: Response, error: unknown): void {
    if (error instanceof BusinessError) {
      res.status(422).json({ error: error.message });
      return;
    }
    console.error(error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
}
