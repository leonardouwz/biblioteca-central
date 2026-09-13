import { test } from "node:test";
import assert from "node:assert/strict";
import { t, baseKeys, keysOf, SUPPORTED_LOCALES, LOCALE_META } from "./t";

test("t: interpola placeholders", () => {
  assert.equal(t("USER_NOT_FOUND", "es"), "El usuario no existe.");
  assert.equal(t("USER_NOT_FOUND", "en"), "The user does not exist.");
});

test("t: pluraliza LOAN_MAX_ACTIVE según count", () => {
  assert.equal(t("LOAN_MAX_ACTIVE", "es", { max: 1, count: 1 }), "El usuario ya tiene 1 préstamo activo.");
  assert.equal(t("LOAN_MAX_ACTIVE", "es", { max: 3, count: 3 }), "El usuario ya tiene 3 préstamos activos.");
  assert.equal(t("LOAN_MAX_ACTIVE", "en", { max: 3, count: 3 }), "The user already has 3 active loans.");
});

test("t: desenvuelve entradas marcadas como traducción automática (mt)", () => {
  const ar = t("USER_NOT_FOUND", "ar");
  assert.equal(ar, "المستخدم غير موجود.");
});

test("t: clave desconocida devuelve el propio código en vez de romper", () => {
  assert.equal(t("NO_EXISTE_ESTA_CLAVE", "es"), "NO_EXISTE_ESTA_CLAVE");
});

test("baseKeys/keysOf: los 3 locales cubren exactamente las claves del locale base", () => {
  const base = new Set(baseKeys());
  for (const locale of SUPPORTED_LOCALES) {
    const keys = new Set(keysOf(locale));
    const missing = [...base].filter((k) => !keys.has(k));
    assert.deepEqual(missing, [], `${locale} le faltan claves: ${missing.join(", ")}`);
  }
});

test("LOCALE_META: es/en son ltr, ar es rtl", () => {
  assert.equal(LOCALE_META.es.dir, "ltr");
  assert.equal(LOCALE_META.en.dir, "ltr");
  assert.equal(LOCALE_META.ar.dir, "rtl");
});
