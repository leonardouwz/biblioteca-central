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
  /** `null` si el libro fue eliminado; el frontend decide cómo mostrarlo (i18n). */
  bookTitle: string | null;
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
      throw new BusinessError("USER_NOT_FOUND");
    }
    if (user.status === "INACTIVE") {
      throw new BusinessError("USER_INACTIVE");
    }

    if (await this.debtRepository.hasUnpaidByUserId(userId)) {
      throw new BusinessError("USER_HAS_UNPAID_DEBT");
    }

    const activeLoans = await this.loanRepository.countActiveByUserId(userId);
    if (activeLoans >= MAX_ACTIVE_LOANS) {
      throw new BusinessError("LOAN_MAX_ACTIVE", { max: MAX_ACTIVE_LOANS, count: MAX_ACTIVE_LOANS });
    }

    const book = await this.bookRepository.findById(bookId);
    if (!book) {
      throw new BusinessError("BOOK_NOT_FOUND");
    }

    const availableCopy = await this.bookRepository.findAvailableCopy(bookId);
    if (!availableCopy) {
      throw new BusinessError("BOOK_NO_COPIES_AVAILABLE");
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
      throw new BusinessError("LOAN_NOT_FOUND");
    }
    if (loan.status === "RETURNED") {
      throw new BusinessError("LOAN_ALREADY_RETURNED");
    }

    const returnDate = new Date();
    await this.bookRepository.setCopyStatus(loan.bookCopyId, "AVAILABLE");
    const updated = await this.loanRepository.markReturned(loanId, returnDate);
    if (!updated) {
      throw new BusinessError("LOAN_NOT_FOUND");
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
    return { ...loan, bookTitle: book?.title ?? null };
  }
}
