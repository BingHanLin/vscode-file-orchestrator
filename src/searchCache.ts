import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Cache entry for storing search results
 */
interface CacheEntry {
    files: vscode.Uri[];
    timestamp: number;
}

/**
 * Manages caching of file search results for improved performance.
 * Automatically invalidates cache when files are created, deleted, or renamed.
 */
export class SearchCacheManager {
    private cache: Map<string, CacheEntry>;
    private fileWatcher: vscode.FileSystemWatcher | undefined;
    private cacheTimeout: number = 30000; // 30 seconds
    private isEnabled: boolean = true;

    constructor() {
        this.cache = new Map();
        this.setupFileWatcher();
        this.loadConfiguration();
    }

    /**
     * Load configuration settings
     */
    private loadConfiguration() {
        const config = vscode.workspace.getConfiguration('fileOrchestrator');
        this.isEnabled = config.get<boolean>('enableCache', true);
    }

    /**
     * Setup file system watcher to invalidate cache on file changes
     */
    private setupFileWatcher() {
        // Watch all files in the workspace
        this.fileWatcher = vscode.workspace.createFileSystemWatcher('**/*');

        // Invalidate cache on file creation, deletion, or rename (change event)
        this.fileWatcher.onDidCreate(() => this.clearAll());
        this.fileWatcher.onDidDelete(() => this.clearAll());
        this.fileWatcher.onDidChange(() => this.clearAll());
    }

    /**
     * Generate a cache key from search parameters
     */
    private getCacheKey(baseName: string, extensions: string[], searchScope: string): string {
        return `${baseName}|${extensions.join(',')}|${searchScope}`;
    }

    /**
     * Get cached search results if available and not expired
     */
    get(baseName: string, extensions: string[], searchScope: string): vscode.Uri[] | undefined {
        if (!this.isEnabled) {
            return undefined;
        }

        const key = this.getCacheKey(baseName, extensions, searchScope);
        const entry = this.cache.get(key);

        if (!entry) {
            return undefined;
        }

        // Check if cache has expired
        if (Date.now() - entry.timestamp > this.cacheTimeout) {
            this.cache.delete(key);
            return undefined;
        }

        return entry.files;
    }

    /**
     * Store search results in cache
     */
    set(baseName: string, extensions: string[], searchScope: string, files: vscode.Uri[]): void {
        if (!this.isEnabled) {
            return;
        }

        const key = this.getCacheKey(baseName, extensions, searchScope);
        this.cache.set(key, {
            files,
            timestamp: Date.now()
        });
    }

    /**
     * Invalidate cache entries for a specific base name
     */
    invalidate(baseName: string): void {
        const keysToDelete: string[] = [];

        for (const key of this.cache.keys()) {
            if (key.startsWith(baseName + '|')) {
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach(key => this.cache.delete(key));
    }

    /**
     * Clear all cache entries
     */
    clearAll(): void {
        this.cache.clear();
    }

    /**
     * Get cache statistics
     */
    getStats(): { size: number; enabled: boolean } {
        return {
            size: this.cache.size,
            enabled: this.isEnabled
        };
    }

    /**
     * Dispose of resources
     */
    dispose(): void {
        this.fileWatcher?.dispose();
        this.cache.clear();
    }

    /**
     * Update configuration (called when settings change)
     */
    updateConfiguration(): void {
        this.loadConfiguration();
        if (!this.isEnabled) {
            this.clearAll();
        }
    }
}
