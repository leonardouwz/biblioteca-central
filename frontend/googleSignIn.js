/**
 * "Iniciar sesión con Google" + recordar el último método usado (estilo
 * Cloudflare: "Último usado" junto al botón con el que entraste la vez pasada).
 *
 * Flujo: Google Identity Services (GIS) entrega un ID token (`credential`) →
 * el caller lo manda a POST /api/v1/auth/google → el backend lo verifica con
 * Google y responde { account, token } con el MISMO JWT HS256 del login con
 * contraseña. Este archivo no guarda la sesión: solo el último método, que no
 * es secreto (método + email para pre-rellenar).
 *
 * UMD mínimo como validators.js: <script> en el navegador, require() en node:test.
 *
 * Uso:
 *   GoogleSignIn.mount(document.getElementById('authProviders'), (credential) => {...},
 *                      { apiBase: API_BASE_URL, locale: 'es' });
 *   GoogleSignIn.saveLastLogin(localStorage, 'google' | 'password', email);
 *   GoogleSignIn.getLastLogin(localStorage)  // → { method, email } | null
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GoogleSignIn = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const STORAGE_KEY = "lastLogin";
  const METHODS = ["password", "google"];
  const GIS_SRC = "https://accounts.google.com/gsi/client";

  /** Lee el último método guardado; tolera storage vacío, bloqueado o corrupto. */
  function getLastLogin(storage) {
    try {
      const data = JSON.parse(storage.getItem(STORAGE_KEY));
      return data && METHODS.includes(data.method) ? { method: data.method, email: data.email || "" } : null;
    } catch {
      return null;
    }
  }

  function saveLastLogin(storage, method, email) {
    if (!METHODS.includes(method)) return;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify({ method, email: email || "" }));
    } catch {
      /* modo privado / storage bloqueado: solo se pierde el "último usado" */
    }
  }

  let gisPromise = null;
  function loadGis() {
    if (!gisPromise) {
      gisPromise = new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = GIS_SRC;
        s.async = true;
        s.onload = () => resolve(window.google);
        s.onerror = () => {
          gisPromise = null;
          reject(new Error("No se pudo cargar Google Identity Services"));
        };
        document.head.appendChild(s);
      });
    }
    return gisPromise;
  }

  /**
   * Dibuja el botón de Google dentro de `container` si el backend tiene
   * GOOGLE_CLIENT_ID configurado; si no, no dibuja nada (devuelve false).
   * Si el último login fue con Google, agrega la marca "Último usado"
   * (texto `lastUsedLabel`) y sugiere esa cuenta a GIS (login_hint).
   */
  async function mount(container, onCredential, opts) {
    const { apiBase = "", locale = "es", lastUsedLabel = "Último usado", storage = window.localStorage } = opts || {};
    let clientId = null;
    try {
      const res = await fetch(apiBase + "/api/v1/auth/config");
      clientId = res.ok ? (await res.json()).googleClientId : null;
    } catch {
      /* backend caído: no se muestra Google */
    }
    if (!clientId) return false;

    const google = await loadGis();
    const last = getLastLogin(storage);
    google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => onCredential(response.credential),
      login_hint: last && last.method === "google" ? last.email : undefined,
      ux_mode: "popup",
    });
    container.innerHTML = "";
    const btn = document.createElement("div");
    container.appendChild(btn);
    google.accounts.id.renderButton(btn, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "pill",
      locale,
      width: Math.min(container.clientWidth || 320, 400),
    });
    if (last && last.method === "google") container.appendChild(lastUsedBadge(lastUsedLabel));
    return true;
  }

  /** Marca "Último usado" reutilizable (el caller la pone junto al form de email si method === 'password'). */
  function lastUsedBadge(label) {
    const el = document.createElement("span");
    el.className = "last-used-badge";
    el.textContent = label;
    // ponytail: estilo mínimo inline para que se vea sin depender de styles.css; el CSS de la app lo puede sobrescribir.
    el.style.cssText =
      "display:inline-block;margin:6px 0 0 8px;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:600;background:#e8f0fe;color:#1a56db;";
    return el;
  }

  return { STORAGE_KEY, getLastLogin, saveLastLogin, mount, lastUsedBadge };
});
