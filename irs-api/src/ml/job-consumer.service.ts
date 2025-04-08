import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { JobService } from '../job/job.service';

@Injectable()
export class JobConsumerService implements OnModuleInit {
  constructor(
    @Inject('RABBITMQ_JOB_CONSUMER_SERVICE') private readonly client: ClientProxy,
    private readonly jobService: JobService,
  ) {}

  async onModuleInit() {
    await this.client.connect();
  }

  async processJobTensor(data: any) {
    try {
      const { jobId, title, description } = data;
      
      // Combine title and description for embedding
      const combinedText = `${title}. ${description}`;
      
      // Send to ML service for tensor generation
      const jobTensor = await this.generateTensor(combinedText);
      
      // Update the job with the generated tensor
      await this.jobService.updateTensor(jobId, jobTensor);
    } catch (error) {
      console.error('Error processing job tensor:', error);
      await this.jobService.markAsFailed(data.jobId, error.message);
    }
  }

  private async generateTensor(text: string): Promise<number[]> {
    // Send the text to the ML service and wait for the response
    const response = await this.client.send('text.process', {
      data: {
        text: text
      }
    }).toPromise();

    if (!response || !response.data || !response.data.embedding) {
      throw new Error('Failed to generate tensor from ML service');
    }

    return response.data.embedding;
  }
} 