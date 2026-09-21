const { test } = require("node:test");
const assert = require("node:assert/strict");
const { isValidEmail, isValidPassword, isValidName, isNonNegativeInteger } = require("./validators.js");

test("isValidEmail: acepta formatos razonables, rechaza los rotos", () => {
  assert.equal(isValidEmail("ana@example.com"), true);
  assert.equal(isValidEmail("  ana@example.com  "), true);
  assert.equal(isValidEmail("ana@example"), false);
  assert.equal(isValidEmail("ana example.com"), false);
  assert.equal(isValidEmail(""), false);
});

test("isValidPassword: exige letra + número, min 6", () => {
  assert.equal(isValidPassword("secret1"), true);
  assert.equal(isValidPassword("abcdef"), false); // sin número
  assert.equal(isValidPassword("123456"), false); // sin letra
  assert.equal(isValidPassword("a1"), false); // muy corta
});

test("isValidName: acepta letras/acentos/espacios, rechaza dígitos", () => {
  assert.equal(isValidName("Ana Pérez"), true);
  assert.equal(isValidName("Jean-Luc O'Brien"), true);
  assert.equal(isValidName("Ana123"), false);
  assert.equal(isValidName(""), false);
});

test("isNonNegativeInteger: rechaza decimales, negativos y notación científica", () => {
  assert.equal(isNonNegativeInteger("0"), true);
  assert.equal(isNonNegativeInteger("10"), true);
  assert.equal(isNonNegativeInteger(" 10 "), true);
  assert.equal(isNonNegativeInteger("-1"), false);
  assert.equal(isNonNegativeInteger("1.5"), false);
  assert.equal(isNonNegativeInteger("1e3"), false);
  assert.equal(isNonNegativeInteger(""), false);
});
