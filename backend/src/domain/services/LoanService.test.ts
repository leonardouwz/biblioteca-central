import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "crypto";
import { calculateFine, LoanService } from "./LoanService";
import { BusinessError } from "../errors/BusinessError";
import { ILoanRepository } from "../interfaces/ILoanRepository";
import { IBookRepository } from "../interfaces/IBookRepository";
import { IUserRepository } from "../interfaces/IUserRepository";
import { IDebtRepository } from "../interfaces/IDebtRepository";
import { ISettingsRepository } from "../interfaces/ISettingsRepository";
import { Loan } from "../entities/Loan";
import { Book } from "../entities/Book";
import { BookCopy } from "../entities/BookCopy";
import { User } from "../entities/User";
import { Debt } from "../entities/Debt";
import { Settings, DEFAULT_SETTINGS } from "../entities/Settings";

// ---------- calculateFine (función pura) ----------

test("calculateFine: sin atraso => 0", () => {
  const due = new Date("2026-01-10T00:00:00Z");
  assert.equal(calculateFine(due, new Date("2026-01-10T00:00:00Z"), 5, 1), 0);
  assert.equal(calculateFine(due, new Date("2026-01-05T00:00:00Z"), 5, 1), 0);
});

test("calculateFine: cobra por hora, redondeando la fracción hacia arriba", () => {
  const due = new Date("2026-01-10T00:00:00Z");
  // 2h exactas de atraso -> 2 horas
  assert.equal(calculateFine(due, new Date("2026-01-10T02:00:00Z"), 5, 1), 10);
  // 2h01 de atraso -> redondea a 3 horas (la fracción cuenta como hora completa)
  assert.equal(calculateFine(due, new Date("2026-01-10T02:01:00Z"), 5, 1), 15);
});

test("calculateFine: aplica el multiplicador configurable", () => {
  const due = new Date("2026-01-10T00:00:00Z");
  assert.equal(calculateFine(due, new Date("2026-01-10T02:00:00Z"), 5, 2), 20);
});

// ---------- LoanService (repos en memoria) ----------

class FakeLoanRepository implements ILoanRepository {
  loans: Loan[] = [];
  async findAll() {
    return this.loans;
  }
  async findById(id: string) {
    return this.loans.find((l) => l.id === id) ?? null;
  }
  async findByUserId(userId: string) {
    return this.loans.filter((l) => l.userId === userId);
  }
  async create(loan: Omit<Loan, "id">) {
    const created = { id: randomUUID(), ...loan };
    this.loans.push(created);
    return created;
  }
  async markReturned(id: string, returnDate: Date) {
    const loan = this.loans.find((l) => l.id === id);
    if (!loan) return null;
    loan.status = "RETURNED";
    loan.returnDate = returnDate;
    return loan;
  }
}

class FakeBookRepository implements IBookRepository {
  books: Book[] = [];
  copies: BookCopy[] = [];
  async findAll() {
    return this.books;
  }
  async findById(id: string) {
    return this.books.find((b) => b.id === id) ?? null;
  }
  async create(book: Omit<Book, "id">) {
    const created = { id: randomUUID(), ...book };
    this.books.push(created);
    return created;
  }
  async update() {
    return null;
  }
  async delete() {
    return false;
  }
  async findCopiesByBookId(bookId: string) {
    return this.copies.filter((c) => c.bookId === bookId);
  }
  async findCopyById(copyId: string) {
    return this.copies.find((c) => c.id === copyId) ?? null;
  }
  async findAvailableCopy(bookId: string) {
    return this.copies.find((c) => c.bookId === bookId && c.status === "AVAILABLE") ?? null;
  }
  async addCopies(bookId: string, quantity: number) {
    const created: BookCopy[] = [];
    for (let i = 0; i < quantity; i++) {
      const copy: BookCopy = { id: randomUUID(), bookId, status: "AVAILABLE" };
      this.copies.push(copy);
      created.push(copy);
    }
    return created;
  }
  async setCopyStatus(copyId: string, status: BookCopy["status"]) {
    const copy = this.copies.find((c) => c.id === copyId);
    if (copy) copy.status = status;
  }
}

class FakeUserRepository implements IUserRepository {
  users: User[] = [];
  async findAll() {
    return this.users;
  }
  async findById(id: string) {
    return this.users.find((u) => u.id === id) ?? null;
  }
  async findByEmail(email: string) {
    return this.users.find((u) => u.email === email) ?? null;
  }
  async create(user: Omit<User, "id">) {
    const created = { id: randomUUID(), ...user };
    this.users.push(created);
    return created;
  }
  async update() {
    return null;
  }
  async setStatus() {
    return null;
  }
  async delete() {
    return false;
  }
}

class FakeDebtRepository implements IDebtRepository {
  debts: Debt[] = [];
  async findAll() {
    return this.debts;
  }
  async findByUserId(userId: string) {
    return this.debts.filter((d) => d.userId === userId);
  }
  async hasUnpaidByUserId(userId: string) {
    return this.debts.some((d) => d.userId === userId && !d.paid);
  }
  async create(debt: Omit<Debt, "id">) {
    const created = { id: randomUUID(), ...debt };
    this.debts.push(created);
    return created;
  }
  async markPaid() {
    return null;
  }
}

class FakeSettingsRepository implements ISettingsRepository {
  settings: Settings = { ...DEFAULT_SETTINGS };
  async get() {
    return this.settings;
  }
  async update(settings: Settings) {
    this.settings = settings;
    return settings;
  }
}

async function setup(settingsOverride: Partial<Settings> = {}) {
  const loanRepo = new FakeLoanRepository();
  const bookRepo = new FakeBookRepository();
  const userRepo = new FakeUserRepository();
  const debtRepo = new FakeDebtRepository();
  const settingsRepo = new FakeSettingsRepository();
  settingsRepo.settings = { ...DEFAULT_SETTINGS, ...settingsOverride };

  const service = new LoanService(loanRepo, bookRepo, userRepo, debtRepo, settingsRepo);

  const user = await userRepo.create({ name: "Ana", email: "ana@example.com", status: "ACTIVE" });
  const book = await bookRepo.create({ title: "Libro", author: "Autor" });
  await bookRepo.addCopies(book.id, 2);

  return { service, loanRepo, bookRepo, userRepo, debtRepo, settingsRepo, user, book };
}

test("createLoan: bloquea un préstamo nuevo si el usuario tiene uno vencido sin devolver (aunque no tenga deuda)", async () => {
  const { service, loanRepo, user, book } = await setup();

  // Préstamo ya vencido, creado directo en el repo (sin pasar por createLoan) para simular el escenario.
  loanRepo.loans.push({
    id: randomUUID(),
    userId: user.id,
    bookCopyId: "cualquiera",
    loanDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    dueDate: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000), // venció hace 16 días
    returnDate: null,
    status: "ACTIVE",
  });

  await assert.rejects(
    () => service.createLoan(user.id, book.id),
    (error: unknown) => error instanceof BusinessError && error.code === "USER_HAS_OVERDUE_LOAN"
  );
});

test("createLoan/returnLoan: usa maxActiveLoans y loanPeriodDays configurables", async () => {
  const { service, user, book } = await setup({ maxActiveLoans: 1, loanPeriodDays: 7 });

  const loan = await service.createLoan(user.id, book.id);
  const daysUntilDue = Math.round((loan.dueDate.getTime() - loan.loanDate.getTime()) / (1000 * 60 * 60 * 24));
  assert.equal(daysUntilDue, 7);

  await assert.rejects(
    () => service.createLoan(user.id, book.id),
    (error: unknown) => error instanceof BusinessError && error.code === "LOAN_MAX_ACTIVE"
  );
});

test("getLoansByUserId: expone provisionalFine para un préstamo vencido sin devolver, sin crear ninguna deuda", async () => {
  const { service, loanRepo, debtRepo, user, book } = await setup({ hourlyLateFeeRate: 5, debtMultiplier: 1 });
  await service.createLoan(user.id, book.id);

  // Lo "envejecemos" 3h30 pasado el vencimiento (margen para que el tiempo
  // real que tarda el test en correr no cambie a qué hora redondea el ceil).
  loanRepo.loans[0].dueDate = new Date(Date.now() - (3 * 60 + 30) * 60 * 1000);

  const [loanWithTitle] = await service.getLoansByUserId(user.id);
  assert.equal(loanWithTitle.provisionalFine, 20); // ceil(3.5h) = 4h * 5

  assert.equal(debtRepo.debts.length, 0); // solo es informativo, no genera deuda
});

test("returnLoan: al devolver tarde, genera la deuda con la tarifa/multiplicador vigentes", async () => {
  const { service, loanRepo, debtRepo, user, book } = await setup({ hourlyLateFeeRate: 10, debtMultiplier: 2 });
  const loan = await service.createLoan(user.id, book.id);
  loanRepo.loans[0].dueDate = new Date(Date.now() - (1 * 60 + 30) * 60 * 1000); // vencido hace 1h30

  const { fineAmount } = await service.returnLoan(loan.id);
  assert.equal(fineAmount, 40); // ceil(1.5h) = 2h * 10 * 2
  assert.equal(debtRepo.debts.length, 1);
  assert.equal(debtRepo.debts[0].amount, 40);
});
