import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "file-orchestrator" is now active!');

    const renameFileCommand = vscode.commands.registerCommand('file-orchestrator.renameFile', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active file to rename');
            return;
        }

        const currentFilePath = editor.document.uri.fsPath;
        const currentFileName = path.basename(currentFilePath);
        const currentFileNameWithoutExt = path.parse(currentFileName).name;
        const currentDir = path.dirname(currentFilePath);

        const config = vscode.workspace.getConfiguration('fileOrchestrator');
        const defaultExtensions = config.get<string[]>('defaultExtensions') || [];
        const customExtensionLists = config.get<{ [key: string]: string[] }>('customExtensionLists') || {};

        const extensionLists = {
            'Default': defaultExtensions,
            ...customExtensionLists
        };

        const selectedList = await vscode.window.showQuickPick(
            Object.keys(extensionLists),
            { placeHolder: 'Select extension list to apply' }
        );

        if (!selectedList) return;

        const selectedExtensions = extensionLists[selectedList];

        const newFileName = await vscode.window.showInputBox({
            prompt: 'Enter new file name',
            value: currentFileNameWithoutExt,
            validateInput: (value) => {
                return value && value !== currentFileNameWithoutExt ? null : 'Please enter a new file name';
            }
        });

        if (newFileName) {
            const filesToRename = getRelatedFiles(currentDir, currentFileNameWithoutExt, selectedExtensions);

            for (const file of filesToRename) {
                const oldPath = path.join(currentDir, file);
                const newPath = path.join(currentDir, `${newFileName}${path.extname(file)}`);
                
                try {
                    await vscode.workspace.fs.rename(vscode.Uri.file(oldPath), vscode.Uri.file(newPath));
                    vscode.window.showInformationMessage(`File renamed: ${file} -> ${path.basename(newPath)}`);
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to rename file ${file}: ${error}`);
                }
            }
        }
    });

    context.subscriptions.push(renameFileCommand);
}

function getRelatedFiles(dir: string, baseName: string, extensions: string[]): string[] {
    return fs.readdirSync(dir)
        .filter(file => {
            const { name, ext } = path.parse(file);
            return name === baseName && extensions.includes(ext);
        });
}

export function deactivate() {}