import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "crypto";
import { AuthService } from "./AuthService";
import { IAccountRepository } from "../interfaces/IAccountRepository";
import { Account } from "../entities/Account";

/** Repo en memoria — suficiente para probar las reglas de `resolveRole` sin BD real. */
class FakeAccountRepository implements IAccountRepository {
  private readonly accounts: Account[] = [];

  async findByEmail(email: string): Promise<Account | null> {
    return this.accounts.find((a) => a.email === email) ?? null;
  }

  async countAll(): Promise<number> {
    return this.accounts.length;
  }

  async create(account: Omit<Account, "id">): Promise<Account> {
    const created = { id: randomUUID(), ...account };
    this.accounts.push(created);
    return created;
  }
}

// Regresión de seguridad: antes, `register(email, password, "ADMINISTRADOR")`
// le daba rol ADMINISTRADOR a cualquier visitante anónimo que lo pidiera.
test("register: nadie puede autoasignarse ADMINISTRADOR pidiéndolo, salvo la primera cuenta", async () => {
  const service = new AuthService(new FakeAccountRepository(), "test-secret");

  const first = await service.register("primera@example.com", "secret1");
  assert.equal(first.account.role, "ADMINISTRADOR"); // bootstrap: la primera cuenta sí es admin

  const attacker = await service.register("atacante@example.com", "secret1", "ADMINISTRADOR");
  assert.equal(attacker.account.role, "USUARIO"); // el rol pedido se ignora

  const librarian = await service.register("bibliotecario@example.com", "secret1", "BIBLIOTECARIO");
  assert.equal(librarian.account.role, "BIBLIOTECARIO"); // este sí sigue permitido
});
