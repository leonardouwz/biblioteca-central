/**
 * Extrae los nombres de placeholder `{nombre}` de una entrada de catálogo
 * (string plano, `{text}` de traducción automática, o `{one,other}` plural).
 * Sirve para la prueba de localización: cada traducción debe usar EXACTAMENTE
 * los mismos placeholders que el texto base, o `t()` los deja sin sustituir
 * en tiempo de ejecución (bug real detectado en la corrida de i18n-translate
 * contra Google Translate: tradujo `{email}` a `{البريد الإلكتروني}`).
 */
export function placeholdersOf(entry: unknown): Set<string> {
  const texts: string[] = [];
  if (typeof entry === "string") {
    texts.push(entry);
  } else if (entry && typeof entry === "object") {
    for (const value of Object.values(entry as Record<string, unknown>)) {
      if (typeof value === "string") texts.push(value);
    }
  }

  const names = new Set<string>();
  for (const text of texts) {
    for (const match of text.matchAll(/\{(\w+)\}/g)) {
      names.add(match[1]);
    }
  }
  return names;
}

function sameSet(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && [...a].every((x) => b.has(x));
}

/** Compara los placeholders de dos catálogos completos; devuelve las claves donde difieren. */
export function placeholderMismatches(
  base: Record<string, unknown>,
  target: Record<string, unknown>
): string[] {
  const mismatches: string[] = [];
  for (const key of Object.keys(base)) {
    if (!(key in target)) continue; // la completitud de claves ya se chequea aparte
    if (!sameSet(placeholdersOf(base[key]), placeholdersOf(target[key]))) {
      mismatches.push(key);
    }
  }
  return mismatches;
}
