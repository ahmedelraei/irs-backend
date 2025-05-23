import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Connection } from 'mongoose';
import { ObjectId } from 'mongodb';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { GetUserDto } from './dto/get-user.dto';
import { UserDocument } from './schemas/user.schema';
import { UserProfileDocument } from './schemas/userProfile.schema';
import * as bcrypt from 'bcrypt';
import { S3File } from 'src/types/upload.types';
import { ClientProxy } from '@nestjs/microservices';
import { promises as fsp } from 'fs';
import * as pdfParse from 'pdf-parse';

@Injectable()
export class UserService {
  constructor(
    @InjectModel('User') private readonly userModel: Model<UserDocument>,
    @InjectModel('UserProfile')
    private readonly userProfileModel: Model<UserProfileDocument>,
    @InjectConnection() private connection: Connection,
    @Inject('RABBITMQ_ML_PRODUCER_SERVICE')
    private readonly producerClient: ClientProxy,
    @Inject('RABBITMQ_JOB_PRODUCER_SERVICE')
    private readonly jobProducerClient: ClientProxy,
  ) {}

  async register(createUserDto: CreateUserDto): Promise<GetUserDto> {
    try {
      const existingUser = await this.userModel
        .findOne({ email: createUserDto.email })
        .exec();
      if (existingUser) {
        throw new BadRequestException('Email already registered');
      }
      const jobTitle = createUserDto.jobTitle;
      delete createUserDto.jobTitle;
      const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
      const newUser = new this.userModel({
        ...createUserDto,
        password: hashedPassword,
      });
      await newUser.save();
      const profile = new this.userProfileModel({
        user: newUser._id,
        jobTitle,
      });
      await profile.save();

      const populatedUser = await this.userModel
        .findById(newUser._id)
        .populate('profile')
        .lean();

      this.jobProducerClient.emit('job.fetch', {
        jobTitles: [jobTitle],
      });

      // Create a clean object to prevent circular references
      const userDto = {
        id: populatedUser._id.toString(),
        email: populatedUser.email,
        name: `${populatedUser.firstName} ${populatedUser.lastName}`,
        jobTitle: populatedUser.profile?.jobTitle || null,
      };

      return userDto as GetUserDto;
    } catch (error) {
      throw error;
    }
  }

  async login(loginUserDto: LoginUserDto): Promise<UserDocument> {
    const user = await this.userModel
      .findOne({ email: loginUserDto.email })
      .exec();
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const valid = await bcrypt.compare(loginUserDto.password, user.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return user;
  }

  async findById(id: string): Promise<UserDocument> {
    return this.userModel.findById(id);
  }

  async getUserProfile(userId: string): Promise<UserProfileDocument> {
    return this.userProfileModel.findOne({ user: new ObjectId(userId) });
  }

  async uploadResumeFile(file: S3File) {
    return {
      url: file.location,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    };
  }

  async processResume(resume: Express.Multer.File, userId: string) {
    if (!resume) {
      console.log('No resume file provided, skipping processing');
      return;
    }

    try {
      let resumeText = '';

      // For S3 storage (location property exists)
      if ('location' in resume) {
        const s3File = resume as S3File;
        console.log('Processing S3 file:', s3File.location);

        // Since we can't directly read S3 files here, we'll send the URL to the ML service
        this.producerClient.emit('resume.uploaded', {
          userId,
          resumeUrl: s3File.location,
          isS3: true,
        });
        return;
      }
      // For local storage (path property exists)
      else if ('path' in resume) {
        console.log('Processing local file:', resume.path);
        // Read and parse the PDF file
        const fileBuffer = await fsp.readFile(resume.path);
        const pdfData = await pdfParse(fileBuffer);
        resumeText = pdfData.text;
      }

      // Produce message to RabbitMQ for local files
      this.producerClient.emit('resume.uploaded', {
        userId,
        resume: resumeText,
      });
    } catch (error) {
      console.error('Error processing resume:', error);
      throw new BadRequestException('Failed to process resume file');
    }
  }

  async updateProfile(
    user: UserDocument,
    updateUserDto: UpdateUserDto,
  ): Promise<UserProfileDocument> {
    const profile = await this.userProfileModel.findOne({
      user: new ObjectId(user.id),
    });
    if (!profile) {
      throw new BadRequestException('Profile not found');
    }
    return this.userProfileModel.findOneAndUpdate(
      { user: new ObjectId(user.id) },
      updateUserDto,
      { new: true },
    );
  }
  async updateResume(userId: string, resumeTensor: number[]) {
    console.log(userId);
    const profile = await this.userProfileModel.findOne({
      user: new ObjectId(userId),
    });
    console.log('profile');
    console.log(profile);
    if (!profile) {
      throw new BadRequestException('Profile not found');
    }
    profile.resumeTensor = resumeTensor;
    return await profile.save();
  }
}
