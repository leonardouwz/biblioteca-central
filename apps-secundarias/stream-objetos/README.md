# Stream de objetos en Node.js

Tarea del curso: investigar cómo hacer *stream* de objetos con Node.js y construir un ejemplo sencillo.
No usa dependencias externas, solo el módulo `node:stream` que viene con Node (versión 18 o superior).

```bash
cd apps-secundarias/stream-objetos
node ejemplo.js      # ejemplo 1: en la terminal
node servidor.js     # ejemplo 2: abrir http://localhost:3000
```

---

## 1. ¿Qué es un stream?

Un *stream* es una forma de procesar datos **por partes, a medida que llegan**, en vez de cargar todo en memoria
y después procesarlo. Es como tomar agua de una manguera en lugar de esperar a llenar un balde.

Node tiene cuatro tipos:

| Tipo | Qué hace | Ejemplo real |
|---|---|---|
| `Readable` | Produce datos | Leer un archivo, una consulta a la BD |
| `Writable` | Consume datos | Escribir un archivo, la respuesta HTTP |
| `Transform` | Recibe, modifica y reenvía | Filtrar, convertir a JSON, comprimir |
| `Duplex` | Lee y escribe a la vez, por separado | Un socket TCP o WebSocket |

### Modo objeto (`objectMode`)

Por defecto un stream solo transporta **bytes** (`Buffer`) o texto. Con `objectMode: true` cada "trozo"
(*chunk*) puede ser **cualquier valor de JavaScript**: un objeto, un array, un número.
Así se puede tener una "cinta transportadora" de objetos `{ titulo, autor }` en lugar de bytes.

```js
new Transform({
  objectMode: true,                 // entra un objeto, sale un objeto
  transform(obj, _enc, callback) {
    callback(null, { ...obj, procesado: true });
  },
});
```

También se puede activar solo de un lado: `writableObjectMode: true` (entra objeto, sale texto) es justo
lo que hace falta para convertir objetos a JSON antes de mandarlos por la red (ver `servidor.js`).

### Conceptos clave

- **Backpressure (contrapresión):** si el destino es más lento que la fuente, el stream la frena
  automáticamente para no llenar la memoria. En modo objeto el límite (`highWaterMark`) se cuenta en
  **cantidad de objetos** (16 por defecto), no en bytes.
- **`pipeline()`:** conecta varios streams en cadena, propaga los errores y cierra todo al terminar o
  si algo falla. Es preferible a encadenar `.pipe()` a mano, que no maneja errores.
- **`Readable.from(iterable)`:** convierte un array o un generador (incluso `async function*`) en un
  stream de objetos. Es la forma más corta de crear una fuente.
- **`for await (const obj of stream)`:** todo `Readable` se puede recorrer como un iterable asíncrono.

---

## 2. Los ejemplos de esta carpeta

### `ejemplo.js` — cadena básica en la terminal

```
[array de libros] → Readable.from → Transform (filtra disponibles, agrega antigüedad) → Writable (imprime)
```

Muestra los tres tipos de stream en modo objeto y termina con un `assert` que comprueba el resultado.
Salida esperada:

```
-> Cien años de soledad (Gabriel García Márquez), 59 años
-> Ficciones (Jorge Luis Borges), 82 años
-> Pedro Páramo (Juan Rulfo), 71 años
OK: llegaron 3 de 4 objetos
```

### `servidor.js` — stream de objetos por HTTP al navegador

```
generador async (sensor, 1 lectura cada 500 ms) → Transform objeto→NDJSON → respuesta HTTP → fetch() en el navegador
```

- El servidor **no espera** a tener las 20 lecturas: envía cada una apenas se genera.
- El formato es **NDJSON** (*newline-delimited JSON*): un objeto JSON por línea. Es el estándar de facto
  para mandar objetos por streaming, porque el cliente puede ir parseando línea por línea.
- En el navegador se lee con `fetch()` + `response.body.getReader()` (Web Streams) y cada objeto se agrega
  a la lista en cuanto llega.
- Si el usuario cierra la pestaña, `pipeline()` detecta el corte y detiene el generador: no queda trabajo
  colgado en el servidor.

También se puede ver desde la terminal:

```bash
curl -N http://localhost:3000/lecturas
```

---

## 3. Aplicaciones posibles

| Aplicación | Cómo se usa el stream de objetos |
|---|---|
| **Exportar/importar datos grandes** (CSV, JSON de millones de filas) | Leer fila por fila → transformar cada fila a objeto → insertar en la BD por lotes, con memoria constante |
| **Consultas grandes a la base de datos** | Drivers como `pg-query-stream` (PostgreSQL) o `cursor.stream()` (MongoDB) devuelven las filas como stream de objetos en vez de un array gigante |
| **ETL / limpieza de datos** | Cadena de `Transform`: validar → normalizar → enriquecer → guardar |
| **Logs y monitoreo** | Leer logs línea por línea, parsear cada una a objeto, filtrar errores y enviarlos a un servicio |
| **IoT / sensores en tiempo real** | Cada lectura es un objeto que fluye hacia un dashboard (como `servidor.js`) |
| **Respuestas de IA token por token** | APIs de modelos de lenguaje mandan eventos (objetos) a medida que generan el texto |
| **Feeds en vivo** | Precios, marcadores deportivos, notificaciones, disponibilidad de libros en el catálogo |
| **Colas de mensajes** | Consumir mensajes de Kafka/RabbitMQ/Redis Streams como un stream de objetos con backpressure |

> Relación con el proyecto principal: el Catálogo de `biblioteca-central` ya actualiza la disponibilidad en vivo
> por WebSocket, que es otra forma de stream de objetos (un `Duplex`: el servidor empuja eventos JSON al cliente).

---

## 4. Otros ejemplos de uso sencillos

**Recorrer un stream con `for await`:**

```js
import { Readable } from 'node:stream';
for await (const libro of Readable.from([{ t: 'A' }, { t: 'B' }])) {
  console.log(libro.t);
}
```

**Transformación con un generador (sin clase `Transform`):**

```js
import { pipeline } from 'node:stream/promises';
await pipeline(
  Readable.from(libros),
  async function* (origen) {
    for await (const l of origen) if (l.disponible) yield l;
  },
  destino,
);
```

**Leer un archivo de texto línea por línea y convertir cada línea en objeto:**

```js
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
for await (const linea of createInterface({ input: createReadStream('datos.ndjson') })) {
  const objeto = JSON.parse(linea);
  // procesar objeto...
}
```

**Operadores tipo array sobre streams** (Node 17+, experimentales):

```js
const titulos = await Readable.from(libros)
  .filter((l) => l.disponible)
  .map((l) => l.titulo)
  .toArray();
```

---

## 5. Herramientas en la nube para desplegarlo

`servidor.js` lee el puerto de `process.env.PORT` y `package.json` tiene `"start": "node servidor.js"`,
así que funciona tal cual en las plataformas que ejecutan Node.

| Plataforma | Plan gratuito | Soporta respuestas en streaming | Cómo desplegar |
|---|---|---|---|
| **Google Cloud Run** | Sí (cuota mensual) | Sí | `gcloud run deploy stream-objetos --source . --region us-central1 --allow-unauthenticated` (detecta Node solo, sin Dockerfile) |
| **Render** | Sí (se duerme sin uso) | Sí | Conectar el repo, *Root Directory* `apps-secundarias/stream-objetos`, *Start* `npm start` |
| **Railway** | Créditos de prueba | Sí | Conectar el repo y fijar el directorio raíz |
| **Fly.io** | Limitado | Sí | `fly launch` en la carpeta |
| **Vercel / Netlify Functions** | Sí | Sí, pero con tiempo máximo por petición | Requiere adaptar el código al formato de función serverless |
| **Cloudflare Workers** | Sí | Sí, con **Web Streams** (`ReadableStream`) | Requiere reescribir con la API de Web Streams en vez de `node:http` |
| **AWS Lambda** | Sí | Sí, con *response streaming* | Usar `awslambda.streamifyResponse()` |

Recomendación: **Cloud Run** o **Render**, porque ejecutan el servidor sin cambiar una línea. Cloud Run ya se
usa en el proyecto principal, así que el flujo de despliegue es conocido.

Servicios en la nube especializados en streams de datos (para escalar la idea, no necesarios para la tarea):
Apache Kafka (Confluent Cloud, Upstash), Redis Streams (Upstash, Redis Cloud), Google Pub/Sub, AWS Kinesis,
Supabase Realtime.

---

## 6. Referencias

- Documentación oficial de streams: <https://nodejs.org/api/stream.html>
  (secciones *Object mode*, *stream.pipeline*, *Readable.from*)
- Guía de backpressure: <https://nodejs.org/en/learn/modules/backpressuring-in-streams>
- Web Streams en Node: <https://nodejs.org/api/webstreams.html>
- Especificación NDJSON: <https://github.com/ndjson/ndjson-spec>
