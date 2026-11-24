/**
 * Web Worker del catálogo: filtra los libros fuera del hilo principal para que
 * escribir en el buscador no congele la página aunque el catálogo sea grande.
 *
 * Mensajes que recibe:
 *   { type: "set", books }        guarda el catálogo (se envía una vez por carga)
 *   { type: "filter", id, query } filtra y responde { id, books }
 * El `id` deja al hilo principal descartar respuestas viejas si el usuario
 * sigue escribiendo.
 */
importScripts("catalog.js");

let books = [];

self.onmessage = (event) => {
  const msg = event.data;
  if (msg.type === "set") books = msg.books || [];
  if (msg.type === "filter") self.postMessage({ id: msg.id, books: Catalog.filterBooks(books, msg.query) });
};
