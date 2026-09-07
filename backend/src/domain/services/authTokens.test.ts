import { test } from "node:test";
import assert from "node:assert/strict";
import { signToken, verifyToken, hashPassword, verifyPassword } from "./authTokens";

const SECRET = "test-secret";

test("verifyToken: acepta un token recién firmado", () => {
  const token = signToken("acc-1", "ADMINISTRADOR", SECRET, 1_000);
  const payload = verifyToken(token, SECRET, 2_000);
  assert.equal(payload?.sub, "acc-1");
  assert.equal(payload?.role, "ADMINISTRADOR");
});

test("verifyToken: rechaza firma inválida y token expirado", () => {
  const token = signToken("acc-1", "USUARIO", SECRET, 0);
  assert.equal(verifyToken(token, "otro-secret", 1_000), null);
  assert.equal(verifyToken(token, SECRET, 9_999_999_999_999), null);
  assert.equal(verifyToken("basura", SECRET), null);
});

test("verifyPassword: coincide solo con la contraseña correcta", () => {
  const stored = hashPassword("clave-seg", "sal-fija");
  assert.equal(verifyPassword("clave-seg", stored), true);
  assert.equal(verifyPassword("clave-mala", stored), false);
});
