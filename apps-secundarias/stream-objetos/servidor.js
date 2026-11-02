// Ejemplo 2 (web): un "sensor" genera objetos y el servidor los envía al navegador
// a medida que se producen, como NDJSON (un JSON por línea). Sin dependencias.
// Ejecutar: node servidor.js  ->  http://localhost:3000
import http from 'node:http';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { setTimeout as esperar } from 'node:timers/promises';

// Fuente de objetos: un generador asíncrono que simula lecturas de un sensor cada 500 ms.
async function* lecturasDelSensor(total = 20) {
  for (let id = 1; id <= total; id++) {
    await esperar(500);
    yield { id, temperatura: +(20 + Math.random() * 5).toFixed(1), hora: new Date().toISOString() };
  }
}

// Entra un objeto, sale texto: la respuesta HTTP solo acepta bytes, no objetos.
const aNDJSON = () =>
  new Transform({
    writableObjectMode: true,
    transform(objeto, _encoding, callback) {
      callback(null, JSON.stringify(objeto) + '\n');
    },
  });

const PAGINA = `<!doctype html>
<html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Stream de objetos</title>
<body style="font-family:system-ui;max-width:40rem;margin:2rem auto;padding:0 1rem">
<h1>Lecturas del sensor en vivo</h1>
<button id="boton">Iniciar stream</button>
<ul id="lista"></ul>
<script>
boton.onclick = async () => {
  lista.innerHTML = '';
  const respuesta = await fetch('/lecturas');
  const lector = respuesta.body.pipeThrough(new TextDecoderStream()).getReader();
  let resto = '';
  while (true) {
    const { value, done } = await lector.read();
    if (done) break;
    const lineas = (resto + value).split('\\n');
    resto = lineas.pop(); // la última puede venir incompleta
    for (const linea of lineas) {
      const o = JSON.parse(linea);
      const li = document.createElement('li');
      li.textContent = '#' + o.id + ': ' + o.temperatura + ' °C (' + o.hora + ')';
      lista.append(li);
    }
  }
};
</script>`;

const servidor = http.createServer(async (req, res) => {
  if (req.url === '/lecturas') {
    res.writeHead(200, { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache' });
    try {
      await pipeline(Readable.from(lecturasDelSensor()), aNDJSON(), res);
    } catch {
      // El cliente cerró la conexión: pipeline ya detuvo el generador, no hay nada más que hacer.
    }
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(PAGINA);
});

const puerto = process.env.PORT || 3000; // las plataformas en la nube inyectan PORT
servidor.listen(puerto, () => console.log(`Servidor en http://localhost:${puerto}`));
