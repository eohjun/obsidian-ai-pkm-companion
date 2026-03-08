/**
 * Gemini Provider — 공유 빌더/파서 사용
 */

import { BaseProvider } from './base-provider';
import type {
  AIProviderType,
  AIMessage,
  AIRequestOptions,
  AIProviderResponse,
} from '../../domain/interfaces/llm-provider';
import { buildGeminiBody, parseGeminiResponse, getGeminiGenerateUrl } from 'obsidian-llm-shared';

export class GeminiProvider extends BaseProvider {
  readonly id: AIProviderType = 'gemini';
  readonly name = 'Google Gemini';

  async testApiKey(apiKey: string): Promise<boolean> {
    try {
      const body = buildGeminiBody(
        [{ role: 'user', content: 'Hello' }],
        this.config.defaultModel,
        { maxTokens: 10 }
      );
      const url = getGeminiGenerateUrl(this.config.defaultModel, apiKey, this.config.endpoint);
      const json = await this.makeRequest<Record<string, unknown>>({
        url,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return parseGeminiResponse(json).success;
    } catch {
      return false;
    }
  }

  async generateText(
    messages: AIMessage[],
    apiKey: string,
    options?: AIRequestOptions
  ): Promise<AIProviderResponse> {
    try {
      const model = options?.model || this.config.defaultModel;
      const body = buildGeminiBody(messages, model, {
        maxTokens: options?.maxTokens,
        temperature: options?.temperature,
      });

      const url = getGeminiGenerateUrl(model, apiKey, this.config.endpoint);

      const json = await this.makeRequest<Record<string, unknown>>({
        url,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = parseGeminiResponse(json);
      if (!result.success) {
        return { success: false, content: '', error: result.error, errorCode: 'API_ERROR' };
      }

      return {
        success: true,
        content: result.text,
        tokensUsed: result.usage.totalTokens,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }
}
