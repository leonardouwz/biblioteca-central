/** Parámetros de la política de préstamos, editables por un administrador. */
export interface Settings {
  /** Soles por hora de atraso (antes era una tarifa fija por día). */
  hourlyLateFeeRate: number;
  /** Multiplicador aplicado sobre horas × tarifa; 1 = sin recargo extra. */
  debtMultiplier: number;
  /** Préstamos activos simultáneos permitidos por usuario. */
  maxActiveLoans: number;
  /** Días de plazo de un préstamo nuevo. */
  loanPeriodDays: number;
}

/** Usados si la fila de configuración no existiera todavía (no debería pasar: el schema la siembra). */
export const DEFAULT_SETTINGS: Settings = {
  hourlyLateFeeRate: 5,
  debtMultiplier: 1,
  maxActiveLoans: 3,
  loanPeriodDays: 14,
};
