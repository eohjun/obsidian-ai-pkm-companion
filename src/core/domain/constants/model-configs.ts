/**
 * Model Configurations
 * Centralized model settings, pricing, and token limits
 */

import type { AIProviderType, AIProviderConfig, FeatureType } from '../interfaces/llm-provider';

export type ModelTier = 'economy' | 'standard' | 'premium';

export interface ModelConfig {
  id: string;
  displayName: string;
  provider: AIProviderType;
  tier: ModelTier;
  inputCostPer1M: number;
  outputCostPer1M: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  supportsVision: boolean;
  supportsStreaming: boolean;
}

export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  // Claude Models
  'claude-opus-4.6': {
    id: 'claude-opus-4-6',
    displayName: 'Claude Opus 4.6',
    provider: 'claude',
    tier: 'premium',
    inputCostPer1M: 5.0,
    outputCostPer1M: 25.0,
    maxInputTokens: 200000,
    maxOutputTokens: 128000,
    supportsVision: true,
    supportsStreaming: true,
  },
  'claude-sonnet-4.6': {
    id: 'claude-sonnet-4-6',
    displayName: 'Claude Sonnet 4.6',
    provider: 'claude',
    tier: 'standard',
    inputCostPer1M: 3.0,
    outputCostPer1M: 15.0,
    maxInputTokens: 200000,
    maxOutputTokens: 64000,
    supportsVision: true,
    supportsStreaming: true,
  },
  'claude-haiku-4.5': {
    id: 'claude-haiku-4-5-20251001',
    displayName: 'Claude Haiku 4.5',
    provider: 'claude',
    tier: 'economy',
    inputCostPer1M: 1.0,
    outputCostPer1M: 5.0,
    maxInputTokens: 200000,
    maxOutputTokens: 64000,
    supportsVision: true,
    supportsStreaming: true,
  },

  // Gemini Models
  'gemini-3.1-pro': {
    id: 'gemini-3.1-pro-preview',
    displayName: 'Gemini 3.1 Pro',
    provider: 'gemini',
    tier: 'premium',
    inputCostPer1M: 2.0,
    outputCostPer1M: 12.0,
    maxInputTokens: 1000000,
    maxOutputTokens: 65536,
    supportsVision: true,
    supportsStreaming: true,
  },
  'gemini-2.5-flash': {
    id: 'gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
    provider: 'gemini',
    tier: 'standard',
    inputCostPer1M: 0.3,
    outputCostPer1M: 2.5,
    maxInputTokens: 1000000,
    maxOutputTokens: 65536,
    supportsVision: true,
    supportsStreaming: true,
  },
  'gemini-2-flash': {
    id: 'gemini-2.0-flash',
    displayName: 'Gemini 2.0 Flash',
    provider: 'gemini',
    tier: 'economy',
    inputCostPer1M: 0.1,
    outputCostPer1M: 0.4,
    maxInputTokens: 1000000,
    maxOutputTokens: 8192,
    supportsVision: true,
    supportsStreaming: true,
  },

  // OpenAI Models
  'gpt-5.4': {
    id: 'gpt-5.4',
    displayName: 'GPT-5.4',
    provider: 'openai',
    tier: 'premium',
    inputCostPer1M: 2.5,
    outputCostPer1M: 15.0,
    maxInputTokens: 1050000,
    maxOutputTokens: 128000,
    supportsVision: true,
    supportsStreaming: true,
  },
  'gpt-5-mini': {
    id: 'gpt-5-mini',
    displayName: 'GPT-5 Mini',
    provider: 'openai',
    tier: 'standard',
    inputCostPer1M: 0.25,
    outputCostPer1M: 2.0,
    maxInputTokens: 400000,
    maxOutputTokens: 128000,
    supportsVision: true,
    supportsStreaming: true,
  },
  'gpt-5-nano': {
    id: 'gpt-5-nano',
    displayName: 'GPT-5 Nano',
    provider: 'openai',
    tier: 'economy',
    inputCostPer1M: 0.05,
    outputCostPer1M: 0.4,
    maxInputTokens: 400000,
    maxOutputTokens: 128000,
    supportsVision: true,
    supportsStreaming: true,
  },

  // Grok Models
  'grok-4.1-fast': {
    id: 'grok-4-1-fast',
    displayName: 'Grok 4.1 Fast',
    provider: 'grok',
    tier: 'standard',
    inputCostPer1M: 0.2,
    outputCostPer1M: 0.5,
    maxInputTokens: 2000000,
    maxOutputTokens: 16384,
    supportsVision: true,
    supportsStreaming: true,
  },
  'grok-4.1-fast-non-reasoning': {
    id: 'grok-4-1-fast-non-reasoning',
    displayName: 'Grok 4.1 Fast (Non-Reasoning)',
    provider: 'grok',
    tier: 'economy',
    inputCostPer1M: 0.2,
    outputCostPer1M: 0.5,
    maxInputTokens: 2000000,
    maxOutputTokens: 16384,
    supportsVision: true,
    supportsStreaming: true,
  },
};

/**
 * Provider configurations
 */
export const AI_PROVIDERS: Record<AIProviderType, AIProviderConfig> = {
  claude: {
    id: 'claude',
    name: 'Anthropic Claude',
    displayName: 'Claude',
    endpoint: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-sonnet-4-6',
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    displayName: 'Gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta',
    apiKeyPrefix: 'AIza',
    defaultModel: 'gemini-2.5-flash',
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    displayName: 'OpenAI',
    endpoint: 'https://api.openai.com/v1',
    apiKeyPrefix: 'sk-',
    defaultModel: 'gpt-5-mini',
  },
  grok: {
    id: 'grok',
    name: 'xAI Grok',
    displayName: 'Grok',
    endpoint: 'https://api.x.ai/v1',
    defaultModel: 'grok-4-1-fast',
  },
};

/**
 * Default models per feature
 */
export const FEATURE_DEFAULT_MODELS: Record<FeatureType, Record<AIProviderType, string>> = {
  'content-analysis': {
    claude: 'claude-haiku-4-5-20251001',
    gemini: 'gemini-2.0-flash',
    openai: 'gpt-5-nano',
    grok: 'grok-4-1-fast-non-reasoning',
  },
  'permanent-note': {
    claude: 'claude-sonnet-4-6',
    gemini: 'gemini-2.5-flash',
    openai: 'gpt-5-mini',
    grok: 'grok-4-1-fast',
  },
};

/**
 * Calculate estimated cost for token usage
 */
export function calculateCost(
  modelKey: string,
  inputTokens: number,
  outputTokens: number
): number {
  const config = MODEL_CONFIGS[modelKey];
  if (!config) return 0;

  const inputCost = (inputTokens / 1_000_000) * config.inputCostPer1M;
  const outputCost = (outputTokens / 1_000_000) * config.outputCostPer1M;
  return inputCost + outputCost;
}

/**
 * Get models for a specific provider
 */
export function getModelsByProvider(provider: AIProviderType): ModelConfig[] {
  return Object.values(MODEL_CONFIGS).filter((m: ModelConfig) => m.provider === provider);
}

/**
 * Get model configuration by model ID
 */
export function getModelConfigById(modelId: string): ModelConfig | undefined {
  return Object.values(MODEL_CONFIGS).find((m: ModelConfig) => m.id === modelId);
}

/**
 * Estimate token count from text
 * Rough approximation: ~4 chars = 1 token for English, ~2 chars = 1 token for Korean
 */
export function estimateTokens(text: string): number {
  const koreanChars = (text.match(/[\uAC00-\uD7AF]/g) || []).length;
  const otherChars = text.length - koreanChars;
  return Math.ceil(koreanChars / 2 + otherChars / 4);
}

/**
 * Get default model for a specific feature and provider
 */
export function getDefaultModelForFeature(
  feature: FeatureType,
  provider: AIProviderType
): string {
  return FEATURE_DEFAULT_MODELS[feature][provider];
}

/**
 * Get models by tier
 */
export function getModelsByTier(tier: ModelTier): ModelConfig[] {
  return Object.values(MODEL_CONFIGS).filter((m: ModelConfig) => m.tier === tier);
}
