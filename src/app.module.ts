import { LoggerModule } from '@libs/logger';
import {
  ExceptionFilterModule,
  GuardsModule,
  ValidationPipeModule,
} from '@libs/modules';
import { publicPath } from '@libs/utils';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { DocumentModule } from './modules/document/document.module';
import { OcrModule } from './modules/ocr/ocr.module';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: publicPath(),
    }),

    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),

    LoggerModule,

    ValidationPipeModule,
    ExceptionFilterModule,

    GuardsModule,

    DocumentModule,
    OcrModule,
  ],
})
export class AppModule {}
