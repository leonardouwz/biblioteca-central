import express from "express";
import path from "path";

import { createDatabaseConnection } from "./infrastructure/database/Database";
import { SqliteBookRepository } from "./infrastructure/repositories/SqliteBookRepository";
import { SqliteUserRepository } from "./infrastructure/repositories/SqliteUserRepository";
import { SqliteLoanRepository } from "./infrastructure/repositories/SqliteLoanRepository";
import { SqliteDebtRepository } from "./infrastructure/repositories/SqliteDebtRepository";

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

// --- Infraestructura ---
const db = createDatabaseConnection();
const bookRepository = new SqliteBookRepository(db);
const userRepository = new SqliteUserRepository(db);
const loanRepository = new SqliteLoanRepository(db);
const debtRepository = new SqliteDebtRepository(db);

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
