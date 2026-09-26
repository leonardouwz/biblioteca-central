const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeIsbn,
  isValidIsbn,
  isbnSearchUrl,
  querySearchUrl,
  coverUrl,
  parseBookDoc,
  parseSearchResults,
  parseSearchResponse,
} = require("./openLibrary.js");

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
  assert.equal(isValidIsbn("Mario Vargas Llosa"), false); // texto libre no es un ISBN
  assert.equal(isValidIsbn(""), false);
});

test("isbnSearchUrl: arma la URL de búsqueda exacta por ISBN, normalizado", () => {
  assert.equal(
    isbnSearchUrl("978-0-451-52493-5"),
    "https://openlibrary.org/search.json?isbn=9780451524935&fields=title,author_name,cover_i"
  );
});

test("querySearchUrl: arma la URL de búsqueda general, con página y límite", () => {
  const url = querySearchUrl("Mario Vargas Llosa", 2, 5);
  assert.match(url, /^https:\/\/openlibrary\.org\/search\.json\?/);
  assert.match(url, /q=Mario\+Vargas\+Llosa/);
  assert.match(url, /page=2/);
  assert.match(url, /limit=5/);
});

test("querySearchUrl: page por defecto es 1, nunca baja de 1", () => {
  assert.match(querySearchUrl("test"), /page=1/);
  assert.match(querySearchUrl("test", 0), /page=1/);
  assert.match(querySearchUrl("test", -5), /page=1/);
});

test("coverUrl: null sin coverId, URL con el tamaño pedido si lo hay", () => {
  assert.equal(coverUrl(undefined), null);
  assert.equal(coverUrl(15257377), "https://covers.openlibrary.org/b/id/15257377-M.jpg");
  assert.equal(coverUrl(15257377, "L"), "https://covers.openlibrary.org/b/id/15257377-L.jpg");
});

test("parseBookDoc: título, autor(es), año y portada de un doc crudo", () => {
  assert.deepEqual(parseBookDoc({ title: "La Fiesta del Chivo", author_name: ["Mario Vargas Llosa"], first_publish_year: 2000, cover_i: 1047728 }), {
    title: "La Fiesta del Chivo",
    author: "Mario Vargas Llosa",
    year: 2000,
    coverUrl: "https://covers.openlibrary.org/b/id/1047728-M.jpg",
  });
});

test("parseBookDoc: varios autores se unen con coma; sin año/portada -> null", () => {
  const doc = parseBookDoc({ title: "Good Omens", author_name: ["Terry Pratchett", "Neil Gaiman"] });
  assert.equal(doc.author, "Terry Pratchett, Neil Gaiman");
  assert.equal(doc.year, null);
  assert.equal(doc.coverUrl, null);
});

test("parseSearchResults: pagina resultados y calcula totalPages a partir de numFound/limit", () => {
  const json = {
    numFound: 858,
    docs: [
      { title: "La Fiesta del Chivo", author_name: ["Mario Vargas Llosa"] },
      { title: "La ciudad y los perros", author_name: ["Mario Vargas Llosa"] },
    ],
  };
  const page = parseSearchResults(json, 1, 5);
  assert.equal(page.results.length, 2);
  assert.equal(page.results[0].title, "La Fiesta del Chivo");
  assert.equal(page.page, 1);
  assert.equal(page.numFound, 858);
  assert.equal(page.totalPages, Math.ceil(858 / 5));
});

test("parseSearchResults: sin resultados devuelve página vacía (no null), totalPages mínimo 1", () => {
  const page = parseSearchResults({ docs: [], numFound: 0 }, 1, 5);
  assert.deepEqual(page.results, []);
  assert.equal(page.totalPages, 1);
  assert.equal(parseSearchResults(null).results.length, 0);
});

test("parseSearchResponse (búsqueda por ISBN exacto): primer resultado o null", () => {
  const response = {
    docs: [{ title: "Nineteen Eighty-Four", author_name: ["George Orwell"], cover_i: 15257377 }],
  };
  assert.deepEqual(parseSearchResponse(response), {
    title: "Nineteen Eighty-Four",
    author: "George Orwell",
    year: null,
    coverUrl: "https://covers.openlibrary.org/b/id/15257377-M.jpg",
  });
  assert.equal(parseSearchResponse({ docs: [] }), null);
  assert.equal(parseSearchResponse(null), null);
});
