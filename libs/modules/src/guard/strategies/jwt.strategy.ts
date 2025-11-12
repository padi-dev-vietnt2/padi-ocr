import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    const config = {
      secretOrKey: configService.get('GUARD_JWT_SECRET', 'GUARD_JWT_SECRET'),
    };

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      ...config,
    });
  }

  validate(payload) {
    if (!payload?.id) {
      return false;
    }

    return payload;
  }
}
