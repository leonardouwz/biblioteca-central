# Biblioteca N-Capas

Sistema de Gestión de Préstamos de Biblioteca. Arquitectura N-Capas (Presentación / Dominio / Infraestructura) en Node.js + TypeScript, organizada en 3 módulos desplegables por separado.

```
biblioteca-n-capas/
  backend/     API Express + TS (presentation / domain / infrastructure)
  frontend/    HTML/CSS/JS estático, sin framework ni build
  database/    Esquema SQL + archivo de datos SQLite
```

## Ejecutar en local

```bash
cd backend
npm install
npm run dev
```

Abrir `http://localhost:3000` (el backend sirve el frontend estático y expone la API en `/api/v1`).

La base de datos SQLite se crea sola en `database/biblioteca.sqlite` la primera vez que arranca el backend, aplicando `database/schema.sql`.

## Despliegue por módulos

Cada carpeta se puede desplegar de forma independiente:

- **backend/**: cualquier host Node (Railway, Render, VPS, etc.). Variables de entorno:
  - `PORT` (default `3000`)
  - `DATABASE_PATH` (default `../database/biblioteca.sqlite`) — apuntar a un volumen persistente en producción.
  - `SCHEMA_PATH` (default `../database/schema.sql`)
- **frontend/**: es HTML/CSS/JS puro, se puede servir desde cualquier hosting estático (Netlify, Vercel, S3, nginx) o dejar que el propio backend lo sirva (comportamiento actual). Si se separa a otro dominio, hay que editar las URLs `fetch('/api/v1/...')` para apuntar a la URL pública del backend.
- **database/**: `schema.sql` es la fuente de verdad del esquema; `biblioteca.sqlite` es el archivo de datos. Para producción con múltiples instancias del backend, reemplazar SQLite por un servidor de base de datos aparte (Postgres, etc.) implementando las mismas interfaces de repositorio (`IBookRepository`, `IUserRepository`, `ILoanRepository`, `IDebtRepository`) — el resto de la app no cambia gracias a la Inversión de Dependencias.

## Despliegue en Render (link público)

1. Subir el repo a GitHub.
2. En [Render](https://render.com) → **New → Web Service** → conectar el repo.
3. Configurar:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Environment**: Node (Render detecta la versión vía `engines` en `backend/package.json`, ya fijada en `>=22.5.0` porque el proyecto usa el módulo nativo `node:sqlite`)
   - No hace falta configurar variables de entorno: Render inyecta `PORT` solo, y `DATABASE_PATH`/`SCHEMA_PATH` resuelven solos relativo al repo.
4. Deploy. La URL pública sirve tanto la API como el frontend.

**Importante — plan gratuito de Render:**
- El servicio "duerme" tras ~15 min sin tráfico y tarda ~30-50s en responder la primera vez que alguien entra después de eso. Antes de presentar, abrí el link vos mismo unos minutos antes para "despertarlo".
- El disco es efímero: si Render reinicia o redepliega el servicio, `database/biblioteca.sqlite` vuelve a crearse vacío (se recrea solo desde `schema.sql`). Para una demo esto es aceptable; si más adelante querés que los datos persistan entre reinicios, hay que agregar un disco persistente en el plan pago de Render y apuntar `DATABASE_PATH` ahí.

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
