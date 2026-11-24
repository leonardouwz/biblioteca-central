/**
 * Verificación del ID token de "Iniciar sesión con Google" (Google Identity Services).
 *
 * El frontend recibe de Google un ID token (un JWT firmado con RS256 por Google)
 * y lo manda al backend. NUNCA se confía en el email que diga el frontend: el
 * backend le pregunta a Google si el token es auténtico y luego valida que
 * fue emitido para NUESTRO client ID (`aud`), por Google (`iss`), que no
 * expiró y que el email está verificado.
 *
 * ponytail: usa el endpoint `tokeninfo` de Google (valida firma y expiración
 * por nosotros) en vez de bajar las claves públicas y verificar RS256 a mano.
 * Cuesta una llamada HTTP por login, irrelevante a este volumen; si algún día
 * hay muchos logins por segundo, cambiar a `google-auth-library` (claves cacheadas).
 */

export interface GoogleIdentity {
  email: string;
  sub: string; // id estable de la cuenta Google
  name?: string;
}

const TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo?id_token=";
const VALID_ISSUERS = ["accounts.google.com", "https://accounts.google.com"];

export type GoogleVerifier = (idToken: string) => Promise<GoogleIdentity | null>;

/** Devuelve la identidad si el token es válido para `clientId`, o `null`. */
export function createGoogleVerifier(
  clientId: string,
  fetchFn: typeof fetch = fetch,
  now: () => number = Date.now
): GoogleVerifier {
  return async (idToken) => {
    if (!idToken || idToken.split(".").length !== 3) return null;
    let res: Response;
    try {
      res = await fetchFn(TOKENINFO_URL + encodeURIComponent(idToken));
    } catch {
      return null;
    }
    if (!res.ok) return null; // Google responde 400 si la firma o el formato no valen
    const claims = (await res.json().catch(() => null)) as Record<string, string> | null;
    if (!claims) return null;
    if (claims.aud !== clientId) return null; // token emitido para otra app
    if (!VALID_ISSUERS.includes(claims.iss)) return null;
    if (Number(claims.exp) * 1000 <= now()) return null;
    if (claims.email_verified !== "true" || !claims.email) return null;
    return { email: claims.email.toLowerCase(), sub: claims.sub, name: claims.name };
  };
}
