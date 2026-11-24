import { test } from "node:test";
import assert from "node:assert/strict";
import { createGoogleVerifier } from "./googleIdToken";

const NOW = 1_800_000_000_000;
const good = { aud: "mi-client-id", iss: "https://accounts.google.com", exp: String(NOW / 1000 + 600), email: "Ana@Gmail.com", email_verified: "true", sub: "123" };

/** fetch falso que responde lo que diría el endpoint tokeninfo de Google. */
const fakeFetch = (status: number, body: object) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
const verify = (status: number, body: object) => createGoogleVerifier("mi-client-id", fakeFetch(status, body), () => NOW)("a.b.c");

test("acepta un token válido para nuestro client ID y normaliza el email", async () => {
  assert.deepEqual(await verify(200, good), { email: "ana@gmail.com", sub: "123", name: undefined });
});

test("rechaza token de otra app, emisor ajeno, expirado, email sin verificar o firma inválida", async () => {
  assert.equal(await verify(200, { ...good, aud: "otra-app" }), null);
  assert.equal(await verify(200, { ...good, iss: "evil.com" }), null);
  assert.equal(await verify(200, { ...good, exp: String(NOW / 1000 - 1) }), null);
  assert.equal(await verify(200, { ...good, email_verified: "false" }), null);
  assert.equal(await verify(400, { error: "invalid_token" }), null);
  assert.equal(await createGoogleVerifier("mi-client-id", fakeFetch(200, good))("no-es-jwt"), null);
});
