from dotenv import load_dotenv
import pika
import torch
import numpy as np
import os
from transformers import T5Tokenizer, T5ForConditionalGeneration
import json
import requests
import tempfile
import PyPDF2
import io

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

# Function to download and extract text from S3 PDF
def extract_text_from_s3_pdf(url):
    try:
        # Download the PDF file from S3
        response = requests.get(url)
        response.raise_for_status()  # Check if the download was successful
        
        # Create a file-like object from the content
        pdf_file = io.BytesIO(response.content)
        
        # Extract text using PyPDF2
        pdf_reader = PyPDF2.PdfReader(pdf_file)
        text = ""
        for page_num in range(len(pdf_reader.pages)):
            text += pdf_reader.pages[page_num].extract_text()
        
        return text
    except Exception as e:
        print(f"Error extracting text from S3 PDF: {e}")
        return ""

# RabbitMQ Callback Functions
def on_resume_request(ch, method, properties, body):
    """ Processes incoming resume requests, generates an embedding, and sends it back. """
    message = json.loads(body.decode("utf-8"))
    user_id = message['data']['userId']
    
    # Check if it's an S3 file or direct text
    if 'isS3' in message['data'] and message['data']['isS3']:
        # Extract the resume URL and download the PDF
        resume_url = message['data']['resumeUrl']
        text = extract_text_from_s3_pdf(resume_url)
    else:
        # Use the text directly
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
