export type LoanStatus = "ACTIVE" | "RETURNED";

export interface Loan {
  id: string;
  userId: string;
  bookCopyId: string;
  loanDate: Date;
  dueDate: Date;
  returnDate: Date | null;
  status: LoanStatus;
}
