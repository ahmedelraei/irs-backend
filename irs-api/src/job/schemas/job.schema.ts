import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type JobDocument = Job & Document;

export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Schema({ timestamps: true })
export class Job {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  company: string;

  @Prop({ type: [Number], default: [] })
  jobTensor: number[];

  @Prop({ type: String })
  applyUrl: string;

  @Prop({ type: String, enum: JobStatus, default: JobStatus.PENDING })
  status: JobStatus;

  @Prop({ type: String, default: null })
  error: string | null;
}

export const JobSchema = SchemaFactory.createForClass(Job);
