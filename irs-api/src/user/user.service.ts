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
import { plainToInstance } from 'class-transformer';

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
    const session = await this.connection.startSession();
    try {
      await session.startTransaction();
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
      const profile = new this.userProfileModel({ user: newUser, jobTitle });
      await profile.save();
      await session.commitTransaction();
      
      const populatedUser = await this.userModel.findById(newUser._id).populate('profile');

      this.jobProducerClient.emit('job.fetch', {
        jobTitles: [jobTitle],
      });

      return plainToInstance(GetUserDto, populatedUser);
    } catch (error) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      throw error;
    } finally {
      session.endSession();
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
    const fileBuffer = await fsp.readFile(resume.path);
    const pdfData = await pdfParse(fileBuffer);
    console.log(userId);
    // Produce message to RabbitMQ
    this.producerClient.emit('resume.uploaded', {
      userId,
      resume: pdfData.text,
    });
    
  }

  async updateProfile(
    user: UserDocument,
    updateUserDto: UpdateUserDto,
  ): Promise<UserProfileDocument> {
    const profile = await this.userProfileModel.findOne({ user: new ObjectId(user.id) });
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
