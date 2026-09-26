/**
 * Integración con Open Library (openlibrary.org) — servicio externo público,
 * sin API key. Busca un libro por ISBN para autocompletar título/autor y
 * mostrar la portada al darlo de alta, sin tener que tipearlo a mano.
 *
 * Mismo patrón que format.js/validators.js: las funciones de parseo son
 * puras (mismo JSON de entrada -> mismo resultado, testeables sin red);
 * `fetchBookByIsbn` es la única función con efecto (hace la llamada real).
 * UMD mínimo: <script src="openLibrary.js"> en el navegador, require() en
 * node:test.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.OpenLibrary = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const ISBN_RE = /^(?:\d{9}[\dXx]|\d{13})$/; // ISBN-10 (9 dígitos + dígito/X) o ISBN-13 (13 dígitos)

  /** Quita guiones/espacios; no valida el formato (para eso está isValidIsbn). */
  function normalizeIsbn(raw) {
    return String(raw).replace(/[\s-]/g, "");
  }

  function isValidIsbn(raw) {
    return ISBN_RE.test(normalizeIsbn(raw));
  }

  function searchUrl(isbn) {
    return `https://openlibrary.org/search.json?isbn=${encodeURIComponent(normalizeIsbn(isbn))}&fields=title,author_name,cover_i`;
  }

  /** URL de la portada a partir del id que trae la búsqueda. Tamaños: S/M/L. */
  function coverUrl(coverId, size = "M") {
    return coverId ? `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg` : null;
  }

  /**
   * Traduce la respuesta cruda de openlibrary.org/search.json al shape que
   * usa el formulario. Devuelve `null` si no hay ningún resultado — así el
   * caller no tiene que saber nada del formato de Open Library.
   */
  function parseSearchResponse(json) {
    const doc = json && Array.isArray(json.docs) ? json.docs[0] : null;
    if (!doc) return null;
    return {
      title: doc.title || "",
      author: Array.isArray(doc.author_name) ? doc.author_name.join(", ") : "",
      coverUrl: coverUrl(doc.cover_i),
    };
  }

  /** Único punto con efecto: hace el fetch real. El resto del módulo es puro. */
  async function fetchBookByIsbn(isbn) {
    const res = await fetch(searchUrl(isbn));
    if (!res.ok) throw new Error(`Open Library respondió ${res.status}`);
    return parseSearchResponse(await res.json());
  }

  return { ISBN_RE, normalizeIsbn, isValidIsbn, searchUrl, coverUrl, parseSearchResponse, fetchBookByIsbn };
});
