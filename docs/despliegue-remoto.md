# Despliegue remoto (sin laptop)

Todo se despliega desde GitHub Actions al hacer merge a `main`. No hace falta tener
la laptop encendida: se trabaja en una rama, se abre un PR, se fusiona, y GitHub
prueba y despliega.

| Qué cambia | Workflow | Destino | URL |
|---|---|---|---|
| `backend/**` | `deploy-backend.yml` | Cloud Run `biblioteca-backend` | https://biblioteca-backend-438047115829.us-central1.run.app |
| `frontend/**` | `deploy-frontend.yml` | Cloudflare Worker `biblioteca-central` | https://biblioteca-central.readuls.workers.dev |
| `apps-secundarias/<nombre>/**` | `deploy-apps.yml` | Cloud Run `<nombre>` | `https://<nombre>-438047115829.us-central1.run.app` |

Cada workflow corre las pruebas (`npm test`) antes de desplegar: si fallan, no se
despliega nada. También se pueden lanzar a mano desde **Actions → (workflow) → Run workflow**,
por ejemplo para redesplegar sin cambios o desplegar una sola app secundaria.

La URL final de cada despliegue aparece en el resumen de la ejecución en Actions.

## Configuración única (una sola vez)

Todo se hace desde el navegador. Para los comandos de Google Cloud, usar
**Cloud Shell** (botón `>_` arriba a la derecha en https://console.cloud.google.com),
que corre en la nube.

### 1. Cuenta de servicio de Google Cloud → secreto `GCP_SA_KEY`

En Cloud Shell:

```bash
PROJECT=biblioteca-central-2026
gcloud iam service-accounts create github-deploy --project $PROJECT --display-name "GitHub Actions deploy"
SA=github-deploy@$PROJECT.iam.gserviceaccount.com
for ROLE in run.admin iam.serviceAccountUser cloudbuild.builds.editor storage.admin \
            artifactregistry.admin serviceusage.serviceUsageConsumer logging.viewer; do
  gcloud projects add-iam-policy-binding $PROJECT --member "serviceAccount:$SA" --role "roles/$ROLE" --condition=None -q >/dev/null
done
gcloud iam service-accounts keys create key.json --iam-account $SA
base64 -w0 key.json; echo   # copiar TODA la línea que imprime
rm key.json
```

En GitHub: **Settings → Secrets and variables → Actions → New repository secret**
- Nombre: `GCP_SA_KEY`
- Valor: la línea en base64. (Pegar el JSON directo desde la terminal suele romperse,
  porque la terminal corta la llave privada en varias líneas; el base64 no tiene ese problema.)

Los secretos de la app (`database-url` y `auth-secret`) ya están en Secret Manager y
no pasan por GitHub: el workflow solo los referencia con `--set-secrets`.

### 2. Token de Cloudflare → secretos `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`

1. https://dash.cloudflare.com/profile/api-tokens → **Create Token** → plantilla
   **Edit Cloudflare Workers** → Create. Copiar el token.
2. El **Account ID** está en el panel de Cloudflare, en **Workers & Pages** (columna derecha)
   o en la URL `dash.cloudflare.com/<account-id>/...`.
3. En GitHub, crear dos secretos de repositorio: `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`.

### 3. Base de datos (Supabase) → secreto `SUPABASE_DB_URL`

El despliegue del backend aplica `backend/database/schema.postgres.sql` en Supabase
**antes** de desplegar el código. Si el SQL falla, no se despliega nada. El esquema es
idempotente (`IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `ON CONFLICT DO NOTHING`), así que
se puede aplicar en cada despliegue.

1. Supabase → proyecto `biblioteca-central` → botón **Connect** (arriba) → **Connection string**
   → **Session pooler** (o *Transaction pooler*). Copiar la URI y reemplazar
   `[YOUR-PASSWORD]` por la contraseña de la base de datos.
   (Es el mismo valor que ya está en Secret Manager como `database-url`.)
2. En GitHub, crear el secreto de repositorio `SUPABASE_DB_URL` con esa URI.

Sin este secreto el paso se salta con un aviso, y el backend sigue aplicando el esquema
al arrancar, igual que antes.

**Cambiar la base de datos**: editar `backend/database/schema.postgres.sql` (y su par SQLite,
`database/schema.sql`) agregando sentencias que se puedan repetir sin romper, por ejemplo
`ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...`. Nunca un `DROP` o un `ALTER` destructivo
sin respaldo. Al fusionar a `main`, el workflow del backend lo aplica.

**Cambiar la contraseña de la base de datos**: actualizar el secreto `SUPABASE_DB_URL` en GitHub
y la versión de `database-url` en Secret Manager
(`gcloud secrets versions add database-url --data-file=-` en Cloud Shell, pegar la URI y Ctrl+D),
y volver a desplegar el backend desde Actions → *Deploy backend* → *Run workflow*.

### 4. (Opcional) Variable `GCP_PROJECT_ID`

Si el proyecto de Google Cloud cambia, crear en GitHub una **variable** (pestaña
*Variables*, no *Secrets*) `GCP_PROJECT_ID`. Si no existe, se usa `biblioteca-central-2026`.

## Agregar una nueva actividad del curso

1. Crear una rama y la carpeta `apps-secundarias/<nombre>/`. El nombre será el
   del servicio en Cloud Run: **solo minúsculas, números y guiones** (ej. `chat-sockets`).
2. Dentro, como mínimo:
   - `package.json` con `"start"` (y `"test"` si hay pruebas; si fallan no se despliega).
   - El servidor debe escuchar en `process.env.PORT` (Cloud Run lo inyecta).
   - `README.md` con la explicación de la actividad y el link de la demo.
   Ver `apps-secundarias/stream-objetos/` como plantilla.
3. Abrir PR → merge a `main`. El workflow detecta la carpeta nueva y la despliega.
4. Copiar la URL del resumen de Actions al `README.md` de la actividad.

Si la actividad modifica la app principal (backend o frontend), se trabaja en esas
carpetas y se despliega sola con sus workflows.

## Entregar una actividad

Para la entrega basta con:
- El link del PR o de la carpeta en GitHub (código + README con la explicación).
- El link de la demo en vivo (de la tabla de arriba o del resumen de Actions).

Cloud Run escala a cero: la primera petición tras un rato sin uso tarda unos
segundos. Abrir la demo unos minutos antes de presentarla.

## Si un despliegue falla

Actions → la ejecución en rojo → el paso que falló muestra el error. Lo más común:
- **Pruebas**: arreglar en una rama y volver a fusionar.
- **Permisos / `GCP_SA_KEY`**: revisar el paso 1 de la configuración.
- **Cloudflare 10000 / authentication error**: el token no tiene permiso de Workers (paso 2).
