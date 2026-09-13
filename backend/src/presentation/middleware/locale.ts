import { RequestHandler } from "express";
import { Locale, SUPPORTED_LOCALES, DEFAULT_LOCALE } from "../../domain/i18n/t";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      locale: Locale;
    }
  }
}

const isSupported = (value: string): value is Locale => (SUPPORTED_LOCALES as string[]).includes(value);

/**
 * Resuelve `req.locale` a partir de `?lang=` (prioridad) o `Accept-Language`.
 * Corre antes de las rutas para que todo controlador tenga `req.locale` listo.
 */
export const resolveLocale: RequestHandler = (req, _res, next) => {
  const fromQuery = typeof req.query.lang === "string" ? req.query.lang.toLowerCase() : undefined;
  if (fromQuery && isSupported(fromQuery)) {
    req.locale = fromQuery;
    next();
    return;
  }

  const header = req.headers["accept-language"];
  const candidates = typeof header === "string" ? header.split(",").map((c) => c.trim().slice(0, 2).toLowerCase()) : [];
  req.locale = candidates.find(isSupported) ?? DEFAULT_LOCALE;
  next();
};
