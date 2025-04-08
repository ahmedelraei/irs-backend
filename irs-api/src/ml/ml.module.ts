import { Module } from '@nestjs/common';
import { JobConsumerService } from './job-consumer.service';
import { JobModule } from '../job/job.module';
import { MlController } from './ml.controller';

@Module({
  imports: [JobModule],
  controllers: [MlController],
  providers: [JobConsumerService],
  exports: [JobConsumerService],
})
export class MlModule {} 