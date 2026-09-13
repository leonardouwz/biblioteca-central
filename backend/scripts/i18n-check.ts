/**
 * Red de seguridad de completitud de i18n. Sin red, sin API keys.
 * - Backend: cada locale (en/ar) tiene las mismas claves que es.json (base),
 *   y cada `new BusinessError("CODE")` realmente usado tiene traducción.
 * - Frontend: mismo chequeo de completitud sobre frontend/locales/*.json (si existen).
 *
 * Uso: npm run i18n:check   (desde backend/)
 */
import { readFileSync, existsSync, readdirSync } from "fs";
import path from "path";
import { baseKeys, keysOf, SUPPORTED_LOCALES } from "../src/domain/i18n/t";
import { findUsedErrorCodes } from "../src/domain/i18n/scanErrorCodes";
import { placeholderMismatches } from "../src/domain/i18n/placeholders";
import esBackend from "../src/domain/i18n/locales/es.json";
import enBackend from "../src/domain/i18n/locales/en.json";
import arBackend from "../src/domain/i18n/locales/ar.json";

let problems = 0;

function report(scope: string, missing: string[]): void {
  if (missing.length === 0) {
    console.log(`✔ ${scope}: completo`);
    return;
  }
  problems += missing.length;
  console.error(`✘ ${scope}: faltan ${missing.length} clave(s) -> ${missing.join(", ")}`);
}

// --- Backend: es.json vs en/ar ---
const base = new Set(baseKeys());
for (const locale of SUPPORTED_LOCALES) {
  const missing = [...base].filter((k) => !new Set(keysOf(locale)).has(k));
  report(`backend/${locale}.json`, missing);
}

// --- Backend: cada traducción usa los MISMOS placeholders {x} que el texto base ---
for (const [locale, dict] of [
  ["en", enBackend],
  ["ar", arBackend],
] as const) {
  const mismatches = placeholderMismatches(esBackend, dict);
  report(`backend/${locale}.json placeholders`, mismatches);
}

// --- Backend: códigos usados vs catálogo base ---
const servicesDir = path.join(__dirname, "..", "src", "domain", "services");
const used = findUsedErrorCodes(servicesDir);
report("backend BusinessError codes -> es.json", used.filter((c) => !base.has(c)));

// --- Frontend: frontend/locales/{es,en,ar}.json (si ya existen) ---
const frontendLocalesDir = path.join(__dirname, "..", "..", "frontend", "locales");
if (existsSync(frontendLocalesDir)) {
  const esPath = path.join(frontendLocalesDir, "es.json");
  const frontendBase: Record<string, unknown> = JSON.parse(readFileSync(esPath, "utf8"));
  const frontendBaseKeys = new Set(Object.keys(frontendBase));

  for (const file of readdirSync(frontendLocalesDir)) {
    if (file === "es.json" || file === "meta.json") continue;
    const dict: Record<string, unknown> = JSON.parse(readFileSync(path.join(frontendLocalesDir, file), "utf8"));
    const missing = [...frontendBaseKeys].filter((k) => !(k in dict));
    report(`frontend/${file}`, missing);
    report(`frontend/${file} placeholders`, placeholderMismatches(frontendBase, dict));
  }
} else {
  console.log("… frontend/locales aún no existe, se omite ese chequeo.");
}

if (problems > 0) {
  console.error(`\n${problems} problema(s) de i18n. Corrige antes de continuar.`);
  process.exit(1);
}
console.log("\ni18n: todo completo.");
