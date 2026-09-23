# Funciones Stateless y Stateful — Sistema de Gestión de Biblioteca

Documento de entrega. Se identifican **2 funciones stateless** (sin estado) y
**2 funciones stateful** (con estado), una existente y una nueva de cada tipo.

| Concepto | Definición aplicada en este proyecto |
|----------|--------------------------------------|
| **Stateless** | El resultado depende **solo de los argumentos**. No lee ni escribe base de datos, disco, red ni variables globales. Mismo input → mismo output (idempotente). |
| **Stateful** | Su resultado o su efecto dependen de / modifican **estado persistente** (las tablas de la base de datos). El mismo llamado puede dar distinto resultado según el estado guardado. |

---

## 1. STATELESS — `calculateFine(dueDate, asOfDate, hourlyRate, multiplier)`

- **Archivo:** `backend/src/domain/services/LoanService.ts`
- **Tipo:** nueva (extraída de la lógica que estaba embebida en `returnLoan`).
- **Actualizada (ver `docs/prestamos-configuracion.md`):** ahora cobra por
  hora (no por día) y con un multiplicador configurable, y se usa también
  para calcular una multa *provisional* antes de devolver el préstamo.

```ts
export function calculateFine(dueDate: Date, asOfDate: Date, hourlyRate: number, multiplier: number): number {
  if (asOfDate <= dueDate) return 0;
  const hoursLate = Math.ceil((asOfDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60));
  return Math.round(hoursLate * hourlyRate * multiplier);
}
```

**Por qué es stateless:** recibe dos fechas, una tarifa y un multiplicador y
devuelve un número. No consulta la tabla `loans` ni `debts`, no usa
`Date.now()` internamente (el caller decide qué fecha pasar), no guarda
nada. Con los mismos argumentos devuelve siempre lo mismo — por eso puede
usarse tanto para la multa real (`returnDate`) como para la previsualización
(`new Date()`, sin crear ninguna deuda).

**Uso real:** `LoanService.returnLoan()` la llama con la tarifa/multiplicador
vigentes (`Settings`) para generar la deuda; `LoanService.getAllLoans()` /
`getLoansByUserId()` la llaman con "ahora" para el campo `provisionalFine`.

**Prueba:** `backend/src/domain/services/LoanService.test.ts`
```
sin atraso              → 0
ceil(2h de atraso)      → 2h * tarifa
ceil(2h01 de atraso)    → 3h * tarifa (la fracción de hora redondea hacia arriba)
con multiplicador 2     → el doble
```

---

## 2. STATELESS — `verifyToken(token, secret, now?)`

- **Archivo:** `backend/src/domain/services/authTokens.ts`
- **Tipo:** nueva (parte del módulo de autenticación básica).

```ts
export function verifyToken(token: string, secret: string, now = Date.now()): TokenPayload | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expectedSig = hmac(payload, secret);
  // ...comparación en tiempo constante de la firma HMAC-SHA256...
  const data = JSON.parse(fromB64url(payload).toString("utf8")) as TokenPayload;
  if (typeof data.exp !== "number" || data.exp < now) return null;
  return data;
}
```

**Por qué es stateless:** valida firma y expiración de un token con puro
cálculo criptográfico. **No hay tabla de sesiones**: toda la información
(`sub`, `role`, `exp`) viaja firmada dentro del propio token. El reloj se
inyecta como parámetro `now` para que la función siga siendo determinista.
Mismo token + mismo secret + mismo `now` → mismo resultado.

El mismo módulo contiene otras funciones puras de apoyo: `signToken`,
`hashPassword`, `verifyPassword`.

**Uso real:** el middleware `requireAuth` (`backend/src/presentation/middleware/requireAuth.ts`)
la ejecuta en **cada request** a los endpoints protegidos para validar la sesión
y el rol, sin tocar la base de datos. También la usa `AuthController.me()`.

**Prueba:** `backend/src/domain/services/authTokens.test.ts`
(token válido aceptado; firma incorrecta / token expirado / basura → `null`).

---

## 3. STATEFUL — `LoanService.createLoan(userId, bookId)`

- **Archivo:** `backend/src/domain/services/LoanService.ts`
- **Tipo:** existente.

```ts
async createLoan(userId: string, bookId: string): Promise<Loan> {
  const user = await this.userRepository.findById(userId);          // LEE estado
  if (await this.debtRepository.hasUnpaidByUserId(userId)) { ... }   // LEE estado
  const activeLoans = await this.loanRepository.countActiveByUserId(userId); // LEE estado
  const availableCopy = await this.bookRepository.findAvailableCopy(bookId);  // LEE estado
  await this.bookRepository.setCopyStatus(availableCopy.id, "LOANED");        // ESCRIBE estado
  return this.loanRepository.create({ ... status: "ACTIVE" });               // ESCRIBE estado
}
```

**Por qué es stateful:** su comportamiento depende por completo del estado
guardado (¿el usuario existe?, ¿tiene deudas?, ¿cuántos préstamos activos
tiene?, ¿hay copias libres?) y además **modifica** la base de datos: marca una
copia como `LOANED` y crea una fila en `loans`. Llamarla dos veces seguidas
con los mismos argumentos da resultados distintos (la segunda puede fallar por
límite de préstamos o falta de copias).

---

## 4. STATEFUL — `AuthService.register(email, password, role?)` y `login(email, password)`

- **Archivo:** `backend/src/domain/services/AuthService.ts`
- **Tipo:** nueva. Autenticación básica con roles: **USUARIO**, **BIBLIOTECARIO**, **ADMINISTRADOR**.

```ts
async register(email, password, requestedRole?) {
  if (await this.accountRepository.findByEmail(normalizedEmail)) {   // LEE estado
    throw new BusinessError("Ya existe una cuenta con ese email.");
  }
  const isFirstAccount = (await this.accountRepository.countAll()) === 0; // LEE estado
  const role = this.resolveRole(requestedRole, isFirstAccount);
  const created = await this.accountRepository.create({              // ESCRIBE estado
    email: normalizedEmail,
    passwordHash: hashPassword(password, newSalt()),
    role,
    createdAt: new Date(),
  });
  return this.buildResult(created); // { account, token }
}

async login(email, password) {
  const account = await this.accountRepository.findByEmail(...);     // LEE estado
  if (!account || !verifyPassword(password, account.passwordHash)) {
    throw new BusinessError("Email o contraseña incorrectos.");
  }
  return this.buildResult(account); // { account, token }
}
```

**Por qué es stateful:** `register` **escribe** una fila nueva en la tabla
`accounts` (y su resultado depende de si ya hay cuentas: la primera cuenta se
crea como `ADMINISTRADOR`). `login` **lee** esa tabla y compara el hash
guardado; el mismo email/contraseña da éxito o error según lo que exista en la
base de datos.

Reparto de la parte pura vs. la parte con estado:

| Parte | Función | Tipo |
|-------|---------|------|
| Hash de contraseña + firma de token | `hashPassword`, `signToken`, `verifyToken` (`authTokens.ts`) | **stateless** |
| Alta / búsqueda de cuentas en BD | `AuthService.register` / `login` | **stateful** |

### Roles

- **USUARIO:** rol por defecto al registrarse. Usa la app (consulta catálogo, sus préstamos y deudas).
- **BIBLIOTECARIO:** gestiona préstamos, devoluciones y catálogo.
- **ADMINISTRADOR:** todo lo anterior + gestión de socios y de cuentas. La **primera** cuenta registrada es automáticamente ADMINISTRADOR.

> Nota: la autenticación es *básica y demostrativa* (registro, hash `scrypt`,
> token firmado HMAC-SHA256, sin refresh tokens ni recuperación de contraseña),
> pero funciona de punta a punta y **todos los endpoints están protegidos**.

---

## Protección de los endpoints existentes

El middleware `requireAuth(secret, ...roles)` (`backend/src/presentation/middleware/requireAuth.ts`)
se aplica a todas las rutas `/api/v1` salvo `/auth/*`. Llama a `verifyToken`
(stateless) y, si se le pasan roles, exige que el rol del token esté en la lista.

| Ruta | Permiso mínimo |
|------|----------------|
| `GET /books`, `GET /books/:id`, `GET /loans` | cualquier sesión (USUARIO+) |
| `POST/PUT/DELETE /books`, `POST /books/:id/stock` | BIBLIOTECARIO / ADMINISTRADOR |
| `POST /loans`, `POST /loans/:id/return` | BIBLIOTECARIO / ADMINISTRADOR |
| `GET /debts`, `POST /debts/:id/pay` | BIBLIOTECARIO / ADMINISTRADOR |
| `GET/POST/PUT /users`, `PUT /users/:id/status` | BIBLIOTECARIO / ADMINISTRADOR |
| `DELETE /users/:id` | ADMINISTRADOR |
| `POST /auth/register`, `POST /auth/login` | público |

Respuestas: `401` si falta el token o es inválido/expirado; `403` si el rol no alcanza.

En el frontend, `fetchJson` adjunta `Authorization: Bearer <token>` en cada
llamada, borra la sesión al recibir `401`, y el panel de gestión (pestañas) solo
se muestra a cuentas BIBLIOTECARIO/ADMINISTRADOR.

---

## Esquema de base de datos añadido

`database/schema.sql` (SQLite) y `backend/database/schema.postgres.sql` (Postgres):

```sql
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('USUARIO', 'BIBLIOTECARIO', 'ADMINISTRADOR')),
  created_at TEXT NOT NULL           -- TIMESTAMPTZ en Postgres
);
```

## Endpoints nuevos

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/v1/auth/register` | `{ email, password, role? }` → `{ account, token }` |
| `POST` | `/api/v1/auth/login` | `{ email, password }` → `{ account, token }` |
| `GET`  | `/api/v1/auth/me` | Header `Authorization: Bearer <token>` → payload del token o 401 |

Variable de entorno `AUTH_SECRET` (secreto para firmar tokens). Si no está
definida se usa un valor por defecto solo apto para desarrollo.

## Desplegado en producción

| Componente | URL |
|------------|-----|
| Frontend (Cloudflare Workers) | https://biblioteca-central.readuls.workers.dev |
| Backend (Google Cloud Run) | https://biblioteca-backend-438047115829.us-central1.run.app |

La tabla `accounts` se crea sola al arrancar el backend (Supabase Postgres).
La primera cuenta registrada queda como ADMINISTRADOR.

## Cómo probar

```bash
cd backend
npm test          # pruebas de calculateFine y verifyToken/verifyPassword

# demo manual del login (servidor local con SQLite)
npm run dev
# 1) registrar (la 1ª cuenta -> ADMINISTRADOR); guarda el "token" de la respuesta
curl -XPOST localhost:3000/api/v1/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"admin@lib.com","password":"secret1"}'
# 2) llamar a un endpoint protegido con el token
curl localhost:3000/api/v1/books -H "Authorization: Bearer <TOKEN>"
# sin token -> 401 ; con rol insuficiente -> 403
```

En el frontend hay una tarjeta **"Iniciar sesión"** arriba de las pestañas con
formularios de login y registro; la sesión se guarda en `localStorage` y el
panel de gestión aparece solo para BIBLIOTECARIO/ADMINISTRADOR.

---

## Resumen

| # | Función | Archivo | Stateless / Stateful | Estado |
|---|---------|---------|----------------------|--------|
| 1 | `calculateFine()` | `backend/src/domain/services/LoanService.ts` | **Stateless** | Nueva |
| 2 | `verifyToken()` | `backend/src/domain/services/authTokens.ts` | **Stateless** | Nueva |
| 3 | `LoanService.createLoan()` | `backend/src/domain/services/LoanService.ts` | **Stateful** | Existente |
| 4 | `AuthService.register()` / `login()` | `backend/src/domain/services/AuthService.ts` | **Stateful** | Nueva |
