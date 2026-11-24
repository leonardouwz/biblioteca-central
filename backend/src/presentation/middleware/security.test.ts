import { test } from "node:test";
import "./locale"; // tipo de req.locale
import assert from "node:assert/strict";
import { AddressInfo } from "net";
import express from "express";
import cors from "cors";
import { corsOrigins, rateLimit, DEFAULT_CORS_ORIGINS } from "./security";

test("corsOrigins: lee CORS_ORIGINS y cae al frontend de producción si no está", () => {
  assert.deepEqual(corsOrigins(undefined), DEFAULT_CORS_ORIGINS);
  assert.deepEqual(corsOrigins(" "), DEFAULT_CORS_ORIGINS);
  assert.deepEqual(corsOrigins("https://a.dev/, http://localhost:8787"), ["https://a.dev", "http://localhost:8787"]);
});

test("CORS solo responde Allow-Origin al dominio permitido; rateLimit corta con 429", async () => {
  let clock = 0;
  const app = express();
  app.use(cors({ origin: corsOrigins("https://front.dev") }));
  app.use((req, _res, next) => ((req.locale = "es"), next()));
  app.post("/login", rateLimit(2, 60_000, () => clock), (_req, res) => res.json({ ok: true }));
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  const post = (origin: string) => fetch(`http://localhost:${port}/login`, { method: "POST", headers: { Origin: origin } });

  try {
    const ok = await post("https://front.dev");
    assert.equal(ok.headers.get("access-control-allow-origin"), "https://front.dev");
    const evil = await post("https://evil.dev");
    assert.equal(evil.headers.get("access-control-allow-origin"), null);

    const blocked = await post("https://front.dev"); // 3.er intento con max=2
    assert.equal(blocked.status, 429);
    assert.equal((await blocked.json()).code, "TOO_MANY_REQUESTS");
    assert.equal(blocked.headers.get("retry-after"), "60");

    clock = 60_000; // pasó la ventana
    assert.equal((await post("https://front.dev")).status, 200);
  } finally {
    server.close();
  }
});
