/**
 * Actividad "llamadas asíncronas": consume la API pública de apicountries.com
 * (hoy servida en https://countries.dev, sin API key) con fetch + async/await.
 * Es la alternativa que da el enunciado: restcountries.com/v3.1 ya no responde
 * (devuelve "This API version has been deprecated"; su v5 exige API key).
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
  const API = "https://countries.dev";
  // Lista estática, como permite el enunciado: son los valores que acepta /region/{region}.
  const REGIONS = ["Africa", "Americas", "Asia", "Europe", "Oceania", "Polar"];

  /** [{ code, name }] ordenado por nombre, a partir de /region/{region}. */
  function parseCountryList(json) {
    return (Array.isArray(json) ? json : [])
      .map((c) => ({ code: c.alpha3Code, name: c.name }))
      .filter((c) => c.code && c.name)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Filas de la tabla: un idioma por fila, con su nombre en ese mismo idioma. */
  function parseLanguageRows(country) {
    return ((country && country.languages) || []).map((l) => ({
      language: l.name,
      languageNative: l.nativeName || "—",
    }));
  }

  async function getJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`apicountries respondió ${res.status}`);
    return res.json();
  }

  async function fetchCountriesByRegion(region) {
    return parseCountryList(await getJson(`${API}/region/${encodeURIComponent(region)}`));
  }

  async function fetchCountryDetail(code) {
    const country = await getJson(`${API}/alpha/${encodeURIComponent(code)}`);
    return { name: country.name, nativeName: country.nativeName || "—", rows: parseLanguageRows(country) };
  }

  return { REGIONS, parseCountryList, parseLanguageRows, fetchCountriesByRegion, fetchCountryDetail };
});
