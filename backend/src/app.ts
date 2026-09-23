import express from "express";
import cors from "cors";
import path from "path";

import { createDatabaseConnection } from "./infrastructure/database/Database";
import { createPostgresPool } from "./infrastructure/database/PostgresDatabase";
import { SqliteBookRepository } from "./infrastructure/repositories/SqliteBookRepository";
import { SqliteUserRepository } from "./infrastructure/repositories/SqliteUserRepository";
import { SqliteLoanRepository } from "./infrastructure/repositories/SqliteLoanRepository";
import { SqliteDebtRepository } from "./infrastructure/repositories/SqliteDebtRepository";
import { PostgresBookRepository } from "./infrastructure/repositories/PostgresBookRepository";
import { PostgresUserRepository } from "./infrastructure/repositories/PostgresUserRepository";
import { PostgresLoanRepository } from "./infrastructure/repositories/PostgresLoanRepository";
import { PostgresDebtRepository } from "./infrastructure/repositories/PostgresDebtRepository";
import { SqliteAccountRepository } from "./infrastructure/repositories/SqliteAccountRepository";
import { PostgresAccountRepository } from "./infrastructure/repositories/PostgresAccountRepository";
import { SqliteSettingsRepository } from "./infrastructure/repositories/SqliteSettingsRepository";
import { PostgresSettingsRepository } from "./infrastructure/repositories/PostgresSettingsRepository";
import { IBookRepository } from "./domain/interfaces/IBookRepository";
import { IAccountRepository } from "./domain/interfaces/IAccountRepository";
import { IUserRepository } from "./domain/interfaces/IUserRepository";
import { ILoanRepository } from "./domain/interfaces/ILoanRepository";
import { IDebtRepository } from "./domain/interfaces/IDebtRepository";
import { ISettingsRepository } from "./domain/interfaces/ISettingsRepository";

import { BookService } from "./domain/services/BookService";
import { UserService } from "./domain/services/UserService";
import { LoanService } from "./domain/services/LoanService";
import { DebtService } from "./domain/services/DebtService";
import { AuthService } from "./domain/services/AuthService";
import { SettingsService } from "./domain/services/SettingsService";

import { BookController } from "./presentation/controllers/BookController";
import { UserController } from "./presentation/controllers/UserController";
import { LoanController } from "./presentation/controllers/LoanController";
import { DebtController } from "./presentation/controllers/DebtController";
import { AuthController } from "./presentation/controllers/AuthController";
import { SettingsController } from "./presentation/controllers/SettingsController";

import { createBookRoutes } from "./presentation/routes/bookRoutes";
import { createUserRoutes } from "./presentation/routes/userRoutes";
import { createLoanRoutes } from "./presentation/routes/loanRoutes";
import { createDebtRoutes } from "./presentation/routes/debtRoutes";
import { createAuthRoutes } from "./presentation/routes/authRoutes";
import { createSettingsRoutes } from "./presentation/routes/settingsRoutes";
import { resolveLocale } from "./presentation/middleware/locale";
import { t } from "./domain/i18n/t";

async function main(): Promise<void> {
  // --- Infraestructura: Postgres (Supabase) en producción si hay DATABASE_URL, SQLite local en desarrollo ---
  let bookRepository: IBookRepository;
  let userRepository: IUserRepository;
  let loanRepository: ILoanRepository;
  let debtRepository: IDebtRepository;
  let accountRepository: IAccountRepository;
  let settingsRepository: ISettingsRepository;

  if (process.env.DATABASE_URL) {
    const pool = await createPostgresPool();
    bookRepository = new PostgresBookRepository(pool);
    userRepository = new PostgresUserRepository(pool);
    loanRepository = new PostgresLoanRepository(pool);
    debtRepository = new PostgresDebtRepository(pool);
    accountRepository = new PostgresAccountRepository(pool);
    settingsRepository = new PostgresSettingsRepository(pool);
    console.log("Conectado a Postgres (Supabase).");
  } else {
    const db = createDatabaseConnection();
    bookRepository = new SqliteBookRepository(db);
    userRepository = new SqliteUserRepository(db);
    loanRepository = new SqliteLoanRepository(db);
    debtRepository = new SqliteDebtRepository(db);
    accountRepository = new SqliteAccountRepository(db);
    settingsRepository = new SqliteSettingsRepository(db);
    console.log("Conectado a SQLite local.");
  }

  const authSecret = process.env.AUTH_SECRET || "dev-secret-cambiar-en-produccion";
  if (!process.env.AUTH_SECRET) {
    // AUTH_SECRET firma los tokens de sesión: con el valor por defecto
    // (público en este repo), cualquiera puede forjar un token válido.
    console.warn(
      "⚠ AUTH_SECRET no está configurada — usando el secreto de desarrollo por defecto. " +
        "Esto es inseguro fuera de un entorno local; configura la variable de entorno en producción."
    );
  }

  // --- Dominio (Inyección manual: Repositorio -> Servicio) ---
  const bookService = new BookService(bookRepository);
  const loanService = new LoanService(loanRepository, bookRepository, userRepository, debtRepository, settingsRepository);
  const userService = new UserService(userRepository, loanService, debtRepository);
  const debtService = new DebtService(debtRepository);
  const authService = new AuthService(accountRepository, authSecret);
  const settingsService = new SettingsService(settingsRepository);

  // --- Presentación (Servicio -> Controlador) ---
  const bookController = new BookController(bookService);
  const userController = new UserController(userService);
  const loanController = new LoanController(loanService);
  const debtController = new DebtController(debtService);
  const authController = new AuthController(authService, authSecret);
  const settingsController = new SettingsController(settingsService);

  // --- Aplicación Express ---
  const app = express();
  app.disable("x-powered-by"); // no anunciar el framework/versión al mundo
  app.use(cors());
  app.use(express.json());
  app.use(resolveLocale);
  app.use(express.static(path.join(__dirname, "..", "..", "frontend")));
  app.use("/api/v1", createBookRoutes(bookController, authSecret));
  app.use("/api/v1", createUserRoutes(userController, authSecret));
  app.use("/api/v1", createLoanRoutes(loanController, authSecret));
  app.use("/api/v1", createDebtRoutes(debtController, authSecret));
  app.use("/api/v1", createAuthRoutes(authController));
  app.use("/api/v1", createSettingsRoutes(settingsController, authSecret));

  // --- Errores: todo lo que caiga hasta acá responde en el mismo formato
  // JSON {code, error} que el resto de la API, nunca la página HTML por
  // defecto de Express (que además revela detalles internos). ---
  app.use((req, res) => {
    res.status(404).json({ code: "ROUTE_NOT_FOUND", error: t("ROUTE_NOT_FOUND", req.locale) });
  });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((error: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(error);
    res.status(500).json({ code: "INTERNAL_ERROR", error: t("INTERNAL_ERROR", req.locale) });
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
  });
}

main().catch((error) => {
  console.error("Error al iniciar el servidor:", error);
  process.exit(1);
});
