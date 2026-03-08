/**
 * OpenAI Provider — 공유 빌더/파서 사용
 *
 * 수정된 버그: temperature가 reasoning 모델에도 전송되던 문제 해결
 */

import { BaseProvider } from './base-provider';
import type {
  AIProviderType,
  AIMessage,
  AIRequestOptions,
  AIProviderResponse,
} from '../../domain/interfaces/llm-provider';
import { buildOpenAIBody, parseOpenAIResponse } from 'obsidian-llm-shared';

export class OpenAIProvider extends BaseProvider {
  readonly id: AIProviderType = 'openai';
  readonly name = 'OpenAI';

  async testApiKey(apiKey: string): Promise<boolean> {
    try {
      const body = buildOpenAIBody(
        [{ role: 'user', content: 'Hello' }],
        this.config.defaultModel,
        { maxTokens: 10 }
      );
      const json = await this.makeRequest<Record<string, unknown>>({
        url: `${this.config.endpoint}/chat/completions`,
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return parseOpenAIResponse(json).success;
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
      const body = buildOpenAIBody(messages, model, {
        maxTokens: options?.maxTokens,
        temperature: options?.temperature,
      });

      const json = await this.makeRequest<Record<string, unknown>>({
        url: `${this.config.endpoint}/chat/completions`,
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = parseOpenAIResponse(json);
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
