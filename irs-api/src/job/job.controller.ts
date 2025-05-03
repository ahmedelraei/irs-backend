import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JobService } from './job.service';
import { CreateJobDto } from './dto/create-job.dto';
import { CreateJobsBulkDto } from './dto/create-jobs-bulk.dto';
import { SearchJobDto } from './dto/search-job.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from 'src/types';

@Controller('jobs')
export class JobController {
  constructor(private readonly jobService: JobService) {}

  @Post()
  async create(@Body() createJobDto: CreateJobDto) {
    return this.jobService.create(createJobDto);
  }

  @Post('bulk')
  async createBulk(@Body() createJobsBulkDto: CreateJobsBulkDto) {
    return this.jobService.createBulk(createJobsBulkDto.jobs);
  }

  @Get()
  async findAll() {
    return this.jobService.findAll();
  }

  @Get('recommended')
  @UseGuards(JwtAuthGuard)
  async getRecommendedJobs(
    @Req() req: AuthenticatedRequest,
    @Query('limit') limit: number = 10,
  ) {
    return await this.jobService.getRecommendedJobs(req.user.id, limit);
  }

  @Get('search/tensor')
  async findByTensor(@Query() searchJobDto: SearchJobDto) {
    return this.jobService.findByTensor(searchJobDto.tensor);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.jobService.findOne(id);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.jobService.delete(id);
  }
}
