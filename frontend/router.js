/**
 * Rutas de la SPA por hash (sin build ni dependencias). Funciones STATELESS:
 * dado el hash y el rol, deciden qué vista y qué sección del panel mostrar.
 *   #/            -> inicio público (catálogo)
 *   #/login       -> inicio de sesión
 *   #/panel/<sec> -> panel; la sección depende del rol
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Router = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const STAFF = ["BIBLIOTECARIO", "ADMINISTRADOR"];
  // Mismo criterio que data-roles en index.html y que requireAuth en el backend.
  const SECTION_ROLES = {
    resumen: "ALL",
    prestamos: "STAFF",
    libros: "STAFF",
    socios: "STAFF",
    deudas: "STAFF",
    config: "ADMINISTRADOR",
    paises: "ALL",
  };

  function canSee(roles, role) {
    if (!role) return false;
    if (roles === "ALL") return true;
    if (roles === "STAFF") return STAFF.includes(role);
    return roles === role;
  }

  /** Secciones del panel visibles para `role`, en orden del menú. */
  function sectionsFor(role) {
    return Object.keys(SECTION_ROLES).filter((s) => canSee(SECTION_ROLES[s], role));
  }

  /**
   * Resuelve `hash` a { view, section }. Sin sesión, el panel redirige a login;
   * con sesión, login redirige al panel; una sección no permitida cae en "resumen".
   */
  function resolve(hash, role) {
    const [, view = "", section = ""] = String(hash || "").replace(/^#/, "").split("/");
    if (view === "login") return role ? { view: "panel", section: "resumen" } : { view: "login", section: null };
    if (view === "panel") {
      if (!role) return { view: "login", section: null };
      return { view: "panel", section: sectionsFor(role).includes(section) ? section : "resumen" };
    }
    return { view: "home", section: null };
  }

  return { resolve, sectionsFor, canSee, STAFF };
});
