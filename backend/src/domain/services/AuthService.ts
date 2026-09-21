import { IAccountRepository } from "../interfaces/IAccountRepository";
import { Account, PublicAccount, Role, ROLES, toPublicAccount } from "../entities/Account";
import { BusinessError } from "../errors/BusinessError";
import { hashPassword, newSalt, verifyPassword, signToken } from "./authTokens";
import { isValidEmail } from "../validation/patterns";

export interface AuthResult {
  account: PublicAccount;
  token: string;
}

export class AuthService {
  constructor(
    private readonly accountRepository: IAccountRepository,
    private readonly secret: string
  ) {}

  /**
   * FUNCIÓN STATEFUL: lee y ESCRIBE la tabla `accounts`.
   * La primera cuenta creada es ADMINISTRADOR; el resto USUARIO salvo que un
   * rol válido se pida explícitamente (para poder crear bibliotecarios en la demo).
   */
  async register(email: string, password: string, requestedRole?: string): Promise<AuthResult> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      throw new BusinessError("EMAIL_INVALID");
    }
    if (password.length < 6) {
      throw new BusinessError("PASSWORD_TOO_SHORT");
    }
    if (await this.accountRepository.findByEmail(normalizedEmail)) {
      throw new BusinessError("ACCOUNT_EMAIL_TAKEN");
    }

    const isFirstAccount = (await this.accountRepository.countAll()) === 0;
    const role = this.resolveRole(requestedRole, isFirstAccount);

    const created = await this.accountRepository.create({
      email: normalizedEmail,
      passwordHash: hashPassword(password, newSalt()),
      role,
      createdAt: new Date(),
    });

    return this.buildResult(created);
  }

  /**
   * FUNCIÓN STATEFUL: LEE la tabla `accounts` para autenticar.
   * El resultado depende del estado persistido (existe la cuenta, hash guardado).
   */
  async login(email: string, password: string): Promise<AuthResult> {
    const account = await this.accountRepository.findByEmail(email.trim().toLowerCase());
    if (!account || !verifyPassword(password, account.passwordHash)) {
      throw new BusinessError("AUTH_INVALID_CREDENTIALS");
    }
    return this.buildResult(account);
  }

  private resolveRole(requested: string | undefined, isFirstAccount: boolean): Role {
    if (isFirstAccount) return "ADMINISTRADOR";
    if (requested && (ROLES as string[]).includes(requested)) return requested as Role;
    return "USUARIO";
  }

  private buildResult(account: Account): AuthResult {
    return {
      account: toPublicAccount(account),
      token: signToken(account.id, account.role, this.secret),
    };
  }
}
