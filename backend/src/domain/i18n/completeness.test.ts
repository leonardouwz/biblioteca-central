import { test } from "node:test";
import assert from "node:assert/strict";
import path from "path";
import { baseKeys } from "./t";
import { findUsedErrorCodes } from "./scanErrorCodes";

// Guarda contra el bug original del proyecto: un servicio lanzaba
// `new BusinessError("texto en español")` sin traducción posible. Ahora cada
// código realmente usado en los Service.ts debe existir en el catálogo base.
test("todo BusinessError lanzado en los servicios tiene traducción en es.json", () => {
  const servicesDir = path.join(__dirname, "..", "services");
  const used = findUsedErrorCodes(servicesDir);
  const known = new Set(baseKeys());
  const untranslated = used.filter((code) => !known.has(code));
  assert.deepEqual(untranslated, [], `códigos sin traducción: ${untranslated.join(", ")}`);
});
