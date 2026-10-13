import { Server } from "http";
import { RequestHandler } from "express";
import { WebSocketServer, WebSocket } from "ws";

/**
 * Catálogo en vivo por WebSocket. Cada vez que una petición que modifica
 * libros o préstamos termina bien, se avisa a todos los navegadores
 * conectados para que vuelvan a pedir el catálogo.
 *
 * El mensaje no lleva datos, solo el aviso `{type:"catalog-changed"}`: el
 * cliente vuelve a llamar a GET /books con su token, así que el socket no
 * necesita autenticación propia (no hay nada que filtrar por él).
 */
export function createCatalogSocket(): { notifyOnChange: RequestHandler; attach(server: Server): void } {
  // ponytail: clientes en memoria, sirve con UNA instancia del backend. Si
  // Cloud Run escala a varias, pasar el aviso por Postgres LISTEN/NOTIFY.
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 });

  const notifyOnChange: RequestHandler = (req, res, next) => {
    if (req.method !== "GET" && /^\/api\/v1\/(books|loans)/.test(req.path)) {
      res.on("finish", () => {
        if (res.statusCode >= 400) return;
        for (const client of wss.clients) {
          if (client.readyState === WebSocket.OPEN) client.send('{"type":"catalog-changed"}');
        }
      });
    }
    next();
  };

  return {
    notifyOnChange,
    attach(server) {
      server.on("upgrade", (req, socket, head) => {
        if (req.url !== "/ws") return socket.destroy();
        wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
      });
    },
  };
}
