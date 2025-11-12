import { Module } from '@nestjs/common';
import { GeminiModule } from '../services/gemini/gemini.module';
import { OpenAIModule } from '../services/openai/openai.module';
import { OcrController } from './ocr.controller';
import { OcrService } from './ocr.service';

@Module({
  imports: [GeminiModule, OpenAIModule],
  controllers: [OcrController],
  providers: [OcrService],
})
export class OcrModule {}
