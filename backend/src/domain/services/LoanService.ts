import { ILoanRepository } from "../interfaces/ILoanRepository";
import { IBookRepository } from "../interfaces/IBookRepository";
import { IUserRepository } from "../interfaces/IUserRepository";
import { IDebtRepository } from "../interfaces/IDebtRepository";
import { ISettingsRepository } from "../interfaces/ISettingsRepository";
import { Loan } from "../entities/Loan";
import { Settings } from "../entities/Settings";
import { BusinessError } from "../errors/BusinessError";

export interface LoanWithBookTitle extends Loan {
  /** `null` si el libro fue eliminado; el frontend decide cómo mostrarlo (i18n). */
  bookTitle: string | null;
  /**
   * Multa que se generaría SI se devolviera ahora mismo. Puramente
   * informativo: no crea ninguna deuda, solo se muestra en la UI para que
   * el atraso no sea una sorpresa recién al devolver. `null` si el
   * préstamo no está vencido o ya fue devuelto.
   */
  provisionalFine: number | null;
}

/**
 * Función STATELESS (pura): mismo input -> mismo output, sin leer ni
 * escribir estado externo (BD, disco, red). Calcula la multa por atraso
 * en soles, por hora (la fracción de hora se redondea hacia arriba) y con
 * un multiplicador configurable — ambos vienen de `Settings`, que el
 * caller (el servicio) lee antes de invocar esta función; la función en sí
 * no sabe nada de configuración persistida.
 */
export function calculateFine(dueDate: Date, asOfDate: Date, hourlyRate: number, multiplier: number): number {
  if (asOfDate <= dueDate) return 0;
  const hoursLate = Math.ceil((asOfDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60));
  return Math.round(hoursLate * hourlyRate * multiplier);
}

export class LoanService {
  constructor(
    private readonly loanRepository: ILoanRepository,
    private readonly bookRepository: IBookRepository,
    private readonly userRepository: IUserRepository,
    private readonly debtRepository: IDebtRepository,
    private readonly settingsRepository: ISettingsRepository
  ) {}

  async getAllLoans(overdueOnly = false): Promise<LoanWithBookTitle[]> {
    const [loans, settings] = await Promise.all([this.loanRepository.findAll(), this.settingsRepository.get()]);
    const filtered = overdueOnly ? loans.filter((l) => this.isOverdue(l)) : loans;
    return Promise.all(filtered.map((loan) => this.withBookTitle(loan, settings)));
  }

  async getLoansByUserId(userId: string): Promise<LoanWithBookTitle[]> {
    const [loans, settings] = await Promise.all([
      this.loanRepository.findByUserId(userId),
      this.settingsRepository.get(),
    ]);
    return Promise.all(loans.map((loan) => this.withBookTitle(loan, settings)));
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

    const settings = await this.settingsRepository.get();
    const userLoans = await this.loanRepository.findByUserId(userId);
    const now = new Date();

    // No basta con no tener deudas: un préstamo vencido y sin devolver
    // todavía no genera deuda (eso pasa recién al devolverlo), pero de
    // todas formas bloquea préstamos nuevos.
    if (userLoans.some((l) => l.status === "ACTIVE" && l.dueDate.getTime() < now.getTime())) {
      throw new BusinessError("USER_HAS_OVERDUE_LOAN");
    }

    const activeLoans = userLoans.filter((l) => l.status === "ACTIVE").length;
    if (activeLoans >= settings.maxActiveLoans) {
      throw new BusinessError("LOAN_MAX_ACTIVE", { max: settings.maxActiveLoans, count: settings.maxActiveLoans });
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

    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + settings.loanPeriodDays);

    return this.loanRepository.create({
      userId,
      bookCopyId: availableCopy.id,
      loanDate: now,
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

    const settings = await this.settingsRepository.get();
    const returnDate = new Date();
    await this.bookRepository.setCopyStatus(loan.bookCopyId, "AVAILABLE");
    const updated = await this.loanRepository.markReturned(loanId, returnDate);
    if (!updated) {
      throw new BusinessError("LOAN_NOT_FOUND");
    }

    const fineAmount = calculateFine(loan.dueDate, returnDate, settings.hourlyLateFeeRate, settings.debtMultiplier);
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

  private async withBookTitle(loan: Loan, settings: Settings): Promise<LoanWithBookTitle> {
    const copy = await this.bookRepository.findCopyById(loan.bookCopyId);
    const book = copy ? await this.bookRepository.findById(copy.bookId) : null;
    const provisionalFine = this.isOverdue(loan)
      ? calculateFine(loan.dueDate, new Date(), settings.hourlyLateFeeRate, settings.debtMultiplier)
      : null;
    return { ...loan, bookTitle: book?.title ?? null, provisionalFine };
  }
}
