# Producer / Consumer con RabbitMQ

Tarea del curso: recrear el [tutorial 1 de RabbitMQ ("Hello World!")](https://www.rabbitmq.com/tutorials/tutorial-one-python)
en Python, usando la [imagen oficial de Docker `rabbitmq`](https://hub.docker.com/_/rabbitmq).

```
 send.py (P)  ──►  [ cola "hello" ]  ──►  receive.py (C)
  producer          RabbitMQ broker          consumer
```

| Archivo | Qué hace |
|---|---|
| `send.py` | **Producer**: se conecta al broker, declara la cola `hello` y publica un mensaje (por defecto `Hello World!`, o el texto que pases como argumento). |
| `receive.py` | **Consumer**: declara la misma cola y se queda escuchando; imprime cada mensaje que llega. |
| `docker-compose.yml` | Levanta RabbitMQ (`rabbitmq:4-management`) con el puerto AMQP 5672 y el panel web 15672. |
| `requirements.txt` | Única dependencia: `pika`, el cliente Python de RabbitMQ que usa el tutorial. |

## Conceptos

- **Producer**: programa que envía mensajes. Nunca los manda directo a una cola, sino a un *exchange*.
  Aquí se usa el exchange por defecto (`''`), que entrega el mensaje a la cola cuyo nombre coincide con `routing_key`.
- **Cola (queue)**: buffer dentro de RabbitMQ donde esperan los mensajes. Muchos producers pueden escribir en ella
  y muchos consumers pueden leer de ella.
- **Consumer**: programa que espera mensajes. `basic_consume` registra un *callback* que RabbitMQ llama por cada mensaje.
- **`queue_declare` es idempotente**: los dos scripts la declaran, así no importa cuál arranque primero.
- **`auto_ack=True`**: el mensaje se da por procesado apenas se entrega (como en el tutorial; el tutorial 2 cambia esto).

**Diferencia con el tutorial:** la cola se declara con `durable=True`. RabbitMQ 4.x rechaza por defecto las colas
transitorias no exclusivas (error `transient_nonexcl_queues is deprecated`), así que el código tal cual del tutorial
falla con la imagen actual.

## Ejecutar en local

Requiere Docker y Python 3.

```bash
cd apps-secundarias/rabbitmq-producer-consumer
docker compose up -d                 # 1. levanta RabbitMQ (esperar ~10 s)
pip install -r requirements.txt      # 2. instala pika

python receive.py                    # 3. terminal 1: consumer (queda escuchando)
python send.py                       # 4. terminal 2: producer
python send.py "Hola desde Biblioteca Central"

docker compose down                  # al terminar
```

Salida esperada:

```
# terminal 2 (send.py)
 [x] Sent 'Hello World!'
 [x] Sent 'Hola desde Biblioteca Central'

# terminal 1 (receive.py)
 [*] Waiting for messages. To exit press CTRL+C
 [x] Received Hello World!
 [x] Received Hola desde Biblioteca Central
```

Panel de administración: <http://localhost:15672> (usuario `guest`, clave `guest`), pestaña *Queues* → `hello`.
Para ver la cola desde la terminal: `docker compose exec rabbitmq rabbitmqctl list_queues`.

Si RabbitMQ corre en otra máquina o contenedor, usar la variable `RABBITMQ_HOST` (por defecto `localhost`).

## Evidencia remota (GitHub Actions)

El workflow [`.github/workflows/rabbitmq-demo.yml`](../../.github/workflows/rabbitmq-demo.yml) corre todo sin
necesitar una laptop encendida: levanta `rabbitmq:4-management` como contenedor de servicio, arranca `receive.py`,
envía 3 mensajes con `send.py` y comprueba que el consumer recibió los 3. La salida queda en el resumen del job
(pestaña **Actions → RabbitMQ Producer/Consumer (demo)**). Se puede volver a lanzar con *Run workflow*.

Esta app **no** se despliega en Cloud Run: el workflow de despliegue de apps secundarias solo toma carpetas con
`package.json`, y un consumer que escucha una cola no es un servicio web.
