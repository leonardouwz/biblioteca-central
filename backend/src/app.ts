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
import { IBookRepository } from "./domain/interfaces/IBookRepository";
import { IUserRepository } from "./domain/interfaces/IUserRepository";
import { ILoanRepository } from "./domain/interfaces/ILoanRepository";
import { IDebtRepository } from "./domain/interfaces/IDebtRepository";

import { BookService } from "./domain/services/BookService";
import { UserService } from "./domain/services/UserService";
import { LoanService } from "./domain/services/LoanService";
import { DebtService } from "./domain/services/DebtService";

import { BookController } from "./presentation/controllers/BookController";
import { UserController } from "./presentation/controllers/UserController";
import { LoanController } from "./presentation/controllers/LoanController";
import { DebtController } from "./presentation/controllers/DebtController";

import { createBookRoutes } from "./presentation/routes/bookRoutes";
import { createUserRoutes } from "./presentation/routes/userRoutes";
import { createLoanRoutes } from "./presentation/routes/loanRoutes";
import { createDebtRoutes } from "./presentation/routes/debtRoutes";

async function main(): Promise<void> {
  // --- Infraestructura: Postgres (Supabase) en producción si hay DATABASE_URL, SQLite local en desarrollo ---
  let bookRepository: IBookRepository;
  let userRepository: IUserRepository;
  let loanRepository: ILoanRepository;
  let debtRepository: IDebtRepository;

  if (process.env.DATABASE_URL) {
    const pool = await createPostgresPool();
    bookRepository = new PostgresBookRepository(pool);
    userRepository = new PostgresUserRepository(pool);
    loanRepository = new PostgresLoanRepository(pool);
    debtRepository = new PostgresDebtRepository(pool);
    console.log("Conectado a Postgres (Supabase).");
  } else {
    const db = createDatabaseConnection();
    bookRepository = new SqliteBookRepository(db);
    userRepository = new SqliteUserRepository(db);
    loanRepository = new SqliteLoanRepository(db);
    debtRepository = new SqliteDebtRepository(db);
    console.log("Conectado a SQLite local.");
  }

  // --- Dominio (Inyección manual: Repositorio -> Servicio) ---
  const bookService = new BookService(bookRepository);
  const loanService = new LoanService(loanRepository, bookRepository, userRepository, debtRepository);
  const userService = new UserService(userRepository, loanService, debtRepository);
  const debtService = new DebtService(debtRepository);

  // --- Presentación (Servicio -> Controlador) ---
  const bookController = new BookController(bookService);
  const userController = new UserController(userService);
  const loanController = new LoanController(loanService);
  const debtController = new DebtController(debtService);

  // --- Aplicación Express ---
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.join(__dirname, "..", "..", "frontend")));
  app.use("/api/v1", createBookRoutes(bookController));
  app.use("/api/v1", createUserRoutes(userController));
  app.use("/api/v1", createLoanRoutes(loanController));
  app.use("/api/v1", createDebtRoutes(debtController));

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
  });
}

main().catch((error) => {
  console.error("Error al iniciar el servidor:", error);
  process.exit(1);
});
