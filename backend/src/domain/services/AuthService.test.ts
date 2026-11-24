import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "crypto";
import { AuthService } from "./AuthService";
import { IAccountRepository } from "../interfaces/IAccountRepository";
import { Account, LoginMethod } from "../entities/Account";
import { GoogleVerifier } from "./googleIdToken";

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

  logins: { id: string; method: LoginMethod }[] = [];
  async recordLogin(id: string, method: LoginMethod): Promise<void> {
    this.logins.push({ id, method });
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

// Verificador falso: solo el token "valido" corresponde a un email verificado.
const fakeGoogle: GoogleVerifier = async (token) =>
  token.startsWith("valido:") ? { email: token.slice(7), sub: "g-1" } : null;

test("loginWithGoogle: crea USUARIO, reutiliza cuenta existente con su rol y guarda el último método", async () => {
  const repo = new FakeAccountRepository();
  const service = new AuthService(repo, "test-secret", fakeGoogle);
  await service.register("admin@example.com", "secret1"); // primera = admin

  const nuevo = await service.loginWithGoogle("valido:nuevo@gmail.com");
  assert.equal(nuevo.account.role, "USUARIO");
  assert.equal(nuevo.account.lastLoginMethod, "google");
  assert.ok(nuevo.token.split(".").length === 3); // mismo JWT HS256

  const admin = await service.loginWithGoogle("valido:admin@example.com");
  assert.equal(admin.account.role, "ADMINISTRADOR"); // misma cuenta, no una nueva
  assert.equal(await repo.countAll(), 2);
  assert.deepEqual(repo.logins.map((l) => l.method), ["password", "google", "google"]);

  // La cuenta creada con Google no tiene contraseña: no se puede entrar con una vacía.
  await assert.rejects(service.login("nuevo@gmail.com", ""), /AUTH_INVALID_CREDENTIALS/);
});

test("loginWithGoogle: rechaza tokens inválidos y falla claro si no está configurado", async () => {
  const withGoogle = new AuthService(new FakeAccountRepository(), "s", fakeGoogle);
  await assert.rejects(withGoogle.loginWithGoogle("falso"), /AUTH_GOOGLE_INVALID/);
  const without = new AuthService(new FakeAccountRepository(), "s");
  await assert.rejects(without.loginWithGoogle("valido:x@gmail.com"), /AUTH_GOOGLE_DISABLED/);
});
