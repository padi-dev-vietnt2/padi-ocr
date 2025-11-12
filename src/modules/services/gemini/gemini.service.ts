import { GoogleGenAI, Type } from '@google/genai';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface GeminiConfig {
  apiKey: string;
  model?: string;
}

interface InvoiceData {
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  orderDate?: string;
  currency?: string; // ISO 4217 currency code (USD, EUR, VND, etc.)

  // Provider/Vendor information
  providerName?: string;
  providerAddress?: string;
  providerPhone?: string;
  providerEmail?: string;
  providerTaxId?: string;

  // Customer information
  customerName?: string;
  customerAddress?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerTaxId?: string;

  // Line items
  items?: Array<{
    itemNumber?: string;
    description: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
    tax?: number;
    total: number;
  }>;

  // Financial summary
  subtotal?: number;
  discount?: number;
  taxRate?: number;
  taxAmount?: number;
  shippingCost?: number;
  total?: number;

  // Payment information
  paymentMethod?: string;
  paymentStatus?: string;
  paymentTerms?: string;

  // Additional notes
  notes?: string;
  terms?: string;

  [key: string]: any;
}

@Injectable()
export class GeminiService {
  private googleGenAi: GoogleGenAI;
  private model: string;

  constructor(private configService: ConfigService) {
    const apiKey =
      this.configService.get<string>('GOOGLE_GENERATIVE_AI_API_KEY') || '';
    this.googleGenAi = new GoogleGenAI({ apiKey });
    this.model =
      this.configService.get<string>('GEMINI_MODEL') || 'gemini-2.5-flash';
  }

  /**
   * Generate invoice extraction prompt configuration with JSON schema
   * @returns Configuration object with responseMimeType and responseSchema
   */
  private generateInvoicePromptConfig() {
    return {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          documentInfo: {
            type: Type.OBJECT,
            properties: {
              invoiceNumber: { type: Type.STRING, nullable: true },
              invoiceDate: { type: Type.STRING, nullable: true },
              dueDate: { type: Type.STRING, nullable: true },
              orderDate: { type: Type.STRING, nullable: true },
              currency: {
                type: Type.STRING,
                nullable: true,
                description:
                  'ISO 4217 currency code (e.g., USD, EUR, GBP, VND, JPY)',
              },
            },
          },
          providerInfo: {
            type: Type.OBJECT,
            properties: {
              providerName: { type: Type.STRING, nullable: true },
              providerAddress: { type: Type.STRING, nullable: true },
              providerPhone: { type: Type.STRING, nullable: true },
              providerEmail: { type: Type.STRING, nullable: true },
              providerTaxId: { type: Type.STRING, nullable: true },
            },
          },
          customerInfo: {
            type: Type.OBJECT,
            properties: {
              customerName: { type: Type.STRING, nullable: true },
              customerAddress: { type: Type.STRING, nullable: true },
              customerPhone: { type: Type.STRING, nullable: true },
              customerEmail: { type: Type.STRING, nullable: true },
              customerTaxId: { type: Type.STRING, nullable: true },
            },
          },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                itemNumber: { type: Type.STRING, nullable: true },
                description: { type: Type.STRING },
                quantity: { type: Type.NUMBER },
                unitPrice: { type: Type.NUMBER },
                discount: { type: Type.NUMBER, nullable: true },
                tax: { type: Type.NUMBER, nullable: true },
                total: { type: Type.NUMBER },
              },
              required: ['description', 'quantity', 'unitPrice', 'total'],
            },
          },
          financialSummary: {
            type: Type.OBJECT,
            properties: {
              subtotal: { type: Type.NUMBER, nullable: true },
              discount: { type: Type.NUMBER, nullable: true },
              taxRate: { type: Type.NUMBER, nullable: true },
              taxAmount: { type: Type.NUMBER, nullable: true },
              shippingCost: { type: Type.NUMBER, nullable: true },
              total: { type: Type.NUMBER, nullable: true },
            },
          },
          paymentInfo: {
            type: Type.OBJECT,
            properties: {
              paymentMethod: { type: Type.STRING, nullable: true },
              paymentStatus: { type: Type.STRING, nullable: true },
              paymentTerms: { type: Type.STRING, nullable: true },
            },
          },
          additionalInfo: {
            type: Type.OBJECT,
            properties: {
              notes: { type: Type.STRING, nullable: true },
              terms: { type: Type.STRING, nullable: true },
            },
          },
        },
        required: ['items'],
      },
    };
  }

  /**
   * Extract invoice data from an image using Gemini Vision API
   * @param base64Image Base64 encoded image string
   * @param mimeType MIME type of the image (e.g., 'image/jpeg', 'image/png')
   * @returns Extracted invoice data
   */
  async extractInvoiceData(
    base64Image: string,
    mimeType: string,
  ): Promise<InvoiceData> {
    console.log('gemini');

    const prompt = `Analyze this invoice/receipt image and extract ALL relevant information.
Extract all visible document information, provider/vendor details, customer/buyer details, line items, financial summary, payment information, and any additional notes or terms.

IMPORTANT INSTRUCTIONS:
1. CURRENCY: Detect the currency used in this invoice from currency symbols (€, $, £, ¥, ₫, etc.), currency codes (USD, EUR, VND, etc.), or country context. Return the ISO 4217 currency code (e.g., USD for US Dollar, EUR for Euro, VND for Vietnamese Dong, GBP for British Pound, JPY for Japanese Yen).

2. NUMBER FORMATTING:
   - DO NOT round any numbers. Extract the EXACT values as shown in the invoice.
   - Be aware that number formatting varies by locale:
     * Some countries use periods (.) as thousands separators and commas (,) as decimal separators (e.g., 1.234,56 = one thousand two hundred thirty-four point fifty-six)
     * Other countries use commas (,) as thousands separators and periods (.) as decimal separators (e.g., 1,234.56 = one thousand two hundred thirty-four point fifty-six)
   - Always return numbers in standard decimal format (using period as decimal separator, no thousands separators)
   - Examples:
     * If you see "1.234,50" → return 1234.50
     * If you see "1,234.50" → return 1234.50
     * If you see "10.000" → return 10000 (if it's a thousands separator) OR 10.000 (if it's actually ten with three decimal places - use context)
   - Preserve all decimal places exactly as shown in the invoice.

3. TAX RATE:
   - Return tax rate as a percentage NUMBER (not decimal).
   - Examples:
     * If you see "10% VAT" or "Tax: 10%" → return 10
     * If you see "5% tax" → return 5
     * If you see "0.08" or "8%" → return 8
   - If the tax rate is shown as a decimal (e.g., 0.10), convert it to percentage (return 10).

4. DATE FORMATTING:
   - Be aware that date formats vary by country and region:
     * US format: MM/DD/YYYY (e.g., 12/31/2024 = December 31, 2024)
     * European/International format: DD/MM/YYYY (e.g., 31/12/2024 = December 31, 2024)
     * ISO format: YYYY-MM-DD (e.g., 2024-12-31)
     * Other formats: DD.MM.YYYY, DD-MM-YYYY, YYYY/MM/DD, etc.
   - Use context clues (currency, language, company location, address) to determine the correct date format.
   - Always return dates in ISO 8601 format: YYYY-MM-DD
   - Examples:
     * If invoice is in European currency and you see "15/03/2024" → return "2024-03-15" (March 15, 2024)
     * If invoice is in USD and you see "03/15/2024" → return "2024-03-15" (March 15, 2024)
     * If you see "31/12/2024" → return "2024-12-31" (this must be December 31st as there's no 31st month)
   - Pay special attention to ambiguous dates like "05/06/2024" - use country context to determine if it's May 6th or June 5th.`;

    // Get JSON schema configuration
    const schemaConfig = this.generateInvoicePromptConfig();

    try {
      const result = await this.googleGenAi.models.generateContent({
        model: this.model,
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Image,
                },
              },
            ],
          },
        ],
        config: {
          temperature: 0.1,
          topK: 32,
          topP: 1,
          maxOutputTokens: 4096,
          ...schemaConfig,
        },
      });

      if (!result || !result.candidates || result.candidates.length === 0) {
        throw new Error('No response from Gemini API');
      }

      const textResponse = result.candidates[0]?.content?.parts?.[0]?.text;

      if (!textResponse) {
        throw new Error('No text response from Gemini API');
      }

      // Parse the JSON response (with structured output, it should be valid JSON)
      const invoiceData = JSON.parse(textResponse);

      // Extract token usage information from the response
      const usageMetadata = result.usageMetadata || {};
      const tokenUsage = {
        inputTokens: usageMetadata.promptTokenCount || 0,
        outputTokens: usageMetadata.candidatesTokenCount || 0,
        totalTokens: usageMetadata.totalTokenCount || 0,
      };

      // Flatten the nested structure to match frontend expectations
      const flattenedData = {
        // Document info
        ...invoiceData.documentInfo,
        // Provider info
        ...invoiceData.providerInfo,
        // Customer info
        ...invoiceData.customerInfo,
        // Line items (keep as array)
        items: invoiceData.items || [],
        // Financial summary
        ...invoiceData.financialSummary,
        // Payment info
        ...invoiceData.paymentInfo,
        // Additional info
        ...invoiceData.additionalInfo,
        // Token usage
        _tokenUsage: tokenUsage,
      };

      return flattenedData;
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      throw new Error(`Failed to extract invoice data: ${error.message}`);
    }
  }

  /**
   * Convert a file buffer to base64 string
   * @param buffer File buffer
   * @returns Base64 encoded string
   */
  bufferToBase64(buffer: Buffer): string {
    return buffer.toString('base64');
  }

  /**
   * Get MIME type from file buffer or filename
   * @param file Express Multer File object
   * @returns MIME type string
   */
  getMimeType(file: Express.Multer.File): string {
    return file.mimetype;
  }
}
