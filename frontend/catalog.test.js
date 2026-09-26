const { test } = require("node:test");
const assert = require("node:assert/strict");
const { filterBooks } = require("./catalog.js");

const books = [
  { title: "Cien años de Soledad", author: "Gabriel García Márquez" },
  { title: "La Fiesta del Chivo", author: "Mario Vargas Llosa" },
  { title: "Atomic Habits", author: "James Clear" },
];

test("filterBooks: query vacío devuelve todos los libros sin tocarlos", () => {
  assert.deepEqual(filterBooks(books, ""), books);
  assert.deepEqual(filterBooks(books, "   "), books);
  assert.deepEqual(filterBooks(books, undefined), books);
});

test("filterBooks: coincide por título", () => {
  const result = filterBooks(books, "cien años");
  assert.equal(result.length, 1);
  assert.equal(result[0].title, "Cien años de Soledad");
});

test("filterBooks: coincide por autor, insensible a mayúsculas", () => {
  const result = filterBooks(books, "VARGAS llosa");
  assert.equal(result.length, 1);
  assert.equal(result[0].author, "Mario Vargas Llosa");
});

test("filterBooks: sin coincidencias devuelve un array vacío", () => {
  assert.deepEqual(filterBooks(books, "no existe este libro"), []);
});

test("filterBooks: no rompe si el libro no tiene autor/título (undefined)", () => {
  const result = filterBooks([{ title: "Solo título" }, { author: "Solo autor" }], "solo");
  assert.equal(result.length, 2);
});
