import {
  Controller,
  Post,
  Body,
  Patch,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Get,
  Req,
} from '@nestjs/common';
import { UserService } from './user.service';
import { AuthService } from '../auth/auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { uploadOptions } from 'src/lib/upload.config';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateUserDto } from './dto/update-user.dto';
import { EventPattern } from '@nestjs/microservices';
import { AuthenticatedRequest } from 'src/types';

@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
  ) {}

  @Post('')
  async register(@Body() createUserDto: CreateUserDto) {
    return this.userService.register(createUserDto);
  }

  @Post('login')
  async login(@Body() loginUserDto: LoginUserDto) {
    const user = await this.userService.login(loginUserDto);
    const tokens = this.authService.login(user);
    return tokens;
  }

  @Post('refresh')
  async refresh(@Body() refreshToken: { refreshToken: string }) {
    const tokens = this.authService.refreshToken(refreshToken.refreshToken);
    return tokens;
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: AuthenticatedRequest) {
    return req.user;
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('resumeFile', uploadOptions()))
  async updateProfile(
    @Req() req: AuthenticatedRequest,
    @Body() updateUserDto: UpdateUserDto,
    @UploadedFile() resumeFile: Express.Multer.File,
  ) {
    if (resumeFile && resumeFile.path) {
      updateUserDto.resume = resumeFile.path;
    }
    await this.userService.processResume(resumeFile, req.user.id);
    return await this.userService.updateProfile(req.user, updateUserDto);
  }

  @EventPattern('resume.processed')
  async handleProcessedResume(data: any) {
    console.log('Resume processed', data);
    await this.userService.updateResume(data.userId, data.embedding);
  }
}
