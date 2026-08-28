export interface Debt {
  id: string;
  userId: string;
  loanId: string;
  amount: number;
  createdAt: Date;
  paid: boolean;
  paidAt: Date | null;
}
