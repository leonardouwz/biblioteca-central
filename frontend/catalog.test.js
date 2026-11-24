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

test("filterBooks: ignora tildes en la búsqueda y en el libro", () => {
  assert.equal(filterBooks(books, "garcia marquez").length, 1);
  assert.equal(filterBooks(books, "ÁTOMIC").length, 1);
});

test("catalogWorker.js: guarda el catálogo y responde el filtro con su id", () => {
  const fs = require("node:fs");
  const vm = require("node:vm");
  const sent = [];
  const self = { postMessage: (m) => sent.push(m) };
  const ctx = vm.createContext({ self });
  ctx.importScripts = () => { ctx.Catalog = require("./catalog.js"); }; // en el navegador, catalog.js define `Catalog` global
  vm.runInContext(fs.readFileSync(__dirname + "/catalogWorker.js", "utf8"), ctx);
  self.onmessage({ data: { type: "set", books } });
  self.onmessage({ data: { type: "filter", id: 7, query: "clear" } });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].id, 7);
  assert.deepEqual(sent[0].books.map((b) => b.author), ["James Clear"]);
});
