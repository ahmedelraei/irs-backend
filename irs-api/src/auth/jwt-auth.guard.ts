import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  CanActivate,
} from '@nestjs/common';
import { JwtAuthService } from 'src/shared/services/jwt.service';
import { AuthenticatedRequest } from 'src/types';
import { UserService } from '../user/user.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtAuthService: JwtAuthService,
    private readonly userService: UserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // Extract Authorization header
    const authHeader: string | undefined = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Invalid or missing token');
    }

    const token: string = authHeader.split(' ')[1];
    const decoded = await this.jwtAuthService.decodeToken(token);
    console.log(decoded);
    if (!decoded || !decoded.id) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // Fetch user from database
    const user = await this.userService.findById(decoded.id);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Attach user to request
    request.user = user;
    return true;
  }
}
