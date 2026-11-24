# JWT y servicios web: autenticación con bearer token

Actividad del curso: *incorporar la autenticación mediante JWT en los servicios del proyecto final* y presentar un avance con el **servicio de login** y el **bearer token** funcionando.

- Sitio: <https://biblioteca-central.readuls.workers.dev> → **Iniciar sesión** (correo y contraseña, o **Continuar con Google**).
- API: `https://biblioteca-backend-438047115829.us-central1.run.app/api/v1` (Cloud Run).

## Cómo funciona

1. **Login** — dos formas, las dos terminan en el **mismo JWT**:
   - `POST /api/v1/auth/login` con `{ email, password }`: el backend verifica la contraseña (hash scrypt + sal).
   - `POST /api/v1/auth/google` con `{ credential }`: ver [Login con Google](#login-con-google-emite-el-mismo-jwt).
2. **Bearer token** — el cliente envía el JWT en cada petición: `Authorization: Bearer <token>`.
3. **Servicios protegidos** — el middleware `requireAuth` (`backend/src/presentation/middleware/requireAuth.ts`) valida el token **sin consultar la base de datos** (stateless):
   - sin token o token inválido/expirado → `401 Unauthorized` + cabecera `WWW-Authenticate: Bearer` (RFC 6750);
   - token válido pero rol sin permiso → `403 Forbidden`;
   - token válido → pasa al controlador.

### Estructura del JWT (RFC 7519)

`header.payload.firma`, cada parte en base64url:

| Parte | Contenido |
|---|---|
| Header | `{"alg":"HS256","typ":"JWT"}` |
| Payload (claims) | `sub` (id de la cuenta), `role` (USUARIO / BIBLIOTECARIO / ADMINISTRADOR), `email` (para que el panel del socio encuentre su ficha sin ir a la BD), `iat` (emitido, segundos epoch), `exp` (expira, 8 h después) |
| Firma | HMAC-SHA256 de `header.payload` con el secreto `AUTH_SECRET` |

Implementación en `backend/src/domain/services/authTokens.ts` con el módulo `crypto` de Node (sin dependencias extra). Se rechaza cualquier cabecera que no sea `HS256` (evita el ataque `alg: none`) y la firma se compara en tiempo constante. El token puede pegarse en https://jwt.io para verlo decodificado.

### Servicios y permisos (tras el rediseño)

Con el rediseño el catálogo pasó a ser público (la portada lo muestra sin sesión); todo lo demás exige token.

| Servicio | Requiere |
|---|---|
| `POST /auth/register`, `POST /auth/login`, `POST /auth/google`, `GET /auth/config` | público (login y registro con límite de intentos por IP) |
| `GET /books`, `GET /books/:id` | público (catálogo de la portada) |
| `GET /auth/me`, `GET /me` (panel del socio: sus préstamos y deudas) | token válido, cualquier rol |
| `POST/PUT/DELETE /books`, `GET/POST /loans`, usuarios, deudas, `GET /settings` | token de BIBLIOTECARIO o ADMINISTRADOR |
| `PUT /settings` | token de ADMINISTRADOR |

`GET /loans` (todos los préstamos) es solo del personal: un socio ve únicamente los suyos en `/me`.

### En el frontend

Al iniciar sesión, `app.js` guarda el token en `localStorage` (`authToken`) y lo envía como `Authorization: Bearer …` en cada llamada. Con él se decide qué panel mostrar (socio o personal); el backend vuelve a comprobar el rol en cada petición, así que cambiar `localStorage` a mano no da más permisos.

### El secreto en producción

En Cloud Run, `AUTH_SECRET` sale del secreto **`auth-secret`** de Secret Manager. Nunca se guarda en el repositorio; si falta, el backend avisa en el log y usa un secreto de desarrollo.

## Login con Google (emite el mismo JWT)

Detalle completo en [login-google.md](login-google.md). En resumen:

1. El frontend pide `GET /auth/config`; si hay `googleClientId`, muestra **Continuar con Google**.
2. Google devuelve al navegador un **ID token** (otro JWT, firmado por Google con RS256).
3. El frontend lo manda a `POST /auth/google`. El backend lo valida con Google (`tokeninfo`) y exige `aud` = nuestro client ID, `iss` de Google, que no haya expirado y `email_verified`. Nunca confía en el email que manda el navegador.
4. Si ya existe una cuenta con ese email entra a ella (conserva su rol); si no, crea una cuenta `USUARIO`. Responde `{ account, token }` con **nuestro JWT HS256**, igual que el login con contraseña.

Es decir: el JWT de Google solo sirve para **identificar** a la persona una vez; para usar los servicios siempre se usa el JWT propio de la biblioteca. Un ID token de Google falso o de otra app se rechaza con `422` (`AUTH_GOOGLE_INVALID`).

## Evidencia (ejecución local, 24/11/2026)

Backend del commit actual de `main` levantado con `AUTH_SECRET=secreto-demo` (SQLite local, base vacía). Los tokens de abajo están firmados con ese secreto de demo, no con el de producción.

**1. Servicio protegido sin token → 401** (el catálogo, en cambio, es público)
```
$ curl -i http://localhost:3000/api/v1/loans
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="biblioteca"
{"code":"AUTH_REQUIRED","error":"Sesión requerida. Inicia sesión."}

$ curl -i http://localhost:3000/api/v1/books
HTTP/1.1 200 OK
```

**2. Login → JWT**
```
$ curl -X POST http://localhost:3000/api/v1/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"admin@biblio.pe","password":"Clave123!"}'
{"account":{"id":"1fa8c7aa-2a85-4a11-8068-6401cfc6a1f1","email":"admin@biblio.pe","role":"ADMINISTRADOR",
  "createdAt":"2026-11-24T19:54:19.679Z","lastLoginAt":"2026-11-24T19:55:19.843Z","lastLoginMethod":"password"},
 "token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxZmE4YzdhYS0yYTg1LTRhMTEtODA2OC02NDAxY2ZjNmExZjEiLCJyb2xlIjoiQURNSU5JU1RSQURPUiIsImVtYWlsIjoiYWRtaW5AYmlibGlvLnBlIiwiaWF0IjoxNzk1NTUwMTE5LCJleHAiOjE3OTU1Nzg5MTl9.VX4OeI2Phskd6mpLsbOCjnLy2tUDY_qVO2NaBYxh9Sk"}
```

**3. El token decodificado**
```
header : {"alg":"HS256","typ":"JWT"}
payload: {"sub":"1fa8c7aa-2a85-4a11-8068-6401cfc6a1f1","role":"ADMINISTRADOR","email":"admin@biblio.pe","iat":1795550119,"exp":1795578919}
```

**4. Servicio protegido con `Authorization: Bearer <token>` → 200**
```
$ curl -i http://localhost:3000/api/v1/loans -H "Authorization: Bearer $TOKEN"
HTTP/1.1 200 OK
[]

$ curl http://localhost:3000/api/v1/auth/me -H "Authorization: Bearer $TOKEN"
{"sub":"1fa8c7aa-2a85-4a11-8068-6401cfc6a1f1","role":"ADMINISTRADOR","email":"admin@biblio.pe","iat":1795550119,"exp":1795578919}
```

**5. Token alterado (último carácter de la firma cambiado) → 401**
```
$ curl -i http://localhost:3000/api/v1/loans -H "Authorization: Bearer $TOKEN_ALTERADO"
HTTP/1.1 401 Unauthorized
{"code":"AUTH_REQUIRED","error":"Sesión requerida. Inicia sesión."}
```

**6. Token válido de un USUARIO (socio) intentando crear un libro → 403; su propio panel → 200**
```
$ curl -i -X POST http://localhost:3000/api/v1/books -H "Authorization: Bearer $TOKEN_USUARIO" ...
HTTP/1.1 403 Forbidden
{"code":"AUTH_FORBIDDEN","error":"No tienes permiso para realizar esta acción."}

$ curl -i http://localhost:3000/api/v1/me -H "Authorization: Bearer $TOKEN_USUARIO"
HTTP/1.1 200 OK
{"user":null,"loans":[],"debts":[]}
```

**7. Login con Google: configuración pública y token falso rechazado**
```
$ curl http://localhost:3000/api/v1/auth/config
{"googleClientId":"demo-client.apps.googleusercontent.com"}

$ curl -i -X POST http://localhost:3000/api/v1/auth/google -H 'Content-Type: application/json' \
    -d '{"credential":"no-es-un-token"}'
HTTP/1.1 422 Unprocessable Entity
{"code":"AUTH_GOOGLE_INVALID","error":"No se pudo verificar tu cuenta de Google. Inténtalo de nuevo."}
```

**8. En el navegador** (Playwright): al enviar el formulario, `POST /auth/login` responde 200 con el token, el frontend lo guarda en `localStorage` y la siguiente llamada (`GET /me`) ya sale con `Authorization: Bearer …`.

![Pantalla de inicio de sesión](img/34-jwt-login.png)

(En el entorno de prueba no hay acceso a `accounts.google.com`, por eso no aparece el botón de Google; en el sitio publicado se muestra encima del formulario.)

![Panel del socio cargado con el bearer token](img/35-jwt-panel-socio.png)

**9. Pruebas automáticas** — `npm test` en `backend/`: 40 pruebas OK, entre ellas `authTokens.test.ts` (formato JWT, expiración, firma inválida, rechazo de `alg: none`) y `googleIdToken.test.ts` (rechazo por `aud`, `iss`, expiración y email no verificado).

## Probarlo en producción

```
URL=https://biblioteca-backend-438047115829.us-central1.run.app
curl -i $URL/api/v1/loans                                       # 401 (sin token)
TOKEN=$(curl -s -X POST $URL/api/v1/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"TU_CORREO","password":"TU_CLAVE"}' | jq -r .token)
curl -i $URL/api/v1/me -H "Authorization: Bearer $TOKEN"         # 200
```

El despliegue (GitHub Actions) ya hace esta prueba de humo en cada cambio de `main`: `GET /books` sin token → 200 y `GET /loans` sin token → 401.

Si entras con Google, el token está en el navegador: F12 → *Application* → *Local Storage* → `authToken`.
