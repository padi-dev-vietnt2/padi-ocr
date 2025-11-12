import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AppExceptionFilter } from './app-exception.filter';

@Module({
  providers: [
    {
      provide: APP_FILTER,
      useClass: AppExceptionFilter,
    },
  ],
})
export class ExceptionFilterModule implements OnModuleInit {
  constructor(private readonly logger: Logger) {}

  onModuleInit() {
    process.on('unhandledRejection', (reason: any) => {
      this.logger.error('[UnhandledRejection]', {
        message: reason instanceof Error ? reason.message : reason,
        stack: reason instanceof Error ? reason.stack : undefined,
      });
    });

    process.on('uncaughtException', (error: Error) => {
      this.logger.error('[UncaughtException]', {
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
      });
    });
  }
}
