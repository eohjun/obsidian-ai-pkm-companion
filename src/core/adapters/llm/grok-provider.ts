/**
 * Grok Provider — 공유 빌더/파서 사용
 *
 * 추가: Reasoning 모델 지원 (grok-4-1-fast)
 */

import { BaseProvider } from './base-provider';
import type {
  AIProviderType,
  AIMessage,
  AIRequestOptions,
  AIProviderResponse,
} from '../../domain/interfaces/llm-provider';
import { buildGrokBody, parseGrokResponse } from 'obsidian-llm-shared';

export class GrokProvider extends BaseProvider {
  readonly id: AIProviderType = 'grok';
  readonly name = 'xAI Grok';

  async testApiKey(apiKey: string): Promise<boolean> {
    try {
      const body = buildGrokBody(
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
      return parseGrokResponse(json).success;
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
      const body = buildGrokBody(messages, model, {
        maxTokens: options?.maxTokens,
        temperature: options?.temperature,
      });

      const json = await this.makeRequest<Record<string, unknown>>({
        url: `${this.config.endpoint}/chat/completions`,
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = parseGrokResponse(json);
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
