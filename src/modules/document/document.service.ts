import { GoogleGenAI, Type } from '@google/genai';
import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PDFDocument } from 'pdf-lib';
import {
  bufferCount,
  from,
  map,
  mergeMap,
  of,
  scan,
  Subject,
  takeWhile,
  tap,
} from 'rxjs';
import {
  LANGUAGES,
  QUESTION_TYPES,
  QuestionGenerateDto,
  SessionState,
} from './dtos';

@Injectable()
export class DocumentService {
  private sessions: Map<string, SessionState> = new Map();

  private googleGenAi: GoogleGenAI;

  constructor(
    protected configService: ConfigService,
    protected httpService: HttpService,
    protected logger: Logger,
  ) {
    this.googleGenAi = new GoogleGenAI({
      apiKey: this.configService.get<string>('GOOGLE_GENERATIVE_AI_API_KEY'),
    });
  }

  private ensureSession(sessionId: string) {
    if (!this.sessions.has(sessionId)) {
      const session: SessionState = {
        stream$: new Subject<MessageEvent>(),
      };
      this.sessions.set(sessionId, session);
    }

    return this.sessions.get(sessionId)!;
  }

  async extractQuestionsFromFile(
    file: Express.Multer.File,
    inputs: QuestionGenerateDto,
  ): Promise<any> {
    const { buffer, mimetype } = file;
    const { stream$ } = this.ensureSession(inputs.sessionId);

    const pdfDoc = await PDFDocument.load(buffer);
    const totalPages = pdfDoc.getPageCount();

    const pagesPerChunk = Math.min(
      Math.ceil(totalPages / inputs.numberOfQuestions),
      3,
    );

    const totalChunks = Math.ceil(totalPages / pagesPerChunk);
    const questionPerChunk = Math.max(
      Math.ceil(inputs.numberOfQuestions / totalChunks),
      1,
    );

    const concurrent = Math.min(totalChunks, inputs?.numberOfQuestions, 5);
    const prompt = this.generatePrompt(inputs, questionPerChunk);

    from(Array.from({ length: totalPages }, (_, i) => i))
      .pipe(
        bufferCount(pagesPerChunk),
        mergeMap(async (pageIndexes) => {
          const chunkDoc = await PDFDocument.create();
          const copiedPages = await chunkDoc.copyPages(pdfDoc, pageIndexes);
          copiedPages.forEach((p) => chunkDoc.addPage(p));
          const chunkBuffer = await chunkDoc.save();
          return Buffer.from(chunkBuffer);
        }, concurrent),
        mergeMap((chunk) => {
          const contents = [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimetype,
                data: chunk.toString('base64'),
              },
            },
          ];
          return this.sendAiGenerateContent({
            prompt: contents,
            config: this.generateQuestionPromptConfig(),
          })
            .then((res) => res?.parsedResult)
            .catch((err) => {
              this.logger.error('sendAiGenerateContent', {
                err: err?.message || err,
              });
              return null;
            });
        }, concurrent),
        mergeMap((res) => (Array.isArray(res) ? from(res) : of(res))),
        map((question, index) => {
          const progress = {
            total: inputs.numberOfQuestions,
            generated: index + 1,
            percent: Math.round(((index + 1) / inputs.numberOfQuestions) * 100),
          };
          stream$.next(
            new MessageEvent('system', {
              data: {
                question: { ...question, saveData: inputs?.saveData ?? {} },
                progress,
              },
            }),
          );
          return question;
        }),
        scan(
          (acc) => ({
            count: acc.count + 1,
          }),
          { count: 0 },
        ),
        takeWhile((acc) => acc.count < inputs.numberOfQuestions, true),
      )
      .subscribe();
  }

  generatePrompt(
    inputs: QuestionGenerateDto,
    questionPerChunk: number = 1,
  ): string {
    const language = this.getLanguage(inputs.language);

    switch (inputs.questionType) {
      case QUESTION_TYPES.singleChoice:
        return `
          Generate ${questionPerChunk} ${inputs.questionType} questions based on the document file:
          Each question should have four answer choices labeled as A, B, C, and D.
          Provide the output as a valid JSON array with the following structure:
          
          [
            {
              "question": "What is X?",
              "options": {
                "A": "Option A text",
                "B": "Option B text",
                "C": "Option C text",
                "D": "Option D text"
              },
              "answer": "A/B/C/D"
            }
          ]
          
          Ensure:
          - The language used in the questions and answers is ${language}.
          - The field "level" represents the difficulty level of the question, from 1 (very easy) to 5 (very difficult).
          - All generated questions must be at difficulty level ${inputs.level}.
          - The correct answer is returned as a single letter: "A", "B", "C", or "D".
          - The response is a valid JSON array without any additional formatting or markdown. Do NOT include triple backticks (\`\`\`), newlines outside JSON, or extra explanations.
        `;
      case QUESTION_TYPES.fillInTheBlank:
        return `
          Generate ${questionPerChunk} ${inputs.questionType} questions based on the document file:
          Each question should have four answer choices labeled as A, B, C, and D. Question should have a blank space represented by "_____".
          Provide the output as a valid JSON array with the following structure:
          
          [
            {
              "question": "X is _____, in Hanoi.",
              "options": {
                "A": "Option A text",
                "B": "Option B text",
                "C": "Option C text",
                "D": "Option D text"
              },
              "answer": "A/B/C/D"
            }
          ]
          
          Ensure:
          - The language used in the questions and answers is ${language}.
          - The field "level" represents the difficulty level of the question, from 1 (very easy) to 5 (very difficult).
          - All generated questions must be at difficulty level ${inputs.level}.
          - The correct answer is returned as a single letter: "A", "B", "C", or "D".
          - The response is a valid JSON array without any additional formatting or markdown. Do NOT include triple backticks (\`\`\`), newlines outside JSON, or extra explanations.
        `;
    }
  }

  generateQuestionPromptConfig() {
    return {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            question: {
              type: Type.STRING,
            },
            options: {
              type: Type.OBJECT,
              properties: {
                A: { type: Type.STRING },
                B: { type: Type.STRING },
                C: { type: Type.STRING },
                D: { type: Type.STRING },
              },
              required: ['A', 'B', 'C', 'D'],
            },
            answer: {
              type: Type.STRING,
            },
          },
          propertyOrdering: ['question', 'options', 'answer'],
        },
      },
    };
  }

  async sendAiGenerateContent({ prompt, config = {}, depth = 0 }) {
    const _config = { responseMimeType: 'application/json', ...config };
    const result = await this.googleGenAi.models.generateContent({
      model: 'gemini-2.5-flash	',
      contents: prompt,
      config: _config,
    });

    if (_config?.responseMimeType !== 'application/json') {
      return {
        result,
        parsedResult: result.text,
      };
    }

    let parsedResult = this.parseJson(result.text);
    if (parsedResult === undefined) {
      if (depth > 3) {
        throw new Error('Failed to parse JSON after multiple attempts');
      }

      return this.sendAiGenerateContent({ prompt, config, depth: depth + 1 });
    }

    if (Array.isArray(parsedResult) && parsedResult.length === 1) {
      parsedResult = parsedResult[0];
    }

    return {
      result,
      parsedResult,
    };
  }

  async sendAiGenerateContentStream({ prompt, config = {} }) {
    return await this.googleGenAi.models.generateContentStream({
      model: 'gemini-2.5-flash	',
      contents: prompt,
      config,
    });
  }

  private getLanguage(language: LANGUAGES) {
    switch (language) {
      case LANGUAGES.ja:
        return 'Japanese';

      case LANGUAGES.vi:
        return 'Vietnamese';

      default:
        return 'English';
    }
  }

  parseJson(string) {
    try {
      return JSON.parse(string);
    } catch {
      return undefined;
    }
  }

  streamReply(sessionId: string) {
    const { stream$ } = this.ensureSession(sessionId);
    return stream$.asObservable();
  }

  async splitPdfBuffer(
    pdfBuffer: Buffer,
    pagesPerChunk = 10,
  ): Promise<Buffer[]> {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const totalPages = pdfDoc.getPageCount();
    const chunks: Buffer[] = [];

    for (let i = 0; i < totalPages; i += pagesPerChunk) {
      const chunkDoc = await PDFDocument.create();
      const end = Math.min(i + pagesPerChunk, totalPages);

      const copiedPages = await chunkDoc.copyPages(
        pdfDoc,
        Array.from({ length: end - i }, (_, idx) => i + idx),
      );

      copiedPages.forEach((page) => chunkDoc.addPage(page));

      const chunkBuffer = await chunkDoc.save();
      chunks.push(Buffer.from(chunkBuffer));
    }

    return chunks;
  }
}
