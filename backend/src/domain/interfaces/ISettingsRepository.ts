import { Settings } from "../entities/Settings";

export interface ISettingsRepository {
  get(): Promise<Settings>;
  update(settings: Settings): Promise<Settings>;
}
