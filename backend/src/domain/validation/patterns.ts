/**
 * Patrones de validación por regex, del lado del servidor (fuente de verdad
 * de seguridad — nunca confiar solo en la validación del frontend).
 * `frontend/validators.js` reimplementa las mismas reglas para dar
 * retroalimentación inmediata en el navegador; son dos runtimes sin build
 * compartido, por eso están duplicadas a propósito en vez de importadas.
 *
 * FUNCIONES STATELESS: dado el mismo string, siempre el mismo resultado.
 */

// Suficiente para atrapar errores de tipeo comunes (sin @, sin dominio, con
// espacios) sin la complejidad de un regex RFC 5322 completo.
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Letras (incluye acentos/ñ y alfabetos no latinos vía \p{L}), espacios,
// apóstrofes, puntos, comas y guiones; 2 a 60 caracteres.
export const NAME_PATTERN = /^[\p{L}\s'.,-]{2,60}$/u;

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

export function isValidName(value: string): boolean {
  return NAME_PATTERN.test(value.trim());
}
