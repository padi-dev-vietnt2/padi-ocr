import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class BasicGuard extends AuthGuard('basic') {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  override handleRequest<TUser = any>(
    err: any,
    user: TUser,
    info: any,
    context: ExecutionContext,
  ): TUser {
    if (err || !user) {
      const ctx = context.switchToHttp();
      const response = ctx.getResponse();

      const realm = this.configService.get('GUARD_BASIC_REALM', 'MyApp');
      response.set('WWW-Authenticate', `Basic realm="${realm}"`);
      throw new UnauthorizedException();
    }

    return user;
  }
}
