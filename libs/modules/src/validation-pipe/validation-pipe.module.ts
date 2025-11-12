import { BadRequestException, Module, ValidationPipe } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { ValidationError } from 'class-validator';

@Module({
  providers: [
    {
      provide: APP_PIPE,
      useFactory: () =>
        new ValidationPipe({
          transform: true,
          whitelist: true,
          exceptionFactory: (validationErrors: ValidationError[] = []) => {
            const errors = validationErrors.reduce((errors, error) => {
              return {
                ...errors,
                [error.property]: Object.values(
                  error.constraints || '(UNKNOWN ERROR)',
                ),
              };
            }, {});
            return new BadRequestException({ errors });
          },
        }),
    },
  ],
})
export class ValidationPipeModule {}
