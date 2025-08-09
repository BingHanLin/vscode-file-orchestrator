import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class RelatedFilesProvider implements vscode.TreeDataProvider<RelatedFileItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<RelatedFileItem | undefined | void> = new vscode.EventEmitter<RelatedFileItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<RelatedFileItem | undefined | void> = this._onDidChangeTreeData.event;

    constructor() {
        vscode.window.onDidChangeActiveTextEditor(() => this.refresh());
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('fileOrchestrator.activeExtensionGroup') || e.affectsConfiguration('fileOrchestrator.customExtensionGroups')) {
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

    getChildren(element?: RelatedFileItem): Thenable<RelatedFileItem[]> {
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
        let extensions: string[];
        if (activeGroup === 'default') {
            extensions = defaultExtensions;
        } else if (customExtensionGroups[activeGroup]) {
            extensions = customExtensionGroups[activeGroup];
        } else {
            extensions = defaultExtensions;
        }
        let files: string[] = [];
        try {
            files = fs.readdirSync(currentDir).filter(file => {
                const { name, ext } = path.parse(file);
                return name === baseName && extensions.includes(ext);
            });
        } catch {
            // ignore
        }
        return Promise.resolve(files.map(file => {
            const filePath = path.join(currentDir, file);
            return new RelatedFileItem(file, filePath);
        }));
    }
}

export class RelatedFileItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly filePath: string
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.tooltip = filePath;
        this.resourceUri = vscode.Uri.file(filePath);
        this.command = {
            command: 'vscode.open',
            title: 'Open File',
            arguments: [this.resourceUri]
        };
        this.iconPath = vscode.ThemeIcon.File;
    }
}
