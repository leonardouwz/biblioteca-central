import { Pool } from "pg";
import { ISettingsRepository } from "../../domain/interfaces/ISettingsRepository";
import { Settings, DEFAULT_SETTINGS } from "../../domain/entities/Settings";

interface SettingsRow {
  hourly_late_fee_rate: number;
  debt_multiplier: number;
  max_active_loans: number;
  loan_period_days: number;
}

const toSettings = (row: SettingsRow): Settings => ({
  hourlyLateFeeRate: Number(row.hourly_late_fee_rate),
  debtMultiplier: Number(row.debt_multiplier),
  maxActiveLoans: row.max_active_loans,
  loanPeriodDays: row.loan_period_days,
});

/** Fila única (id fijo 'default'), sembrada por el schema. */
export class PostgresSettingsRepository implements ISettingsRepository {
  constructor(private readonly pool: Pool) {}

  async get(): Promise<Settings> {
    const { rows } = await this.pool.query<SettingsRow>("SELECT * FROM settings WHERE id = 'default'");
    return rows[0] ? toSettings(rows[0]) : DEFAULT_SETTINGS;
  }

  async update(settings: Settings): Promise<Settings> {
    await this.pool.query(
      "UPDATE settings SET hourly_late_fee_rate = $1, debt_multiplier = $2, max_active_loans = $3, loan_period_days = $4 WHERE id = 'default'",
      [settings.hourlyLateFeeRate, settings.debtMultiplier, settings.maxActiveLoans, settings.loanPeriodDays]
    );
    return settings;
  }
}
