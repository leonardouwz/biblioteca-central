import { test } from "node:test";
import assert from "node:assert/strict";
import { AddressInfo } from "net";
import express from "express";
import { createCatalogSocket } from "./catalogSocket";

test("avisa por WebSocket solo cuando una escritura de libros/préstamos termina bien", async () => {
  const realtime = createCatalogSocket();
  const app = express();
  app.use(realtime.notifyOnChange);
  app.post("/api/v1/loans", (_req, res) => res.status(201).json({}));
  app.post("/api/v1/loans/fail", (_req, res) => res.status(409).json({}));
  app.get("/api/v1/books", (_req, res) => res.json([]));
  app.post("/api/v1/users", (_req, res) => res.status(201).json({}));
  const server = app.listen(0);
  realtime.attach(server);
  const { port } = server.address() as AddressInfo;

  const received: string[] = [];
  const ws = new WebSocket(`ws://localhost:${port}/ws`);
  ws.onmessage = (e) => received.push(String(e.data));
  await new Promise((resolve) => (ws.onopen = resolve));

  const call = (method: string, path: string) => fetch(`http://localhost:${port}${path}`, { method });
  await call("GET", "/api/v1/books"); // lectura: no avisa
  await call("POST", "/api/v1/loans/fail"); // falló: no avisa
  await call("POST", "/api/v1/users"); // no afecta al catálogo: no avisa
  await call("POST", "/api/v1/loans"); // préstamo creado: avisa
  await new Promise((resolve) => setTimeout(resolve, 100));

  assert.deepEqual(received, ['{"type":"catalog-changed"}']);
  ws.close();
  server.closeAllConnections();
  server.close();
});
