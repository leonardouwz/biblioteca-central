# JWT y servicios web: autenticación con bearer token

Actividad del curso: *incorporar la autenticación mediante JWT en los servicios del proyecto final* y presentar un avance con el **servicio de login** y el **bearer token** funcionando.

## Cómo funciona

1. **Login** — `POST /api/v1/auth/login` con `{ email, password }`. El backend verifica la contraseña (hash scrypt + sal) y devuelve un **JWT** firmado.
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
| Payload (claims) | `sub` (id de la cuenta), `role` (USUARIO / BIBLIOTECARIO / ADMINISTRADOR), `iat` (emitido, segundos epoch), `exp` (expira, 8 h después) |
| Firma | HMAC-SHA256 de `header.payload` con el secreto `AUTH_SECRET` |

Implementación en `backend/src/domain/services/authTokens.ts` con el módulo `crypto` de Node (sin dependencias extra). Se rechaza cualquier cabecera que no sea `HS256` (evita el ataque `alg: none`) y la firma se compara en tiempo constante. El token generado puede pegarse en https://jwt.io para verlo decodificado.

### Rutas protegidas

| Servicio | Requiere |
|---|---|
| `/auth/register`, `/auth/login` | público |
| `GET /auth/me` | token válido |
| `GET /books`, `GET /books/:id`, catálogo | token válido (cualquier rol) |
| `POST/PUT/DELETE /books`, usuarios, préstamos, deudas, configuración | token de BIBLIOTECARIO o ADMINISTRADOR |

### El secreto en producción

En Cloud Run, `AUTH_SECRET` sale del secreto **`auth-secret`** de Secret Manager (ya configurado en el despliegue). Nunca se guarda en el repositorio; si falta, el backend avisa en el log y usa un secreto de desarrollo.

## Evidencia (ejecución local, 24/11/2026)

Backend levantado con `AUTH_SECRET=secreto-demo npm run dev` (SQLite local). Los tokens de abajo están firmados con ese secreto de demo, no con el de producción.

**1. Servicio protegido sin token → 401**
```
$ curl -i http://localhost:3000/api/v1/books
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="biblioteca"
{"code":"AUTH_REQUIRED","error":"Sesión requerida. Inicia sesión."}
```

**2. Login → JWT**
```
$ curl -X POST http://localhost:3000/api/v1/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"admin@biblio.pe","password":"Clave123!"}'
{"account":{"id":"fd23ca79-1d69-4c70-9c1b-581053295ab9","email":"admin@biblio.pe","role":"ADMINISTRADOR","createdAt":"2026-11-24T18:03:20.912Z"},
 "token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmZDIzY2E3OS0xZDY5LTRjNzAtOWMxYi01ODEwNTMyOTVhYjkiLCJyb2xlIjoiQURNSU5JU1RSQURPUiIsImlhdCI6MTc5NTU0MzQwMSwiZXhwIjoxNzk1NTcyMjAxfQ.uuZITqcKZxQcKd58zfmvcbipK13b-dl8ZVM0JcT9USY"}
```

**3. El token decodificado**
```
header : {"alg":"HS256","typ":"JWT"}
payload: {"sub":"fd23ca79-1d69-4c70-9c1b-581053295ab9","role":"ADMINISTRADOR","iat":1795543401,"exp":1795572201}
```

**4. Servicio protegido con `Authorization: Bearer <token>` → 200**
```
$ curl -i http://localhost:3000/api/v1/books -H "Authorization: Bearer $TOKEN"
HTTP/1.1 200 OK
[]

$ curl http://localhost:3000/api/v1/auth/me -H "Authorization: Bearer $TOKEN"
{"sub":"fd23ca79-1d69-4c70-9c1b-581053295ab9","role":"ADMINISTRADOR","iat":1795543401,"exp":1795572201}
```

**5. Token alterado (un carácter de la firma cambiado) → 401**
```
HTTP/1.1 401 Unauthorized
{"code":"AUTH_REQUIRED","error":"Sesión requerida. Inicia sesión."}
```

**6. Token válido de un USUARIO intentando crear un libro → 403**
```
$ curl -i -X POST http://localhost:3000/api/v1/books -H "Authorization: Bearer $TOKEN_USUARIO" ...
HTTP/1.1 403 Forbidden
{"code":"AUTH_FORBIDDEN","error":"No tienes permiso para realizar esta acción."}
```

**7. Pruebas automáticas** — `npm test` en `backend/`: verifican el formato JWT, la expiración, la firma inválida y el rechazo de `alg: none` (`authTokens.test.ts`).

## Probarlo en producción

Con el backend desplegado (`<URL>` = URL de Cloud Run de `biblioteca-backend`):
```
TOKEN=$(curl -s -X POST <URL>/api/v1/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"TU_CORREO","password":"TU_CLAVE"}' | jq -r .token)
curl -i <URL>/api/v1/books                                   # 401
curl -i <URL>/api/v1/books -H "Authorization: Bearer $TOKEN"   # 200
```
En el frontend (Cloudflare) el login guarda el token en `localStorage` y lo envía como bearer en cada llamada.

> Nota de despliegue: los tokens emitidos con el formato anterior dejan de ser válidos; quien tenga sesión abierta solo tiene que volver a iniciar sesión.
