#!/usr/bin/env python
# Consumer: escucha la cola "hello" e imprime cada mensaje (tutorial 1 de RabbitMQ).
import os
import sys

import pika


def main():
    host = os.environ.get('RABBITMQ_HOST', 'localhost')
    connection = pika.BlockingConnection(pika.ConnectionParameters(host))
    channel = connection.channel()

    # Se declara también aquí por si el consumer arranca antes que el producer.
    channel.queue_declare(queue='hello', durable=True)

    def callback(ch, method, properties, body):
        print(f" [x] Received {body.decode()}", flush=True)

    channel.basic_consume(queue='hello', on_message_callback=callback, auto_ack=True)

    print(' [*] Waiting for messages. To exit press CTRL+C', flush=True)
    channel.start_consuming()


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print('Interrupted')
        sys.exit(0)
