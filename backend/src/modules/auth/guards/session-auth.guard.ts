import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { UsersService } from '../../users/users.service';

export interface AuthenticatedUser {
  id: string;
  email: string;
}

declare module 'express' {
  interface Request {
    user?: AuthenticatedUser;
  }
}

/**
 * Authenticates a request from its server-side session.
 *
 * The user id is only ever read from the session — never from the request
 * body, query or headers — and the account is re-loaded on every request so a
 * deleted account loses access immediately.
 */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const userId = request.session?.userId;

    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }

    try {
      const user = await this.usersService.findById(userId);
      request.user = {
        id: user._id.toString(),
        email: user.email,
      };
      return true;
    } catch {
      if (request.session) {
        request.session.destroy(() => {});
      }
      throw new UnauthorizedException('User session is invalid');
    }
  }
}
