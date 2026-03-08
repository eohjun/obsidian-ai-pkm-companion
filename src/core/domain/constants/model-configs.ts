/**
 * Model Configurations
 *
 * Bridge module: re-exports shared configs from obsidian-llm-shared,
 * plus plugin-specific types, constants, and helper functions.
 */

import type { AIProviderType, AIProviderConfig, FeatureType } from '../interfaces/llm-provider';
import {
  AI_PROVIDERS as SHARED_PROVIDERS,
  MODEL_CONFIGS as SHARED_MODELS,
  getModelsByProvider as sharedGetModelsByProvider,
  getModelConfig as sharedGetModelConfig,
  calculateCost as sharedCalculateCost,
  type ModelConfig as SharedModelConfig,
} from 'obsidian-llm-shared';

// ─── Re-export shared helpers (types come from local interfaces) ────────

export {
  isReasoningModel,
  getEffectiveMaxTokens,
  getThinkingConfig,
  getProviderConfig,
} from 'obsidian-llm-shared';

// ─── Plugin-specific types ──────────────────────────────────────────────

export type ModelTier = 'economy' | 'standard' | 'premium';

/**
 * Extended ModelConfig that adds plugin-specific fields on top of shared config.
 */
export interface ModelConfig extends SharedModelConfig {
  tier: ModelTier;
  maxInputTokens: number;
  maxOutputTokens: number;
  supportsVision: boolean;
  supportsStreaming: boolean;
}

// ─── Tier assignment map (shared models → plugin tiers) ─────────────────

const TIER_MAP: Record<string, ModelTier> = {
  // Claude
  'claude-opus-4-6':           'premium',
  'claude-sonnet-4-6':         'standard',
  'claude-haiku-4-5-20251001': 'economy',
  // OpenAI
  'gpt-5.4':                   'premium',
  'gpt-5-mini':                'standard',
  'gpt-5-nano':                'economy',
  // Gemini
  'gemini-3.1-pro-preview':         'premium',
  'gemini-3.1-flash-lite-preview':  'economy',
  'gemini-2.5-flash':               'standard',
  'gemini-2.0-flash':               'economy',
  // Grok
  'grok-4-1-fast':                  'standard',
  'grok-4-1-fast-non-reasoning':    'economy',
};

function inferTier(model: SharedModelConfig): ModelTier {
  if (TIER_MAP[model.id]) return TIER_MAP[model.id];
  // Fallback heuristic based on cost
  if (model.inputCostPer1M >= 2.0) return 'premium';
  if (model.inputCostPer1M >= 0.2) return 'standard';
  return 'economy';
}

/**
 * Build extended MODEL_CONFIGS from shared models.
 * Maps contextWindow → maxInputTokens, defaultCompletionTokens → maxOutputTokens,
 * and adds tier / vision / streaming flags.
 */
function buildExtendedConfigs(): Record<string, ModelConfig> {
  const result: Record<string, ModelConfig> = {};
  for (const [key, shared] of Object.entries(SHARED_MODELS)) {
    result[key] = {
      ...shared,
      tier: inferTier(shared),
      maxInputTokens: shared.contextWindow,
      maxOutputTokens: shared.defaultCompletionTokens,
      supportsVision: true,   // all current models support vision
      supportsStreaming: true, // all current models support streaming
    };
  }
  return result;
}

export const MODEL_CONFIGS: Record<string, ModelConfig> = buildExtendedConfigs();

// ─── Re-export AI_PROVIDERS (cast to match local AIProviderType) ────────

export const AI_PROVIDERS: Record<AIProviderType, AIProviderConfig> =
  SHARED_PROVIDERS as Record<AIProviderType, AIProviderConfig>;

// ─── Plugin-specific constants ──────────────────────────────────────────

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

// ─── Functions ──────────────────────────────────────────────────────────

/**
 * Calculate estimated cost for token usage.
 * Delegates to shared calculateCost (which looks up model by id).
 */
export function calculateCost(
  modelKey: string,
  inputTokens: number,
  outputTokens: number,
): number {
  return sharedCalculateCost(modelKey, inputTokens, outputTokens);
}

/**
 * Get models for a specific provider (returns extended ModelConfig[]).
 */
export function getModelsByProvider(provider: AIProviderType): ModelConfig[] {
  return Object.values(MODEL_CONFIGS).filter((m) => m.provider === provider);
}

/**
 * Get model configuration by model ID (searches by .id field).
 */
export function getModelConfigById(modelId: string): ModelConfig | undefined {
  return Object.values(MODEL_CONFIGS).find((m) => m.id === modelId);
}

/**
 * Estimate token count from text.
 * Rough approximation: ~4 chars = 1 token for English, ~2 chars = 1 token for Korean.
 */
export function estimateTokens(text: string): number {
  const koreanChars = (text.match(/[\uAC00-\uD7AF]/g) || []).length;
  const otherChars = text.length - koreanChars;
  return Math.ceil(koreanChars / 2 + otherChars / 4);
}

/**
 * Get default model for a specific feature and provider.
 */
export function getDefaultModelForFeature(
  feature: FeatureType,
  provider: AIProviderType,
): string {
  return FEATURE_DEFAULT_MODELS[feature][provider];
}

/**
 * Get models by tier.
 */
export function getModelsByTier(tier: ModelTier): ModelConfig[] {
  return Object.values(MODEL_CONFIGS).filter((m) => m.tier === tier);
}
