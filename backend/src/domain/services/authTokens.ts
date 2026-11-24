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

const TOKEN_TTL_S = 8 * 60 * 60; // 8 horas

/** Claims del JWT (RFC 7519). `iat`/`exp` en segundos epoch, como manda el estándar. */
export interface TokenPayload {
  sub: string; // id de la cuenta
  role: Role;
  email?: string; // para que el panel del socio encuentre su ficha sin ir a la BD
  iat: number;
  exp: number;
}

/** Cabecera fija: solo aceptamos HS256 (evita el ataque `alg: none`). */
const JWT_HEADER = { alg: "HS256", typ: "JWT" };

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

/**
 * Firma un JWT estándar `header.payload.firma` (HS256). Pura: depende solo de
 * sub/role/secret/now. Se puede inspeccionar en https://jwt.io.
 */
export function signToken(sub: string, role: Role, secret: string, now = Date.now(), email?: string): string {
  const iat = Math.floor(now / 1000);
  const head = b64url(JSON.stringify(JWT_HEADER));
  const body = b64url(JSON.stringify({ sub, role, email, iat, exp: iat + TOKEN_TTL_S }));
  return `${head}.${body}.${hmac(`${head}.${body}`, secret)}`;
}

/**
 * Verifica cabecera, firma y expiración de un JWT. Devuelve los claims o `null`.
 * Función STATELESS de referencia: sin BD, sin sesiones en memoria.
 */
export function verifyToken(token: string, secret: string, now = Date.now()): TokenPayload | null {
  const [head, body, sig, extra] = token.split(".");
  if (!head || !body || !sig || extra !== undefined) return null;

  const a = Buffer.from(sig);
  const b = Buffer.from(hmac(`${head}.${body}`, secret));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const header = JSON.parse(fromB64url(head).toString("utf8"));
    if (header.alg !== "HS256") return null;
    const data = JSON.parse(fromB64url(body).toString("utf8")) as TokenPayload;
    if (typeof data.exp !== "number" || data.exp <= Math.floor(now / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}
