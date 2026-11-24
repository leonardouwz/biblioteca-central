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

test("signToken: genera un JWT HS256 estándar (header.payload.firma)", () => {
  const token = signToken("acc-1", "USUARIO", SECRET, 10_000);
  const [head, body, sig] = token.split(".");
  assert.ok(sig);
  assert.deepEqual(JSON.parse(Buffer.from(head, "base64url").toString()), { alg: "HS256", typ: "JWT" });
  const claims = JSON.parse(Buffer.from(body, "base64url").toString());
  assert.equal(claims.iat, 10);
  assert.equal(claims.exp, 10 + 8 * 3600);
});

test("verifyToken: rechaza cabecera alterada (p. ej. alg none)", () => {
  const [, body, sig] = signToken("acc-1", "ADMINISTRADOR", SECRET, 0).split(".");
  const none = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  assert.equal(verifyToken(`${none}.${body}.${sig}`, SECRET, 1_000), null);
  assert.equal(verifyToken(`${none}.${body}.`, SECRET, 1_000), null);
});

test("verifyPassword: coincide solo con la contraseña correcta", () => {
  const stored = hashPassword("clave-seg", "sal-fija");
  assert.equal(verifyPassword("clave-seg", stored), true);
  assert.equal(verifyPassword("clave-mala", stored), false);
});
