/**
 * Note Topic Finder Plugin
 * Main entry point
 */

import { Plugin, Notice, requestUrl } from 'obsidian';
import type { AIProviderType, AISettings } from './core/domain/interfaces/llm-provider';
import { AI_PROVIDERS } from './core/domain/constants/model-configs';
import {
  AIService,
  initializeAIService,
  updateAIServiceSettings,
  resetAIService,
  CostTracker,
  getEventEmitter,
  resetEventEmitter,
  JobQueue,
  AnalyzeContentUseCase,
  SuggestNoteTopicsUseCase,
} from './core/application';
import type { AnalysisResult } from './core/domain/entities/analysis-result';
import { createLLMProvider, createAllProviders } from './core/adapters';
import { SettingsTab, AnalyzeModal, AnalysisView, ANALYSIS_VIEW_TYPE } from './views';
import type { AnalyzeModalResult } from './views';

export interface PluginSettings {
  ai: AISettings;
  outputFolder: string;
}

const DEFAULT_SETTINGS: PluginSettings = {
  ai: {
    provider: 'openai',
    apiKeys: {},
    models: {
      claude: 'claude-sonnet-4-6',
      gemini: 'gemini-2.5-flash',
      openai: 'gpt-5.4-mini',
      grok: 'grok-4-1-fast',
    },
    featureModels: {
      'content-analysis': {
        provider: 'openai',
        model: 'gpt-5.4-nano',
      },
      'permanent-note': {
        provider: 'openai',
        model: 'gpt-5.4-mini',
      },
    },
    defaultLanguage: 'auto',
    budgetLimit: undefined,
  },
  outputFolder: '',
};

export default class NoteTopicFinderPlugin extends Plugin {
  settings!: PluginSettings;
  private aiService!: AIService;
  private costTracker!: CostTracker;
  private jobQueue!: JobQueue;
  private analysisView: AnalysisView | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.initializeServices();
    this.registerViews();
    this.registerCommands();
    this.addSettingTab(new SettingsTab(this.app, this));
    this.setupRibbonIcon();

    console.log('Note Topic Finder loaded');
  }

  async onunload(): Promise<void> {
    resetAIService();
    resetEventEmitter();
    console.log('Note Topic Finder unloaded');
  }

  private initializeServices(): void {
    // Initialize EventEmitter
    const emitter = getEventEmitter();

    // Initialize Cost Tracker
    this.costTracker = new CostTracker(this.settings.ai.budgetLimit, emitter);

    // Initialize AI Service
    this.aiService = initializeAIService(this.settings.ai);

    // Register all providers
    const providers = createAllProviders();
    providers.forEach((provider) => {
      this.aiService.registerProvider(provider);
    });

    // Initialize Job Queue
    this.jobQueue = new JobQueue(emitter);

    // Subscribe to events
    emitter.on('job:progress', ({ jobId, progress, message }) => {
      if (this.analysisView) {
        this.analysisView.updateProgress(progress, message);
      }
    });

    emitter.on('cost:updated', ({ totalSpend, budgetLimit }) => {
      if (budgetLimit && totalSpend >= budgetLimit * 0.9) {
        new Notice(`Warning: Budget usage at ${((totalSpend / budgetLimit) * 100).toFixed(0)}%`);
      }
    });
  }

  private registerViews(): void {
    this.registerView(ANALYSIS_VIEW_TYPE, (leaf) => {
      this.analysisView = new AnalysisView(leaf, this);
      return this.analysisView;
    });
  }

  private registerCommands(): void {
    // Open analysis modal
    this.addCommand({
      id: 'analyze-content',
      name: 'Analyze content',
      callback: () => this.openAnalyzeModal(),
    });

    // Analyze clipboard content
    this.addCommand({
      id: 'analyze-clipboard',
      name: 'Analyze clipboard content',
      callback: () => this.analyzeClipboard(),
    });

    // Open analysis view
    this.addCommand({
      id: 'open-analysis-view',
      name: 'Open analysis view',
      callback: () => this.activateView(),
    });

    // Suggest permanent note topics from last analysis
    this.addCommand({
      id: 'suggest-note-topics',
      name: 'Suggest permanent note topics from analysis',
      callback: () => {
        if (this.analysisView) {
          const currentResult = (this.analysisView as AnalysisView & { currentResult: AnalysisResult | null }).currentResult;
          if (currentResult) {
            this.suggestNoteTopics(currentResult);
          } else {
            new Notice('No analysis result available. Run analysis first.');
          }
        }
      },
    });
  }

  private setupRibbonIcon(): void {
    this.addRibbonIcon('sparkles', 'Note Topic Finder', () => {
      this.openAnalyzeModal();
    });
  }

  public openAnalyzeModal(): void {
    new AnalyzeModal(this.app, async (result) => {
      await this.analyzeContent(result);
    }).open();
  }

  private async analyzeClipboard(): Promise<void> {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        new Notice('Clipboard is empty');
        return;
      }

      // Check if it's a URL
      let sourceType: 'url' | 'text' = 'text';
      try {
        new URL(text);
        sourceType = 'url';
      } catch {
        // Not a URL
      }

      await this.analyzeContent({
        content: text,
        sourceType,
        sourceUrl: sourceType === 'url' ? text : undefined,
        language: this.settings.ai.defaultLanguage,
        detailLevel: 'standard',
      });
    } catch (error) {
      new Notice('Failed to read clipboard');
    }
  }

  private async analyzeContent(input: AnalyzeModalResult): Promise<void> {
    // Ensure view is open
    await this.activateView();

    // Show loading state
    if (this.analysisView) {
      this.analysisView.showProgress({
        id: 'temp',
        type: 'analyze-content',
        status: 'running',
        progress: 0,
        priority: 1,
        createdAt: new Date(),
        retryCount: 0,
        maxRetries: 3,
        data: input,
      });
    }

    // Double rAF ensures DOM is painted before continuing
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resolve();
        });
      });
    });

    try {
      // Fetch URL content if needed
      let content = input.content;
      if (input.sourceType === 'url') {
        content = await this.fetchUrlContent(input.content);
      }

      // Create use case and execute
      const useCase = new AnalyzeContentUseCase(this.aiService, this.costTracker);
      const response = await useCase.execute({
        content,
        sourceType: input.sourceType,
        sourceUrl: input.sourceUrl,
        sourcePath: input.sourcePath,
        language: input.language,
        detailLevel: input.detailLevel,
      });

      if (response.success && response.result) {
        if (this.analysisView) {
          this.analysisView.showResult(response.result);
        }
        new Notice('Analysis complete');
      } else {
        if (this.analysisView) {
          this.analysisView.showError(response.error || 'Analysis failed');
        }
        new Notice(`Analysis failed: ${response.error}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      if (this.analysisView) {
        this.analysisView.showError(errorMsg);
      }
      new Notice(`Analysis error: ${errorMsg}`);
    }
  }

  private async fetchUrlContent(url: string): Promise<string> {
    try {
      const response = await requestUrl({ url });
      // Basic HTML to text extraction
      const html = response.text;
      // Remove scripts, styles, and HTML tags
      const text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return text.slice(0, 50000); // Limit content length
    } catch (error) {
      throw new Error(`Failed to fetch URL: ${error}`);
    }
  }

  private async activateView(): Promise<void> {
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

  public async testApiKey(provider: AIProviderType): Promise<boolean> {
    const llmProvider = createLLMProvider(provider);
    const apiKey = this.settings.ai.apiKeys[provider];
    if (!apiKey) return false;
    return llmProvider.testApiKey(apiKey);
  }

  public async suggestNoteTopics(analysisResult: AnalysisResult): Promise<void> {
    // Show suggesting state
    if (this.analysisView) {
      this.analysisView.setSuggestingTopics(true);
    }

    // Allow DOM to render before starting
    await new Promise((resolve) => setTimeout(resolve, 50));

    try {
      const useCase = new SuggestNoteTopicsUseCase(this.aiService, this.costTracker);
      const response = await useCase.execute({
        analysisResult,
        language: this.settings.ai.defaultLanguage,
        count: 4,
      });

      if (response.success && response.topics) {
        if (this.analysisView) {
          this.analysisView.showTopicSuggestions(response.topics);
        }
        new Notice(`Found ${response.topics.length} note topics`);
      } else {
        if (this.analysisView) {
          this.analysisView.showError(response.error || 'Failed to suggest topics');
        }
        new Notice(`Suggestion failed: ${response.error}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      if (this.analysisView) {
        this.analysisView.showError(errorMsg);
      }
      new Notice(`Suggestion error: ${errorMsg}`);
    }
  }

  public getCurrentSpend(): number {
    return this.costTracker.getCurrentSpend();
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    updateAIServiceSettings(this.settings.ai);
    this.costTracker.setBudgetLimit(this.settings.ai.budgetLimit);
  }
}
