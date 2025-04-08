import { Controller, Inject } from '@nestjs/common';
import { ClientProxy, EventPattern } from '@nestjs/microservices';
import { JobConsumerService } from './job-consumer.service';

@Controller()
export class JobConsumerController {
  constructor(
    private readonly jobConsumerService: JobConsumerService,
    @Inject('RABBITMQ_ML_JOB_CONSUMER_SERVICE') private readonly client: ClientProxy,
  ) {
  }

  @EventPattern('job.processed')
  async handleTensorResponse(data: { jobId: string; embedding: number[] }) {
    await this.jobConsumerService.handleTensorResponse(data.jobId, data.embedding);
  }
} 