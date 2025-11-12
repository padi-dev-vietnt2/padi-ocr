import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeminiService } from '../services/gemini/gemini.service';
import { OpenAIService } from '../services/openai/openai.service';

@Injectable()
export class OcrService {
  private ocrProvider: 'gemini' | 'openai';

  constructor(
    private readonly geminiService: GeminiService,
    private readonly openaiService: OpenAIService,
    private readonly configService: ConfigService,
  ) {
    // Get OCR provider from environment variable, default to gemini
    this.ocrProvider =
      (this.configService.get<string>('OCR_PROVIDER') as 'gemini' | 'openai') ||
      'gemini';
  }

  async processInvoice(
    file: Express.Multer.File,
    provider?: 'gemini' | 'openai',
  ): Promise<any> {
    try {
      // Use the provider parameter if provided, otherwise use the configured default
      const selectedProvider = provider || this.ocrProvider;

      let base64Image: string;
      let mimeType: string;
      let invoiceData: any;

      if (selectedProvider === 'openai') {
        // Use OpenAI
        base64Image = this.openaiService.bufferToBase64(file.buffer);
        mimeType = this.openaiService.getMimeType(file);
        invoiceData = await this.openaiService.extractInvoiceData(
          base64Image,
          mimeType,
        );
      } else {
        // Use Gemini (default)
        base64Image = this.geminiService.bufferToBase64(file.buffer);
        mimeType = this.geminiService.getMimeType(file);
        invoiceData = await this.geminiService.extractInvoiceData(
          base64Image,
          mimeType,
        );
      }

      // Add provider information to response
      return {
        ...invoiceData,
        _provider: selectedProvider,
      };
    } catch (error) {
      console.error('Error processing invoice:', error);

      throw new Error(`Internal Server Error`);
    }
  }
}
