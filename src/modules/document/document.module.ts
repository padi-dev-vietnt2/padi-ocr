import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { DocumentService } from './document.service';
import { DocumentController } from './document.controller';

@Module({
  imports: [HttpModule],
  controllers: [DocumentController],
  providers: [DocumentService],
})
export class DocumentModule {}
