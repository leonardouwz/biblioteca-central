/**
 * Orquestación de i18n en el navegador: carga el catálogo del locale activo,
 * expone `t()`/`formatCurrency()`/`formatDate()` globales, actualiza
 * `<html lang dir>`, persiste la elección en localStorage y traduce el DOM
 * vía atributos `data-i18n*`. Usa las funciones puras de `format.js`.
 */
(function () {
  const SUPPORTED = ["es", "en", "ar", "fr"];
  const DEFAULT_LOCALE = "es";
  const STORAGE_KEY = "locale";

  let currentLocale = DEFAULT_LOCALE;
  let catalog = {};
  let meta = {};

  function detectInitialLocale() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED.includes(stored)) return stored;
    const browser = (navigator.language || "es").slice(0, 2).toLowerCase();
    return SUPPORTED.includes(browser) ? browser : DEFAULT_LOCALE;
  }

  async function loadJson(path) {
    const res = await fetch(path);
    return res.json();
  }

  function applyDirection(locale) {
    const dir = (meta[locale] && meta[locale].dir) || "ltr";
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }

  function translateDom() {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    // Atributos: data-i18n-placeholder="key", data-i18n-aria-label="key", etc.
    document.querySelectorAll("*").forEach((el) => {
      for (const attr of el.attributes) {
        if (attr.name.startsWith("data-i18n-")) {
          const target = attr.name.replace("data-i18n-", "");
          el.setAttribute(target, t(attr.value));
        }
      }
    });
  }

  /** Traduce `key` con el catálogo del locale activo. Placeholders: t('a.b', {x: 1}). */
  function t(key, params) {
    return I18nFormat.translate(catalog, key, currentLocale, params);
  }

  function formatCurrency(amount) {
    return I18nFormat.formatCurrency(amount, currentLocale);
  }

  function formatDate(iso) {
    return I18nFormat.formatDate(iso, currentLocale, I18nFormat.detectTimeZone());
  }

  /** Traduce un código de error del backend (`data.code`) con fallback al mensaje ya traducido por el servidor. */
  function translateError(data) {
    if (!data) return t("common.unexpectedError");
    if (data.code && catalog["errors." + data.code] !== undefined) {
      return t("errors." + data.code);
    }
    return data.error || t("common.unexpectedError");
  }

  async function setLocale(locale) {
    if (!SUPPORTED.includes(locale)) locale = DEFAULT_LOCALE;
    catalog = await loadJson(`locales/${locale}.json`);
    currentLocale = locale;
    localStorage.setItem(STORAGE_KEY, locale);
    applyDirection(locale);
    translateDom();
    document.dispatchEvent(new CustomEvent("i18n:changed", { detail: { locale } }));
  }

  function getLocale() {
    return currentLocale;
  }

  async function initI18n() {
    meta = await loadJson("locales/meta.json");
    await setLocale(detectInitialLocale());
  }

  window.I18n = { t, formatCurrency, formatDate, translateError, setLocale, getLocale, initI18n, SUPPORTED };
})();
