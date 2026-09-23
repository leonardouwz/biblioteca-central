import { ISettingsRepository } from "../interfaces/ISettingsRepository";
import { Settings } from "../entities/Settings";
import { BusinessError } from "../errors/BusinessError";

export class SettingsService {
  constructor(private readonly settingsRepository: ISettingsRepository) {}

  async getSettings(): Promise<Settings> {
    return this.settingsRepository.get();
  }

  /**
   * FUNCIÓN STATEFUL: lee la fila actual, aplica el patch, valida y ESCRIBE.
   * Solo ADMINISTRADOR puede llamarla (ver settingsRoutes.ts).
   */
  async updateSettings(patch: Partial<Settings>): Promise<Settings> {
    const current = await this.settingsRepository.get();
    const next: Settings = { ...current, ...patch };
    this.validate(next);
    return this.settingsRepository.update(next);
  }

  private validate(settings: Settings): void {
    const { hourlyLateFeeRate, debtMultiplier, maxActiveLoans, loanPeriodDays } = settings;
    const valid =
      Number.isFinite(hourlyLateFeeRate) &&
      hourlyLateFeeRate >= 0 &&
      Number.isFinite(debtMultiplier) &&
      debtMultiplier > 0 &&
      Number.isInteger(maxActiveLoans) &&
      maxActiveLoans >= 1 &&
      Number.isInteger(loanPeriodDays) &&
      loanPeriodDays >= 1;
    if (!valid) {
      throw new BusinessError("SETTINGS_INVALID");
    }
  }
}
