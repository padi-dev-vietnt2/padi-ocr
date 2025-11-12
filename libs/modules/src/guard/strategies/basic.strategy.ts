import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { BasicStrategy as Strategy } from 'passport-http';

@Injectable()
export class BasicStrategy extends PassportStrategy(Strategy, 'basic') {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  validate(username: string, password: string) {
    const configUsername = this.configService.get(
      'GUARD_BASIC_USERNAME',
      'admin',
    );
    const configPassword = this.configService.get(
      'GUARD_BASIC_PASSWORD',
      'password',
    );

    return username === configUsername && password === configPassword;
  }
}
