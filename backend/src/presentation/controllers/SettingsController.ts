import { Request, Response } from "express";
import { SettingsService } from "../../domain/services/SettingsService";
import { Settings } from "../../domain/entities/Settings";
import { handleBusinessError, badRequest } from "./handleBusinessError";

export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  get = async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json(await this.settingsService.getSettings());
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { hourlyLateFeeRate, debtMultiplier, maxActiveLoans, loanPeriodDays } = req.body as Partial<Settings>;

    if (
      typeof hourlyLateFeeRate !== "number" ||
      typeof debtMultiplier !== "number" ||
      typeof maxActiveLoans !== "number" ||
      typeof loanPeriodDays !== "number"
    ) {
      badRequest(res, req.locale, "BODY_SETTINGS_INVALID");
      return;
    }

    try {
      res
        .status(200)
        .json(await this.settingsService.updateSettings({ hourlyLateFeeRate, debtMultiplier, maxActiveLoans, loanPeriodDays }));
    } catch (error) {
      handleBusinessError(res, error, req.locale);
    }
  };
}
