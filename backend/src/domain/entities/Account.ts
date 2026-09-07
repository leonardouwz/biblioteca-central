export type Role = "USUARIO" | "BIBLIOTECARIO" | "ADMINISTRADOR";

export const ROLES: Role[] = ["USUARIO", "BIBLIOTECARIO", "ADMINISTRADOR"];

export interface Account {
  id: string;
  email: string;
  passwordHash: string;
  role: Role;
  createdAt: Date;
}

/** Cuenta sin el hash de contraseña, para exponer en respuestas HTTP. */
export type PublicAccount = Omit<Account, "passwordHash">;

export const toPublicAccount = ({ passwordHash, ...rest }: Account): PublicAccount => rest;
