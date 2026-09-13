import { readFileSync, readdirSync } from "fs";
import path from "path";

const CODE_PATTERN = /new BusinessError\(\s*"([A-Z0-9_]+)"/g;

/** Escanea los `Service.ts` en busca de `new BusinessError("CODE")` usados de verdad. */
export function findUsedErrorCodes(servicesDir: string): string[] {
  const codes = new Set<string>();
  for (const file of readdirSync(servicesDir)) {
    if (!file.endsWith("Service.ts") || file.endsWith(".test.ts")) continue;
    const content = readFileSync(path.join(servicesDir, file), "utf8");
    for (const match of content.matchAll(CODE_PATTERN)) {
      codes.add(match[1]);
    }
  }
  return [...codes].sort();
}
