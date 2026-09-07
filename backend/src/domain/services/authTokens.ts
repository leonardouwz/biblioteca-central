import { createHmac, scryptSync, randomBytes, timingSafeEqual } from "crypto";
import { Role } from "../entities/Account";

/**
 * FUNCIONES STATELESS (puras).
 *
 * Ninguna de estas funciones lee ni escribe base de datos, disco, red ni
 * variables globales. El resultado depende SOLO de los argumentos recibidos
 * (el "reloj" se inyecta como parámetro `now` para que sigan siendo
 * deterministas y testeables). Mismo input -> mismo output.
 */

const TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8 horas

export interface TokenPayload {
  sub: string; // id de la cuenta
  role: Role;
  exp: number; // epoch ms
}

const b64url = (buf: Buffer | string): string =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const fromB64url = (s: string): Buffer => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

const hmac = (data: string, secret: string): string => b64url(createHmac("sha256", secret).update(data).digest());

/** Deriva el hash de una contraseña con una sal dada. Pura y determinista. */
export function hashPassword(password: string, salt: string): string {
  return `${salt}:${scryptSync(password, salt, 32).toString("hex")}`;
}

/** Genera una sal aleatoria (único punto no determinista; se usa una sola vez al registrar). */
export function newSalt(): string {
  return randomBytes(16).toString("hex");
}

/** Compara en tiempo constante una contraseña contra un hash `sal:hash`. Pura. */
export function verifyPassword(password: string, stored: string): boolean {
  const [salt] = stored.split(":");
  if (!salt) return false;
  const expected = Buffer.from(stored);
  const actual = Buffer.from(hashPassword(password, salt));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Firma un token `payload.firma` (HMAC-SHA256). Pura: depende solo de sub/role/secret/now. */
export function signToken(sub: string, role: Role, secret: string, now = Date.now()): string {
  const payload = b64url(JSON.stringify({ sub, role, exp: now + TOKEN_TTL_MS }));
  return `${payload}.${hmac(payload, secret)}`;
}

/**
 * Verifica firma y expiración de un token. Devuelve el payload o `null`.
 * Función STATELESS de referencia: sin BD, sin sesiones en memoria.
 */
export function verifyToken(token: string, secret: string, now = Date.now()): TokenPayload | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;

  const expectedSig = hmac(payload, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const data = JSON.parse(fromB64url(payload).toString("utf8")) as TokenPayload;
    if (typeof data.exp !== "number" || data.exp < now) return null;
    return data;
  } catch {
    return null;
  }
}
