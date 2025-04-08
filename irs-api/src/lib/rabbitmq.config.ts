import { Transport, ClientsModuleOptions } from '@nestjs/microservices';

export const rabbitMQConfig: ClientsModuleOptions = {
  clients: [
    {
      name: 'RABBITMQ_ML_PRODUCER_SERVICE',
      transport: Transport.RMQ,
      options: {
        urls: ['amqp://guest:guest@localhost:5672'],
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
        urls: ['amqp://guest:guest@localhost:5672'],
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
        urls: ['amqp://guest:guest@localhost:5672'],
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
        urls: ['amqp://guest:guest@localhost:5672'],
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
        urls: ['amqp://guest:guest@localhost:5672'],
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
        urls: ['amqp://guest:guest@localhost:5672'],
        queue: 'scraped_job_queue',
        queueOptions: {
          durable: false,
        },
      },
    },
  ],
  isGlobal: true,
};
