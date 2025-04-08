import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtAuthService } from 'src/shared/services/jwt.service';
import { UserService } from '../user/user.service';
import { UserDocument } from 'src/user/schemas/user.schema';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtAuthService,
    private readonly userService: UserService,
  ) {}

  async login(user: UserDocument) {
    const userId = user._id.toString();
    const payload = { id: userId, username: user.username, email: user.email };
    const tokens = await this.jwtService.generateTokens(payload);
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyToken(refreshToken);
      const user = await this.userService.findById(payload.id);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }
      const userId = (user as any)._id.toString();
      const newPayload = {
        id: userId,
        email: user.email,
        username: user.username,
      };
      const accessToken = await this.jwtService.refreshToken(
        refreshToken,
        newPayload,
      );
      return { accessToken };
    } catch (error) {
      console.error(error);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
