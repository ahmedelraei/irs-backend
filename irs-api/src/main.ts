import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Transport } from '@nestjs/microservices';
import { ValidationPipe } from '@nestjs/common';
import { config } from 'dotenv';

config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: true,
    credentials: true,
    methods: 'GET,PUT,PATCH,POST,DELETE',
    allowedHeaders: [
      'Origin',
      'Accept',
      'DNT',
      'Authorization',
      'Content-Type',
      'User-Agent',
      'X-Requested-With',
      'If-Modified-Since',
      'Cache-Control',
      'Range',
      'Accept-Encoding',
      'Accept-Language',
      'Content-Language',
      'Content-Range',
      'X-Forwarded-For',
      'X-Forwarded-Proto',
      'X-Real-IP',
    ],
    exposedHeaders: [
      'Origin',
      'Authorization',
      'Content-Type',
      'User-Agent',
      'Accept-Encoding',
      'Accept-Language',
      'Content-Language',
      'Content-Range',
      'X-Forwarded-For',
      'X-Forwarded-Proto',
      'X-Requested-With',
    ],
  });

  // Enable validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties that don't have any decorators
      transform: true, // Automatically transform payloads to DTO instances
      forbidNonWhitelisted: true, // Throw errors if non-whitelisted properties are present
      transformOptions: {
        enableImplicitConversion: true, // Enable implicit type conversion
      },
    }),
  );

  // Connect microservice for job embeddings
  app.connectMicroservice({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL],
      queue: 'job_texts_embeddings',
      queueOptions: {
        durable: false,
      },
    },
  });

  // Connect microservice for resume embeddings
  app.connectMicroservice({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL],
      queue: 'text_embeddings',
      queueOptions: {
        durable: false,
      },
    },
  });

  await app.startAllMicroservices();
  await app.listen(process.env.PORT || 8080);
}
bootstrap();
