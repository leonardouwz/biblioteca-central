import es from "./locales/es.json";
import en from "./locales/en.json";
import ar from "./locales/ar.json";

export type Locale = "es" | "en" | "ar";
export const SUPPORTED_LOCALES: Locale[] = ["es", "en", "ar"];
export const DEFAULT_LOCALE: Locale = "es";

/** Metadatos por locale que NO dependen de listar códigos a mano en el frontend. */
export const LOCALE_META: Record<Locale, { dir: "ltr" | "rtl"; label: string }> = {
  es: { dir: "ltr", label: "Español" },
  en: { dir: "ltr", label: "English" },
  ar: { dir: "rtl", label: "العربية" },
};

type PluralEntry = { one?: string; other: string; mt?: boolean };
/** `mt: true` marca una traducción generada por `scripts/i18n-translate.ts`, pendiente de revisión humana. */
type MtEntry = { text: string; mt?: boolean };
type Entry = string | PluralEntry | MtEntry;

const CATALOGS: Record<Locale, Record<string, Entry>> = { es, en, ar };

const isPlural = (e: Entry): e is PluralEntry => typeof e === "object" && "other" in e;
const isMt = (e: Entry): e is MtEntry => typeof e === "object" && "text" in e;

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}

/**
 * FUNCIÓN STATELESS: dado el mismo (code, locale, params) siempre resuelve el
 * mismo texto. No lee base de datos ni red; los catálogos se cargan una sola
 * vez como JSON estático.
 */
export function t(code: string, locale: Locale, params?: Record<string, string | number>): string {
  const catalog = CATALOGS[locale] ?? CATALOGS[DEFAULT_LOCALE];
  const entry = catalog[code] ?? CATALOGS[DEFAULT_LOCALE][code];
  if (!entry) return code; // clave desconocida: mejor mostrar el código que romper

  if (isMt(entry)) return interpolate(entry.text, params);

  if (isPlural(entry)) {
    const count = Number(params?.count ?? 0);
    // ponytail: solo mapeamos "one"/"other". Intl.PluralRules(ar) también puede
    // devolver "zero"/"two"/"few"/"many"; caen al fallback "other" (gramaticalmente
    // aceptable, no idiomático). Ampliar el tipo con esas formas si un locale árabe
    // real lo exige.
    const rule = new Intl.PluralRules(locale).select(count);
    const form = rule === "one" ? entry.one : undefined;
    return interpolate(form ?? entry.other, params);
  }

  return interpolate(entry, params);
}

/** Para los tests/CLI de completitud: claves del catálogo base (es = fuente de verdad). */
export function baseKeys(): string[] {
  return Object.keys(CATALOGS[DEFAULT_LOCALE]);
}

export function keysOf(locale: Locale): string[] {
  return Object.keys(CATALOGS[locale]);
}
