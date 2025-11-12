import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { get } from 'lodash';
import { BasicStrategy as Strategy } from 'passport-http';

@Injectable()
export class PassKeyStrategy extends PassportStrategy(Strategy, 'pass-key') {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  validate(req: Request) {
    const configPassKey = this.configService.get('GUARD_PASS_KEY', '');
    if (!configPassKey?.length) {
      return;
    }

    const passKey: string =
      get(req, ['headers', 'x-pass-key']) ||
      get(req, ['body', 'x-pass-key']) ||
      get(req, ['query', 'x-pass-key']);

    return passKey === configPassKey;
  }
}
