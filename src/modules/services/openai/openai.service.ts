import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface OpenAIConfig {
  apiKey: string;
  model?: string;
}

interface InvoiceData {
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  orderDate?: string;

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
export class OpenAIService {
  private apiKey: string;
  private model: string;
  private apiUrl = 'https://api.openai.com/v1/chat/completions';

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('OPENAI_API_KEY') || '';
    this.model =
      this.configService.get<string>('OPENAI_MODEL') || 'gpt-4.1-nano';
  }

  /**
   * Extract invoice data from an image using OpenAI Vision API
   * @param base64Image Base64 encoded image string
   * @param mimeType MIME type of the image (e.g., 'image/jpeg', 'image/png')
   * @returns Extracted invoice data
   */
  async extractInvoiceData(
    base64Image: string,
    mimeType: string,
  ): Promise<InvoiceData> {
    console.log('openai');

    const prompt = `Analyze this invoice/receipt image and extract ALL relevant information in JSON format.

Extract the following fields if available:

DOCUMENT INFORMATION:
- invoiceNumber: The invoice/receipt number
- invoiceDate: The invoice/receipt date
- dueDate: The payment due date
- orderDate: The order creation date/time

PROVIDER/VENDOR INFORMATION:
- providerName: The vendor/seller/company name
- providerAddress: The vendor's full address
- providerPhone: The vendor's phone number
- providerEmail: The vendor's email address
- providerTaxId: The vendor's tax ID or registration number

CUSTOMER/BUYER INFORMATION:
- customerName: The customer/buyer name
- customerAddress: The customer's full address
- customerPhone: The customer's phone number
- customerEmail: The customer's email address
- customerTaxId: The customer's tax ID or registration number

LINE ITEMS:
- items: An array of line items, each containing:
  - itemNumber: Item number or SKU
  - description: Item description or name
  - quantity: Quantity purchased
  - unitPrice: Unit price per item
  - discount: Discount applied (if any)
  - tax: Tax amount for this item (if itemized)
  - total: Total price for this line item

FINANCIAL SUMMARY:
- subtotal: Subtotal amount before tax and discounts
- discount: Total discount amount
- taxRate: Tax rate percentage
- taxAmount: Total tax amount
- shippingCost: Shipping or delivery cost
- total: Final total amount

PAYMENT INFORMATION:
- paymentMethod: Payment method used (cash, card, etc.)
- paymentStatus: Payment status (paid, pending, etc.)
- paymentTerms: Payment terms or conditions

ADDITIONAL INFORMATION:
- notes: Any additional notes or comments
- terms: Terms and conditions

IMPORTANT:
1. Return ONLY valid JSON without any markdown formatting, code blocks, or additional text
2. Use null for fields that are not found in the image
3. Ensure all numeric values are numbers, not strings
4. Parse dates in ISO format if possible (YYYY-MM-DD)
5. Be thorough and extract ALL visible information from the invoice`;

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'hello',
                },
                // {
                //   type: 'image_url',
                //   image_url: {
                //     url: `data:${mimeType};base64,${base64Image}`,
                //   },
                // },
              ],
            },
          ],
          max_tokens: 4096,
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      if (!data.choices || data.choices.length === 0) {
        throw new Error('No response from OpenAI API');
      }

      const textResponse = data.choices[0].message.content;

      // Remove markdown code blocks if present
      const cleanedText = textResponse
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      // Parse the JSON response
      const invoiceData = JSON.parse(cleanedText);

      // Extract token usage information from the response
      const usage = data.usage || {};
      const tokenUsage = {
        inputTokens: usage.prompt_tokens || 0,
        outputTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0,
      };

      // Return both invoice data and token usage
      return {
        ...invoiceData,
        _tokenUsage: tokenUsage,
      };
    } catch (error) {
      console.error('Error calling OpenAI API:', error);
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
