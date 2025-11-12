import { Global, Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { BasicStrategy, JwtStrategy, PassKeyStrategy } from './strategies';

@Global()
@Module({
  imports: [PassportModule],
  providers: [BasicStrategy, PassKeyStrategy, JwtStrategy],
})
export class GuardsModule {}
