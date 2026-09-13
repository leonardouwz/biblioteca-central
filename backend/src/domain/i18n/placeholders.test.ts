import { test } from "node:test";
import assert from "node:assert/strict";
import { placeholdersOf, placeholderMismatches } from "./placeholders";
import es from "./locales/es.json";
import en from "./locales/en.json";
import ar from "./locales/ar.json";
import fr from "./locales/fr.json";

test("placeholdersOf: extrae nombres de {placeholder} de string, {text} y {one,other}", () => {
  assert.deepEqual(placeholdersOf("Hola {name}"), new Set(["name"]));
  assert.deepEqual(placeholdersOf({ text: "مرحبا {name}", mt: true }), new Set(["name"]));
  assert.deepEqual(
    placeholdersOf({ one: "{max} préstamo", other: "{max} préstamos" }),
    new Set(["max"])
  );
  assert.deepEqual(placeholdersOf("Sin placeholders"), new Set());
});

// Regresión del bug real: Google Translate tradujo el propio nombre del
// placeholder ({email} -> {البريد الإلكتروني}), dejando la interpolación rota.
test("placeholderMismatches: detecta cuando una traducción no preserva los placeholders del original", () => {
  const base = { "auth.welcome": "Bienvenido, {email}." };
  const roto = { "auth.welcome": { text: "أهلاً، {البريد الإلكتروني}.", mt: true } };
  assert.deepEqual(placeholderMismatches(base, roto), ["auth.welcome"]);

  const bien = { "auth.welcome": { text: "أهلاً، {email}.", mt: true } };
  assert.deepEqual(placeholderMismatches(base, bien), []);
});

test("catálogos backend: en/ar/fr preservan los mismos placeholders que es.json", () => {
  assert.deepEqual(placeholderMismatches(es, en), []);
  assert.deepEqual(placeholderMismatches(es, ar), []);
  assert.deepEqual(placeholderMismatches(es, fr), []);
});
