import {
  BadRequestException,
  Body,
  Controller,
  FileTypeValidator,
  Get,
  MaxFileSizeValidator,
  ParseFilePipe,
  Post,
  Query,
  Render,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { OcrService } from './ocr.service';

@Controller('ocr')
export class OcrController {
  constructor(private readonly ocrService: OcrService) {}

  @Get()
  @Render('ocr')
  root() {
    return {};
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async uploadInvoice(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
          new FileTypeValidator({
            fileType: /(image\/(png|jpeg|jpg|gif|webp)|application\/pdf)/,
          }),
        ],
        exceptionFactory: (errors) => new BadRequestException(errors),
      }),
    )
    file: Express.Multer.File,
    @Query('provider') provider?: 'gemini' | 'openai',
  ) {
    const result = await this.ocrService.processInvoice(file, provider);
    return result;
  }
}
