const { test } = require("node:test");
const assert = require("node:assert/strict");
const { translate, formatCurrency, formatDate, interpolate } = require("./format.js");

test("interpolate: sustituye placeholders conocidos y deja el resto intacto", () => {
  assert.equal(interpolate("Hola {name}", { name: "Ana" }), "Hola Ana");
  assert.equal(interpolate("Hola {name}", {}), "Hola {name}");
});

test("translate: string plano", () => {
  const catalog = { "nav.books": "Libros" };
  assert.equal(translate(catalog, "nav.books", "es"), "Libros");
});

test("translate: entrada {text, mt} (borrador de traducción automática)", () => {
  const catalog = { "nav.books": { text: "كتب", mt: true } };
  assert.equal(translate(catalog, "nav.books", "ar"), "كتب");
});

test("translate: plural según count (es/en)", () => {
  const catalog = {
    "books.stockAdded": { one: "Se agregó {qty} copia.", other: "Se agregaron {qty} copias." },
  };
  assert.equal(translate(catalog, "books.stockAdded", "es", { qty: 1, count: 1 }), "Se agregó 1 copia.");
  assert.equal(translate(catalog, "books.stockAdded", "es", { qty: 3, count: 3 }), "Se agregaron 3 copias.");
});

test("translate: clave desconocida devuelve la clave, no rompe", () => {
  assert.equal(translate({}, "no.existe", "es"), "no.existe");
});

test("formatCurrency: PEN en es vs en (símbolo y separadores)", () => {
  assert.match(formatCurrency(1500, "es-PE"), /S\/\s*1,500\.00/);
  assert.match(formatCurrency(1500, "en"), /PEN|S\/|1,500\.00/);
});

test("formatDate: usa el locale pedido y una zona horaria fija (reproducible)", () => {
  const iso = "2026-01-15T10:00:00.000Z";
  assert.equal(formatDate(iso, "en", "UTC"), "Jan 15, 2026");
  assert.equal(formatDate(iso, "es", "UTC"), "15 ene 2026");
});
