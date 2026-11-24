const { test } = require("node:test");
const assert = require("node:assert/strict");
const { resolve, sectionsFor } = require("./router.js");

test("resolve: inicio público por defecto, con o sin sesión", () => {
  assert.deepEqual(resolve("", null), { view: "home", section: null });
  assert.deepEqual(resolve("#/", "USUARIO"), { view: "home", section: null });
});

test("resolve: el panel exige sesión y login redirige si ya hay una", () => {
  assert.equal(resolve("#/panel/libros", null).view, "login");
  assert.deepEqual(resolve("#/login", "USUARIO"), { view: "panel", section: "resumen" });
});

test("resolve: una sección no permitida para el rol cae en resumen", () => {
  assert.equal(resolve("#/panel/libros", "USUARIO").section, "resumen");
  assert.equal(resolve("#/panel/config", "BIBLIOTECARIO").section, "resumen");
  assert.equal(resolve("#/panel/config", "ADMINISTRADOR").section, "config");
});

test("sectionsFor: cada rol ve un panel distinto", () => {
  assert.deepEqual(sectionsFor("USUARIO"), ["resumen", "paises"]);
  assert.deepEqual(sectionsFor("BIBLIOTECARIO"), ["resumen", "prestamos", "libros", "socios", "deudas", "paises"]);
  assert.ok(sectionsFor("ADMINISTRADOR").includes("config"));
});
