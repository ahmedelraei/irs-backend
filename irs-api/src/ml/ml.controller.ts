import { Controller, Inject } from '@nestjs/common';
import { ClientProxy, MessagePattern } from '@nestjs/microservices';
import { JobConsumerService } from './job-consumer.service';

@Controller()
export class MlController {
  constructor(
    @Inject('RABBITMQ_JOB_CONSUMER_SERVICE') private readonly client: ClientProxy,
    private readonly jobConsumerService: JobConsumerService,
  ) {}

  @MessagePattern('job.generate_tensor')
  async handleJobTensorGeneration(data: any) {
    return this.jobConsumerService.processJobTensor(data);
  }
} 