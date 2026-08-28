# Biblioteca N-Capas

Sistema de Gestión de Préstamos de Biblioteca. Arquitectura N-Capas (Presentación / Dominio / Infraestructura) en Node.js + TypeScript, organizada en 3 módulos desplegables por separado.

```
biblioteca-n-capas/
  backend/     API Express + TS (presentation / domain / infrastructure)
               backend/database/schema.postgres.sql viaja con el módulo (deploy autocontenido)
  frontend/    HTML/CSS/JS estático, sin framework ni build (wrangler.jsonc para Cloudflare Workers)
  database/    Esquema SQL (SQLite) + archivo de datos, solo para desarrollo local
```

## Ejecutar en local

```bash
cd backend
npm install
npm run dev
```

Abrir `http://localhost:3000` (el backend sirve el frontend estático y expone la API en `/api/v1`). Sin `DATABASE_URL` configurada, usa SQLite local automáticamente — no hace falta Supabase para desarrollar.

La base de datos SQLite se crea sola en `database/biblioteca.sqlite` la primera vez que arranca el backend, aplicando `database/schema.sql`.

## Arquitectura de despliegue (producción)

```
Cloudflare Workers (frontend estático)
        │  fetch('https://biblioteca-backend-....run.app/api/v1/...')
        ▼
Google Cloud Run (backend Express)
        │  DATABASE_URL (Secret Manager)
        ▼
Supabase (Postgres, vía pooler Supavisor)
```

- **Frontend** — https://biblioteca-central.readuls.workers.dev
  Desplegado como Worker de assets estáticos (sin build, `frontend/wrangler.jsonc`). `frontend/index.html` apunta al backend vía la constante `API_BASE_URL` (buscarla si el backend cambia de URL).
  Redeploy: `cd frontend && npx wrangler deploy`

- **Backend** — https://biblioteca-backend-438047115829.us-central1.run.app
  Desplegado en Cloud Run directo desde el código fuente (Google Buildpacks, sin Dockerfile). CORS abierto (`cors()` sin restricción de origen — no hay autenticación en la API). El módulo es autocontenido: `backend/database/schema.postgres.sql` viaja dentro de `backend/` para que el deploy funcione sin las carpetas hermanas.
  Redeploy: `gcloud run deploy biblioteca-backend --source backend --region us-central1 --project biblioteca-central-2026 --allow-unauthenticated --set-secrets=DATABASE_URL=database-url:latest`

- **Base de datos** — proyecto Supabase `biblioteca-central` (Postgres 17). La connection string vive en Secret Manager (`database-url` en el proyecto GCP), nunca en el código. Esquema en `backend/database/schema.postgres.sql`.

Al arrancar, el backend elige automáticamente: si existe `DATABASE_URL` usa Postgres (`Postgres*Repository`), si no, SQLite local (`Sqlite*Repository`) — mismo patrón Repository detrás de las mismas interfaces (`IBookRepository`, `IUserRepository`, `ILoanRepository`, `IDebtRepository`), gracias a la Inversión de Dependencias.

**Nota sobre el plan gratuito de Cloud Run**: la primera petición tras un rato de inactividad puede tardar unos segundos (cold start). Para la presentación, abrí el link unos minutos antes.

## Modelo de negocio

- **Book** (título) + **BookCopy** (ejemplar físico con código único). Un título puede tener varias copias; agregar stock crea copias nuevas.
- **User**: `ACTIVE` / `INACTIVE`. Un usuario inactivo no puede pedir préstamos nuevos.
- **Loan**: préstamo por 14 días. Se puede devolver antes del plazo.
- **Debt**: se genera automáticamente al devolver un préstamo fuera de plazo (días de atraso × tarifa diaria). Un usuario con deudas impagas no puede pedir préstamos nuevos hasta pagarlas.

Reglas completas en `backend/src/domain/services/`.

## Endpoints principales

```
GET    /api/v1/books
POST   /api/v1/books              { title, author, initialCopies }
PUT    /api/v1/books/:id          { title, author }
POST   /api/v1/books/:id/stock    { quantity }
DELETE /api/v1/books/:id

GET    /api/v1/users
GET    /api/v1/users/:id/loans
GET    /api/v1/users/:id/debts
POST   /api/v1/users              { name, email }
PUT    /api/v1/users/:id          { name, email }
PUT    /api/v1/users/:id/status   { status: "ACTIVE" | "INACTIVE" }
DELETE /api/v1/users/:id

GET    /api/v1/loans              (?overdue=true)
POST   /api/v1/loans              { userId, bookId }
POST   /api/v1/loans/:id/return

GET    /api/v1/debts
POST   /api/v1/debts/:id/pay
```

## Fuera de alcance (por ahora)

Login/roles de usuario, notificaciones, pagos online, categorías de libros. El registro de usuarios es un formulario dentro de la misma app, sin autenticación.
