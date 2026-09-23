import { test } from "node:test";
import assert from "node:assert/strict";
import { SettingsService } from "./SettingsService";
import { ISettingsRepository } from "../interfaces/ISettingsRepository";
import { Settings, DEFAULT_SETTINGS } from "../entities/Settings";
import { BusinessError } from "../errors/BusinessError";

class FakeSettingsRepository implements ISettingsRepository {
  private settings: Settings = { ...DEFAULT_SETTINGS };

  async get(): Promise<Settings> {
    return this.settings;
  }

  async update(settings: Settings): Promise<Settings> {
    this.settings = settings;
    return settings;
  }
}

test("updateSettings: aplica el patch sobre lo existente y lo guarda", async () => {
  const service = new SettingsService(new FakeSettingsRepository());
  const updated = await service.updateSettings({ hourlyLateFeeRate: 8 });
  assert.equal(updated.hourlyLateFeeRate, 8);
  assert.equal(updated.debtMultiplier, DEFAULT_SETTINGS.debtMultiplier); // el resto no cambió

  assert.equal((await service.getSettings()).hourlyLateFeeRate, 8);
});

test("updateSettings: rechaza valores fuera de rango", async () => {
  const service = new SettingsService(new FakeSettingsRepository());
  await assert.rejects(() => service.updateSettings({ hourlyLateFeeRate: -1 }), BusinessError);
  await assert.rejects(() => service.updateSettings({ debtMultiplier: 0 }), BusinessError);
  await assert.rejects(() => service.updateSettings({ maxActiveLoans: 0 }), BusinessError);
  await assert.rejects(() => service.updateSettings({ maxActiveLoans: 2.5 }), BusinessError);
  await assert.rejects(() => service.updateSettings({ loanPeriodDays: 0 }), BusinessError);
});
