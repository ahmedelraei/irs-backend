import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JobController } from './job.controller';
import { JobService } from './job.service';
import { JobConsumerService } from './job-consumer.service';
import { Job, JobSchema } from './schemas/job.schema';
import { JobConsumerController } from './job-consumer.controller';
import { UserModule } from '../user/user.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Job.name, schema: JobSchema }]),
    UserModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [JobController, JobConsumerController],
  providers: [JobService, JobConsumerService],
  exports: [JobService],
})
export class JobModule {} 