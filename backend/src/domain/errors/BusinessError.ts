/**
 * Error de dominio identificado por un CÓDIGO (no por un mensaje fijo), para
 * que la capa de presentación pueda: (a) decidir el status HTTP por código,
 * no por comparar texto traducible, y (b) traducir el mensaje al locale del
 * request con `t(code, locale, params)` (ver `../i18n/t.ts`).
 */
export class BusinessError extends Error {
  constructor(
    public readonly code: string,
    public readonly params?: Record<string, string | number>
  ) {
    super(code);
    this.name = "BusinessError";
  }
}
