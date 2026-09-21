import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidEmail, isValidName } from "./patterns";

test("isValidEmail: acepta formatos razonables, rechaza los rotos", () => {
  assert.equal(isValidEmail("ana@example.com"), true);
  assert.equal(isValidEmail("  ana@example.com  "), true); // trim
  assert.equal(isValidEmail("ana.perez+libros@sub.dominio.pe"), true);
  assert.equal(isValidEmail("ana@example"), false); // sin TLD
  assert.equal(isValidEmail("ana example.com"), false); // sin @
  assert.equal(isValidEmail("@example.com"), false); // sin usuario
  assert.equal(isValidEmail(""), false);
});

test("isValidName: acepta letras/acentos/espacios, rechaza dígitos y strings vacíos o muy cortos", () => {
  assert.equal(isValidName("Ana Pérez"), true);
  assert.equal(isValidName("María José O'Higgins-Smith Jr."), true);
  assert.equal(isValidName("李"), false); // 1 char, bajo el mínimo de 2
  assert.equal(isValidName("Ana123"), false);
  assert.equal(isValidName(""), false);
  assert.equal(isValidName("A".repeat(61)), false); // excede el máximo
});
