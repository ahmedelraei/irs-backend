import pika
import json
def consume_keywords(callback):
    connection = pika.BlockingConnection(pika.ConnectionParameters('localhost'))
    channel = connection.channel()

    channel.queue_declare(queue='job_queue')

    def on_message(ch, method, properties, body):
        message = json.loads(body.decode('utf-8'))
        print(f"Raw Body: {body.decode('utf-8')}")
        if message['pattern'] == 'job.fetch':
            keywords = message['data']['jobTitles']
            print(f"THE keywords: {keywords}")
            callback(keywords)

    channel.basic_consume(queue='job_queue', on_message_callback=on_message, auto_ack=True)
    print("Waiting for keywords...")
    channel.start_consuming()