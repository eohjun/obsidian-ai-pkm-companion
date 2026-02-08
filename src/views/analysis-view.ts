/**
 * Analysis View
 * Sidebar view for displaying analysis results
 */

import { ItemView, WorkspaceLeaf, setIcon, Notice, normalizePath, TFolder } from 'obsidian';
import type { AnalysisResult } from '../core/domain/entities/analysis-result';
import type { Job } from '../core/domain/entities/job';
import type { NoteTopic } from '../core/application';
import type NoteTopicFinderPlugin from '../main';

export const ANALYSIS_VIEW_TYPE = 'note-topic-finder-view';

export class AnalysisView extends ItemView {
  private plugin: NoteTopicFinderPlugin;
  private currentResult: AnalysisResult | null = null;
  private currentJob: Job | null = null;
  private suggestedTopics: NoteTopic[] | null = null;
  private isSuggestingTopics: boolean = false;
  private viewingTopics: boolean = false;  // Track which view to show

  // Loading overlay elements (direct DOM references)
  private loadingOverlayEl: HTMLElement | null = null;
  private loadingTextEl: HTMLElement | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: NoteTopicFinderPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return ANALYSIS_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'AI Analysis';
  }

  getIcon(): string {
    return 'sparkles';
  }

  async onOpen(): Promise<void> {
    this.render();
  }

  async onClose(): Promise<void> {
    this.hideLoadingOverlay();
    this.currentResult = null;
    this.currentJob = null;
    this.suggestedTopics = null;
    this.loadingOverlayEl = null;
    this.loadingTextEl = null;
  }

  public showResult(result: AnalysisResult): void {
    this.hideLoadingOverlay();
    this.currentResult = result;
    this.currentJob = null;
    this.suggestedTopics = null;
    this.isSuggestingTopics = false;
    this.viewingTopics = false;  // Reset to analysis view for new result
    this.render();
  }

  public showTopicSuggestions(topics: NoteTopic[]): void {
    this.hideLoadingOverlay();
    this.suggestedTopics = topics;
    this.isSuggestingTopics = false;
    this.viewingTopics = true;  // Show topics view
    this.render();
  }

  public setSuggestingTopics(suggesting: boolean): void {
    this.isSuggestingTopics = suggesting;
    if (suggesting) {
      this.showLoadingOverlay('Finding note topics...');
    } else {
      this.hideLoadingOverlay();
    }
  }

  public showProgress(job: Job): void {
    this.currentJob = job;
    // Determine message based on source type
    const data = job.data as { sourceType?: string; sourceUrl?: string; sourcePath?: string };
    let message = 'Analyzing content...';
    if (data.sourceType === 'url') {
      message = 'Analyzing URL...';
    } else if (data.sourceType === 'note') {
      message = 'Analyzing note...';
    } else if (data.sourceType === 'text') {
      message = 'Analyzing text...';
    }
    this.showLoadingOverlay(message);
  }

  public updateProgress(progress: number, message?: string): void {
    if (this.loadingTextEl && message) {
      this.loadingTextEl.textContent = message;
    }
  }

  public showError(error: string): void {
    this.hideLoadingOverlay();
    this.currentJob = null;
    this.currentResult = null;

    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass('note-topic-finder-view');

    // Header
    const header = container.createDiv({ cls: 'view-header' });
    header.createEl('h4', { text: 'AI Analysis' });
    const actions = header.createDiv({ cls: 'view-actions' });
    const newAnalysisBtn = actions.createEl('button', { cls: 'clickable-icon' });
    setIcon(newAnalysisBtn, 'plus');
    newAnalysisBtn.title = 'New Analysis';
    newAnalysisBtn.onclick = () => this.plugin.openAnalyzeModal();

    container.createEl('p', { text: error, cls: 'error-message' });
  }

  /**
   * Show loading overlay with spinner and text message
   */
  private showLoadingOverlay(message: string): void {
    const container = this.containerEl.children[1] as HTMLElement;

    // Remove existing overlay if any
    this.hideLoadingOverlay();

    // Hide all existing content except header
    Array.from(container.children).forEach(child => {
      if (child instanceof HTMLElement && !child.hasClass('view-header')) {
        child.style.display = 'none';
      }
    });

    // Create loading element (not overlay, just regular content)
    this.loadingOverlayEl = container.createDiv({ cls: 'loading-container' });
    this.loadingOverlayEl.createDiv({ cls: 'loading-spinner' });
    this.loadingTextEl = this.loadingOverlayEl.createEl('p', { cls: 'loading-text', text: message });
  }

  /**
   * Hide loading overlay
   */
  private hideLoadingOverlay(): void {
    if (this.loadingOverlayEl) {
      this.loadingOverlayEl.remove();
      this.loadingOverlayEl = null;
      this.loadingTextEl = null;
    }
  }

  private render(): void {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass('note-topic-finder-view');

    // Header
    const header = container.createDiv({ cls: 'view-header' });
    header.createEl('h4', { text: 'AI Analysis' });

    // Action buttons
    const actions = header.createDiv({ cls: 'view-actions' });
    const newAnalysisBtn = actions.createEl('button', { cls: 'clickable-icon' });
    setIcon(newAnalysisBtn, 'plus');
    newAnalysisBtn.title = 'New Analysis';
    newAnalysisBtn.onclick = () => this.plugin.openAnalyzeModal();

    // Content - no longer handle progress here
    if (this.viewingTopics && this.suggestedTopics && this.suggestedTopics.length > 0) {
      this.renderTopicSuggestions(container);
    } else if (this.currentResult) {
      this.renderResult(container);
    } else {
      this.renderEmpty(container);
    }
  }

  private renderEmpty(container: HTMLElement): void {
    const emptyState = container.createDiv({ cls: 'empty-state' });
    emptyState.createEl('p', { text: 'No analysis results yet.' });
    emptyState.createEl('p', { text: 'Click the + button or use the command palette to start analyzing content.' });
  }

  private renderResult(container: HTMLElement): void {
    if (!this.currentResult) return;

    const result = this.currentResult;
    const resultContainer = container.createDiv({ cls: 'result-container' });

    // Source info
    if (result.sourceUrl) {
      const sourceEl = resultContainer.createEl('p', { cls: 'source-info' });
      sourceEl.createEl('strong', { text: 'Source: ' });
      const link = sourceEl.createEl('a', { text: result.sourceUrl, href: result.sourceUrl });
      link.setAttr('target', '_blank');
    } else if (result.sourcePath) {
      const sourceEl = resultContainer.createEl('p', { cls: 'source-info' });
      sourceEl.createEl('strong', { text: 'Source Note: ' });
      sourceEl.createSpan({ text: result.sourcePath });
    }

    // Summary
    resultContainer.createEl('h5', { text: 'Summary' });
    resultContainer.createEl('p', { text: result.summary, cls: 'summary-text' });

    // Key Insights
    if (result.keyInsights.length > 0) {
      resultContainer.createEl('h5', { text: 'Key Insights' });
      const insightsList = resultContainer.createEl('ul', { cls: 'insights-list' });
      for (const insight of result.keyInsights) {
        insightsList.createEl('li', { text: insight });
      }
    }

    // Suggested Tags
    if (result.suggestedTags.length > 0) {
      resultContainer.createEl('h5', { text: 'Suggested Tags' });
      const tagsContainer = resultContainer.createDiv({ cls: 'tags-container' });
      for (const tag of result.suggestedTags) {
        const tagEl = tagsContainer.createEl('span', { text: `#${tag}`, cls: 'tag' });
        tagEl.onclick = () => {
          navigator.clipboard.writeText(`#${tag}`);
          new Notice('Tag copied to clipboard');
        };
      }
    }

    // Related Topics
    if (result.relatedTopics.length > 0) {
      resultContainer.createEl('h5', { text: 'Related Topics' });
      const topicsContainer = resultContainer.createDiv({ cls: 'topics-container' });
      for (const topic of result.relatedTopics) {
        topicsContainer.createEl('span', { text: topic, cls: 'topic' });
      }
    }

    // Action Buttons
    const actionButtons = resultContainer.createDiv({ cls: 'action-buttons' });

    const copyBtn = actionButtons.createEl('button', { text: 'Copy as Markdown' });
    copyBtn.onclick = () => {
      const markdown = result.toMarkdown();
      navigator.clipboard.writeText(markdown);
      new Notice('Copied to clipboard');
    };

    const saveBtn = actionButtons.createEl('button', { text: 'Save as Note' });
    saveBtn.onclick = () => this.saveAsNote(result);

    // Show "View Suggested Topics" button if topics already exist
    if (this.suggestedTopics && this.suggestedTopics.length > 0) {
      const viewTopicsBtn = actionButtons.createEl('button', { text: 'View Suggested Topics', cls: 'mod-cta' });
      viewTopicsBtn.onclick = () => {
        this.viewingTopics = true;
        this.render();
      };
    } else {
      const suggestBtn = actionButtons.createEl('button', { text: 'Suggest Note Topics', cls: 'mod-cta' });
      suggestBtn.onclick = () => this.plugin.suggestNoteTopics(result);
    }
  }

  private renderTopicSuggestions(container: HTMLElement): void {
    if (!this.suggestedTopics) return;

    const resultContainer = container.createDiv({ cls: 'result-container' });

    // Header
    resultContainer.createEl('h5', { text: '📚 Permanent Note Topics' });
    resultContainer.createEl('p', {
      text: 'Use /permanent-note-author skill to write these notes with high quality.',
      cls: 'setting-item-description'
    });

    // Topics list
    for (const topic of this.suggestedTopics) {
      const topicCard = resultContainer.createDiv({ cls: 'topic-card' });

      // Title (copyable)
      const titleEl = topicCard.createEl('h6', { text: `💡 ${topic.title}` });
      titleEl.style.cursor = 'pointer';
      titleEl.onclick = () => {
        navigator.clipboard.writeText(topic.title);
        new Notice(`Copied: ${topic.title}`);
      };
      titleEl.title = 'Click to copy title';

      // Rationale
      topicCard.createEl('p', { text: topic.rationale, cls: 'topic-rationale' });

      // Key Points
      if (topic.keyPoints.length > 0) {
        const pointsContainer = topicCard.createDiv({ cls: 'key-points' });
        pointsContainer.createEl('strong', { text: 'Key Points:' });
        const pointsList = pointsContainer.createEl('ul');
        for (const point of topic.keyPoints) {
          pointsList.createEl('li', { text: point });
        }
      }

      // Tags
      if (topic.suggestedTags.length > 0) {
        const tagsContainer = topicCard.createDiv({ cls: 'tags-container' });
        for (const tag of topic.suggestedTags) {
          const tagEl = tagsContainer.createEl('span', { text: `#${tag}`, cls: 'tag' });
          tagEl.onclick = () => {
            navigator.clipboard.writeText(`#${tag}`);
            new Notice('Tag copied');
          };
        }
      }
    }

    // Action Buttons
    const actionButtons = resultContainer.createDiv({ cls: 'action-buttons' });

    const copyAllBtn = actionButtons.createEl('button', { text: 'Copy All Topics' });
    copyAllBtn.onclick = () => {
      const text = this.suggestedTopics!.map((t, i) =>
        `${i + 1}. ${t.title}\n   - ${t.rationale}\n   - Key: ${t.keyPoints.join(', ')}\n   - Tags: ${t.suggestedTags.join(', ')}`
      ).join('\n\n');
      navigator.clipboard.writeText(text);
      new Notice('All topics copied to clipboard');
    };

    // Save as Note button - saves analysis + suggested topics together
    const saveBtn = actionButtons.createEl('button', { text: 'Save as Note', cls: 'mod-cta' });
    saveBtn.onclick = () => this.saveAsNoteWithTopics();

    const backBtn = actionButtons.createEl('button', { text: 'Back to Analysis' });
    backBtn.onclick = () => {
      // Keep suggestedTopics in memory so user can return
      this.viewingTopics = false;
      this.render();
    };
  }

  /**
   * Generate markdown with both analysis result and suggested topics
   */
  private generateFullMarkdown(): string {
    if (!this.currentResult) return '';

    const result = this.currentResult;
    const lines: string[] = [];

    // Frontmatter
    lines.push('---');
    lines.push(`created: ${result.createdAt.toISOString().split('T')[0]}`);
    if (result.sourceUrl) {
      lines.push(`source: "${result.sourceUrl}"`);
    }
    if (result.sourcePath) {
      lines.push(`source_note: "[[${result.sourcePath.replace(/\.md$/, '')}]]"`);
    }
    if (result.suggestedTags.length > 0) {
      lines.push(`tags:`);
      result.suggestedTags.forEach((tag) => {
        const formattedTag = tag.replace(/\s+/g, '_');
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
    lines.push('---');
    lines.push('');

    // Analysis Summary
    lines.push(`## Summary`);
    lines.push(result.summary);
    lines.push('');

    // Key Insights
    if (result.keyInsights.length > 0) {
      lines.push(`## Key Insights`);
      result.keyInsights.forEach((insight) => {
        lines.push(`- ${insight}`);
      });
      lines.push('');
    }

    // Suggested Topics (if available)
    if (this.suggestedTopics && this.suggestedTopics.length > 0) {
      lines.push('## Permanent Note Topics');
      lines.push('');
      lines.push('> Use /permanent-note-author skill to write these notes with high quality.');
      lines.push('');

      this.suggestedTopics.forEach((topic, i) => {
        lines.push(`### ${i + 1}. ${topic.title}`);
        lines.push('');
        lines.push(`**Rationale:** ${topic.rationale}`);
        lines.push('');
        if (topic.keyPoints.length > 0) {
          lines.push('**Key Points:**');
          topic.keyPoints.forEach((point) => {
            lines.push(`- ${point}`);
          });
          lines.push('');
        }
        if (topic.suggestedTags.length > 0) {
          lines.push(`**Tags:** ${topic.suggestedTags.map(t => `#${t}`).join(' ')}`);
          lines.push('');
        }
      });
    }

    return lines.join('\n');
  }

  /**
   * Save note with both analysis result and suggested topics
   */
  private async saveAsNoteWithTopics(): Promise<void> {
    if (!this.currentResult) {
      new Notice('No analysis result to save');
      return;
    }

    const markdown = this.generateFullMarkdown();
    const result = this.currentResult;

    // Sanitize title for file name
    const sanitizedTitle = result.suggestedTitle
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100);
    const fileName = `${sanitizedTitle}.md`;

    // Determine output folder with path normalization
    const outputFolder = this.plugin.settings.outputFolder?.trim();
    const filePath = normalizePath(outputFolder ? `${outputFolder}/${fileName}` : fileName);

    try {
      // Ensure output folder exists (cross-platform safe)
      if (outputFolder) {
        await this.ensureFolder(normalizePath(outputFolder));
      }

      // Create file (with adapter fallback for sync scenarios)
      await this.createFile(filePath, markdown);
      new Notice(`Note created with topics: ${filePath}`);
      await this.app.workspace.openLinkText(filePath, '');
    } catch (error) {
      new Notice(`Error creating note: ${error}`);
    }
  }

  private async saveAsNote(result: AnalysisResult): Promise<void> {
    const markdown = result.toMarkdown();

    // Sanitize title for file name
    const sanitizedTitle = result.suggestedTitle
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100);
    const fileName = `${sanitizedTitle}.md`;

    // Determine output folder with path normalization
    const outputFolder = this.plugin.settings.outputFolder?.trim();
    const filePath = normalizePath(outputFolder ? `${outputFolder}/${fileName}` : fileName);

    try {
      // Ensure output folder exists (cross-platform safe)
      if (outputFolder) {
        await this.ensureFolder(normalizePath(outputFolder));
      }

      // Create file (with adapter fallback for sync scenarios)
      await this.createFile(filePath, markdown);
      new Notice(`Note created: ${filePath}`);
      await this.app.workspace.openLinkText(filePath, '');
    } catch (error) {
      new Notice(`Error creating note: ${error}`);
    }
  }

  /**
   * Ensure folder exists with cross-platform compatibility
   * Handles "already exists" errors from Git sync scenarios
   */
  private async ensureFolder(path: string): Promise<void> {
    const normalizedPath = normalizePath(path);
    const existing = this.app.vault.getAbstractFileByPath(normalizedPath);

    if (existing instanceof TFolder) {
      return; // Already exists as folder
    }

    try {
      await this.app.vault.createFolder(normalizedPath);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      // "Folder already exists" from sync - treat as success
      if (msg.toLowerCase().includes('already exists')) {
        return;
      }
      throw error;
    }
  }

  /**
   * Create file with cross-platform compatibility
   * Uses adapter fallback when Obsidian index isn't synced
   */
  private async createFile(path: string, content: string): Promise<void> {
    const normalizedPath = normalizePath(path);

    try {
      await this.app.vault.create(normalizedPath, content);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      // File exists from sync - use adapter.write
      if (msg.toLowerCase().includes('already exists')) {
        await this.app.vault.adapter.write(normalizedPath, content);
        return;
      }
      throw error;
    }
  }
}
