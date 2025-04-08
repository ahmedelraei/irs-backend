import pika
import json

def publish_jobs(jobs):
    connection = pika.BlockingConnection(pika.ConnectionParameters('localhost'))
    channel = connection.channel()

    channel.queue_declare(queue='job_queue')

    for job in jobs:
        message = json.dumps(job)
        channel.basic_publish(exchange='', routing_key='job_queue', body=message)
        print(f"Published job: {message}")

    connection.close()