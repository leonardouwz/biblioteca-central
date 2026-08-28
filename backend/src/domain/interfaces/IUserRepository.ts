import { User } from "../entities/User";

export interface IUserRepository {
  findAll(): Promise<User[]>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(user: Omit<User, "id">): Promise<User>;
  update(id: string, user: Omit<User, "id">): Promise<User | null>;
  setStatus(id: string, status: User["status"]): Promise<User | null>;
  delete(id: string): Promise<boolean>;
}
