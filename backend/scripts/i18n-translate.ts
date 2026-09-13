/**
 * Traduce automáticamente las claves de es.json que falten en cada locale
 * destino (en/ar), usando Google Cloud Translation API v2. No pisa
 * traducciones existentes (humanas o de una corrida anterior); cada texto
 * generado se marca `{ text, mt: true }` (borrador MT, a revisar por una
 * persona) — `t()` en `src/domain/i18n/t.ts` sabe leer ese formato.
 *
 * Corre sobre backend/src/domain/i18n/locales Y frontend/locales (si existe).
 *
 * Uso: GOOGLE_TRANSLATE_API_KEY=xxx npm run i18n:translate
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";

const TARGET_LANGS: Record<string, string> = { en: "en", ar: "ar", fr: "fr" }; // locale -> código ISO de la API

const CATALOG_DIRS = [
  path.join(__dirname, "..", "src", "domain", "i18n", "locales"),
  path.join(__dirname, "..", "..", "frontend", "locales"),
];

/**
 * Envuelve cada `{placeholder}` en <span class="notranslate">, que la API de
 * Google Translate respeta al pedir format=html — si no, traduce el propio
 * nombre del placeholder (ej. {email} -> {البريد الإلكتروني}) y rompe la
 * interpolación en tiempo de ejecución.
 */
function protectPlaceholders(text: string): string {
  return text.replace(/\{(\w+)\}/g, '<span class="notranslate">{$1}</span>');
}

function unprotectPlaceholders(html: string): string {
  return html
    .replace(/<span class="notranslate">(\{\w+\})<\/span>/g, "$1")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+([.,;:؛])/g, "$1"); // format=html a veces deja un espacio suelto antes de la puntuación
}

async function translateOnce(text: string, target: string, apiKey: string): Promise<string> {
  const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q: protectPlaceholders(text), source: "es", target, format: "html" }),
  });
  if (!res.ok) {
    throw new Error(`Google Translate respondió ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { data: { translations: { translatedText: string }[] } };
  return unprotectPlaceholders(data.data.translations[0].translatedText);
}

/** Un reintento ante fallas de red transitorias (ya vimos un ECONNRESET real). */
async function translateText(text: string, target: string, apiKey: string): Promise<string> {
  try {
    return await translateOnce(text, target, apiKey);
  } catch (error) {
    console.warn(`  reintentando tras error de red: ${(error as Error).message}`);
    return translateOnce(text, target, apiKey);
  }
}

/** Texto "fuente" traducible de una entrada de es.json (string, {text}, o {other} plural). */
function sourceTextOf(entry: unknown): string | null {
  if (typeof entry === "string") return entry;
  if (entry && typeof entry === "object") {
    if ("text" in entry) return (entry as { text: string }).text;
    if ("other" in entry) return (entry as { other: string }).other;
  }
  return null;
}

async function run(): Promise<void> {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!apiKey) {
    console.error("Falta GOOGLE_TRANSLATE_API_KEY. Uso: GOOGLE_TRANSLATE_API_KEY=xxx npm run i18n:translate");
    process.exit(1);
  }

  let totalTranslated = 0;

  for (const dir of CATALOG_DIRS) {
    if (!existsSync(dir)) continue;
    const scope = dir.includes("frontend") ? "frontend" : "backend";
    const basePath = path.join(dir, "es.json");
    if (!existsSync(basePath)) continue;
    const baseDict: Record<string, unknown> = JSON.parse(readFileSync(basePath, "utf8"));

    for (const [locale, apiLang] of Object.entries(TARGET_LANGS)) {
      const targetPath = path.join(dir, `${locale}.json`);
      const targetDict: Record<string, unknown> = existsSync(targetPath)
        ? JSON.parse(readFileSync(targetPath, "utf8"))
        : {};

      for (const [key, entry] of Object.entries(baseDict)) {
        if (key in targetDict) continue; // no pisar traducción existente
        const sourceText = sourceTextOf(entry);
        if (!sourceText) continue;

        const translatedText = await translateText(sourceText, apiLang, apiKey);
        targetDict[key] = { text: translatedText, mt: true };
        totalTranslated += 1;
        console.log(`[${scope}/${locale}] ${key} -> "${translatedText}"`);
        // Escribe tras cada clave: si la API corta la conexión a mitad de
        // camino (pasó de verdad: ECONNRESET), una corrida siguiente retoma
        // donde quedó en vez de perder todo el progreso del locale.
        writeFileSync(targetPath, JSON.stringify(targetDict, null, 2) + "\n", "utf8");
      }
    }
  }

  console.log(`\n${totalTranslated} clave(s) traducida(s). Revísalas antes de dar por buena la traducción.`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
