import { Response } from "express";
import { BusinessError } from "../../domain/errors/BusinessError";
import { t, Locale } from "../../domain/i18n/t";

/**
 * Traduce y responde un `BusinessError` (o un 500 genérico) en el locale del
 * request. Único lugar que decide el status HTTP: por código, no por texto.
 */
export function handleBusinessError(res: Response, error: unknown, locale: Locale): void {
  if (error instanceof BusinessError) {
    const status = error.code.endsWith("_NOT_FOUND") ? 404 : 422;
    res.status(status).json({ code: error.code, error: t(error.code, locale, error.params) });
    return;
  }
  console.error(error);
  res.status(500).json({ code: "INTERNAL_ERROR", error: t("INTERNAL_ERROR", locale) });
}

/** Para los 400 de validación de forma del body (no son BusinessError: se detectan antes de llamar al servicio). */
export function badRequest(res: Response, locale: Locale, code: string): void {
  res.status(400).json({ code, error: t(code, locale) });
}
