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
  const RATES_STORAGE_KEY = "exchangeRates";
  const RATES_TTL_MS = 6 * 60 * 60 * 1000; // 6h: no hace falta más fresco para mostrar montos, y evita pegarle a la API en cada carga
  const RATES_API_URL = "https://open.er-api.com/v6/latest/PEN"; // gratis, sin API key; PEN es la moneda en la que se guardan los montos

  let currentLocale = DEFAULT_LOCALE;
  let catalog = {};
  let meta = {};
  let currentCurrency = I18nFormat.BASE_CURRENCY;
  let ratesFromPEN = { [I18nFormat.BASE_CURRENCY]: 1 };

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

  /**
   * Carga las tasas de cambio (base PEN) desde localStorage si están
   * frescas, o desde la API si no. Ante cualquier falla (sin red, API
   * caída) deja `ratesFromPEN` como esté — `formatCurrency` cae de vuelta a
   * mostrar en PEN en vez de una conversión inventada.
   */
  async function loadExchangeRates() {
    try {
      const cached = JSON.parse(localStorage.getItem(RATES_STORAGE_KEY) || "null");
      if (cached && Date.now() - cached.fetchedAt < RATES_TTL_MS) {
        ratesFromPEN = cached.rates;
        return;
      }
    } catch {
      /* localStorage o JSON corrupto: seguimos a pedirlas de nuevo */
    }
    try {
      const res = await fetch(RATES_API_URL);
      const data = await res.json();
      if (data.result === "success" && data.rates) {
        ratesFromPEN = { [I18nFormat.BASE_CURRENCY]: 1, ...data.rates };
        localStorage.setItem(RATES_STORAGE_KEY, JSON.stringify({ rates: ratesFromPEN, fetchedAt: Date.now() }));
      }
    } catch {
      /* sin red / API caída: nos quedamos con lo último conocido (o solo PEN) */
    }
  }

  /** `amount` siempre viene en PEN desde el backend; se convierte a la moneda del idioma activo. */
  function formatCurrency(amount) {
    const rate = ratesFromPEN[currentCurrency];
    if (rate === undefined) {
      // No hay tasa para esta moneda (aún no cargó, o la API falló): mejor
      // mostrar el monto real en soles que una "conversión" al 1:1 falsa.
      return I18nFormat.formatCurrency(amount, currentLocale, I18nFormat.BASE_CURRENCY);
    }
    return I18nFormat.formatCurrency(I18nFormat.convertAmount(amount, rate), currentLocale, currentCurrency);
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
    currentCurrency = (meta[locale] && meta[locale].currency) || I18nFormat.BASE_CURRENCY;
    localStorage.setItem(STORAGE_KEY, locale);
    applyDirection(locale);
    // Solo hace falta la tasa de cambio si el idioma no muestra en la moneda
    // base — evita una llamada de red innecesaria para el caso más común (es/PEN).
    if (currentCurrency !== I18nFormat.BASE_CURRENCY) {
      await loadExchangeRates();
    }
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
