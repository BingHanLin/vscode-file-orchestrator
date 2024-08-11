import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "file-orchestrator" is now active!');

    const renameFileCommand = vscode.commands.registerCommand('file-orchestrator.renameFile', async () => {
        await orchestrateFiles('rename');
    });

    const copyFileCommand = vscode.commands.registerCommand('file-orchestrator.copyFile', async () => {
        await orchestrateFiles('copy');
    });

    context.subscriptions.push(renameFileCommand, copyFileCommand);
}

async function orchestrateFiles(action: 'rename' | 'copy') {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage(`No active file to ${action}`);
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

    const quickPickItems = Object.entries(extensionLists).map(([name, extensions]) => ({
        label: name,
        description: extensions.join(', ')
    }));

    const selectedItem = await vscode.window.showQuickPick(
        quickPickItems,
        { 
            placeHolder: 'Select extension list to apply',
            matchOnDescription: true
        }
    );

    if (!selectedItem) return;

    const selectedExtensions = extensionLists[selectedItem.label];

    const newFileName = await vscode.window.showInputBox({
        prompt: `Enter new file name for ${action}`,
        value: currentFileNameWithoutExt,
        validateInput: (value) => {
            return value && value !== currentFileNameWithoutExt ? null : `Please enter a new file name for ${action}`;
        }
    });

    if (newFileName) {
        const filesToProcess = getRelatedFiles(currentDir, currentFileNameWithoutExt, selectedExtensions);

        for (const file of filesToProcess) {
            const oldPath = path.join(currentDir, file);
            const newPath = path.join(currentDir, `${newFileName}${path.extname(file)}`);
            
            try {
                if (action === 'rename') {
                    await vscode.workspace.fs.rename(vscode.Uri.file(oldPath), vscode.Uri.file(newPath));
                } else {
                    await vscode.workspace.fs.copy(vscode.Uri.file(oldPath), vscode.Uri.file(newPath), { overwrite: false });
                }
                vscode.window.showInformationMessage(`File ${action}d: ${file} -> ${path.basename(newPath)}`);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to ${action} file ${file}: ${error}`);
            }
        }
    }
}

function getRelatedFiles(dir: string, baseName: string, extensions: string[]): string[] {
    return fs.readdirSync(dir)
        .filter(file => {
            const { name, ext } = path.parse(file);
            return name === baseName && extensions.includes(ext);
        });
}

export function deactivate() {}