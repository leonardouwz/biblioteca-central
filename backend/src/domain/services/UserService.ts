import { IUserRepository } from "../interfaces/IUserRepository";
import { IDebtRepository } from "../interfaces/IDebtRepository";
import { User } from "../entities/User";
import { Debt } from "../entities/Debt";
import { BusinessError } from "../errors/BusinessError";
import { LoanService, LoanWithBookTitle } from "./LoanService";

export class UserService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly loanService: LoanService,
    private readonly debtRepository: IDebtRepository
  ) {}

  async getAllUsers(): Promise<User[]> {
    return this.userRepository.findAll();
  }

  async getUserById(id: string): Promise<User> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new BusinessError("El usuario no existe.");
    }
    return user;
  }

  async getUserLoans(id: string): Promise<LoanWithBookTitle[]> {
    await this.getUserById(id);
    return this.loanService.getLoansByUserId(id);
  }

  async getUserDebts(id: string): Promise<Debt[]> {
    await this.getUserById(id);
    return this.debtRepository.findByUserId(id);
  }

  async createUser(name: string, email: string): Promise<User> {
    await this.validate(name, email);
    return this.userRepository.create({ name, email, status: "ACTIVE" });
  }

  async updateUser(id: string, name: string, email: string): Promise<User> {
    await this.validate(name, email, id);
    const updated = await this.userRepository.update(id, {
      name,
      email,
      status: (await this.getUserById(id)).status,
    });
    if (!updated) {
      throw new BusinessError("El usuario no existe.");
    }
    return updated;
  }

  async setStatus(id: string, status: User["status"]): Promise<User> {
    const updated = await this.userRepository.setStatus(id, status);
    if (!updated) {
      throw new BusinessError("El usuario no existe.");
    }
    return updated;
  }

  async deleteUser(id: string): Promise<void> {
    const activeLoans = (await this.loanService.getLoansByUserId(id)).filter((l) => l.status === "ACTIVE");
    if (activeLoans.length > 0) {
      throw new BusinessError("No se puede eliminar un usuario con préstamos activos.");
    }
    if (await this.debtRepository.hasUnpaidByUserId(id)) {
      throw new BusinessError("No se puede eliminar un usuario con deudas impagas.");
    }
    const deleted = await this.userRepository.delete(id);
    if (!deleted) {
      throw new BusinessError("El usuario no existe.");
    }
  }

  private async validate(name: string, email: string, ignoreUserId?: string): Promise<void> {
    if (!name.trim()) {
      throw new BusinessError("El nombre es requerido.");
    }
    if (!email.trim() || !email.includes("@")) {
      throw new BusinessError("El email no es válido.");
    }
    const existing = await this.userRepository.findByEmail(email);
    if (existing && existing.id !== ignoreUserId) {
      throw new BusinessError("Ya existe un usuario con ese email.");
    }
  }
}
