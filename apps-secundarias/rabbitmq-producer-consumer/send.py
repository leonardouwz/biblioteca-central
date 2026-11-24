#!/usr/bin/env python
# Producer: envía un mensaje a la cola "hello" (tutorial 1 de RabbitMQ).
import os
import sys

import pika

host = os.environ.get('RABBITMQ_HOST', 'localhost')
mensaje = ' '.join(sys.argv[1:]) or 'Hello World!'

connection = pika.BlockingConnection(pika.ConnectionParameters(host))
channel = connection.channel()

# Declarar la cola es idempotente: si ya existe no pasa nada.
# durable=True: RabbitMQ 4.x ya no permite colas transitorias no exclusivas
# (el tutorial original usa queue_declare(queue='hello') sin durable).
channel.queue_declare(queue='hello', durable=True)

# Exchange por defecto (''): enruta el mensaje a la cola cuyo nombre es routing_key.
channel.basic_publish(exchange='', routing_key='hello', body=mensaje)
print(f" [x] Sent '{mensaje}'")

connection.close()
