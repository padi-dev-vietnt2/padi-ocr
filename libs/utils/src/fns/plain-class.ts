import { DECORATORS } from '@nestjs/swagger/dist/constants';
import {
  ClassConstructor,
  ClassTransformOptions,
  Expose,
  plainToClass,
} from 'class-transformer';
import 'reflect-metadata';

export function plainClass<T, V>(
  cls: ClassConstructor<T>,
  plain: V | V[],
  options?: ClassTransformOptions,
): T | T[] {
  return plainToClass(cls, plain, {
    excludeExtraneousValues: true,
    ...options,
  });
}

export function AutoExpose(): ClassDecorator {
  return (target: any) => {
    let keys: string[] =
      Reflect.getMetadata(
        DECORATORS.API_MODEL_PROPERTIES_ARRAY,
        target.prototype,
      ) || [];

    keys = keys.map((k) => (k.startsWith(':') ? k.slice(1) : k));
    for (const key of keys) {
      Expose()(target.prototype, key);
    }
  };
}
