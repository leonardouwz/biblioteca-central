/**
 * Actividad "llamadas asíncronas": consume la API pública REST Countries
 * (https://restcountries.com/v3.1, sin API key) con fetch + async/await.
 *
 * Mismo patrón UMD que openLibrary.js: las funciones de parseo son puras
 * (testeables sin red) y `fetchCountriesByRegion`/`fetchCountryDetail`
 * son las únicas que hacen la llamada real.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.Countries = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const API = "https://restcountries.com/v3.1";
  // ponytail: REST Countries no tiene endpoint de "lista de regiones"; son fijas.
  const REGIONS = ["Africa", "Americas", "Asia", "Europe", "Oceania", "Antarctic"];

  /** [{ code, name }] ordenado por nombre, a partir de /region/{region}. */
  function parseCountryList(json) {
    return (Array.isArray(json) ? json : [])
      .map((c) => ({ code: c.cca3, name: c.name && c.name.common }))
      .filter((c) => c.code && c.name)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Filas de la tabla: un idioma por fila con el nombre nativo del país en
   * ese idioma. `languages` y `name.nativeName` usan las mismas claves ISO 639-3.
   */
  function parseLanguageRows(country) {
    const languages = (country && country.languages) || {};
    const native = (country && country.name && country.name.nativeName) || {};
    return Object.entries(languages).map(([code, language]) => ({
      code,
      language,
      nativeCommon: native[code] ? native[code].common : "—",
      nativeOfficial: native[code] ? native[code].official : "—",
    }));
  }

  async function getJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`REST Countries respondió ${res.status}`);
    return res.json();
  }

  async function fetchCountriesByRegion(region) {
    return parseCountryList(await getJson(`${API}/region/${encodeURIComponent(region)}?fields=name,cca3`));
  }

  async function fetchCountryDetail(code) {
    const country = await getJson(`${API}/alpha/${encodeURIComponent(code)}?fields=name,languages`);
    return { name: country.name.common, rows: parseLanguageRows(country) };
  }

  return { REGIONS, parseCountryList, parseLanguageRows, fetchCountriesByRegion, fetchCountryDetail };
});
