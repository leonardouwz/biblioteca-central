/**
 * Integración con Open Library (openlibrary.org) — servicio externo público,
 * sin API key. Dos formas de buscar un libro al darlo de alta:
 *  - por ISBN exacto (un solo resultado, autocompleta directo)
 *  - por título/autor/texto libre (varios resultados, paginados, el
 *    bibliotecario elige cuál usar)
 *
 * Mismo patrón que format.js/validators.js: las funciones de parseo son
 * puras (mismo JSON de entrada -> mismo resultado, testeables sin red);
 * `fetchBookByIsbn`/`fetchBooksByQuery` son las únicas con efecto (hacen la
 * llamada real). UMD mínimo: <script src="openLibrary.js"> en el
 * navegador, require() en node:test.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.OpenLibrary = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const ISBN_RE = /^(?:\d{9}[\dXx]|\d{13})$/; // ISBN-10 (9 dígitos + dígito/X) o ISBN-13 (13 dígitos)
  const RESULTS_PER_PAGE = 5;

  /** Quita guiones/espacios; no valida el formato (para eso está isValidIsbn). */
  function normalizeIsbn(raw) {
    return String(raw).replace(/[\s-]/g, "");
  }

  function isValidIsbn(raw) {
    return ISBN_RE.test(normalizeIsbn(raw));
  }

  function isbnSearchUrl(isbn) {
    return `https://openlibrary.org/search.json?isbn=${encodeURIComponent(normalizeIsbn(isbn))}&fields=title,author_name,cover_i`;
  }

  /** Búsqueda general por texto libre (título, autor, o cualquier combinación), paginada. */
  function querySearchUrl(query, page = 1, limit = RESULTS_PER_PAGE) {
    const params = new URLSearchParams({
      q: query,
      fields: "title,author_name,cover_i,first_publish_year",
      limit: String(limit),
      page: String(Math.max(1, page)),
    });
    return `https://openlibrary.org/search.json?${params.toString()}`;
  }

  /** URL de la portada a partir del id que trae la búsqueda. Tamaños: S/M/L. */
  function coverUrl(coverId, size = "M") {
    return coverId ? `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg` : null;
  }

  /** Traduce un `doc` crudo de Open Library al shape que usa el formulario. */
  function parseBookDoc(doc) {
    return {
      title: doc.title || "",
      author: Array.isArray(doc.author_name) ? doc.author_name.join(", ") : "",
      year: doc.first_publish_year || null,
      coverUrl: coverUrl(doc.cover_i),
    };
  }

  /**
   * Respuesta completa de una búsqueda paginada: los resultados de esta
   * página + lo necesario para calcular cuántas páginas hay en total.
   * Devuelve una página vacía (no null) si no hay resultados — así el
   * caller no tiene que distinguir "sin resultados" de "error".
   */
  function parseSearchResults(json, page = 1, limit = RESULTS_PER_PAGE) {
    const docs = json && Array.isArray(json.docs) ? json.docs : [];
    const numFound = (json && json.numFound) || 0;
    return {
      results: docs.map(parseBookDoc),
      page,
      totalPages: Math.max(1, Math.ceil(numFound / limit)),
      numFound,
    };
  }

  /**
   * Búsqueda por ISBN exacto: al ser un identificador único, alcanza con el
   * primer resultado. `null` si no hay ninguno.
   */
  function parseSearchResponse(json) {
    const doc = json && Array.isArray(json.docs) ? json.docs[0] : null;
    return doc ? parseBookDoc(doc) : null;
  }

  /** Único punto con efecto para ISBN exacto: hace el fetch real. */
  async function fetchBookByIsbn(isbn) {
    const res = await fetch(isbnSearchUrl(isbn));
    if (!res.ok) throw new Error(`Open Library respondió ${res.status}`);
    return parseSearchResponse(await res.json());
  }

  /** Único punto con efecto para búsqueda general: hace el fetch real, página por página. */
  async function fetchBooksByQuery(query, page = 1, limit = RESULTS_PER_PAGE) {
    const res = await fetch(querySearchUrl(query, page, limit));
    if (!res.ok) throw new Error(`Open Library respondió ${res.status}`);
    return parseSearchResults(await res.json(), page, limit);
  }

  return {
    ISBN_RE,
    RESULTS_PER_PAGE,
    normalizeIsbn,
    isValidIsbn,
    isbnSearchUrl,
    querySearchUrl,
    coverUrl,
    parseBookDoc,
    parseSearchResults,
    parseSearchResponse,
    fetchBookByIsbn,
    fetchBooksByQuery,
  };
});
