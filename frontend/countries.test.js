const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseCountryList, parseLanguageRows } = require("./countries.js");

test("parseCountryList: ordena por nombre y descarta entradas incompletas", () => {
  const list = parseCountryList([
    { alpha3Code: "PER", name: "Peru" },
    { alpha3Code: "ARG", name: "Argentina" },
    { name: "Sin código" },
  ]);
  assert.deepEqual(list, [
    { code: "ARG", name: "Argentina" },
    { code: "PER", name: "Peru" },
  ]);
  assert.deepEqual(parseCountryList(null), []);
});

test("parseLanguageRows: un idioma por fila con su nombre nativo", () => {
  const rows = parseLanguageRows({
    name: "Paraguay",
    nativeName: "Paraguay",
    languages: [
      { name: "Spanish", iso639_2: "spa", nativeName: "Español" },
      { name: "Guaraní", iso639_2: "grn" },
    ],
  });
  assert.deepEqual(rows, [
    { language: "Spanish", languageNative: "Español" },
    { language: "Guaraní", languageNative: "—" },
  ]);
  assert.deepEqual(parseLanguageRows({}), []);
});
