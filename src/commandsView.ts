import * as vscode from 'vscode';

export class CommandsProvider implements vscode.TreeDataProvider<CommandItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<CommandItem | undefined | void> = new vscode.EventEmitter<CommandItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<CommandItem | undefined | void> = this._onDidChangeTreeData.event;

    private commands: { command: string; title: string }[] = [
        { command: 'file-orchestrator.renameFile', title: 'Rename File' },
        { command: 'file-orchestrator.copyFile', title: 'Copy File' },
        { command: 'file-orchestrator.deleteFile', title: 'Delete File' },
        { command: 'file-orchestrator.moveFile', title: 'Move File' },
        { command: 'file-orchestrator.createFile', title: 'Create File' },
        { command: 'file-orchestrator.jumpToRelatedFile', title: 'Jump To Related File' },
        { command: 'file-orchestrator.bulkReplace', title: 'String Replace In Related Files' },
        { command: 'file-orchestrator.openAllRelatedFiles', title: 'Open All Related Files' },
        { command: 'file-orchestrator.setActiveExtensionGroup', title: 'Set Active Extension Group' }
    ];

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: CommandItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: CommandItem): Thenable<CommandItem[]> {
        if (element) {
            return Promise.resolve([]);
        }
        return Promise.resolve(this.commands.map(cmd => new CommandItem(cmd.title, cmd.command)));
    }
}

export class CommandItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly commandId: string
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.command = {
            command: commandId,
            title: label
        };
        this.iconPath = new vscode.ThemeIcon('play');
    }
}
