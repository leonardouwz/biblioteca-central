const { test } = require("node:test");
const assert = require("node:assert/strict");
const { normalizeIsbn, isValidIsbn, searchUrl, coverUrl, parseSearchResponse } = require("./openLibrary.js");

test("normalizeIsbn: quita guiones y espacios", () => {
  assert.equal(normalizeIsbn("978-0-451-52493-5"), "9780451524935");
  assert.equal(normalizeIsbn(" 0451524934 "), "0451524934");
});

test("isValidIsbn: acepta ISBN-10 (con X final) e ISBN-13, rechaza el resto", () => {
  assert.equal(isValidIsbn("9780451524935"), true); // ISBN-13
  assert.equal(isValidIsbn("0451524934"), true); // ISBN-10
  assert.equal(isValidIsbn("043942089X"), true); // ISBN-10 con X de checksum
  assert.equal(isValidIsbn("978-0-451-52493-5"), true); // con guiones
  assert.equal(isValidIsbn("no es un isbn"), false);
  assert.equal(isValidIsbn("12345"), false);
  assert.equal(isValidIsbn(""), false);
});

test("searchUrl: arma la URL de búsqueda de Open Library con el ISBN normalizado", () => {
  assert.equal(
    searchUrl("978-0-451-52493-5"),
    "https://openlibrary.org/search.json?isbn=9780451524935&fields=title,author_name,cover_i"
  );
});

test("coverUrl: null sin coverId, URL con el tamaño pedido si lo hay", () => {
  assert.equal(coverUrl(undefined), null);
  assert.equal(coverUrl(15257377), "https://covers.openlibrary.org/b/id/15257377-M.jpg");
  assert.equal(coverUrl(15257377, "L"), "https://covers.openlibrary.org/b/id/15257377-L.jpg");
});

test("parseSearchResponse: extrae título/autor/portada del primer resultado", () => {
  const response = {
    docs: [{ title: "Nineteen Eighty-Four", author_name: ["George Orwell"], cover_i: 15257377 }],
  };
  assert.deepEqual(parseSearchResponse(response), {
    title: "Nineteen Eighty-Four",
    author: "George Orwell",
    coverUrl: "https://covers.openlibrary.org/b/id/15257377-M.jpg",
  });
});

test("parseSearchResponse: varios autores se unen con coma", () => {
  const response = { docs: [{ title: "Good Omens", author_name: ["Terry Pratchett", "Neil Gaiman"] }] };
  assert.equal(parseSearchResponse(response).author, "Terry Pratchett, Neil Gaiman");
});

test("parseSearchResponse: sin resultados (docs vacío o ausente) devuelve null, no rompe", () => {
  assert.equal(parseSearchResponse({ docs: [] }), null);
  assert.equal(parseSearchResponse({}), null);
  assert.equal(parseSearchResponse(null), null);
});
