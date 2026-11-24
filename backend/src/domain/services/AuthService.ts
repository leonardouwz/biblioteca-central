import { IAccountRepository } from "../interfaces/IAccountRepository";
import { Account, LoginMethod, PublicAccount, Role, toPublicAccount } from "../entities/Account";
import { BusinessError } from "../errors/BusinessError";
import { hashPassword, newSalt, verifyPassword, signToken } from "./authTokens";
import { isValidEmail } from "../validation/patterns";
import { GoogleVerifier } from "./googleIdToken";

export interface AuthResult {
  account: PublicAccount;
  token: string;
}

export class AuthService {
  constructor(
    private readonly accountRepository: IAccountRepository,
    private readonly secret: string,
    /** null = login con Google deshabilitado (falta GOOGLE_CLIENT_ID). */
    private readonly verifyGoogle: GoogleVerifier | null = null
  ) {}

  get googleEnabled(): boolean {
    return this.verifyGoogle !== null;
  }

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

    return this.buildResult(created, "password");
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
    return this.buildResult(account, "password");
  }

  /**
   * FUNCIÓN STATEFUL: valida el ID token con Google y LEE/ESCRIBE `accounts`.
   * Si ya existe una cuenta con ese email (verificado por Google) entra a esa
   * misma cuenta, conservando su rol; si no, la crea como USUARIO (o ADMIN si
   * es la primera). Emite el mismo JWT HS256 que el login con contraseña.
   */
  async loginWithGoogle(idToken: string): Promise<AuthResult> {
    if (!this.verifyGoogle) throw new BusinessError("AUTH_GOOGLE_DISABLED");
    const identity = await this.verifyGoogle(idToken);
    if (!identity) throw new BusinessError("AUTH_GOOGLE_INVALID");

    const existing = await this.accountRepository.findByEmail(identity.email);
    if (existing) return this.buildResult(existing, "google");

    const isFirstAccount = (await this.accountRepository.countAll()) === 0;
    const created = await this.accountRepository.create({
      email: identity.email,
      // Sin contraseña: "" nunca pasa verifyPassword (no tiene sal), así que
      // esta cuenta solo puede entrar con Google.
      passwordHash: "",
      role: isFirstAccount ? "ADMINISTRADOR" : "USUARIO",
      createdAt: new Date(),
    });
    return this.buildResult(created, "google");
  }

  private resolveRole(requested: string | undefined, isFirstAccount: boolean): Role {
    if (isFirstAccount) return "ADMINISTRADOR";
    // Autorregistro nunca puede pedir ADMINISTRADOR (evita que cualquier
    // visitante se autoasigne el rol más alto); BIBLIOTECARIO sigue
    // disponible para que el personal se pueda registrar sin invitación.
    if (requested === "BIBLIOTECARIO") return "BIBLIOTECARIO";
    return "USUARIO";
  }

  private async buildResult(account: Account, method: LoginMethod): Promise<AuthResult> {
    const now = new Date();
    await this.accountRepository.recordLogin(account.id, method, now);
    return {
      account: toPublicAccount({ ...account, lastLoginAt: now, lastLoginMethod: method }),
      token: signToken(account.id, account.role, this.secret),
    };
  }
}
