import {
  BadRequestException,
  Body,
  Controller,
  FileTypeValidator,
  MaxFileSizeValidator,
  ParseFilePipe,
  Post,
  Query,
  Sse,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { DocumentService } from './document.service';
import { QuestionGenerateDto, SessionIdDto } from './dtos';

@Controller('documents')
export class DocumentController {
  constructor(private readonly service: DocumentService) {}

  @Sse('stream')
  stream(@Query() inputs: SessionIdDto) {
    return this.service.streamReply(inputs.sessionId);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 50 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: 'application/pdf' }),
        ],
        exceptionFactory: (errors) => new BadRequestException(errors),
      }),
    )
    file: Express.Multer.File,
    @Body() inputs: QuestionGenerateDto,
  ) {
    this.service.extractQuestionsFromFile(file, inputs);
    return {
      successfully: true,
    };
  }
}
