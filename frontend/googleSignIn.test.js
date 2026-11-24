const { test } = require("node:test");
const assert = require("node:assert/strict");
const { getLastLogin, saveLastLogin } = require("./googleSignIn.js");

const memoryStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
};

test("último método: guarda y lee google/password con su email", () => {
  const s = memoryStorage();
  assert.equal(getLastLogin(s), null);
  saveLastLogin(s, "google", "ana@gmail.com");
  assert.deepEqual(getLastLogin(s), { method: "google", email: "ana@gmail.com" });
  saveLastLogin(s, "password", "ana@example.com");
  assert.deepEqual(getLastLogin(s), { method: "password", email: "ana@example.com" });
});

test("último método: ignora métodos desconocidos, JSON roto y storage bloqueado", () => {
  const s = memoryStorage();
  saveLastLogin(s, "facebook", "x@y.com");
  assert.equal(getLastLogin(s), null);
  s.setItem("lastLogin", "{roto");
  assert.equal(getLastLogin(s), null);
  const blocked = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  assert.equal(getLastLogin(blocked), null);
  assert.doesNotThrow(() => saveLastLogin(blocked, "google", "a@b.com"));
});
