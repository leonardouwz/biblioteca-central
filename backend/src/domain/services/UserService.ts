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
      throw new BusinessError("USER_NOT_FOUND");
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
      throw new BusinessError("USER_NOT_FOUND");
    }
    return updated;
  }

  async setStatus(id: string, status: User["status"]): Promise<User> {
    const updated = await this.userRepository.setStatus(id, status);
    if (!updated) {
      throw new BusinessError("USER_NOT_FOUND");
    }
    return updated;
  }

  async deleteUser(id: string): Promise<void> {
    const activeLoans = (await this.loanService.getLoansByUserId(id)).filter((l) => l.status === "ACTIVE");
    if (activeLoans.length > 0) {
      throw new BusinessError("USER_HAS_ACTIVE_LOANS");
    }
    if (await this.debtRepository.hasUnpaidByUserId(id)) {
      throw new BusinessError("USER_DELETE_HAS_UNPAID_DEBT");
    }
    const deleted = await this.userRepository.delete(id);
    if (!deleted) {
      throw new BusinessError("USER_NOT_FOUND");
    }
  }

  private async validate(name: string, email: string, ignoreUserId?: string): Promise<void> {
    if (!name.trim()) {
      throw new BusinessError("USER_NAME_REQUIRED");
    }
    if (!email.trim() || !email.includes("@")) {
      throw new BusinessError("EMAIL_INVALID");
    }
    const existing = await this.userRepository.findByEmail(email);
    if (existing && existing.id !== ignoreUserId) {
      throw new BusinessError("USER_EMAIL_TAKEN");
    }
  }
}
