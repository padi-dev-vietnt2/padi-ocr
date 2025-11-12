import { loggerOptions } from '@libs/logger';
import { publicPath } from '@libs/utils';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'body-parser';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import helmet from 'helmet';
import { WinstonModule } from 'nest-winston';
import { join } from 'path';
import { AppModule } from './app.module';
import { AppConfig } from './config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useStaticAssets(join(__dirname, '..', 'public'));
  app.setBaseViewsDir(join(__dirname, '..', 'views'));
  app.setViewEngine('hbs');

  app.enableCors({
    origin: '*',
    credentials: true,
  });
  app.use(cookieParser());

  app.use(
    helmet({
      contentSecurityPolicy: false, // Disable CSP to allow inline styles and scripts
    }),
  );
  app.use(compression());
  app.use('/api/', json({ limit: '250mb' }));
  app.use(urlencoded({ limit: '250mb', extended: true }));

  const logger = WinstonModule.createLogger(loggerOptions);
  app.useLogger(logger);

  const dir = publicPath();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(publicPath('index.html'), '');
  }

  const config = new DocumentBuilder()
    .setTitle('Question Generator APIs')
    .setDescription('Question Generator API description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('swagger', app, document);

  const port = AppConfig.port;
  await app.listen(port);
  Logger.log(`🚀 Application is running on: http://localhost:${port}/`);
}
bootstrap();
