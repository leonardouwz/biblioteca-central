import { Request, Response, NextFunction, RequestHandler } from "express";
import { t } from "../../domain/i18n/t";

/** Frontend de producción; se reemplaza con CORS_ORIGINS (lista separada por comas). */
export const DEFAULT_CORS_ORIGINS = ["https://biblioteca-central.readuls.workers.dev"];

export function corsOrigins(env: string | undefined = process.env.CORS_ORIGINS): string[] {
  const list = (env ?? "").split(",").map((o) => o.trim().replace(/\/$/, "")).filter(Boolean);
  return list.length ? list : DEFAULT_CORS_ORIGINS;
}

/**
 * Límite de intentos por IP en una ventana fija (contra fuerza bruta).
 * ponytail: memoria por instancia de Cloud Run — con N instancias el tope real
 * es N×max. Si eso importa, mover el contador a la base de datos o a Redis.
 */
export function rateLimit(max: number, windowMs: number, now: () => number = Date.now): RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const time = now();
    if (hits.size > 10_000) for (const [k, v] of hits) if (v.resetAt <= time) hits.delete(k);
    const key = req.ip ?? "unknown";
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= time) hits.set(key, (entry = { count: 0, resetAt: time + windowMs }));
    if (++entry.count > max) {
      res.setHeader("Retry-After", String(Math.ceil((entry.resetAt - time) / 1000)));
      res.status(429).json({ code: "TOO_MANY_REQUESTS", error: t("TOO_MANY_REQUESTS", req.locale) });
      return;
    }
    next();
  };
}
