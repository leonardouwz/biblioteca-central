/**
 * Funciones STATELESS del catálogo público: filtra libros por texto libre
 * (título o autor), sin red ni DOM — mismo patrón UMD que
 * format.js/validators.js/openLibrary.js.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.Catalog = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  /**
   * Filtra `books` por coincidencia de `query` en título o autor
   * (insensible a mayúsculas/acentos simples). `query` vacío devuelve
   * todos los libros sin tocarlos.
   */
  function filterBooks(books, query) {
    const needle = String(query || "").trim().toLowerCase();
    if (!needle) return books;
    return books.filter((book) => {
      const haystack = `${book.title || ""} ${book.author || ""}`.toLowerCase();
      return haystack.includes(needle);
    });
  }

  return { filterBooks };
});
