import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { env } from '../../config/env';
import { AppError } from '../../utils/errors';
import { SYSTEM_INSTRUCTION, buildUserPrompt } from '../../modules/analysis/prompt';
import type { AnalyzeInput, LLMProvider, RawAnalysis } from './provider';

/**
 * Gemini implementation of LLMProvider.
 *
 * Uses structured output (responseMimeType=application/json + responseSchema) so
 * the model is constrained to the exact citation-bearing shape at the API level,
 * eliminating fragile free-text JSON parsing.
 */

const citationsSchema = {
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: { timestamp: { type: SchemaType.STRING } },
    required: ['timestamp'],
  },
} as const;

const responseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    summary: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: { text: { type: SchemaType.STRING }, citations: citationsSchema },
        required: ['text', 'citations'],
      },
    },
    actionItems: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          task: { type: SchemaType.STRING },
          assignee: { type: SchemaType.STRING, nullable: true },
          citations: citationsSchema,
        },
        required: ['task', 'citations'],
      },
    },
    decisions: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: { text: { type: SchemaType.STRING }, citations: citationsSchema },
        required: ['text', 'citations'],
      },
    },
    followUps: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: { text: { type: SchemaType.STRING }, citations: citationsSchema },
        required: ['text', 'citations'],
      },
    },
  },
  required: ['summary', 'actionItems', 'decisions', 'followUps'],
} as const;

export class GeminiProvider implements LLMProvider {
  public readonly model: string;
  private readonly client: GoogleGenerativeAI;

  constructor() {
    if (!env.GEMINI_API_KEY) {
      throw AppError.dependency('GEMINI_API_KEY is not configured');
    }
    this.client = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    this.model = env.GEMINI_MODEL;
  }

  async analyzeTranscript(input: AnalyzeInput): Promise<RawAnalysis> {
    const model = this.client.getGenerativeModel({
      model: this.model,
      systemInstruction: SYSTEM_INSTRUCTION,
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        responseSchema: responseSchema as any,
      },
    });

    let text: string;
    try {
      const result = await model.generateContent(buildUserPrompt(input));
      text = result.response.text();
    } catch (err) {
      throw AppError.dependency('LLM request failed', {
        provider: 'gemini',
        message: (err as Error).message,
      });
    }

    try {
      return JSON.parse(text) as RawAnalysis;
    } catch {
      throw AppError.dependency('LLM returned non-JSON output', { raw: text.slice(0, 500) });
    }
  }
}
