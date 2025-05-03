from dotenv import load_dotenv
import pika
import torch
import numpy as np
import os
from transformers import T5Tokenizer, T5ForConditionalGeneration
import json

# Load environment variables from .env file
load_dotenv()

# Load the T5 Model
model_name = "t5-small"
tokenizer = T5Tokenizer.from_pretrained(model_name)
model = T5ForConditionalGeneration.from_pretrained(model_name)

# RabbitMQ Configuration
RABBITMQ_HOST = os.getenv("RABBITMQ_HOST", "localhost")
RESUME_QUEUE = "texts_queue"
JOB_QUEUE = "job_texts_queue"

RESUME_EMBEDDING_QUEUE = "text_embeddings"
JOB_EMBEDDING_QUEUE = "job_texts_embeddings"

# Function to generate T5 embeddings
def get_t5_embedding(text):
    """ Converts text (resume/job description) into a vector using T5 embeddings. """
    input_ids = tokenizer.encode(text, return_tensors="pt")
    with torch.no_grad():
        encoder_outputs = model.encoder(input_ids)
    embedding = encoder_outputs.last_hidden_state.mean(dim=1).squeeze().numpy()
    return embedding.tolist()  # Convert NumPy array to list for JSON compatibility

# RabbitMQ Callback Functions
def on_resume_request(ch, method, properties, body):
    """ Processes incoming resume requests, generates an embedding, and sends it back. """
    message = json.loads(body.decode("utf-8"))
    user_id = message['data']['userId']
    text = message['data']['resume']

    # Generate the embedding
    embedding = get_t5_embedding(text)
    
    # Send the response back
    ch.basic_publish(
        exchange="",
        routing_key="text_embeddings",
        properties=pika.BasicProperties(
            correlation_id=properties.correlation_id,
            headers={'event': "resume.processed"}
        ),
        body=json.dumps({
            "pattern": "resume.processed",
            "data": {
                "userId": user_id,
                "embedding": embedding
            }
        })
    )
    ch.basic_ack(delivery_tag=method.delivery_tag)
    print("Sent back resume vector embedding.")

def on_job_request(ch, method, properties, body):
    """ Processes incoming job requests, generates an embedding, and sends it back. """
    message = json.loads(body.decode("utf-8"))
    print(message)
    job_id = message['data']['jobId']
    text = message['data']['text']

    # Generate the embedding
    embedding = get_t5_embedding(text)
    
    # Send the response back
    ch.basic_publish(
        exchange="",
        routing_key=JOB_EMBEDDING_QUEUE,
        properties=pika.BasicProperties(
            correlation_id=properties.correlation_id,
            headers={'event': "job.processed"}
        ),
        body=json.dumps({
            "pattern": "job.processed",
            "data": {
                "jobId": job_id,
                "embedding": embedding
            }
        })
    )
    ch.basic_ack(delivery_tag=method.delivery_tag)
    print("Sent back job vector embedding.")

# Set up RabbitMQ Connection
connection = pika.BlockingConnection(pika.ConnectionParameters(host=RABBITMQ_HOST))
channel = connection.channel()

# Declare queues
channel.queue_declare(queue=RESUME_QUEUE)
channel.queue_declare(queue=JOB_QUEUE)
channel.queue_declare(queue=RESUME_EMBEDDING_QUEUE)
channel.queue_declare(queue=JOB_EMBEDDING_QUEUE)

# Set up consumers
channel.basic_consume(queue=RESUME_QUEUE, on_message_callback=on_resume_request)
channel.basic_consume(queue=JOB_QUEUE, on_message_callback=on_job_request)

# Start the server
print("🚀 T5 Embedding Service Running... Waiting for requests.")
channel.start_consuming()
