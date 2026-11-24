export type Role = "USUARIO" | "BIBLIOTECARIO" | "ADMINISTRADOR";

export const ROLES: Role[] = ["USUARIO", "BIBLIOTECARIO", "ADMINISTRADOR"];

export interface Account {
  id: string;
  email: string;
  passwordHash: string;
  role: Role;
  createdAt: Date;
  /** Último inicio de sesión y con qué método (para mostrar "último usado"). */
  lastLoginAt?: Date | null;
  lastLoginMethod?: LoginMethod | null;
}

export type LoginMethod = "password" | "google";

/** Cuenta sin el hash de contraseña, para exponer en respuestas HTTP. */
export type PublicAccount = Omit<Account, "passwordHash">;

export const toPublicAccount = ({ passwordHash, ...rest }: Account): PublicAccount => rest;
