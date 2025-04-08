/* eslint-disable @typescript-eslint/require-await */
import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '../../types/jwt.types';

@Injectable()
export class JwtAuthService {
  constructor(private readonly jwtService: JwtService) {}

  async generateTokens(
    payload: JwtPayload,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    return {
      accessToken: this.jwtService.sign(payload, {
        secret: process.env.JWT_SECRET,
        expiresIn: process.env.JWT_EXPIRATION || '1h',
      }),
      refreshToken: this.jwtService.sign(payload, {
        secret: process.env.JWT_SECRET,
        expiresIn: process.env.JWT_REFRESH_EXPIRATION || '14d',
      }),
    };
  }

  async refreshToken(
    refreshToken: string,
    payload: JwtPayload,
  ): Promise<{ accessToken: string }> {
    try {
      await this.verifyToken(refreshToken);
      return {
        accessToken: this.jwtService.sign(payload, {
          secret: process.env.JWT_SECRET,
          expiresIn: process.env.JWT_EXPIRATION || '1h',
        }),
      };
    } catch (error) {
      console.error(error);
      throw new BadRequestException('Invalid refresh token');
    }
  }

  // Verify JWT token
  async verifyToken(token: string): Promise<JwtPayload> {
    try {
      return await this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET,
      });
    } catch (error) {
      throw new BadRequestException(error);
    }
  }

  // Decode JWT token (without verifying)
  async decodeToken(token: string): Promise<JwtPayload> {
    return await this.jwtService.decode(token);
  }
}
