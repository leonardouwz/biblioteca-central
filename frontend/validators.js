/**
 * Validación de formularios por expresión regular, del lado del navegador.
 * Es una capa de UX (feedback inmediato, sin esperar al servidor) — el
 * backend (`backend/src/domain/validation/patterns.ts`) reimplementa las
 * mismas reglas y es la autoridad real: nunca confiar solo en esta capa.
 * UMD mínimo, igual que format.js: funciona con <script> en el navegador
 * y con require() en node:test.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.Validators = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  // Suficiente para atrapar errores de tipeo comunes (sin @, sin dominio,
  // con espacios) sin la complejidad de un regex RFC 5322 completo.
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Al menos 6 caracteres, con al menos una letra y un número. Más estricta
  // que el mínimo del backend (solo longitud) a propósito: UX temprana en
  // el registro, sin bloquear el login de cuentas ya creadas.
  const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;

  // Letras (incluye acentos/ñ y alfabetos no latinos vía \p{L}), espacios,
  // apóstrofes, puntos, comas y guiones; 2 a 60 caracteres.
  const NAME_RE = /^[\p{L}\s'.,-]{2,60}$/u;

  // Entero no negativo sin signo, sin decimales ni notación científica
  // (un <input type="number"> por sí solo deja pasar "1e3" o "1.5").
  const NON_NEGATIVE_INTEGER_RE = /^\d+$/;

  const isValidEmail = (value) => EMAIL_RE.test(String(value).trim());
  const isValidPassword = (value) => PASSWORD_RE.test(String(value));
  const isValidName = (value) => NAME_RE.test(String(value).trim());
  const isNonNegativeInteger = (value) => NON_NEGATIVE_INTEGER_RE.test(String(value).trim());

  return {
    EMAIL_RE,
    PASSWORD_RE,
    NAME_RE,
    NON_NEGATIVE_INTEGER_RE,
    isValidEmail,
    isValidPassword,
    isValidName,
    isNonNegativeInteger,
  };
});
