import { RequestHandler } from "express";
import { verifyToken, TokenPayload } from "../../domain/services/authTokens";
import { Role } from "../../domain/entities/Account";
import { t } from "../../domain/i18n/t";

export interface AuthedRequest {
  auth?: TokenPayload;
}

/**
 * Middleware de autenticación. Sin `roles` exige solo sesión válida;
 * con `roles` exige además que el rol del token esté en la lista.
 * Usa `verifyToken` (stateless): no consulta la base de datos.
 */
export function requireAuth(secret: string, ...roles: Role[]): RequestHandler {
  return (req, res, next) => {
    const token = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
    const payload = verifyToken(token, secret);
    if (!payload) {
      res.status(401).json({ code: "AUTH_REQUIRED", error: t("AUTH_REQUIRED", req.locale) });
      return;
    }
    if (roles.length > 0 && !roles.includes(payload.role)) {
      res.status(403).json({ code: "AUTH_FORBIDDEN", error: t("AUTH_FORBIDDEN", req.locale) });
      return;
    }
    (req as typeof req & AuthedRequest).auth = payload;
    next();
  };
}

/** Roles del personal de la biblioteca (gestión). */
export const STAFF: Role[] = ["BIBLIOTECARIO", "ADMINISTRADOR"];
