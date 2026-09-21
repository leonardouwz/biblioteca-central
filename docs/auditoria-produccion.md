# Auditoría de producción

Revisión de seguridad, roles y consistencia contra el sistema desplegado
(no solo el código local). Se encontraron y corrigieron 2 fallas críticas,
1 alta y varias de pulido — todas verificadas en vivo antes y después del
fix, no solo leídas en el código.

---

## 1. Hallazgos críticos (corregidos)

### 1.1 `AUTH_SECRET` con el valor por defecto en producción

El backend firma los tokens de sesión con `process.env.AUTH_SECRET`, pero
esa variable nunca se configuró al desplegar — el servidor caía al
secreto de desarrollo **hardcodeado en el código, público en este mismo
repositorio de GitHub**:

```ts
const authSecret = process.env.AUTH_SECRET || "dev-secret-cambiar-en-produccion";
```

Cualquiera que leyera el repo podía firmar su propio token con
`role: "ADMINISTRADOR"` y cualquier `sub`, sin necesidad de contraseña ni
cuenta real — la autenticación completa quedaba decorativa.

**Fix:** secreto real generado y guardado en Google Secret Manager
(`auth-secret`), inyectado por `--set-secrets` al desplegar Cloud Run. El
servidor ahora además imprime una advertencia en los logs si algún
entorno vuelve a arrancar sin la variable configurada, para que esto no
pase desapercibido otra vez.

Efecto colateral esperado (y correcto): al rotar el secreto, **todos los
tokens ya emitidos quedaron inválidos** — se verificó en vivo que una
sesión vieja ahora responde `AUTH_SESSION_INVALID`.

### 1.2 Autorregistro con `role: "ADMINISTRADOR"`

`POST /auth/register` aceptaba un `role` explícito en el body, y lo
honraba para **cualquier valor válido del enum**, sin restricción:

```ts
// antes
if (requested && (ROLES as string[]).includes(requested)) return requested as Role;
```

Cualquier visitante anónimo podía registrarse pidiendo
`{ "role": "ADMINISTRADOR" }` y obtener la cuenta con más privilegios del
sistema, sin invitación ni aprobación de nadie.

**Fix:** el autorregistro solo puede resultar en `USUARIO` o
`BIBLIOTECARIO` (este último sigue disponible para que el personal se
registre sin invitación, que era la intención original). `ADMINISTRADOR`
solo se asigna a la primera cuenta creada en todo el sistema (bootstrap).
Se quitó también la opción "Administrador" del `<select>` de registro en
el frontend — antes la ofrecía aunque el backend la iba a ignorar
silenciosamente, una inconsistencia que el propio fix del backend dejó
expuesta.

Verificado en vivo: pedir `role: ADMINISTRADOR` en el registro ahora
devuelve una cuenta `USUARIO`.

---

## 2. Hallazgo alto (corregido)

### 2.1 Sin validación de entero/límite en `quantity` / `initialCopies`

El frontend valida con regex que la cantidad de copias sea un entero
(ver `docs/validacion-regex.md`), pero el **backend no validaba nada más
que el signo** — un request directo a la API (sin pasar por la UI) podía
enviar cualquier número:

- `{"quantity": 1.5}` → creaba 2 copias (el loop `for (i=0; i<1.5; i++)`
  redondea hacia arriba sin avisar), inconsistente con lo pedido.
- `{"quantity": 1e30}` → el mismo loop, sin tope superior, deja el
  proceso iterando de forma casi infinita — una vía trivial de
  denegación de servicio contra el propio backend.

**Fix:** `BookService` ahora exige entero finito entre 0 y 10 000 tanto
en `addStock` como en `createBook`. Verificado en vivo: `1.5` y `1e30`
rechazados con `BOOK_QUANTITY_INVALID`/`BOOK_COPIES_NEGATIVE`; `3` sigue
funcionando normalmente.

---

## 3. Pulido / consistencia (corregido)

| Problema | Antes | Ahora |
|---|---|---|
| Ruta inexistente (`/api/v1/lo-que-sea`) | Página HTML de error por defecto de Express (`Cannot GET ...`) | `404 {"code":"ROUTE_NOT_FOUND","error":"..."}`, traducido, igual al resto de la API |
| JSON mal formado en el body | Página HTML `Bad Request` | Mismo formato JSON consistente, vía un error-handler global |
| Header `X-Powered-By: Express` | Expuesto en toda respuesta | Deshabilitado (`app.disable("x-powered-by")`) |
| `format.test.js`, `validators.test.js`, `package.json`, `wrangler.jsonc`, `.wrangler/**` | Servidos públicamente desde el frontend de Cloudflare | Excluidos vía `.assetsignore` |
| Favicon | Ninguno (ícono genérico del navegador) | Ícono propio (el mismo sello "B°" del header, SVG inline) |

Durante el propio trabajo de auditoría se detectó y corrigió además un
Worker de Cloudflare duplicado y accidental (`biblioteca-n-capas`,
creado por correr `wrangler deploy` desde el directorio equivocado) —
eliminado antes de terminar.

---

## 4. Roles verificados en vivo (no solo leídos en el código)

| Acción | USUARIO | BIBLIOTECARIO | ADMINISTRADOR |
|---|---|---|---|
| Ver catálogo/préstamos | ✅ | ✅ | ✅ |
| Gestionar préstamos, catálogo, socios | ❌ (panel oculto) | ✅ | ✅ |
| Eliminar un socio | ❌ | **403** (confirmado en vivo) | ✅ |
| Autorregistrarse con ese rol | — | ✅ (intencional) | ❌ (era el hallazgo #1.2) |

La separación de roles en sí **no tenía bugs** — el middleware
`requireAuth` y las rutas ya estaban bien restringidas; el problema real
era que cualquiera podía *auto-otorgarse* el rol más alto antes de que
esas restricciones importaran.

---

## 5. Pendiente — no se tocó en esta pasada (recomendaciones)

Estas quedan fuera de esta corrección porque requieren una decisión del
dueño del proyecto o acceso que este entorno no tiene:

- **Cuentas de prueba activas en producción** con contraseñas que
  quedaron pegadas en el historial de este chat (`demo-admin@biblioteca.test`,
  algunas `...@example.com` creadas durante las pruebas de este proyecto,
  varias con rol ADMINISTRADOR). No hay endpoint para borrar cuentas de
  auth — hay que hacerlo desde el SQL editor de Supabase (tabla
  `accounts`), o pedir que se agregue un endpoint de administración de
  cuentas (razonable como siguiente feature, dado que ya se mencionó
  "administración" en el pedido de esta revisión).
- **CORS abierto a cualquier origen** (`Access-Control-Allow-Origin: *`).
  El riesgo real es bajo porque la sesión se maneja con Bearer token (no
  cookies), pero restringirlo al dominio real del frontend sería la
  práctica recomendada para un API "profesional".
- **Sin límite de intentos de login/registro** (fuerza bruta no
  mitigada) y **sin recuperación de contraseña** — esperable en un
  proyecto de este alcance, pero son los siguientes gaps de seguridad si
  el sistema fuera a manejar datos reales.

---

## 6. Verificación

```
backend:  npm test        → 20/20 ✔ (2 nuevos: privesc + cantidad inválida)
backend:  npm run i18n:check → completo
frontend: npm test        → 11/11 ✔
```

Producción re-verificada tras cada fix (no solo local):

| Componente | URL |
|---|---|
| Backend (Cloud Run) | https://biblioteca-backend-438047115829.us-central1.run.app |
| Frontend (Cloudflare Workers) | https://biblioteca-central.readuls.workers.dev |
