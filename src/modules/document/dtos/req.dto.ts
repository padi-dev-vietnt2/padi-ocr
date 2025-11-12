import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { LANGUAGES, QUESTION_TYPES } from './constants';

export class SessionIdDto {
  @IsUUID()
  @IsNotEmpty()
  sessionId: string;
}

export class QuestionGenerateDto extends SessionIdDto {
  @IsEnum(QUESTION_TYPES)
  @IsNotEmpty()
  questionType: QUESTION_TYPES = QUESTION_TYPES.singleChoice;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  numberOfQuestions: number = 1;

  @IsEnum(LANGUAGES)
  @IsNotEmpty()
  language: LANGUAGES = LANGUAGES.en;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  @IsNotEmpty()
  level: number = 2;

  @IsOptional()
  @IsObject()
  @Transform(({ value }) => {
    try {
      return typeof value === 'string' ? JSON.parse(value) : value;
    } catch {
      return {};
    }
  })
  saveData: Record<string, any> = {};
}
