import { Transport, ClientsModuleOptions } from '@nestjs/microservices';

const url = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';

export const rabbitMQConfig: ClientsModuleOptions = {
  clients: [
    {
      name: 'RABBITMQ_ML_PRODUCER_SERVICE',
      transport: Transport.RMQ,
      options: {
        urls: [url],
        queue: 'texts_queue',
        queueOptions: {
          durable: false,
        },
      },
    },
    {
      name: 'RABBITMQ_ML_CONSUMER_SERVICE',
      transport: Transport.RMQ,
      options: {
        urls: [url],
        queue: 'text_embeddings',
        queueOptions: {
          durable: false,
        },
      },
    },
    {
      name: 'RABBITMQ_ML_JOB_PRODUCER_SERVICE',
      transport: Transport.RMQ,
      options: {
        urls: [url],
        queue: 'job_texts_queue',
        queueOptions: {
          durable: false,
        },
      },
    },
    {
      name: 'RABBITMQ_ML_JOB_CONSUMER_SERVICE',
      transport: Transport.RMQ,
      options: {
        urls: [url],
        queue: 'job_texts_embeddings',
        queueOptions: {
          durable: false,
        },
      },
    },
    {
      name: 'RABBITMQ_JOB_PRODUCER_SERVICE',
      transport: Transport.RMQ,
      options: {
        urls: [url],
        queue: 'job_queue',
        queueOptions: {
          durable: false,
        },
      },
    },
    {
      name: 'RABBITMQ_JOB_CONSUMER_SERVICE',
      transport: Transport.RMQ,
      options: {
        urls: [url],
        queue: 'scraped_job_queue',
        queueOptions: {
          durable: false,
        },
      },
    },
  ],
  isGlobal: true,
};
