# Inicio de sesión con Google + "último usado"

## Cómo funciona

1. El frontend (`frontend/googleSignIn.js`) pide `GET /api/v1/auth/config`. Si hay
   `googleClientId`, carga Google Identity Services y dibuja "Continuar con Google".
2. Google devuelve un **ID token** (JWT RS256 firmado por Google) al navegador.
3. El frontend lo manda a `POST /api/v1/auth/google { credential }`.
4. El backend (`googleIdToken.ts`) lo valida con Google (`tokeninfo`) y además exige
   `aud` = nuestro client ID, `iss` de Google, no expirado y `email_verified`.
   **Nunca** se confía en el email que manda el navegador.
5. `AuthService.loginWithGoogle`: si ya existe una cuenta con ese email entra a esa
   (conserva su rol); si no, crea una cuenta `USUARIO` sin contraseña. Responde
   `{ account, token }` con **el mismo JWT HS256** del login con contraseña, así que
   el resto de la API no cambia.

## Último inicio de sesión

- **Servidor:** `accounts.last_login_at` y `accounts.last_login_method` (`password` | `google`)
  se actualizan en cada login y vuelven en `account.lastLoginAt / lastLoginMethod`.
- **Navegador:** `GoogleSignIn.saveLastLogin(localStorage, método, email)` guarda el último
  método; en la próxima visita se muestra la marca **"Último usado"** junto a ese botón
  (como en Cloudflare) y Google sugiere esa cuenta (`login_hint`).

## Configuración (una sola vez)

1. Google Cloud Console → proyecto `biblioteca-central-2026` → **APIs y servicios →
   Pantalla de consentimiento OAuth**: tipo *Externo*, nombre "Biblioteca Central",
   tu correo de soporte. Scopes: los básicos (`email`, `profile`, `openid`).
   Mientras esté en modo *Prueba*, agrega como *usuarios de prueba* las cuentas que van a entrar.
2. **Credenciales → Crear credenciales → ID de cliente de OAuth → Aplicación web.**
   - *Orígenes de JavaScript autorizados*: la URL del frontend en Cloudflare
     (`https://biblioteca-central.<tu-subdominio>.workers.dev`) y `http://localhost:3000`.
   - *URIs de redirección*: no hacen falta (se usa el popup de Google).
3. Copia el **ID de cliente** (termina en `.apps.googleusercontent.com`; es público, no es secreto).
4. GitHub → repo → Settings → Secrets and variables → Actions → pestaña **Variables** →
   `New repository variable`: nombre **`GOOGLE_CLIENT_ID`**, valor = el ID de cliente.
5. Vuelve a desplegar el backend (Actions → *Deploy backend* → Run workflow). Sin la variable,
   el botón de Google simplemente no aparece.

No se necesita el *client secret* ni guardar nada en Secret Manager: el flujo de ID token
solo usa el client ID.

Local: `GOOGLE_CLIENT_ID=... npm run dev` en `backend/`.
