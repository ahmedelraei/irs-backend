import { Injectable, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Job, JobDocument, JobStatus } from './schemas/job.schema';
import { CreateJobDto } from './dto/create-job.dto';
import { ClientProxy } from '@nestjs/microservices';
import { UserService } from '../user/user.service';

@Injectable()
export class JobService {
  constructor(
    @InjectModel(Job.name) private jobModel: Model<JobDocument>,
    @Inject('RABBITMQ_ML_JOB_PRODUCER_SERVICE')
    private readonly client: ClientProxy,
    private readonly userService: UserService,
  ) {}

  async create(createJobDto: CreateJobDto): Promise<Job> {
    const createdJob = new this.jobModel(createJobDto);
    const savedJob = await createdJob.save();
    
    // Publish job for tensor generation without waiting for response
    const combinedText = `${savedJob.title}. ${savedJob.description}`;
    
    this.client.emit('job.process', {
        jobId: savedJob._id.toString(),
        text: combinedText
    });

    return savedJob;
  }

  async findAll(): Promise<Job[]> {
    return this.jobModel.find().exec();
  }

  async findOne(id: string): Promise<Job> {
    return this.jobModel.findById(id).exec();
  }

  async findByTensor(jobTensor: number[]): Promise<Job[]> {
    return this.jobModel.find({ jobTensor }).exec();
  }

  async delete(id: string): Promise<Job> {
    return this.jobModel.findByIdAndDelete(id).exec();
  }

  async updateTensor(jobId: string, tensor: number[]): Promise<Job> {
    return this.jobModel.findByIdAndUpdate(
      jobId,
      {
        jobTensor: tensor,
        status: JobStatus.COMPLETED,
      },
      { new: true },
    ).exec();
  }

  async markAsFailed(jobId: string, error: string): Promise<Job> {
    return this.jobModel.findByIdAndUpdate(
      jobId,
      {
        status: JobStatus.FAILED,
        error,
      },
      { new: true },
    ).exec();
  }

  async getRecommendedJobs(userId: string, limit: number = 10): Promise<Job[]> {
    console.log('Getting recommended jobs for user:', userId);
    
    // Validate limit
    const validLimit = Number.isInteger(limit) && limit > 0 ? limit : 10;
    
    // Get user profile with tensor
    const userProfile = await this.userService.getUserProfile(userId);
    console.log('User profile found:', userProfile ? 'yes' : 'no');
    console.log('User resume tensor:', userProfile?.resumeTensor ? 'exists' : 'missing');
    
    if (!userProfile || !userProfile.resumeTensor) {
      throw new Error('User not found or no resume tensor available');
    }

    const recommendedJobs = await this.jobModel.aggregate([
      { $match: { status: JobStatus.COMPLETED } },
      {
        $addFields: {
          similarity: {
            $let: {
              vars: {
                dotProduct: {
                  $reduce: {
                    input: { $range: [0, { $size: "$jobTensor" }] },
                    initialValue: 0,
                    in: {
                      $add: [
                        "$$value",
                        {
                          $multiply: [
                            { $arrayElemAt: ["$jobTensor", "$$this"] },
                            { $arrayElemAt: [userProfile.resumeTensor, "$$this"] }
                          ]
                        }
                      ]
                    }
                  }
                },
                norm1: {
                  $sqrt: {
                    $reduce: {
                      input: "$jobTensor",
                      initialValue: 0,
                      in: { $add: ["$$value", { $multiply: ["$$this", "$$this"] }] }
                    }
                  }
                },
                norm2: {
                  $sqrt: {
                    $reduce: {
                      input: userProfile.resumeTensor,
                      initialValue: 0,
                      in: { $add: ["$$value", { $multiply: ["$$this", "$$this"] }] }
                    }
                  }
                }
              },
              in: {
                $cond: [
                  { $or: [{ $eq: ["$$norm1", 0] }, { $eq: ["$$norm2", 0] }] },
                  0,
                  { $divide: ["$$dotProduct", { $multiply: ["$$norm1", "$$norm2"] }] }
                ]
              }
            }
          }
        }
      },
      { $sort: { similarity: -1 } },
      { $limit: validLimit }
    ]).exec();

    console.log('Returning recommended jobs:', recommendedJobs.length);
    return recommendedJobs;
  }
} 