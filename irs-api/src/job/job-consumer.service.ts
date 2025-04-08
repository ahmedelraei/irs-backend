import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Job, JobDocument } from './schemas/job.schema';
import { JobStatus } from './schemas/job.schema';

@Injectable()
export class JobConsumerService {
  private readonly logger = new Logger(JobConsumerService.name);

  constructor(
    @InjectModel(Job.name) private jobModel: Model<JobDocument>,
  ) {}

  async handleTensorResponse(jobId: string, embedding: number[]): Promise<void> {
    try {
      await this.jobModel.findByIdAndUpdate(
        jobId,
        {
          jobTensor: embedding,
          status: JobStatus.COMPLETED,
        },
        { new: true },
      );
      this.logger.log(`Successfully updated tensor for job ${jobId}`);
    } catch (error) {
      this.logger.error(`Error updating tensor for job ${jobId}: ${error.message}`);
      await this.markAsFailed(jobId, error.message);
    }
  }

  async markAsFailed(jobId: string, error: string): Promise<void> {
    try {
      await this.jobModel.findByIdAndUpdate(
        jobId,
        {
          status: JobStatus.FAILED,
          error: error,
        },
        { new: true },
      );
      this.logger.error(`Marked job ${jobId} as failed: ${error}`);
    } catch (error) {
      this.logger.error(`Error marking job ${jobId} as failed: ${error.message}`);
    }
  }
} 