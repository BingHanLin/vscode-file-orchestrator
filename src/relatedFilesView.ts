import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class RelatedFilesProvider implements vscode.TreeDataProvider<RelatedFileItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<RelatedFileItem | undefined | void> = new vscode.EventEmitter<RelatedFileItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<RelatedFileItem | undefined | void> = this._onDidChangeTreeData.event;

    constructor() {
        vscode.window.onDidChangeActiveTextEditor(() => this.refresh());
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('fileOrchestrator.activeExtensionGroup') ||
                e.affectsConfiguration('fileOrchestrator.customExtensionGroups') ||
                e.affectsConfiguration('fileOrchestrator.searchScope')) {
                this.refresh();
            }
        });
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: RelatedFileItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: RelatedFileItem): Promise<RelatedFileItem[]> {
        if (element) {
            return Promise.resolve([]);
        }
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return Promise.resolve([]);
        }
        const currentFilePath = editor.document.uri.fsPath;
        const currentDir = path.dirname(currentFilePath);
        const baseName = path.parse(path.basename(currentFilePath)).name;
        const config = vscode.workspace.getConfiguration('fileOrchestrator');
        const defaultExtensions = config.get<string[]>('defaultExtensions') || [];
        const customExtensionGroups = config.get<{ [key: string]: string[] }>('customExtensionGroups') || {};
        const activeGroup = config.get<string>('activeExtensionGroup') || 'default';
        const searchScope = config.get<string>('searchScope', 'workspace');

        let extensions: string[];
        if (activeGroup === 'default') {
            extensions = defaultExtensions;
        } else if (customExtensionGroups[activeGroup]) {
            extensions = customExtensionGroups[activeGroup];
        } else {
            extensions = defaultExtensions;
        }

        const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
        if (!workspaceFolder) {
            return Promise.resolve([]);
        }
        const workspacePath = workspaceFolder.uri.fsPath;

        try {
            // For same directory, use sync method for better performance in sidebar
            if (searchScope === 'sameDirectory') {
                const files = fs.readdirSync(currentDir).filter(file => {
                    const { name, ext } = path.parse(file);
                    return name === baseName && extensions.includes(ext);
                });
                return files.map(file => {
                    const filePath = path.join(currentDir, file);
                    return new RelatedFileItem(file, filePath, currentDir, workspacePath);
                });
            }

            // For workspace/custom paths, use async search
            const relatedFileUris = await this.searchRelatedFiles(baseName, extensions, currentDir, workspacePath);
            return relatedFileUris.map(fileUri => {
                const fileName = path.basename(fileUri.fsPath);
                return new RelatedFileItem(fileName, fileUri.fsPath, currentDir, workspacePath);
            });
        } catch (error) {
            console.error('Error getting related files:', error);
            return Promise.resolve([]);
        }
    }

    /**
     * Search for related files using the advanced search function
     */
    private async searchRelatedFiles(
        baseName: string,
        extensions: string[],
        currentDir: string,
        workspacePath: string
    ): Promise<vscode.Uri[]> {
        const config = vscode.workspace.getConfiguration('fileOrchestrator');
        const searchScope = config.get<string>('searchScope', 'workspace');
        const excludePatterns = config.get<string[]>('searchExclude', []);
        const customSearchPaths = config.get<string[]>('customSearchPaths', []);

        const patterns = extensions.map(ext => `**/${baseName}${ext}`);
        const includePattern = patterns.length === 1 ? patterns[0] : `{${patterns.join(',')}}`;
        const excludePattern = excludePatterns.length > 0 ? `{${excludePatterns.join(',')}}` : undefined;

        if (searchScope === 'customPaths' && customSearchPaths.length > 0) {
            const customPatterns = customSearchPaths.flatMap(customPath =>
                extensions.map(ext => `${customPath}/${baseName}${ext}`)
            );
            const customIncludePattern = customPatterns.length === 1 ? customPatterns[0] : `{${customPatterns.join(',')}}`;
            return await vscode.workspace.findFiles(customIncludePattern, excludePattern);
        } else {
            return await vscode.workspace.findFiles(includePattern, excludePattern);
        }
    }
}

export class RelatedFileItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly filePath: string,
        private readonly currentDir?: string,
        private readonly workspacePath?: string
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);

        // Show directory path for cross-directory files
        if (currentDir && workspacePath && path.dirname(filePath) !== currentDir) {
            const relativePath = path.relative(workspacePath, filePath);
            const relativeDir = path.dirname(relativePath);
            this.description = `$(folder) ${relativeDir}`;
            this.tooltip = `${filePath}\n(in ${relativeDir})`;
        } else {
            this.tooltip = filePath;
        }

        this.resourceUri = vscode.Uri.file(filePath);
        this.command = {
            command: 'vscode.open',
            title: 'Open File',
            arguments: [this.resourceUri]
        };
        this.iconPath = vscode.ThemeIcon.File;
    }
}
