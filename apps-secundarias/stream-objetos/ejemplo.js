// Ejemplo 1 (terminal): Readable -> Transform -> Writable, todos en objectMode.
// Ejecutar: node ejemplo.js
import { Readable, Transform, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import assert from 'node:assert';

const libros = [
  { titulo: 'Cien años de soledad', autor: 'Gabriel García Márquez', anio: 1967, disponible: true },
  { titulo: 'Rayuela', autor: 'Julio Cortázar', anio: 1963, disponible: false },
  { titulo: 'Ficciones', autor: 'Jorge Luis Borges', anio: 1944, disponible: true },
  { titulo: 'Pedro Páramo', autor: 'Juan Rulfo', anio: 1955, disponible: true },
];

// 1. Fuente: Readable.from() convierte cualquier iterable (array, generador...) en un stream de objetos.
const fuente = Readable.from(libros);

// 2. Transformación: descarta los no disponibles y agrega un campo calculado.
const soloDisponibles = new Transform({
  objectMode: true,
  transform(libro, _encoding, callback) {
    if (!libro.disponible) return callback(); // sin segundo argumento = el objeto no sigue
    callback(null, { ...libro, antiguedad: 2026 - libro.anio });
  },
});

// 3. Destino: recibe los objetos uno por uno.
const recibidos = [];
const destino = new Writable({
  objectMode: true,
  write(libro, _encoding, callback) {
    console.log(`-> ${libro.titulo} (${libro.autor}), ${libro.antiguedad} años`);
    recibidos.push(libro);
    callback(); // avisa que puede llegar el siguiente (backpressure)
  },
});

// pipeline() conecta todo, propaga errores y cierra los streams al terminar.
await pipeline(fuente, soloDisponibles, destino);

assert.deepEqual(recibidos.map((l) => l.titulo), ['Cien años de soledad', 'Ficciones', 'Pedro Páramo']);
assert.equal(recibidos[0].antiguedad, 59);
console.log('OK: llegaron', recibidos.length, 'de', libros.length, 'objetos');
