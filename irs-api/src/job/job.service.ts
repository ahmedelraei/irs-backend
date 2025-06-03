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
      text: combinedText,
    });

    return savedJob;
  }

  async createBulk(createJobsDto: CreateJobDto[]): Promise<Job[]> {
    // Create all jobs in the database
    const createdJobs = await this.jobModel.insertMany(createJobsDto);

    // Publish each job for tensor generation
    createdJobs.forEach((job) => {
      const combinedText = `${job.title}. ${job.description}`;

      this.client.emit('job.process', {
        jobId: job._id.toString(),
        text: combinedText,
      });
    });

    return createdJobs;
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
    return this.jobModel
      .findByIdAndUpdate(
        jobId,
        {
          jobTensor: tensor,
          status: JobStatus.COMPLETED,
        },
        { new: true },
      )
      .exec();
  }

  async markAsFailed(jobId: string, error: string): Promise<Job> {
    return this.jobModel
      .findByIdAndUpdate(
        jobId,
        {
          status: JobStatus.FAILED,
          error,
        },
        { new: true },
      )
      .exec();
  }

  async getRecommendedJobs(userId: string, limit: number = 10): Promise<Job[]> {
    console.log('Getting recommended jobs for user:', userId);

    // Validate limit
    const validLimit = Number.isInteger(limit) && limit > 0 ? limit : 10;

    // Get user profile with tensor
    const userProfile = await this.userService.getUserProfile(userId);
    console.log('User profile found:', userProfile ? 'yes' : 'no');
    console.log(
      'User resume tensor:',
      userProfile?.resumeTensor ? 'exists' : 'missing',
    );
    console.log('User job title:', userProfile?.jobTitle);

    if (!userProfile || !userProfile.resumeTensor) {
      throw new Error('User not found or no resume tensor available');
    }

    // Get potential job title matches based on user's job title
    const jobTitleMatches = this.getRelatedJobTitles(userProfile.jobTitle);
    console.log('Looking for jobs matching titles:', jobTitleMatches);

    // First, ensure we have valid tensors by filtering out jobs with invalid tensors
    const recommendedJobs = await this.jobModel
      .aggregate([
        {
          $match: {
            status: JobStatus.COMPLETED,
            jobTensor: { $exists: true, $ne: null },
          },
        },
        {
          $addFields: {
            // Calculate cosine similarity properly with extra validation
            similarity: {
              $let: {
                vars: {
                  dotProduct: {
                    $reduce: {
                      input: {
                        $range: [
                          0,
                          {
                            $min: [
                              { $size: '$jobTensor' },
                              userProfile.resumeTensor.length,
                            ],
                          },
                        ],
                      },
                      initialValue: 0,
                      in: {
                        $add: [
                          '$$value',
                          {
                            $multiply: [
                              { $arrayElemAt: ['$jobTensor', '$$this'] },
                              {
                                $arrayElemAt: [
                                  userProfile.resumeTensor,
                                  '$$this',
                                ],
                              },
                            ],
                          },
                        ],
                      },
                    },
                  },
                  norm1: {
                    $sqrt: {
                      $reduce: {
                        input: '$jobTensor',
                        initialValue: 0,
                        in: {
                          $add: [
                            '$$value',
                            { $multiply: ['$$this', '$$this'] },
                          ],
                        },
                      },
                    },
                  },
                  norm2: {
                    $const: Math.sqrt(
                      userProfile.resumeTensor.reduce(
                        (sum, val) => sum + val * val,
                        0,
                      ),
                    ),
                  },
                },
                in: {
                  $cond: [
                    { $or: [{ $eq: ['$$norm1', 0] }, { $eq: ['$$norm2', 0] }] },
                    0,
                    {
                      $divide: [
                        '$$dotProduct',
                        { $multiply: ['$$norm1', '$$norm2'] },
                      ],
                    },
                  ],
                },
              },
            },
            // Add a titleMatchScore based on how well the title matches the user's job title
            titleMatchScore: {
              $cond: [
                {
                  $regexMatch: {
                    input: '$title',
                    regex: new RegExp(`\\b${userProfile.jobTitle}\\b`, 'i'),
                  },
                },
                1.0, // Exact match gets highest score
                0.5, // Partial match gets medium score
              ],
            },
            // Remove the random factor to ensure consistent results
            // randomFactor: { $rand: {} },
          },
        },
        // Filter out jobs with low similarity scores (can adjust threshold)
        { $match: { similarity: { $gt: 0.1 } } },
        {
          $addFields: {
            finalScore: {
              $add: [
                { $multiply: ['$similarity', 0.7] }, // 70% weight on similarity
                { $multiply: ['$titleMatchScore', 0.3] }, // 30% weight on title match
                // Removed random factor: { $multiply: ['$randomFactor', 0.1] }
              ],
            },
          },
        },
        { $sort: { finalScore: -1 } },
        { $limit: validLimit },
        {
          $project: {
            jobTensor: 0,
            // randomFactor: 0, // Removed since we no longer have randomFactor
            titleMatchScore: 0,
            finalScore: 0,
          },
        },
      ])
      .exec();

    console.log('Returning recommended jobs:', recommendedJobs.length);

    // Log the similarity scores for debugging
    if (recommendedJobs.length > 0) {
      console.log('Top job similarity scores:');
      recommendedJobs.slice(0, 3).forEach((job) => {
        console.log(
          `Job ID: ${job._id}, Title: ${job.title}, Similarity: ${job.similarity}`,
        );
      });
    }

    return recommendedJobs.map((job) => {
      // Remove the similarity score from the returned object
      const { similarity, ...jobWithoutSimilarity } = job;
      return jobWithoutSimilarity;
    });
  }

  /**
   * Helper method to get related job titles based on the user's job title
   */
  private getRelatedJobTitles(jobTitle: string): string[] {
    // Base set always includes the user's exact job title
    const related = [jobTitle];

    // Add related job titles based on the user's job title
    switch (jobTitle) {
      case 'Backend Developer':
        related.push(
          ...[
            'Full Stack Developer',
            'Node.js Developer',
            'Java Developer',
            'Python Developer',
            'Software Engineer',
          ],
        );
        break;
      case 'Frontend Developer':
        related.push(
          ...[
            'Web Developer',
            'Full Stack Developer',
            'UI Developer',
            'React Developer',
            'Angular Developer',
          ],
        );
        break;
      case 'Flutter Developer':
        related.push(
          ...[
            'Mobile Developer',
            'iOS Developer',
            'Android Developer',
            'React Native Developer',
          ],
        );
        break;
      case 'Data Scientist':
        related.push(
          ...[
            'Machine Learning Engineer',
            'AI Engineer',
            'Data Analyst',
            'Data Engineer',
          ],
        );
        break;
      case 'Machine Learning Engineer':
        related.push(
          ...[
            'AI Engineer',
            'Data Scientist',
            'Deep Learning Engineer',
            'NLP Engineer',
          ],
        );
        break;
      case 'AI Engineer':
        related.push(
          ...[
            'Machine Learning Engineer',
            'Data Scientist',
            'AI Researcher',
            'Computer Vision Engineer',
          ],
        );
        break;
      case 'DevOps Engineer':
        related.push(
          ...[
            'Site Reliability Engineer',
            'Platform Engineer',
            'Cloud Engineer',
            'Infrastructure Engineer',
          ],
        );
        break;
      case 'Full Stack Developer':
        related.push(
          ...[
            'Software Engineer',
            'Backend Developer',
            'Frontend Developer',
            'Web Developer',
          ],
        );
        break;
      default:
        // For any unknown job title, add some general software positions
        related.push(...['Software Engineer', 'Developer', 'Programmer']);
    }

    return related;
  }
}
