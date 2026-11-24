const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseCountryList, parseLanguageRows } = require("./countries.js");

test("parseCountryList: ordena por nombre y descarta entradas incompletas", () => {
  const list = parseCountryList([
    { cca3: "PER", name: { common: "Peru" } },
    { cca3: "ARG", name: { common: "Argentina" } },
    { name: { common: "Sin código" } },
  ]);
  assert.deepEqual(list, [
    { code: "ARG", name: "Argentina" },
    { code: "PER", name: "Peru" },
  ]);
  assert.deepEqual(parseCountryList(null), []);
});

test("parseLanguageRows: un idioma por fila con su nombre nativo", () => {
  const rows = parseLanguageRows({
    name: {
      common: "Peru",
      nativeName: {
        spa: { common: "Perú", official: "República del Perú" },
        que: { common: "Piruw", official: "Piruw Ripuwlika" },
      },
    },
    languages: { aym: "Aymara", que: "Quechua", spa: "Spanish" },
  });
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[2], { code: "spa", language: "Spanish", nativeCommon: "Perú", nativeOfficial: "República del Perú" });
  assert.equal(rows[0].nativeCommon, "—"); // aymara sin nombre nativo en la API
});
