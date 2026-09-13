/**
 * Funciones STATELESS de formateo/traducción, sin DOM ni red, para que se
 * puedan probar con `node:test` (ver frontend/format.test.ts) y también
 * cargarlas en el navegador con <script src="format.js"> (sin bundler).
 * UMD mínimo: exporta `module.exports` en Node, `window.I18nFormat` en el navegador.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.I18nFormat = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const CURRENCY = "PEN";

  function interpolate(template, params) {
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
  }

  function isPlural(entry) {
    return entry && typeof entry === "object" && "other" in entry;
  }

  function isMt(entry) {
    return entry && typeof entry === "object" && "text" in entry;
  }

  /**
   * Traduce `key` (ej. "loans.submit") contra un catálogo ya cargado
   * ({ "loans.submit": "..." } o anidado { loans: { submit: "..." } }).
   * Acepta entradas planas, `{text,mt}` (borrador de traducción automática) y
   * plurales `{one,other}` (usa `params.count` con Intl.PluralRules).
   */
  function translate(catalog, key, locale, params) {
    const entry = catalog[key];
    if (entry === undefined) return key; // clave desconocida: mejor mostrar la clave que romper

    if (isMt(entry)) return interpolate(entry.text, params);

    if (isPlural(entry)) {
      const count = Number((params && params.count) ?? 0);
      const rule = new Intl.PluralRules(locale).select(count);
      const form = rule === "one" ? entry.one : undefined;
      return interpolate(form ?? entry.other, params);
    }

    return interpolate(entry, params);
  }

  function formatCurrency(amount, locale) {
    return new Intl.NumberFormat(locale, { style: "currency", currency: CURRENCY }).format(amount);
  }

  function formatDate(iso, locale, timeZone) {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone }).format(new Date(iso));
  }

  function detectTimeZone() {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  return { interpolate, translate, formatCurrency, formatDate, detectTimeZone, CURRENCY };
});
