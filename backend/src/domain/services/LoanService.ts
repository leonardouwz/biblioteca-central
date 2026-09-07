import { ILoanRepository } from "../interfaces/ILoanRepository";
import { IBookRepository } from "../interfaces/IBookRepository";
import { IUserRepository } from "../interfaces/IUserRepository";
import { IDebtRepository } from "../interfaces/IDebtRepository";
import { Loan } from "../entities/Loan";
import { BusinessError } from "../errors/BusinessError";

const MAX_ACTIVE_LOANS = 3;
const LOAN_PERIOD_DAYS = 14;
const DAILY_FINE_RATE = 500;

export interface LoanWithBookTitle extends Loan {
  bookTitle: string;
}

/**
 * Función STATELESS (pura): mismo input -> mismo output, sin leer ni escribir
 * estado externo (BD, disco, red). Calcula la multa por atraso en centavos.
 */
export function calculateFine(dueDate: Date, returnDate: Date, dailyRate = DAILY_FINE_RATE): number {
  if (returnDate <= dueDate) return 0;
  const daysLate = Math.ceil((returnDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
  return daysLate * dailyRate;
}

export class LoanService {
  constructor(
    private readonly loanRepository: ILoanRepository,
    private readonly bookRepository: IBookRepository,
    private readonly userRepository: IUserRepository,
    private readonly debtRepository: IDebtRepository
  ) {}

  async getAllLoans(overdueOnly = false): Promise<LoanWithBookTitle[]> {
    const loans = await this.loanRepository.findAll();
    const filtered = overdueOnly ? loans.filter((l) => this.isOverdue(l)) : loans;
    return Promise.all(filtered.map((loan) => this.withBookTitle(loan)));
  }

  async getLoansByUserId(userId: string): Promise<LoanWithBookTitle[]> {
    const loans = await this.loanRepository.findByUserId(userId);
    return Promise.all(loans.map((loan) => this.withBookTitle(loan)));
  }

  async createLoan(userId: string, bookId: string): Promise<Loan> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new BusinessError("El usuario no existe.");
    }
    if (user.status === "INACTIVE") {
      throw new BusinessError("El usuario está desactivado y no puede solicitar préstamos.");
    }

    if (await this.debtRepository.hasUnpaidByUserId(userId)) {
      throw new BusinessError("El usuario tiene deudas pendientes y no puede solicitar préstamos.");
    }

    const activeLoans = await this.loanRepository.countActiveByUserId(userId);
    if (activeLoans >= MAX_ACTIVE_LOANS) {
      throw new BusinessError(`El usuario ya tiene ${MAX_ACTIVE_LOANS} préstamos activos.`);
    }

    const book = await this.bookRepository.findById(bookId);
    if (!book) {
      throw new BusinessError("El libro no existe.");
    }

    const availableCopy = await this.bookRepository.findAvailableCopy(bookId);
    if (!availableCopy) {
      throw new BusinessError("No hay copias disponibles de este libro.");
    }

    await this.bookRepository.setCopyStatus(availableCopy.id, "LOANED");

    const loanDate = new Date();
    const dueDate = new Date(loanDate);
    dueDate.setDate(dueDate.getDate() + LOAN_PERIOD_DAYS);

    return this.loanRepository.create({
      userId,
      bookCopyId: availableCopy.id,
      loanDate,
      dueDate,
      returnDate: null,
      status: "ACTIVE",
    });
  }

  async returnLoan(loanId: string): Promise<{ loan: Loan; fineAmount: number }> {
    const loan = await this.loanRepository.findById(loanId);
    if (!loan) {
      throw new BusinessError("El préstamo no existe.");
    }
    if (loan.status === "RETURNED") {
      throw new BusinessError("Este préstamo ya fue devuelto.");
    }

    const returnDate = new Date();
    await this.bookRepository.setCopyStatus(loan.bookCopyId, "AVAILABLE");
    const updated = await this.loanRepository.markReturned(loanId, returnDate);
    if (!updated) {
      throw new BusinessError("El préstamo no existe.");
    }

    const fineAmount = calculateFine(loan.dueDate, returnDate);
    if (fineAmount > 0) {
      await this.debtRepository.create({
        userId: loan.userId,
        loanId: loan.id,
        amount: fineAmount,
        createdAt: returnDate,
        paid: false,
        paidAt: null,
      });
    }

    return { loan: updated, fineAmount };
  }

  private isOverdue(loan: Loan): boolean {
    return loan.status === "ACTIVE" && loan.dueDate.getTime() < Date.now();
  }

  private async withBookTitle(loan: Loan): Promise<LoanWithBookTitle> {
    const copy = await this.bookRepository.findCopyById(loan.bookCopyId);
    const book = copy ? await this.bookRepository.findById(copy.bookId) : null;
    return { ...loan, bookTitle: book?.title ?? "(desconocido)" };
  }
}
