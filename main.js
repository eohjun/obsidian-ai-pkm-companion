var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => NoteTopicFinderPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian5 = require("obsidian");

// src/core/application/services/event-emitter.ts
var EventEmitter = class {
  constructor() {
    this.listeners = /* @__PURE__ */ new Map();
  }
  /**
   * Subscribe to an event
   * @returns Unsubscribe function
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, /* @__PURE__ */ new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }
  /**
   * Unsubscribe from an event
   */
  off(event, callback) {
    var _a;
    (_a = this.listeners.get(event)) == null ? void 0 : _a.delete(callback);
  }
  /**
   * Emit an event to all listeners
   */
  emit(event, data) {
    var _a;
    (_a = this.listeners.get(event)) == null ? void 0 : _a.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Event handler error for ${event}:`, error);
      }
    });
  }
  /**
   * Subscribe to an event once (auto-unsubscribe after first call)
   */
  once(event, callback) {
    const unsubscribe = this.on(event, (data) => {
      unsubscribe();
      callback(data);
    });
  }
  /**
   * Remove all listeners for an event (or all events)
   */
  removeAllListeners(event) {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
  /**
   * Get listener count for an event
   */
  listenerCount(event) {
    var _a, _b;
    return (_b = (_a = this.listeners.get(event)) == null ? void 0 : _a.size) != null ? _b : 0;
  }
};
var emitterInstance = null;
function getEventEmitter() {
  if (!emitterInstance) {
    emitterInstance = new EventEmitter();
  }
  return emitterInstance;
}
function resetEventEmitter() {
  if (emitterInstance) {
    emitterInstance.removeAllListeners();
  }
  emitterInstance = null;
}

// src/core/domain/entities/job.ts
function createJob(type, data, options = {}) {
  var _a, _b;
  return {
    id: generateJobId(),
    type,
    status: "pending",
    progress: 0,
    data,
    createdAt: /* @__PURE__ */ new Date(),
    priority: (_a = options.priority) != null ? _a : 5,
    retryCount: 0,
    maxRetries: (_b = options.maxRetries) != null ? _b : 3
  };
}
function generateJobId() {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
function canRetry(job) {
  return job.retryCount < job.maxRetries;
}

// src/core/application/services/job-queue.ts
var JobQueue = class {
  constructor(emitter) {
    this.queue = [];
    this.running = null;
    this.paused = false;
    this.executors = /* @__PURE__ */ new Map();
    this.emitter = emitter != null ? emitter : getEventEmitter();
  }
  /**
   * Register a job executor for a specific job type
   */
  registerExecutor(type, executor) {
    this.executors.set(type, executor);
  }
  /**
   * Add a job to the queue
   */
  enqueue(type, data, priority) {
    const job = createJob(type, data, { priority });
    const insertIndex = this.queue.findIndex((j) => j.priority > job.priority);
    if (insertIndex === -1) {
      this.queue.push(job);
    } else {
      this.queue.splice(insertIndex, 0, job);
    }
    this.emitter.emit("job:created", job);
    this.processNext();
    return job;
  }
  /**
   * Process next job in queue
   */
  async processNext() {
    if (this.paused || this.running || this.queue.length === 0) {
      if (this.queue.length === 0 && !this.running) {
        this.emitter.emit("queue:empty", void 0);
      }
      return;
    }
    const job = this.queue.shift();
    this.running = job;
    const executor = this.executors.get(job.type);
    if (!executor) {
      job.status = "failed";
      job.error = `No executor registered for job type: ${job.type}`;
      this.emitter.emit("job:failed", job);
      this.running = null;
      this.processNext();
      return;
    }
    job.status = "running";
    job.startedAt = /* @__PURE__ */ new Date();
    this.emitter.emit("job:started", job);
    try {
      const result = await executor.execute(job, (progress, message) => {
        job.progress = progress;
        this.emitter.emit("job:progress", {
          jobId: job.id,
          progress,
          message
        });
      });
      job.status = "completed";
      job.result = result;
      job.progress = 100;
      job.completedAt = /* @__PURE__ */ new Date();
      this.emitter.emit("job:completed", job);
    } catch (error) {
      job.retryCount++;
      if (canRetry(job)) {
        job.status = "pending";
        this.queue.unshift(job);
      } else {
        job.status = "failed";
        job.error = error instanceof Error ? error.message : String(error);
        job.completedAt = /* @__PURE__ */ new Date();
        this.emitter.emit("job:failed", job);
      }
    }
    this.running = null;
    this.processNext();
  }
  /**
   * Cancel a pending job
   */
  cancel(jobId) {
    const index = this.queue.findIndex((j) => j.id === jobId);
    if (index !== -1) {
      const job = this.queue.splice(index, 1)[0];
      job.status = "cancelled";
      this.emitter.emit("job:cancelled", job);
      return true;
    }
    return false;
  }
  /**
   * Pause queue processing
   */
  pause() {
    this.paused = true;
    this.emitter.emit("queue:paused", void 0);
  }
  /**
   * Resume queue processing
   */
  resume() {
    this.paused = false;
    this.emitter.emit("queue:resumed", void 0);
    this.processNext();
  }
  /**
   * Get queue status
   */
  getStatus() {
    return {
      pending: this.queue.length,
      running: this.running !== null,
      paused: this.paused,
      currentJob: this.running
    };
  }
  /**
   * Get a specific job
   */
  getJob(jobId) {
    var _a;
    if (((_a = this.running) == null ? void 0 : _a.id) === jobId) return this.running;
    return this.queue.find((j) => j.id === jobId);
  }
  /**
   * Get all jobs (running + queued)
   */
  getAllJobs() {
    return this.running ? [this.running, ...this.queue] : [...this.queue];
  }
  /**
   * Clear all pending jobs
   */
  clear() {
    this.queue.forEach((job) => {
      job.status = "cancelled";
      this.emitter.emit("job:cancelled", job);
    });
    this.queue = [];
  }
  /**
   * Check if queue is empty
   */
  isEmpty() {
    return this.queue.length === 0 && !this.running;
  }
};

// src/core/domain/errors/ai-errors.ts
var AIError = class extends Error {
  constructor(message, code, retryable = false) {
    super(message);
    this.code = code;
    this.retryable = retryable;
    this.name = "AIError";
  }
};
var BudgetExceededError = class extends AIError {
  constructor(message = "Budget limit exceeded.", currentSpend, budgetLimit) {
    super(message, "BUDGET_EXCEEDED", false);
    this.currentSpend = currentSpend;
    this.budgetLimit = budgetLimit;
    this.name = "BudgetExceededError";
  }
};

// node_modules/obsidian-llm-shared/dist/model-configs.js
var AI_PROVIDERS = {
  claude: {
    id: "claude",
    name: "Claude",
    displayName: "Anthropic Claude",
    endpoint: "https://api.anthropic.com/v1",
    defaultModel: "claude-haiku-4-5-20251001",
    apiKeyPrefix: "sk-ant-"
  },
  openai: {
    id: "openai",
    name: "OpenAI",
    displayName: "OpenAI GPT",
    endpoint: "https://api.openai.com/v1",
    defaultModel: "gpt-5-nano",
    apiKeyPrefix: "sk-"
  },
  gemini: {
    id: "gemini",
    name: "Gemini",
    displayName: "Google Gemini",
    endpoint: "https://generativelanguage.googleapis.com/v1beta",
    defaultModel: "gemini-2.5-flash",
    apiKeyPrefix: "AIza"
  },
  grok: {
    id: "grok",
    name: "Grok",
    displayName: "xAI Grok",
    endpoint: "https://api.x.ai/v1",
    defaultModel: "grok-4-1-fast"
  }
};
var MODEL_CONFIGS = {
  // ── OpenAI ── gpt-5 series: all reasoning models
  // Thinking tokens consume from the same max_completion_tokens budget
  // Must use max_completion_tokens (NOT max_tokens), temperature forbidden
  "gpt-5.4": {
    id: "gpt-5.4",
    displayName: "GPT-5.4",
    provider: "openai",
    contextWindow: 128e3,
    defaultCompletionTokens: 16384,
    isReasoning: true,
    inputCostPer1M: 2.5,
    outputCostPer1M: 15
  },
  "gpt-5-mini": {
    id: "gpt-5-mini",
    displayName: "GPT-5 Mini",
    provider: "openai",
    contextWindow: 128e3,
    defaultCompletionTokens: 8192,
    isReasoning: true,
    inputCostPer1M: 0.25,
    outputCostPer1M: 2
  },
  "gpt-5-nano": {
    id: "gpt-5-nano",
    displayName: "GPT-5 Nano",
    provider: "openai",
    contextWindow: 128e3,
    defaultCompletionTokens: 8192,
    isReasoning: true,
    inputCostPer1M: 0.05,
    outputCostPer1M: 0.4
  },
  // ── Gemini ── thinking tokens use separate budget (thinkingBudget), not maxOutputTokens
  "gemini-3.1-pro-preview": {
    id: "gemini-3.1-pro-preview",
    displayName: "Gemini 3.1 Pro",
    provider: "gemini",
    contextWindow: 65536,
    defaultCompletionTokens: 4096,
    isReasoning: true,
    inputCostPer1M: 2,
    outputCostPer1M: 12
  },
  "gemini-3.1-flash-lite-preview": {
    id: "gemini-3.1-flash-lite-preview",
    displayName: "Gemini 3.1 Flash-Lite",
    provider: "gemini",
    contextWindow: 65536,
    defaultCompletionTokens: 4096,
    isReasoning: true,
    inputCostPer1M: 0.25,
    outputCostPer1M: 1.5
  },
  "gemini-2.5-flash": {
    id: "gemini-2.5-flash",
    displayName: "Gemini 2.5 Flash",
    provider: "gemini",
    contextWindow: 65536,
    defaultCompletionTokens: 4096,
    isReasoning: true,
    inputCostPer1M: 0.3,
    outputCostPer1M: 2.5
  },
  "gemini-2.0-flash": {
    id: "gemini-2.0-flash",
    displayName: "Gemini 2.0 Flash",
    provider: "gemini",
    contextWindow: 8192,
    defaultCompletionTokens: 2048,
    isReasoning: false,
    inputCostPer1M: 0.1,
    outputCostPer1M: 0.4
  },
  // ── Anthropic ── extended thinking opt-in via `thinking` parameter
  // Opus 4.6: adaptive thinking (model decides budget)
  // Sonnet 4.6: manual budget (budget_tokens < max_tokens required)
  // Haiku 4.5: no thinking (저가, simple classification)
  "claude-opus-4-6": {
    id: "claude-opus-4-6",
    displayName: "Claude Opus 4.6",
    provider: "claude",
    contextWindow: 128e3,
    defaultCompletionTokens: 2048,
    isReasoning: false,
    inputCostPer1M: 5,
    outputCostPer1M: 25,
    thinkingMode: "adaptive"
  },
  "claude-sonnet-4-6": {
    id: "claude-sonnet-4-6",
    displayName: "Claude Sonnet 4.6",
    provider: "claude",
    contextWindow: 64e3,
    defaultCompletionTokens: 2048,
    isReasoning: false,
    inputCostPer1M: 3,
    outputCostPer1M: 15,
    thinkingMode: "enabled",
    thinkingBudget: 1024
  },
  "claude-haiku-4-5-20251001": {
    id: "claude-haiku-4-5-20251001",
    displayName: "Claude Haiku 4.5",
    provider: "claude",
    contextWindow: 64e3,
    defaultCompletionTokens: 500,
    isReasoning: false,
    inputCostPer1M: 1,
    outputCostPer1M: 5
  },
  // ── Grok (xAI) ──
  "grok-4-1-fast": {
    id: "grok-4-1-fast",
    displayName: "Grok 4.1 Fast",
    provider: "grok",
    contextWindow: 16384,
    defaultCompletionTokens: 4096,
    isReasoning: true,
    inputCostPer1M: 0.2,
    outputCostPer1M: 0.5
  },
  "grok-4-1-fast-non-reasoning": {
    id: "grok-4-1-fast-non-reasoning",
    displayName: "Grok 4.1 Fast (Non-Reasoning)",
    provider: "grok",
    contextWindow: 16384,
    defaultCompletionTokens: 4096,
    isReasoning: false,
    inputCostPer1M: 0.2,
    outputCostPer1M: 0.5
  }
};
function getModelConfig(modelId) {
  return MODEL_CONFIGS[modelId];
}
function calculateCost(modelId, inputTokens, outputTokens) {
  const config = getModelConfig(modelId);
  if (!config)
    return 0;
  return inputTokens / 1e6 * config.inputCostPer1M + outputTokens / 1e6 * config.outputCostPer1M;
}

// src/core/domain/constants/model-configs.ts
var TIER_MAP = {
  // Claude
  "claude-opus-4-6": "premium",
  "claude-sonnet-4-6": "standard",
  "claude-haiku-4-5-20251001": "economy",
  // OpenAI
  "gpt-5.4": "premium",
  "gpt-5-mini": "standard",
  "gpt-5-nano": "economy",
  // Gemini
  "gemini-3.1-pro-preview": "premium",
  "gemini-3.1-flash-lite-preview": "economy",
  "gemini-2.5-flash": "standard",
  "gemini-2.0-flash": "economy",
  // Grok
  "grok-4-1-fast": "standard",
  "grok-4-1-fast-non-reasoning": "economy"
};
function inferTier(model) {
  if (TIER_MAP[model.id]) return TIER_MAP[model.id];
  if (model.inputCostPer1M >= 2) return "premium";
  if (model.inputCostPer1M >= 0.2) return "standard";
  return "economy";
}
function buildExtendedConfigs() {
  const result = {};
  for (const [key, shared] of Object.entries(MODEL_CONFIGS)) {
    result[key] = {
      ...shared,
      tier: inferTier(shared),
      maxInputTokens: shared.contextWindow,
      maxOutputTokens: shared.defaultCompletionTokens,
      supportsVision: true,
      // all current models support vision
      supportsStreaming: true
      // all current models support streaming
    };
  }
  return result;
}
var MODEL_CONFIGS2 = buildExtendedConfigs();
var AI_PROVIDERS2 = AI_PROVIDERS;
var FEATURE_DEFAULT_MODELS = {
  "content-analysis": {
    claude: "claude-haiku-4-5-20251001",
    gemini: "gemini-2.0-flash",
    openai: "gpt-5-nano",
    grok: "grok-4-1-fast-non-reasoning"
  },
  "permanent-note": {
    claude: "claude-sonnet-4-6",
    gemini: "gemini-2.5-flash",
    openai: "gpt-5-mini",
    grok: "grok-4-1-fast"
  }
};
function calculateCost2(modelKey, inputTokens, outputTokens) {
  return calculateCost(modelKey, inputTokens, outputTokens);
}
function getModelsByProvider2(provider) {
  return Object.values(MODEL_CONFIGS2).filter((m) => m.provider === provider);
}
function getModelConfigById(modelId) {
  return Object.values(MODEL_CONFIGS2).find((m) => m.id === modelId);
}
function estimateTokens(text) {
  const koreanChars = (text.match(/[\uAC00-\uD7AF]/g) || []).length;
  const otherChars = text.length - koreanChars;
  return Math.ceil(koreanChars / 2 + otherChars / 4);
}

// src/core/application/services/ai-service.ts
var AIService = class {
  constructor(settings) {
    this.providers = /* @__PURE__ */ new Map();
    this.settings = settings;
  }
  /**
   * Register a provider
   */
  registerProvider(provider) {
    this.providers.set(provider.id, provider);
  }
  /**
   * Update settings
   */
  updateSettings(settings) {
    this.settings = settings;
  }
  /**
   * Get current provider
   */
  getCurrentProvider() {
    return this.providers.get(this.settings.provider);
  }
  /**
   * Get current API key
   */
  getCurrentApiKey() {
    return this.settings.apiKeys[this.settings.provider];
  }
  /**
   * Get current model
   */
  getCurrentModel() {
    return this.settings.models[this.settings.provider];
  }
  /**
   * Test current API key
   */
  async testCurrentApiKey() {
    const provider = this.getCurrentProvider();
    const apiKey = this.getCurrentApiKey();
    if (!provider || !apiKey) return false;
    return provider.testApiKey(apiKey);
  }
  /**
   * Generate text completion
   */
  async generateText(messages, options, currentSpend) {
    const provider = this.getCurrentProvider();
    const apiKey = this.getCurrentApiKey();
    if (!provider) {
      return { success: false, content: "", error: "No provider selected" };
    }
    if (!apiKey) {
      return { success: false, content: "", error: "No API key configured" };
    }
    if (this.settings.budgetLimit && currentSpend !== void 0) {
      if (currentSpend >= this.settings.budgetLimit) {
        throw new BudgetExceededError(
          "Budget limit exceeded",
          currentSpend,
          this.settings.budgetLimit
        );
      }
    }
    const mergedOptions = {
      model: this.settings.models[this.settings.provider],
      ...options
    };
    return provider.generateText(messages, apiKey, mergedOptions);
  }
  /**
   * Simple generation helper
   */
  async simpleGenerate(userPrompt, systemPrompt, options, currentSpend) {
    const messages = [];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: userPrompt });
    return this.generateText(messages, options, currentSpend);
  }
  /**
   * Estimate cost for a response
   */
  estimateCost(inputTokens, outputTokens) {
    const modelId = this.getCurrentModel();
    const modelConfig = getModelConfigById(modelId);
    if (!modelConfig) return 0;
    return calculateCost2(
      Object.keys(modelConfig).find(
        (key) => modelConfig.id === modelId
      ) || "",
      inputTokens,
      outputTokens
    );
  }
  /**
   * Get feature-specific provider and model
   */
  getFeatureConfig(feature) {
    var _a;
    const featureSettings = (_a = this.settings.featureModels) == null ? void 0 : _a[feature];
    if (featureSettings) {
      return {
        provider: featureSettings.provider,
        model: featureSettings.model
      };
    }
    return {
      provider: this.settings.provider,
      model: this.settings.models[this.settings.provider]
    };
  }
  /**
   * Generate text for a specific feature using its configured model
   */
  async generateForFeature(feature, messages, options, currentSpend) {
    const { provider: providerType, model } = this.getFeatureConfig(feature);
    const provider = this.providers.get(providerType);
    const apiKey = this.settings.apiKeys[providerType];
    if (!provider) {
      return { success: false, content: "", error: `Provider ${providerType} not available` };
    }
    if (!apiKey) {
      return { success: false, content: "", error: `No API key configured for ${providerType}` };
    }
    if (this.settings.budgetLimit && currentSpend !== void 0) {
      if (currentSpend >= this.settings.budgetLimit) {
        throw new BudgetExceededError(
          "Budget limit exceeded",
          currentSpend,
          this.settings.budgetLimit
        );
      }
    }
    const mergedOptions = {
      model,
      ...options
    };
    return provider.generateText(messages, apiKey, mergedOptions);
  }
  /**
   * Simple generation helper for a specific feature
   */
  async simpleGenerateForFeature(feature, userPrompt, systemPrompt, options, currentSpend) {
    const messages = [];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: userPrompt });
    return this.generateForFeature(feature, messages, options, currentSpend);
  }
  /**
   * Get all registered providers
   */
  getAvailableProviders() {
    return Array.from(this.providers.keys());
  }
  /**
   * Check if a provider is configured (has API key)
   */
  isProviderConfigured(provider) {
    return !!this.settings.apiKeys[provider];
  }
};
var aiServiceInstance = null;
function initializeAIService(settings) {
  aiServiceInstance = new AIService(settings);
  return aiServiceInstance;
}
function getAIService() {
  return aiServiceInstance;
}
function updateAIServiceSettings(settings) {
  if (aiServiceInstance) {
    aiServiceInstance.updateSettings(settings);
  }
}
function resetAIService() {
  aiServiceInstance = null;
}

// src/core/application/services/cost-tracker.ts
var CostTracker = class {
  constructor(budgetLimit, emitter) {
    this.records = [];
    this.budgetLimit = budgetLimit;
    this.emitter = emitter != null ? emitter : getEventEmitter();
  }
  /**
   * Set budget limit
   */
  setBudgetLimit(limit) {
    this.budgetLimit = limit;
  }
  /**
   * Track a new usage
   */
  trackUsage(provider, model, inputTokens, outputTokens, jobType) {
    const cost = calculateCost2(model, inputTokens, outputTokens);
    const record = {
      id: `usage_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: /* @__PURE__ */ new Date(),
      provider,
      model,
      inputTokens,
      outputTokens,
      cost,
      jobType
    };
    this.records.push(record);
    this.emitter.emit("cost:updated", {
      totalSpend: this.getCurrentSpend(),
      budgetLimit: this.budgetLimit
    });
    return record;
  }
  /**
   * Get current total spend
   */
  getCurrentSpend() {
    return this.records.reduce((sum, r) => sum + r.cost, 0);
  }
  /**
   * Get spend for a specific time period
   */
  getSpendForPeriod(startDate, endDate) {
    return this.records.filter((r) => r.timestamp >= startDate && r.timestamp <= endDate).reduce((sum, r) => sum + r.cost, 0);
  }
  /**
   * Get current month's spend
   */
  getCurrentMonthSpend() {
    const now = /* @__PURE__ */ new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return this.getSpendForPeriod(startOfMonth, now);
  }
  /**
   * Get remaining budget
   */
  getRemainingBudget() {
    if (!this.budgetLimit) return void 0;
    return Math.max(0, this.budgetLimit - this.getCurrentSpend());
  }
  /**
   * Check if budget is exceeded
   */
  isBudgetExceeded() {
    if (!this.budgetLimit) return false;
    return this.getCurrentSpend() >= this.budgetLimit;
  }
  /**
   * Get budget usage percentage
   */
  getBudgetUsagePercent() {
    if (!this.budgetLimit) return void 0;
    return this.getCurrentSpend() / this.budgetLimit * 100;
  }
  /**
   * Get usage history
   */
  getHistory(limit) {
    const sorted = [...this.records].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
    return limit ? sorted.slice(0, limit) : sorted;
  }
  /**
   * Get cost summary
   */
  getSummary() {
    const byProvider = {};
    const byModel = {};
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    for (const record of this.records) {
      byProvider[record.provider] = (byProvider[record.provider] || 0) + record.cost;
      byModel[record.model] = (byModel[record.model] || 0) + record.cost;
      totalInputTokens += record.inputTokens;
      totalOutputTokens += record.outputTokens;
    }
    return {
      totalCost: this.getCurrentSpend(),
      totalInputTokens,
      totalOutputTokens,
      recordCount: this.records.length,
      byProvider,
      byModel
    };
  }
  /**
   * Clear all records
   */
  clear() {
    this.records = [];
  }
  /**
   * Export records as JSON
   */
  exportRecords() {
    return JSON.stringify(this.records, null, 2);
  }
  /**
   * Import records from JSON
   */
  importRecords(json) {
    try {
      const imported = JSON.parse(json);
      imported.forEach((r) => {
        r.timestamp = new Date(r.timestamp);
      });
      this.records = imported;
    } catch (error) {
      console.error("Failed to import cost records:", error);
    }
  }
  /**
   * Get total record count
   */
  getRecordCount() {
    return this.records.length;
  }
};

// src/core/domain/entities/analysis-result.ts
var AnalysisResult = class _AnalysisResult {
  constructor(data) {
    this._id = data.id;
    this._sourceType = data.sourceType;
    this._sourceContent = data.sourceContent;
    this._sourceUrl = data.sourceUrl;
    this._sourcePath = data.sourcePath;
    this._suggestedTitle = data.suggestedTitle;
    this._summary = data.summary;
    this._keyInsights = [...data.keyInsights];
    this._suggestedTags = [...data.suggestedTags];
    this._relatedTopics = [...data.relatedTopics];
    this._tokensUsed = data.tokensUsed;
    this._createdAt = data.createdAt;
  }
  static create(data) {
    return new _AnalysisResult({
      ...data,
      id: _AnalysisResult.generateId(),
      createdAt: /* @__PURE__ */ new Date()
    });
  }
  static fromData(data) {
    return new _AnalysisResult(data);
  }
  static generateId() {
    return `analysis_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
  // Getters
  get id() {
    return this._id;
  }
  get sourceType() {
    return this._sourceType;
  }
  get sourceContent() {
    return this._sourceContent;
  }
  get sourceUrl() {
    return this._sourceUrl;
  }
  get sourcePath() {
    return this._sourcePath;
  }
  get suggestedTitle() {
    return this._suggestedTitle;
  }
  get summary() {
    return this._summary;
  }
  get keyInsights() {
    return this._keyInsights;
  }
  get suggestedTags() {
    return this._suggestedTags;
  }
  get relatedTopics() {
    return this._relatedTopics;
  }
  get tokensUsed() {
    return this._tokensUsed;
  }
  get createdAt() {
    return this._createdAt;
  }
  // Business methods
  hasInsights() {
    return this._keyInsights.length > 0;
  }
  hasTags() {
    return this._suggestedTags.length > 0;
  }
  toMarkdown() {
    const lines = [];
    lines.push("---");
    lines.push(`created: ${this._createdAt.toISOString().split("T")[0]}`);
    if (this._sourceUrl) {
      lines.push(`source: "${this._sourceUrl}"`);
    }
    if (this._sourcePath) {
      lines.push(`source_note: "[[${this._sourcePath.replace(/\.md$/, "")}]]"`);
    }
    if (this._suggestedTags.length > 0) {
      lines.push(`tags:`);
      this._suggestedTags.forEach((tag) => {
        const formattedTag = tag.replace(/\s+/g, "_");
        lines.push(`  - ${formattedTag}`);
      });
    }
    if (this._relatedTopics.length > 0) {
      lines.push(`topics:`);
      this._relatedTopics.forEach((topic) => {
        lines.push(`  - "${topic}"`);
      });
    }
    lines.push(`analyzed_at: ${this._createdAt.toISOString()}`);
    lines.push(`source_type: ${this._sourceType}`);
    lines.push("---");
    lines.push("");
    lines.push(`## Summary`);
    lines.push(this._summary);
    lines.push("");
    if (this._keyInsights.length > 0) {
      lines.push(`## Key Insights`);
      this._keyInsights.forEach((insight) => {
        lines.push(`- ${insight}`);
      });
    }
    return lines.join("\n");
  }
  toData() {
    return {
      id: this._id,
      sourceType: this._sourceType,
      sourceContent: this._sourceContent,
      sourceUrl: this._sourceUrl,
      sourcePath: this._sourcePath,
      suggestedTitle: this._suggestedTitle,
      summary: this._summary,
      keyInsights: [...this._keyInsights],
      suggestedTags: [...this._suggestedTags],
      relatedTopics: [...this._relatedTopics],
      tokensUsed: this._tokensUsed,
      createdAt: this._createdAt
    };
  }
};

// src/core/application/use-cases/analyze-content.ts
var AnalyzeContentUseCase = class {
  constructor(aiService, costTracker) {
    this.aiService = aiService != null ? aiService : getAIService();
    this.costTracker = costTracker;
  }
  async execute(request) {
    var _a;
    const { content, sourceType, sourceUrl, sourcePath, language = "auto", detailLevel = "standard" } = request;
    const estimatedTokens = estimateTokens(content);
    if (estimatedTokens > 1e5) {
      return {
        success: false,
        error: "Content too long. Please provide shorter content."
      };
    }
    const systemPrompt = this.buildSystemPrompt(language, detailLevel);
    const userPrompt = this.buildUserPrompt(content, sourceType, sourceUrl, sourcePath);
    try {
      const response = await this.aiService.simpleGenerate(
        userPrompt,
        systemPrompt,
        { temperature: 0.3 }
        // Lower temperature for more consistent output
      );
      if (!response.success) {
        return {
          success: false,
          error: response.error || "LLM generation failed"
        };
      }
      const parsed = this.parseResponse(response.content);
      if (!parsed) {
        return {
          success: false,
          error: "Failed to parse LLM response"
        };
      }
      if (this.costTracker && response.tokensUsed) {
        this.costTracker.trackUsage(
          ((_a = this.aiService.getCurrentProvider()) == null ? void 0 : _a.id) || "unknown",
          this.aiService.getCurrentModel(),
          Math.floor(response.tokensUsed * 0.7),
          // Rough input estimate
          Math.floor(response.tokensUsed * 0.3),
          // Rough output estimate
          "analyze-content"
        );
      }
      const result = AnalysisResult.create({
        sourceType,
        sourceContent: content.slice(0, 1e3),
        // Store first 1000 chars
        sourceUrl,
        sourcePath,
        suggestedTitle: parsed.suggestedTitle,
        summary: parsed.summary,
        keyInsights: parsed.keyInsights,
        suggestedTags: parsed.suggestedTags,
        relatedTopics: parsed.relatedTopics,
        tokensUsed: response.tokensUsed
      });
      return {
        success: true,
        result,
        tokensUsed: response.tokensUsed
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred"
      };
    }
  }
  buildSystemPrompt(language, detailLevel) {
    const langInstruction = language === "auto" ? "Respond in the same language as the input content." : `Respond in ${language}.`;
    const detailInstruction = {
      brief: "Keep the summary under 100 words. Provide 2-3 key insights.",
      standard: "Provide a comprehensive summary (150-250 words). Provide 3-5 key insights.",
      detailed: "Provide a detailed summary (300-400 words). Provide 5-7 key insights with examples."
    }[detailLevel];
    return `You are an expert content analyst for a Personal Knowledge Management (PKM) system.
Your task is to analyze the provided content and extract structured insights.

${langInstruction}
${detailInstruction}

You MUST respond in the following JSON format only, with no additional text:
{
  "suggestedTitle": "A concise, descriptive title for the note",
  "summary": "A clear, concise summary of the main points",
  "keyInsights": ["insight 1", "insight 2", "insight 3"],
  "suggestedTags": ["tag1", "tag2", "tag3"],
  "relatedTopics": ["related topic 1", "related topic 2"]
}

Guidelines:
- suggestedTitle: Create a concise, descriptive title (3-10 words) that captures the main topic or key concept
- summary: Capture the essence and main arguments
- keyInsights: Extract actionable or notable points that are worth remembering
- suggestedTags: Suggest 3-5 relevant tags for categorization (single words or short phrases, no # prefix)
- relatedTopics: Suggest 2-4 related topics or concepts for further exploration`;
  }
  buildUserPrompt(content, sourceType, sourceUrl, sourcePath) {
    let sourceInfo = "";
    if (sourceType === "url" && sourceUrl) {
      sourceInfo = `Source URL: ${sourceUrl}

`;
    } else if (sourceType === "note" && sourcePath) {
      sourceInfo = `Source Note: ${sourcePath}

`;
    }
    return `${sourceInfo}Please analyze the following content:

---
${content}
---

Provide your analysis in the specified JSON format.`;
  }
  parseResponse(responseContent) {
    try {
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error("No JSON found in response");
        return null;
      }
      const parsed = JSON.parse(jsonMatch[0]);
      if (!parsed.suggestedTitle || !parsed.summary || !Array.isArray(parsed.keyInsights)) {
        console.error("Missing required fields in response");
        return null;
      }
      return {
        suggestedTitle: parsed.suggestedTitle,
        summary: parsed.summary,
        keyInsights: parsed.keyInsights || [],
        suggestedTags: parsed.suggestedTags || [],
        relatedTopics: parsed.relatedTopics || []
      };
    } catch (error) {
      console.error("Failed to parse LLM response:", error);
      return null;
    }
  }
};

// src/core/application/use-cases/suggest-note-topics.ts
var SuggestNoteTopicsUseCase = class {
  constructor(aiService, costTracker) {
    this.aiService = aiService != null ? aiService : getAIService();
    this.costTracker = costTracker;
  }
  async execute(request) {
    const { analysisResult, language = "auto", count = 4 } = request;
    const systemPrompt = this.buildSystemPrompt(language, count);
    const userPrompt = this.buildUserPrompt(analysisResult);
    try {
      const response = await this.aiService.simpleGenerateForFeature(
        "permanent-note",
        userPrompt,
        systemPrompt,
        { temperature: 0.5 }
      );
      if (!response.success) {
        return {
          success: false,
          error: response.error || "LLM generation failed"
        };
      }
      const parsed = this.parseResponse(response.content);
      if (!parsed) {
        return {
          success: false,
          error: "Failed to parse LLM response"
        };
      }
      const { provider: providerType, model } = this.aiService.getFeatureConfig("permanent-note");
      if (this.costTracker && response.tokensUsed) {
        this.costTracker.trackUsage(
          providerType,
          model,
          Math.floor(response.tokensUsed * 0.6),
          Math.floor(response.tokensUsed * 0.4),
          "suggest-topics"
        );
      }
      return {
        success: true,
        topics: parsed,
        tokensUsed: response.tokensUsed
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred"
      };
    }
  }
  buildSystemPrompt(language, count) {
    const langInstruction = language === "auto" ? "Respond in Korean by default, but match the input language if clearly different." : `Respond in ${language}.`;
    return `You are an expert PKM (Personal Knowledge Management) consultant specializing in Zettelkasten methodology.

${langInstruction}

Your task is to identify ${count} distinct concepts or ideas from the content analysis that would make excellent permanent notes.

Guidelines for selecting topics:
1. **Atomic**: Each topic should be a single, focused concept (not a broad category)
2. **Evergreen**: Topics should have lasting value, not time-sensitive information
3. **Connectable**: Topics that can connect to other knowledge areas
4. **Actionable**: Ideas that can influence thinking or behavior
5. **Original**: Prioritize unique insights over common knowledge

For each topic, provide:
- title: A clear, specific title (3-8 words)
- rationale: Why this deserves to be a permanent note (1-2 sentences)
- keyPoints: 3-4 specific aspects to explore when writing the note
- suggestedTags: 3-5 relevant tags for categorization

You MUST respond in this JSON format only:
{
  "topics": [
    {
      "title": "Concept title",
      "rationale": "Why this is worth capturing as permanent knowledge",
      "keyPoints": ["aspect 1", "aspect 2", "aspect 3"],
      "suggestedTags": ["tag1", "tag2", "tag3"]
    }
  ]
}`;
  }
  buildUserPrompt(analysisResult) {
    return `Based on this content analysis, suggest permanent note topics:

**Title**: ${analysisResult.suggestedTitle}

**Summary**:
${analysisResult.summary}

**Key Insights**:
${analysisResult.keyInsights.map((i, idx) => `${idx + 1}. ${i}`).join("\n")}

**Related Topics**: ${analysisResult.relatedTopics.join(", ")}

**Tags**: ${analysisResult.suggestedTags.join(", ")}

Identify the most valuable concepts that deserve their own permanent notes.`;
  }
  parseResponse(responseContent) {
    try {
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error("No JSON found in response");
        return null;
      }
      const parsed = JSON.parse(jsonMatch[0]);
      if (!parsed.topics || !Array.isArray(parsed.topics)) {
        console.error("Missing topics array in response");
        return null;
      }
      return parsed.topics.map((t) => ({
        title: t.title || "",
        rationale: t.rationale || "",
        keyPoints: t.keyPoints || [],
        suggestedTags: t.suggestedTags || []
      }));
    } catch (error) {
      console.error("Failed to parse LLM response:", error);
      return null;
    }
  }
};

// src/core/adapters/llm/base-provider.ts
var import_obsidian = require("obsidian");
var BaseProvider = class {
  get config() {
    return AI_PROVIDERS2[this.id];
  }
  /**
   * HTTP request wrapper using Obsidian's requestUrl
   */
  async makeRequest(options) {
    try {
      const response = await (0, import_obsidian.requestUrl)(options);
      return response.json;
    } catch (error) {
      throw this.normalizeError(error);
    }
  }
  /**
   * Handle errors and return normalized response
   */
  handleError(error) {
    const normalized = this.normalizeError(error);
    return {
      success: false,
      content: "",
      error: normalized.message,
      errorCode: normalized.code
    };
  }
  /**
   * Normalize various error types to standard format
   */
  normalizeError(error) {
    if (error instanceof Error) {
      if (error.message.includes("429") || error.message.includes("rate")) {
        return { message: "Rate limit exceeded. Please try again later.", code: "RATE_LIMIT" };
      }
      if (error.message.includes("401") || error.message.includes("403")) {
        return { message: "Invalid API key or unauthorized access.", code: "AUTH_ERROR" };
      }
      if (error.message.includes("timeout") || error.message.includes("ETIMEDOUT")) {
        return { message: "Request timed out. Please try again.", code: "TIMEOUT" };
      }
      return { message: error.message, code: "UNKNOWN" };
    }
    return { message: "An unknown error occurred", code: "UNKNOWN" };
  }
  /**
   * Estimate token count (approximate)
   * Korean: ~2 chars = 1 token, English: ~4 chars = 1 token
   */
  estimateTokens(text) {
    const koreanChars = (text.match(/[\uAC00-\uD7AF]/g) || []).length;
    const otherChars = text.length - koreanChars;
    return Math.ceil(koreanChars / 2 + otherChars / 4);
  }
};

// src/core/adapters/llm/claude-provider.ts
var ClaudeProvider = class extends BaseProvider {
  constructor() {
    super(...arguments);
    this.id = "claude";
    this.name = "Anthropic Claude";
    this.API_VERSION = "2023-06-01";
  }
  async testApiKey(apiKey) {
    try {
      const response = await this.makeRequest({
        url: `${this.config.endpoint}/messages`,
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": this.API_VERSION,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: this.config.defaultModel,
          messages: [{ role: "user", content: "Hello" }],
          max_tokens: 10
        })
      });
      return !response.error && !!response.content;
    } catch (e) {
      return false;
    }
  }
  async generateText(messages, apiKey, options) {
    var _a, _b;
    const { claudeMessages, systemPrompt } = this.convertMessages(messages);
    const requestBody = {
      model: (options == null ? void 0 : options.model) || this.config.defaultModel,
      messages: claudeMessages,
      max_tokens: (_a = options == null ? void 0 : options.maxTokens) != null ? _a : 4096,
      temperature: (_b = options == null ? void 0 : options.temperature) != null ? _b : 0.7
    };
    if (systemPrompt) {
      requestBody.system = systemPrompt;
    }
    try {
      const response = await this.makeRequest({
        url: `${this.config.endpoint}/messages`,
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": this.API_VERSION,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });
      if (response.error) {
        return {
          success: false,
          content: "",
          error: response.error.message,
          errorCode: response.error.type
        };
      }
      const generatedText = response.content.filter((block) => block.type === "text").map((block) => block.text).join("");
      return {
        success: true,
        content: generatedText,
        tokensUsed: response.usage ? response.usage.input_tokens + response.usage.output_tokens : void 0
      };
    } catch (error) {
      return this.handleError(error);
    }
  }
  convertMessages(messages) {
    const claudeMessages = [];
    let systemPrompt = null;
    for (const msg of messages) {
      if (msg.role === "system") {
        systemPrompt = msg.content;
      } else {
        claudeMessages.push({
          role: msg.role,
          content: msg.content
        });
      }
    }
    return { claudeMessages, systemPrompt };
  }
};

// src/core/adapters/llm/openai-provider.ts
var OpenAIProvider = class extends BaseProvider {
  constructor() {
    super(...arguments);
    this.id = "openai";
    this.name = "OpenAI";
  }
  async testApiKey(apiKey) {
    try {
      const model = this.config.defaultModel;
      const isReasoningModel2 = model.startsWith("gpt-5") || model.startsWith("o1") || model.startsWith("o3");
      const requestBody = {
        model,
        messages: [{ role: "user", content: "Hello" }]
      };
      if (isReasoningModel2) {
        requestBody.max_completion_tokens = 10;
      } else {
        requestBody.max_tokens = 10;
      }
      const response = await this.makeRequest({
        url: `${this.config.endpoint}/chat/completions`,
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });
      return !response.error && response.choices && response.choices.length > 0;
    } catch (e) {
      return false;
    }
  }
  async generateText(messages, apiKey, options) {
    var _a, _b, _c, _d;
    const openaiMessages = this.convertMessages(messages);
    const model = (options == null ? void 0 : options.model) || this.config.defaultModel;
    const isReasoningModel2 = model.startsWith("gpt-5") || model.startsWith("o1") || model.startsWith("o3");
    const requestBody = {
      model,
      messages: openaiMessages,
      temperature: (_a = options == null ? void 0 : options.temperature) != null ? _a : 0.7
    };
    if (isReasoningModel2) {
      requestBody.max_completion_tokens = (_b = options == null ? void 0 : options.maxTokens) != null ? _b : 4096;
    } else {
      requestBody.max_tokens = (_c = options == null ? void 0 : options.maxTokens) != null ? _c : 4096;
    }
    try {
      const response = await this.makeRequest({
        url: `${this.config.endpoint}/chat/completions`,
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });
      if (response.error) {
        return {
          success: false,
          content: "",
          error: response.error.message,
          errorCode: response.error.code || response.error.type
        };
      }
      if (!response.choices || response.choices.length === 0) {
        return {
          success: false,
          content: "",
          error: "No response generated",
          errorCode: "EMPTY_RESPONSE"
        };
      }
      const generatedText = response.choices[0].message.content;
      return {
        success: true,
        content: generatedText,
        tokensUsed: (_d = response.usage) == null ? void 0 : _d.total_tokens
      };
    } catch (error) {
      return this.handleError(error);
    }
  }
  convertMessages(messages) {
    return messages.map((msg) => ({
      role: msg.role,
      content: msg.content
    }));
  }
};

// src/core/adapters/llm/gemini-provider.ts
var GeminiProvider = class extends BaseProvider {
  constructor() {
    super(...arguments);
    this.id = "gemini";
    this.name = "Google Gemini";
  }
  async testApiKey(apiKey) {
    try {
      const model = this.config.defaultModel;
      const url = `${this.config.endpoint}/models/${model}:generateContent?key=${apiKey}`;
      const response = await this.makeRequest({
        url,
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: "Hello" }]
            }
          ],
          generationConfig: {
            maxOutputTokens: 10
          }
        })
      });
      return !response.error && !!response.candidates && response.candidates.length > 0;
    } catch (e) {
      return false;
    }
  }
  async generateText(messages, apiKey, options) {
    var _a, _b, _c;
    const { contents, systemInstruction } = this.convertMessages(messages);
    const model = (options == null ? void 0 : options.model) || this.config.defaultModel;
    const url = `${this.config.endpoint}/models/${model}:generateContent?key=${apiKey}`;
    const requestBody = {
      contents,
      generationConfig: {
        temperature: (_a = options == null ? void 0 : options.temperature) != null ? _a : 0.7,
        maxOutputTokens: (_b = options == null ? void 0 : options.maxTokens) != null ? _b : 4096
      }
    };
    if (systemInstruction) {
      requestBody.systemInstruction = systemInstruction;
    }
    try {
      const response = await this.makeRequest({
        url,
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });
      if (response.error) {
        return {
          success: false,
          content: "",
          error: response.error.message,
          errorCode: response.error.status || String(response.error.code)
        };
      }
      if (!response.candidates || response.candidates.length === 0) {
        return {
          success: false,
          content: "",
          error: "No response generated",
          errorCode: "EMPTY_RESPONSE"
        };
      }
      const generatedText = response.candidates[0].content.parts.map((part) => part.text).join("");
      return {
        success: true,
        content: generatedText,
        tokensUsed: (_c = response.usageMetadata) == null ? void 0 : _c.totalTokenCount
      };
    } catch (error) {
      return this.handleError(error);
    }
  }
  convertMessages(messages) {
    const contents = [];
    let systemInstruction = null;
    for (const msg of messages) {
      if (msg.role === "system") {
        systemInstruction = {
          parts: [{ text: msg.content }]
        };
      } else {
        contents.push({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }]
        });
      }
    }
    return { contents, systemInstruction };
  }
};

// src/core/adapters/llm/grok-provider.ts
var GrokProvider = class extends BaseProvider {
  constructor() {
    super(...arguments);
    this.id = "grok";
    this.name = "xAI Grok";
  }
  async testApiKey(apiKey) {
    try {
      const response = await this.makeRequest({
        url: `${this.config.endpoint}/chat/completions`,
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: this.config.defaultModel,
          messages: [{ role: "user", content: "Hello" }],
          max_tokens: 10
        })
      });
      return !response.error && response.choices && response.choices.length > 0;
    } catch (e) {
      return false;
    }
  }
  async generateText(messages, apiKey, options) {
    var _a, _b, _c;
    const grokMessages = this.convertMessages(messages);
    const requestBody = {
      model: (options == null ? void 0 : options.model) || this.config.defaultModel,
      messages: grokMessages,
      max_tokens: (_a = options == null ? void 0 : options.maxTokens) != null ? _a : 4096,
      temperature: (_b = options == null ? void 0 : options.temperature) != null ? _b : 0.7
    };
    try {
      const response = await this.makeRequest({
        url: `${this.config.endpoint}/chat/completions`,
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });
      if (response.error) {
        return {
          success: false,
          content: "",
          error: response.error.message,
          errorCode: response.error.code || response.error.type
        };
      }
      if (!response.choices || response.choices.length === 0) {
        return {
          success: false,
          content: "",
          error: "No response generated",
          errorCode: "EMPTY_RESPONSE"
        };
      }
      const generatedText = response.choices[0].message.content;
      return {
        success: true,
        content: generatedText,
        tokensUsed: (_c = response.usage) == null ? void 0 : _c.total_tokens
      };
    } catch (error) {
      return this.handleError(error);
    }
  }
  convertMessages(messages) {
    return messages.map((msg) => ({
      role: msg.role,
      content: msg.content
    }));
  }
};

// src/core/adapters/llm/index.ts
function createLLMProvider(type) {
  switch (type) {
    case "claude":
      return new ClaudeProvider();
    case "openai":
      return new OpenAIProvider();
    case "gemini":
      return new GeminiProvider();
    case "grok":
      return new GrokProvider();
    default:
      throw new Error(`Unknown provider type: ${type}`);
  }
}
function createAllProviders() {
  const providers = /* @__PURE__ */ new Map();
  providers.set("claude", new ClaudeProvider());
  providers.set("openai", new OpenAIProvider());
  providers.set("gemini", new GeminiProvider());
  providers.set("grok", new GrokProvider());
  return providers;
}

// src/views/settings-tab.ts
var import_obsidian2 = require("obsidian");
var FEATURE_LABELS = {
  "content-analysis": {
    name: "Content Analysis",
    desc: "URL/\uD14D\uC2A4\uD2B8 \uBD84\uC11D \uBC0F \uC694\uC57D (economy \uBAA8\uB378 \uAD8C\uC7A5)"
  },
  "permanent-note": {
    name: "Topic Suggestion",
    desc: "\uC601\uAD6C \uB178\uD2B8 \uD1A0\uD53D \uC81C\uC548 (standard/premium \uBAA8\uB378 \uAD8C\uC7A5)"
  }
};
var SettingsTab = class extends import_obsidian2.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Note Topic Finder Settings" });
    this.renderApiKeySection(containerEl);
    this.renderFeatureModelSection(containerEl);
    this.renderBudgetSection(containerEl);
    this.renderLanguageSection(containerEl);
  }
  renderApiKeySection(containerEl) {
    containerEl.createEl("h3", { text: "API Keys" });
    const providers = ["claude", "openai", "gemini", "grok"];
    for (const provider of providers) {
      const config = AI_PROVIDERS2[provider];
      const isActive = this.plugin.settings.ai.provider === provider;
      const setting = new import_obsidian2.Setting(containerEl).setName(`${config.displayName} API Key`).setDesc(isActive ? "(Active)" : "").addText((text) => {
        text.setPlaceholder("Enter API key...").setValue(this.plugin.settings.ai.apiKeys[provider] || "").onChange(async (value) => {
          this.plugin.settings.ai.apiKeys[provider] = value;
          await this.plugin.saveSettings();
        });
        text.inputEl.type = "password";
        text.inputEl.style.width = "300px";
      }).addButton((button) => {
        button.setButtonText("Test").onClick(async () => {
          const apiKey = this.plugin.settings.ai.apiKeys[provider];
          if (!apiKey) {
            new import_obsidian2.Notice("Please enter an API key first");
            return;
          }
          button.setButtonText("Testing...");
          button.setDisabled(true);
          try {
            const isValid = await this.plugin.testApiKey(provider);
            if (isValid) {
              new import_obsidian2.Notice(`${config.displayName} API key is valid!`);
            } else {
              new import_obsidian2.Notice(`${config.displayName} API key is invalid`);
            }
          } catch (error) {
            new import_obsidian2.Notice(`Error testing API key: ${error}`);
          } finally {
            button.setButtonText("Test");
            button.setDisabled(false);
          }
        });
      });
      if (isActive) {
        setting.settingEl.style.backgroundColor = "var(--background-secondary)";
      }
    }
  }
  renderFeatureModelSection(containerEl) {
    var _a;
    containerEl.createEl("h3", { text: "Feature-Specific Model Selection" });
    containerEl.createEl("p", {
      text: "\uAC01 \uAE30\uB2A5\uBCC4\uB85C \uC0AC\uC6A9\uD560 Provider\uC640 Model\uC744 \uC120\uD0DD\uD558\uC138\uC694.",
      cls: "setting-item-description"
    });
    const features = ["content-analysis", "permanent-note"];
    for (const feature of features) {
      const label = FEATURE_LABELS[feature];
      const currentSettings = (_a = this.plugin.settings.ai.featureModels) == null ? void 0 : _a[feature];
      const currentProvider = (currentSettings == null ? void 0 : currentSettings.provider) || this.plugin.settings.ai.provider;
      const currentModel = (currentSettings == null ? void 0 : currentSettings.model) || FEATURE_DEFAULT_MODELS[feature][currentProvider];
      const featureDiv = containerEl.createDiv({ cls: "feature-model-setting" });
      featureDiv.createEl("h4", { text: label.name });
      featureDiv.createEl("p", { text: label.desc, cls: "setting-item-description" });
      new import_obsidian2.Setting(featureDiv).setName("Provider").addDropdown((dropdown) => {
        const providers = Object.entries(AI_PROVIDERS2);
        for (const [key, config] of providers) {
          dropdown.addOption(key, config.displayName);
        }
        dropdown.setValue(currentProvider).onChange(async (value) => {
          const provider = value;
          if (!this.plugin.settings.ai.featureModels) {
            this.plugin.settings.ai.featureModels = {};
          }
          this.plugin.settings.ai.featureModels[feature] = {
            provider,
            model: FEATURE_DEFAULT_MODELS[feature][provider]
          };
          await this.plugin.saveSettings();
          this.display();
        });
      });
      const models = getModelsByProvider2(currentProvider);
      new import_obsidian2.Setting(featureDiv).setName("Model").addDropdown((dropdown) => {
        for (const model of models) {
          const tierBadge = model.tier === "premium" ? "\u2B50" : model.tier === "standard" ? "\u25CF" : "\u25CB";
          const costInfo = `$${model.inputCostPer1M}/$${model.outputCostPer1M}`;
          dropdown.addOption(model.id, `${tierBadge} ${model.displayName} (${costInfo})`);
        }
        dropdown.setValue(currentModel).onChange(async (value) => {
          if (!this.plugin.settings.ai.featureModels) {
            this.plugin.settings.ai.featureModels = {};
          }
          this.plugin.settings.ai.featureModels[feature] = {
            provider: currentProvider,
            model: value
          };
          await this.plugin.saveSettings();
        });
      });
    }
  }
  renderBudgetSection(containerEl) {
    containerEl.createEl("h3", { text: "Budget Management" });
    new import_obsidian2.Setting(containerEl).setName("Monthly Budget Limit").setDesc("Set a spending limit in USD (0 = unlimited)").addText((text) => {
      text.setPlaceholder("e.g., 10.00").setValue(String(this.plugin.settings.ai.budgetLimit || 0)).onChange(async (value) => {
        const parsed = parseFloat(value);
        this.plugin.settings.ai.budgetLimit = isNaN(parsed) ? void 0 : parsed;
        await this.plugin.saveSettings();
      });
      text.inputEl.type = "number";
      text.inputEl.step = "0.01";
      text.inputEl.min = "0";
    });
    const currentSpend = this.plugin.getCurrentSpend();
    const budgetLimit = this.plugin.settings.ai.budgetLimit;
    if (budgetLimit && budgetLimit > 0) {
      const percentage = currentSpend / budgetLimit * 100;
      const statusText = `Current: $${currentSpend.toFixed(4)} / $${budgetLimit.toFixed(2)} (${percentage.toFixed(1)}%)`;
      containerEl.createEl("p", {
        text: statusText,
        cls: "setting-item-description"
      });
    }
  }
  renderLanguageSection(containerEl) {
    containerEl.createEl("h3", { text: "Output Settings" });
    new import_obsidian2.Setting(containerEl).setName("Default Language").setDesc("Language for analysis output (auto = same as input)").addDropdown((dropdown) => {
      dropdown.addOption("auto", "Auto-detect").addOption("en", "English").addOption("ko", "Korean").addOption("ja", "Japanese").addOption("zh", "Chinese").setValue(this.plugin.settings.ai.defaultLanguage || "auto").onChange(async (value) => {
        this.plugin.settings.ai.defaultLanguage = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian2.Setting(containerEl).setName("Output Folder").setDesc("Folder path for saved notes (leave empty for vault root)").addText((text) => {
      text.setPlaceholder("e.g., Notes/Analysis").setValue(this.plugin.settings.outputFolder || "").onChange(async (value) => {
        this.plugin.settings.outputFolder = value.trim();
        await this.plugin.saveSettings();
      });
      text.inputEl.style.width = "300px";
    });
  }
};

// src/views/analyze-modal.ts
var import_obsidian3 = require("obsidian");
var AnalyzeModal = class extends import_obsidian3.Modal {
  constructor(app, onSubmit) {
    super(app);
    this.result = null;
    this.sourceType = "text";
    this.content = "";
    this.sourceUrl = "";
    this.selectedNote = null;
    this.language = "auto";
    this.detailLevel = "standard";
    this.onSubmit = onSubmit;
  }
  onOpen() {
    const { contentEl, modalEl } = this;
    modalEl.addClass("mod-note-topic-finder");
    contentEl.empty();
    contentEl.createEl("h2", { text: "Analyze Content" });
    new import_obsidian3.Setting(contentEl).setName("Source Type").setDesc("Select the type of content to analyze").addDropdown((dropdown) => {
      dropdown.addOption("text", "Text").addOption("url", "URL").addOption("note", "Vault Note").setValue(this.sourceType).onChange((value) => {
        this.sourceType = value;
        this.updateContentInput(contentEl);
      });
    });
    const inputContainer = contentEl.createDiv({ cls: "input-container" });
    this.renderContentInput(inputContainer);
    contentEl.createEl("h3", { text: "Analysis Options" });
    new import_obsidian3.Setting(contentEl).setName("Language").setDesc("Output language for the analysis").addDropdown((dropdown) => {
      dropdown.addOption("auto", "Auto-detect (same as input)").addOption("en", "English").addOption("ko", "Korean").setValue(this.language).onChange((value) => {
        this.language = value;
      });
    });
    new import_obsidian3.Setting(contentEl).setName("Detail Level").setDesc("How detailed should the analysis be?").addDropdown((dropdown) => {
      dropdown.addOption("brief", "Brief (quick overview)").addOption("standard", "Standard (balanced)").addOption("detailed", "Detailed (comprehensive)").setValue(this.detailLevel).onChange((value) => {
        this.detailLevel = value;
      });
    });
    const buttonContainer = contentEl.createDiv({ cls: "button-container" });
    buttonContainer.style.display = "flex";
    buttonContainer.style.justifyContent = "flex-end";
    buttonContainer.style.gap = "10px";
    buttonContainer.style.marginTop = "20px";
    const cancelBtn = buttonContainer.createEl("button", { text: "Cancel" });
    cancelBtn.onclick = () => this.close();
    const analyzeBtn = buttonContainer.createEl("button", {
      text: "Analyze",
      cls: "mod-cta"
    });
    analyzeBtn.onclick = () => this.submit();
  }
  renderContentInput(container) {
    container.empty();
    if (this.sourceType === "url") {
      new import_obsidian3.Setting(container).setName("URL").setDesc("Enter the URL to analyze").addText((text) => {
        text.setPlaceholder("https://example.com/article").setValue(this.sourceUrl).onChange((value) => {
          this.sourceUrl = value;
          this.content = value;
        });
        text.inputEl.style.width = "100%";
      });
    } else if (this.sourceType === "note") {
      this.renderNoteSelection(container);
    } else {
      const textAreaSetting = new import_obsidian3.Setting(container).setName("Content").setDesc("Paste the text content to analyze");
      textAreaSetting.controlEl.style.display = "block";
      textAreaSetting.controlEl.style.width = "100%";
      const textArea = new import_obsidian3.TextAreaComponent(textAreaSetting.controlEl);
      textArea.setPlaceholder("Paste your text content here...").setValue(this.content).onChange((value) => {
        this.content = value;
      });
      textArea.inputEl.style.width = "100%";
      textArea.inputEl.style.minHeight = "200px";
      textArea.inputEl.style.fontFamily = "var(--font-text)";
    }
  }
  renderNoteSelection(container) {
    const currentFile = this.app.workspace.getActiveFile();
    if (currentFile) {
      this.selectedNote = currentFile;
      new import_obsidian3.Setting(container).setName("Current Note").setDesc(currentFile.path);
    } else {
      this.selectedNote = null;
      const warning = container.createDiv({ cls: "note-warning" });
      warning.style.color = "var(--text-error)";
      warning.style.padding = "10px";
      warning.setText("No note is currently open. Please open a note first.");
    }
  }
  updateContentInput(contentEl) {
    const container = contentEl.querySelector(".input-container");
    if (container) {
      this.renderContentInput(container);
    }
  }
  async submit() {
    if (this.sourceType === "note") {
      if (!this.selectedNote) {
        new import_obsidian3.Notice("Please select a note to analyze");
        return;
      }
      try {
        this.content = await this.app.vault.cachedRead(this.selectedNote);
      } catch (e) {
        new import_obsidian3.Notice("Failed to read note content");
        return;
      }
    } else if (!this.content.trim()) {
      new import_obsidian3.Notice("Please enter content to analyze");
      return;
    }
    if (this.sourceType === "url" && !this.isValidUrl(this.content)) {
      new import_obsidian3.Notice("Please enter a valid URL");
      return;
    }
    this.result = {
      content: this.content,
      sourceType: this.sourceType,
      sourceUrl: this.sourceType === "url" ? this.content : void 0,
      sourcePath: this.sourceType === "note" && this.selectedNote ? this.selectedNote.path : void 0,
      language: this.language,
      detailLevel: this.detailLevel
    };
    this.onSubmit(this.result);
    this.close();
  }
  isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (e) {
      return false;
    }
  }
  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
};

// src/views/analysis-view.ts
var import_obsidian4 = require("obsidian");
var ANALYSIS_VIEW_TYPE = "note-topic-finder-view";
var AnalysisView = class extends import_obsidian4.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.currentResult = null;
    this.currentJob = null;
    this.suggestedTopics = null;
    this.isSuggestingTopics = false;
    this.viewingTopics = false;
    // Track which view to show
    // Loading overlay elements (direct DOM references)
    this.loadingOverlayEl = null;
    this.loadingTextEl = null;
    this.plugin = plugin;
  }
  getViewType() {
    return ANALYSIS_VIEW_TYPE;
  }
  getDisplayText() {
    return "AI Analysis";
  }
  getIcon() {
    return "sparkles";
  }
  async onOpen() {
    this.render();
  }
  async onClose() {
    this.hideLoadingOverlay();
    this.currentResult = null;
    this.currentJob = null;
    this.suggestedTopics = null;
    this.loadingOverlayEl = null;
    this.loadingTextEl = null;
  }
  showResult(result) {
    this.hideLoadingOverlay();
    this.currentResult = result;
    this.currentJob = null;
    this.suggestedTopics = null;
    this.isSuggestingTopics = false;
    this.viewingTopics = false;
    this.render();
  }
  showTopicSuggestions(topics) {
    this.hideLoadingOverlay();
    this.suggestedTopics = topics;
    this.isSuggestingTopics = false;
    this.viewingTopics = true;
    this.render();
  }
  setSuggestingTopics(suggesting) {
    this.isSuggestingTopics = suggesting;
    if (suggesting) {
      this.showLoadingOverlay("Finding note topics...");
    } else {
      this.hideLoadingOverlay();
    }
  }
  showProgress(job) {
    this.currentJob = job;
    const data = job.data;
    let message = "Analyzing content...";
    if (data.sourceType === "url") {
      message = "Analyzing URL...";
    } else if (data.sourceType === "note") {
      message = "Analyzing note...";
    } else if (data.sourceType === "text") {
      message = "Analyzing text...";
    }
    this.showLoadingOverlay(message);
  }
  updateProgress(progress, message) {
    if (this.loadingTextEl && message) {
      this.loadingTextEl.textContent = message;
    }
  }
  showError(error) {
    this.hideLoadingOverlay();
    this.currentJob = null;
    this.currentResult = null;
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("note-topic-finder-view");
    const header = container.createDiv({ cls: "view-header" });
    header.createEl("h4", { text: "AI Analysis" });
    const actions = header.createDiv({ cls: "view-actions" });
    const newAnalysisBtn = actions.createEl("button", { cls: "clickable-icon" });
    (0, import_obsidian4.setIcon)(newAnalysisBtn, "plus");
    newAnalysisBtn.title = "New Analysis";
    newAnalysisBtn.onclick = () => this.plugin.openAnalyzeModal();
    container.createEl("p", { text: error, cls: "error-message" });
  }
  /**
   * Show loading overlay with spinner and text message
   */
  showLoadingOverlay(message) {
    const container = this.containerEl.children[1];
    this.hideLoadingOverlay();
    Array.from(container.children).forEach((child) => {
      if (child instanceof HTMLElement && !child.hasClass("view-header")) {
        child.style.display = "none";
      }
    });
    this.loadingOverlayEl = container.createDiv({ cls: "loading-container" });
    this.loadingOverlayEl.createDiv({ cls: "loading-spinner" });
    this.loadingTextEl = this.loadingOverlayEl.createEl("p", { cls: "loading-text", text: message });
  }
  /**
   * Hide loading overlay
   */
  hideLoadingOverlay() {
    if (this.loadingOverlayEl) {
      this.loadingOverlayEl.remove();
      this.loadingOverlayEl = null;
      this.loadingTextEl = null;
    }
  }
  render() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("note-topic-finder-view");
    const header = container.createDiv({ cls: "view-header" });
    header.createEl("h4", { text: "AI Analysis" });
    const actions = header.createDiv({ cls: "view-actions" });
    const newAnalysisBtn = actions.createEl("button", { cls: "clickable-icon" });
    (0, import_obsidian4.setIcon)(newAnalysisBtn, "plus");
    newAnalysisBtn.title = "New Analysis";
    newAnalysisBtn.onclick = () => this.plugin.openAnalyzeModal();
    if (this.viewingTopics && this.suggestedTopics && this.suggestedTopics.length > 0) {
      this.renderTopicSuggestions(container);
    } else if (this.currentResult) {
      this.renderResult(container);
    } else {
      this.renderEmpty(container);
    }
  }
  renderEmpty(container) {
    const emptyState = container.createDiv({ cls: "empty-state" });
    emptyState.createEl("p", { text: "No analysis results yet." });
    emptyState.createEl("p", { text: "Click the + button or use the command palette to start analyzing content." });
  }
  renderResult(container) {
    if (!this.currentResult) return;
    const result = this.currentResult;
    const resultContainer = container.createDiv({ cls: "result-container" });
    if (result.sourceUrl) {
      const sourceEl = resultContainer.createEl("p", { cls: "source-info" });
      sourceEl.createEl("strong", { text: "Source: " });
      const link = sourceEl.createEl("a", { text: result.sourceUrl, href: result.sourceUrl });
      link.setAttr("target", "_blank");
    } else if (result.sourcePath) {
      const sourceEl = resultContainer.createEl("p", { cls: "source-info" });
      sourceEl.createEl("strong", { text: "Source Note: " });
      sourceEl.createSpan({ text: result.sourcePath });
    }
    resultContainer.createEl("h5", { text: "Summary" });
    resultContainer.createEl("p", { text: result.summary, cls: "summary-text" });
    if (result.keyInsights.length > 0) {
      resultContainer.createEl("h5", { text: "Key Insights" });
      const insightsList = resultContainer.createEl("ul", { cls: "insights-list" });
      for (const insight of result.keyInsights) {
        insightsList.createEl("li", { text: insight });
      }
    }
    if (result.suggestedTags.length > 0) {
      resultContainer.createEl("h5", { text: "Suggested Tags" });
      const tagsContainer = resultContainer.createDiv({ cls: "tags-container" });
      for (const tag of result.suggestedTags) {
        const tagEl = tagsContainer.createEl("span", { text: `#${tag}`, cls: "tag" });
        tagEl.onclick = () => {
          navigator.clipboard.writeText(`#${tag}`);
          new import_obsidian4.Notice("Tag copied to clipboard");
        };
      }
    }
    if (result.relatedTopics.length > 0) {
      resultContainer.createEl("h5", { text: "Related Topics" });
      const topicsContainer = resultContainer.createDiv({ cls: "topics-container" });
      for (const topic of result.relatedTopics) {
        topicsContainer.createEl("span", { text: topic, cls: "topic" });
      }
    }
    const actionButtons = resultContainer.createDiv({ cls: "action-buttons" });
    const copyBtn = actionButtons.createEl("button", { text: "Copy as Markdown" });
    copyBtn.onclick = () => {
      const markdown = result.toMarkdown();
      navigator.clipboard.writeText(markdown);
      new import_obsidian4.Notice("Copied to clipboard");
    };
    const saveBtn = actionButtons.createEl("button", { text: "Save as Note" });
    saveBtn.onclick = () => this.saveAsNote(result);
    if (this.suggestedTopics && this.suggestedTopics.length > 0) {
      const viewTopicsBtn = actionButtons.createEl("button", { text: "View Suggested Topics", cls: "mod-cta" });
      viewTopicsBtn.onclick = () => {
        this.viewingTopics = true;
        this.render();
      };
    } else {
      const suggestBtn = actionButtons.createEl("button", { text: "Suggest Note Topics", cls: "mod-cta" });
      suggestBtn.onclick = () => this.plugin.suggestNoteTopics(result);
    }
  }
  renderTopicSuggestions(container) {
    if (!this.suggestedTopics) return;
    const resultContainer = container.createDiv({ cls: "result-container" });
    resultContainer.createEl("h5", { text: "\u{1F4DA} Permanent Note Topics" });
    resultContainer.createEl("p", {
      text: "Use /permanent-note-author skill to write these notes with high quality.",
      cls: "setting-item-description"
    });
    for (const topic of this.suggestedTopics) {
      const topicCard = resultContainer.createDiv({ cls: "topic-card" });
      const titleEl = topicCard.createEl("h6", { text: `\u{1F4A1} ${topic.title}` });
      titleEl.style.cursor = "pointer";
      titleEl.onclick = () => {
        navigator.clipboard.writeText(topic.title);
        new import_obsidian4.Notice(`Copied: ${topic.title}`);
      };
      titleEl.title = "Click to copy title";
      topicCard.createEl("p", { text: topic.rationale, cls: "topic-rationale" });
      if (topic.keyPoints.length > 0) {
        const pointsContainer = topicCard.createDiv({ cls: "key-points" });
        pointsContainer.createEl("strong", { text: "Key Points:" });
        const pointsList = pointsContainer.createEl("ul");
        for (const point of topic.keyPoints) {
          pointsList.createEl("li", { text: point });
        }
      }
      if (topic.suggestedTags.length > 0) {
        const tagsContainer = topicCard.createDiv({ cls: "tags-container" });
        for (const tag of topic.suggestedTags) {
          const tagEl = tagsContainer.createEl("span", { text: `#${tag}`, cls: "tag" });
          tagEl.onclick = () => {
            navigator.clipboard.writeText(`#${tag}`);
            new import_obsidian4.Notice("Tag copied");
          };
        }
      }
    }
    const actionButtons = resultContainer.createDiv({ cls: "action-buttons" });
    const copyAllBtn = actionButtons.createEl("button", { text: "Copy All Topics" });
    copyAllBtn.onclick = () => {
      const text = this.suggestedTopics.map(
        (t, i) => `${i + 1}. ${t.title}
   - ${t.rationale}
   - Key: ${t.keyPoints.join(", ")}
   - Tags: ${t.suggestedTags.join(", ")}`
      ).join("\n\n");
      navigator.clipboard.writeText(text);
      new import_obsidian4.Notice("All topics copied to clipboard");
    };
    const saveBtn = actionButtons.createEl("button", { text: "Save as Note", cls: "mod-cta" });
    saveBtn.onclick = () => this.saveAsNoteWithTopics();
    const backBtn = actionButtons.createEl("button", { text: "Back to Analysis" });
    backBtn.onclick = () => {
      this.viewingTopics = false;
      this.render();
    };
  }
  /**
   * Generate markdown with both analysis result and suggested topics
   */
  generateFullMarkdown() {
    if (!this.currentResult) return "";
    const result = this.currentResult;
    const lines = [];
    lines.push("---");
    lines.push(`created: ${result.createdAt.toISOString().split("T")[0]}`);
    if (result.sourceUrl) {
      lines.push(`source: "${result.sourceUrl}"`);
    }
    if (result.sourcePath) {
      lines.push(`source_note: "[[${result.sourcePath.replace(/\.md$/, "")}]]"`);
    }
    if (result.suggestedTags.length > 0) {
      lines.push(`tags:`);
      result.suggestedTags.forEach((tag) => {
        const formattedTag = tag.replace(/\s+/g, "_");
        lines.push(`  - ${formattedTag}`);
      });
    }
    if (result.relatedTopics.length > 0) {
      lines.push(`topics:`);
      result.relatedTopics.forEach((topic) => {
        lines.push(`  - "${topic}"`);
      });
    }
    lines.push(`analyzed_at: ${result.createdAt.toISOString()}`);
    lines.push(`source_type: ${result.sourceType}`);
    lines.push("---");
    lines.push("");
    lines.push(`## Summary`);
    lines.push(result.summary);
    lines.push("");
    if (result.keyInsights.length > 0) {
      lines.push(`## Key Insights`);
      result.keyInsights.forEach((insight) => {
        lines.push(`- ${insight}`);
      });
      lines.push("");
    }
    if (this.suggestedTopics && this.suggestedTopics.length > 0) {
      lines.push("## Permanent Note Topics");
      lines.push("");
      lines.push("> Use /permanent-note-author skill to write these notes with high quality.");
      lines.push("");
      this.suggestedTopics.forEach((topic, i) => {
        lines.push(`### ${i + 1}. ${topic.title}`);
        lines.push("");
        lines.push(`**Rationale:** ${topic.rationale}`);
        lines.push("");
        if (topic.keyPoints.length > 0) {
          lines.push("**Key Points:**");
          topic.keyPoints.forEach((point) => {
            lines.push(`- ${point}`);
          });
          lines.push("");
        }
        if (topic.suggestedTags.length > 0) {
          lines.push(`**Tags:** ${topic.suggestedTags.map((t) => `#${t}`).join(" ")}`);
          lines.push("");
        }
      });
    }
    return lines.join("\n");
  }
  /**
   * Save note with both analysis result and suggested topics
   */
  async saveAsNoteWithTopics() {
    var _a;
    if (!this.currentResult) {
      new import_obsidian4.Notice("No analysis result to save");
      return;
    }
    const markdown = this.generateFullMarkdown();
    const result = this.currentResult;
    const sanitizedTitle = result.suggestedTitle.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim().slice(0, 100);
    const fileName = `${sanitizedTitle}.md`;
    const outputFolder = (_a = this.plugin.settings.outputFolder) == null ? void 0 : _a.trim();
    const filePath = (0, import_obsidian4.normalizePath)(outputFolder ? `${outputFolder}/${fileName}` : fileName);
    try {
      if (outputFolder) {
        await this.ensureFolder((0, import_obsidian4.normalizePath)(outputFolder));
      }
      await this.createFile(filePath, markdown);
      new import_obsidian4.Notice(`Note created with topics: ${filePath}`);
      await this.app.workspace.openLinkText(filePath, "");
    } catch (error) {
      new import_obsidian4.Notice(`Error creating note: ${error}`);
    }
  }
  async saveAsNote(result) {
    var _a;
    const markdown = result.toMarkdown();
    const sanitizedTitle = result.suggestedTitle.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim().slice(0, 100);
    const fileName = `${sanitizedTitle}.md`;
    const outputFolder = (_a = this.plugin.settings.outputFolder) == null ? void 0 : _a.trim();
    const filePath = (0, import_obsidian4.normalizePath)(outputFolder ? `${outputFolder}/${fileName}` : fileName);
    try {
      if (outputFolder) {
        await this.ensureFolder((0, import_obsidian4.normalizePath)(outputFolder));
      }
      await this.createFile(filePath, markdown);
      new import_obsidian4.Notice(`Note created: ${filePath}`);
      await this.app.workspace.openLinkText(filePath, "");
    } catch (error) {
      new import_obsidian4.Notice(`Error creating note: ${error}`);
    }
  }
  /**
   * Ensure folder exists with cross-platform compatibility
   * Handles "already exists" errors from Git sync scenarios
   */
  async ensureFolder(path) {
    const normalizedPath = (0, import_obsidian4.normalizePath)(path);
    const existing = this.app.vault.getAbstractFileByPath(normalizedPath);
    if (existing instanceof import_obsidian4.TFolder) {
      return;
    }
    try {
      await this.app.vault.createFolder(normalizedPath);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.toLowerCase().includes("already exists")) {
        return;
      }
      throw error;
    }
  }
  /**
   * Create file with cross-platform compatibility
   * Uses adapter fallback when Obsidian index isn't synced
   */
  async createFile(path, content) {
    const normalizedPath = (0, import_obsidian4.normalizePath)(path);
    try {
      await this.app.vault.create(normalizedPath, content);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.toLowerCase().includes("already exists")) {
        await this.app.vault.adapter.write(normalizedPath, content);
        return;
      }
      throw error;
    }
  }
};

// src/main.ts
var DEFAULT_SETTINGS = {
  ai: {
    provider: "openai",
    apiKeys: {},
    models: {
      claude: "claude-sonnet-4-6",
      gemini: "gemini-2.5-flash",
      openai: "gpt-5-mini",
      grok: "grok-4-1-fast"
    },
    featureModels: {
      "content-analysis": {
        provider: "openai",
        model: "gpt-5-nano"
      },
      "permanent-note": {
        provider: "openai",
        model: "gpt-5-mini"
      }
    },
    defaultLanguage: "auto",
    budgetLimit: void 0
  },
  outputFolder: ""
};
var NoteTopicFinderPlugin = class extends import_obsidian5.Plugin {
  constructor() {
    super(...arguments);
    this.analysisView = null;
  }
  async onload() {
    await this.loadSettings();
    this.initializeServices();
    this.registerViews();
    this.registerCommands();
    this.addSettingTab(new SettingsTab(this.app, this));
    this.setupRibbonIcon();
    console.log("Note Topic Finder loaded");
  }
  async onunload() {
    resetAIService();
    resetEventEmitter();
    console.log("Note Topic Finder unloaded");
  }
  initializeServices() {
    const emitter = getEventEmitter();
    this.costTracker = new CostTracker(this.settings.ai.budgetLimit, emitter);
    this.aiService = initializeAIService(this.settings.ai);
    const providers = createAllProviders();
    providers.forEach((provider) => {
      this.aiService.registerProvider(provider);
    });
    this.jobQueue = new JobQueue(emitter);
    emitter.on("job:progress", ({ jobId, progress, message }) => {
      if (this.analysisView) {
        this.analysisView.updateProgress(progress, message);
      }
    });
    emitter.on("cost:updated", ({ totalSpend, budgetLimit }) => {
      if (budgetLimit && totalSpend >= budgetLimit * 0.9) {
        new import_obsidian5.Notice(`Warning: Budget usage at ${(totalSpend / budgetLimit * 100).toFixed(0)}%`);
      }
    });
  }
  registerViews() {
    this.registerView(ANALYSIS_VIEW_TYPE, (leaf) => {
      this.analysisView = new AnalysisView(leaf, this);
      return this.analysisView;
    });
  }
  registerCommands() {
    this.addCommand({
      id: "analyze-content",
      name: "Analyze content",
      callback: () => this.openAnalyzeModal()
    });
    this.addCommand({
      id: "analyze-clipboard",
      name: "Analyze clipboard content",
      callback: () => this.analyzeClipboard()
    });
    this.addCommand({
      id: "open-analysis-view",
      name: "Open analysis view",
      callback: () => this.activateView()
    });
    this.addCommand({
      id: "suggest-note-topics",
      name: "Suggest permanent note topics from analysis",
      callback: () => {
        if (this.analysisView) {
          const currentResult = this.analysisView.currentResult;
          if (currentResult) {
            this.suggestNoteTopics(currentResult);
          } else {
            new import_obsidian5.Notice("No analysis result available. Run analysis first.");
          }
        }
      }
    });
  }
  setupRibbonIcon() {
    this.addRibbonIcon("sparkles", "Note Topic Finder", () => {
      this.openAnalyzeModal();
    });
  }
  openAnalyzeModal() {
    new AnalyzeModal(this.app, async (result) => {
      await this.analyzeContent(result);
    }).open();
  }
  async analyzeClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        new import_obsidian5.Notice("Clipboard is empty");
        return;
      }
      let sourceType = "text";
      try {
        new URL(text);
        sourceType = "url";
      } catch (e) {
      }
      await this.analyzeContent({
        content: text,
        sourceType,
        sourceUrl: sourceType === "url" ? text : void 0,
        language: this.settings.ai.defaultLanguage,
        detailLevel: "standard"
      });
    } catch (error) {
      new import_obsidian5.Notice("Failed to read clipboard");
    }
  }
  async analyzeContent(input) {
    await this.activateView();
    if (this.analysisView) {
      this.analysisView.showProgress({
        id: "temp",
        type: "analyze-content",
        status: "running",
        progress: 0,
        priority: 1,
        createdAt: /* @__PURE__ */ new Date(),
        retryCount: 0,
        maxRetries: 3,
        data: input
      });
    }
    await new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resolve();
        });
      });
    });
    try {
      let content = input.content;
      if (input.sourceType === "url") {
        content = await this.fetchUrlContent(input.content);
      }
      const useCase = new AnalyzeContentUseCase(this.aiService, this.costTracker);
      const response = await useCase.execute({
        content,
        sourceType: input.sourceType,
        sourceUrl: input.sourceUrl,
        sourcePath: input.sourcePath,
        language: input.language,
        detailLevel: input.detailLevel
      });
      if (response.success && response.result) {
        if (this.analysisView) {
          this.analysisView.showResult(response.result);
        }
        new import_obsidian5.Notice("Analysis complete");
      } else {
        if (this.analysisView) {
          this.analysisView.showError(response.error || "Analysis failed");
        }
        new import_obsidian5.Notice(`Analysis failed: ${response.error}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      if (this.analysisView) {
        this.analysisView.showError(errorMsg);
      }
      new import_obsidian5.Notice(`Analysis error: ${errorMsg}`);
    }
  }
  async fetchUrlContent(url) {
    try {
      const response = await (0, import_obsidian5.requestUrl)({ url });
      const html = response.text;
      const text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      return text.slice(0, 5e4);
    } catch (error) {
      throw new Error(`Failed to fetch URL: ${error}`);
    }
  }
  async activateView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(ANALYSIS_VIEW_TYPE)[0];
    if (!leaf) {
      const rightLeaf = workspace.getRightLeaf(false);
      if (rightLeaf) {
        leaf = rightLeaf;
        await leaf.setViewState({ type: ANALYSIS_VIEW_TYPE, active: true });
      }
    }
    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }
  async testApiKey(provider) {
    const llmProvider = createLLMProvider(provider);
    const apiKey = this.settings.ai.apiKeys[provider];
    if (!apiKey) return false;
    return llmProvider.testApiKey(apiKey);
  }
  async suggestNoteTopics(analysisResult) {
    if (this.analysisView) {
      this.analysisView.setSuggestingTopics(true);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
    try {
      const useCase = new SuggestNoteTopicsUseCase(this.aiService, this.costTracker);
      const response = await useCase.execute({
        analysisResult,
        language: this.settings.ai.defaultLanguage,
        count: 4
      });
      if (response.success && response.topics) {
        if (this.analysisView) {
          this.analysisView.showTopicSuggestions(response.topics);
        }
        new import_obsidian5.Notice(`Found ${response.topics.length} note topics`);
      } else {
        if (this.analysisView) {
          this.analysisView.showError(response.error || "Failed to suggest topics");
        }
        new import_obsidian5.Notice(`Suggestion failed: ${response.error}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      if (this.analysisView) {
        this.analysisView.showError(errorMsg);
      }
      new import_obsidian5.Notice(`Suggestion error: ${errorMsg}`);
    }
  }
  getCurrentSpend() {
    return this.costTracker.getCurrentSpend();
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
    updateAIServiceSettings(this.settings.ai);
    this.costTracker.setBudgetLimit(this.settings.ai.budgetLimit);
  }
};
