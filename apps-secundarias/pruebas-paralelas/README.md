# Ejecución paralela de pruebas con PyTest + pytest-xdist

Actividad del curso *Tecnologías de Construcción de Software*. Es independiente de la app
Biblioteca central (vive en `apps-secundarias/`, aparte de la app y de su rediseño):
no comparte código con ella y no se despliega (no tiene `package.json`,
así que el workflow `deploy-apps.yml` la ignora).

## Herramienta elegida

**PyTest** (uno de los frameworks del material del profesor) con el plugin **pytest-xdist**,
que agrega ejecución paralela con la opción `-n`.

## 1. Cómo funciona la ejecución paralela en pytest-xdist

1. **Un proceso controlador y varios workers.** Al ejecutar `pytest -n 4`, pytest arranca un
   proceso *controlador* y 4 procesos *worker* (`gw0`, `gw1`, `gw2`, `gw3`). Cada worker es un
   intérprete de Python separado, con su propio PID y su propia memoria. Por eso es
   **paralelismo real** (varios núcleos a la vez), no solo concurrencia intercalada.
2. **Recolección.** Cada worker recolecta la lista completa de pruebas y el controlador verifica
   que todas las listas sean iguales.
3. **Distribución (scheduling).** El controlador reparte los casos de prueba entre los workers.
   Por defecto (`--dist load`) manda pruebas a cada worker conforme se va desocupando. Otros modos:
   - `--dist loadscope`: agrupa por módulo o clase (paralelización *por clases*).
   - `--dist loadfile`: agrupa por archivo (paralelización *por suites*).
   - `--dist worksteal`: un worker libre "roba" pruebas pendientes de otro.
4. **Resultados.** Cada worker ejecuta sus pruebas y envía los resultados al controlador, que
   los junta en un solo reporte, como si fuera una ejecución normal.
5. **`-n auto`** crea un worker por núcleo de CPU disponible.

Requisito: las pruebas deben ser **independientes** (no compartir estado ni depender del orden),
porque corren en procesos distintos y en orden no determinista. La variable de entorno
`PYTEST_XDIST_WORKER` indica en qué worker corre cada prueba.

Para la **paralelización distribuida** (varias máquinas) se puede combinar con la matriz de
GitHub Actions, donde cada job ejecuta una parte de la suite.

## 2. Ejemplo

[`tests/test_biblioteca.py`](tests/test_biblioteca.py) tiene 8 casos de prueba (búsqueda de libros
por ISBN y cálculo de multas). Cada uno espera 1 segundo para simular una operación lenta
(consulta a BD, llamada HTTP), así se nota la diferencia de tiempo.

```bash
pip install -r requirements.txt
pytest -v              # en serie: ~8 s
pytest -n 4 -v -rP     # en paralelo con 4 workers: ~2 s
```

## 3. Evidencia

### Local

| Modo | Comando | Tiempo |
|---|---|---|
| Serie | `pytest -v` | **8.03 s** |
| Paralelo | `pytest -n 4 -v -rP` | **2.39 s** |

Salida completa: [`evidencia/local-serie.txt`](evidencia/local-serie.txt) y
[`evidencia/local-paralelo.txt`](evidencia/local-paralelo.txt). En la salida paralela cada línea
indica el worker que ejecutó la prueba, y cada prueba imprime su PID: hay 4 PID distintos, uno
por worker.

```
[gw3] [ 12%] PASSED tests/test_biblioteca.py::test_multa[10-5.0]
[gw2] [ 25%] PASSED tests/test_biblioteca.py::test_multa[0-0]
[gw1] [ 37%] PASSED tests/test_biblioteca.py::test_libro_existe[978-2]
[gw0] [ 50%] PASSED tests/test_biblioteca.py::test_libro_existe[978-0]
...
============================== 8 passed in 2.39s ===============================
```

### GitHub Actions

El workflow [`.github/workflows/pruebas-paralelas.yml`](../../.github/workflows/pruebas-paralelas.yml)
corre la suite en serie y en paralelo cada vez que cambia esta carpeta (o a mano desde la pestaña
*Actions*, "Run workflow"). El resumen del run muestra los dos tiempos y qué worker ejecutó cada
prueba.

Run de evidencia más reciente (24/11/2026, lanzado a mano sobre `main`):
<https://github.com/leonardouwz/biblioteca-central/actions/runs/45475321160>
(runner `ubuntu-latest`, Python 3.12.16):

| Paso | Duración del paso | Resultado de pytest |
|---|---|---|
| En serie (1 proceso) | 8 s (19:55:38 a 19:55:46 UTC) | 8 passed |
| En paralelo (`-n 4`) | 3 s (19:55:46 a 19:55:49 UTC) | `8 passed in 2.36s` |

En el log del paso paralelo se ven los 4 workers con PID distintos
(`gw0 pid=2242`, `gw1 pid=2245`, `gw2 pid=2248`, `gw3 pid=2251`), cada uno con 2 pruebas.
El resumen del run (pestaña *Summary*) muestra los dos tiempos y qué worker ejecutó cada prueba.

Run anterior, con el mismo resultado: <https://github.com/leonardouwz/biblioteca-central/actions/runs/45455379875>
(`8 passed in 2.40s`).

Para repetirlo: GitHub → pestaña **Actions** → *Pruebas paralelas (pytest-xdist)* → **Run workflow**.
