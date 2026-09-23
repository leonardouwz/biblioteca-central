import { DatabaseSync } from "node:sqlite";
import { ISettingsRepository } from "../../domain/interfaces/ISettingsRepository";
import { Settings, DEFAULT_SETTINGS } from "../../domain/entities/Settings";

interface SettingsRow {
  hourly_late_fee_rate: number;
  debt_multiplier: number;
  max_active_loans: number;
  loan_period_days: number;
}

const toSettings = (row: SettingsRow): Settings => ({
  hourlyLateFeeRate: row.hourly_late_fee_rate,
  debtMultiplier: row.debt_multiplier,
  maxActiveLoans: row.max_active_loans,
  loanPeriodDays: row.loan_period_days,
});

/** Fila única (id fijo 'default'), sembrada por el schema. */
export class SqliteSettingsRepository implements ISettingsRepository {
  constructor(private readonly db: DatabaseSync) {}

  async get(): Promise<Settings> {
    const row = this.db.prepare("SELECT * FROM settings WHERE id = 'default'").get() as unknown as
      | SettingsRow
      | undefined;
    return row ? toSettings(row) : DEFAULT_SETTINGS;
  }

  async update(settings: Settings): Promise<Settings> {
    this.db
      .prepare(
        "UPDATE settings SET hourly_late_fee_rate = ?, debt_multiplier = ?, max_active_loans = ?, loan_period_days = ? WHERE id = 'default'"
      )
      .run(settings.hourlyLateFeeRate, settings.debtMultiplier, settings.maxActiveLoans, settings.loanPeriodDays);
    return settings;
  }
}
