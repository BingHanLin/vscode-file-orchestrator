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

    const deleteFileCommand = vscode.commands.registerCommand('file-orchestrator.deleteFile', async () => {
        await orchestrateFiles('delete');
    });

    const moveFileCommand = vscode.commands.registerCommand('file-orchestrator.moveFile', async () => {
        await orchestrateFiles('move');
    });

    context.subscriptions.push(renameFileCommand, copyFileCommand, deleteFileCommand, moveFileCommand);
}

async function orchestrateFiles(action: 'rename' | 'copy' | 'delete' | 'move') {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage(`No active file to ${action}`);
        return;
    }

    const currentFilePath = editor.document.uri.fsPath;
    const currentFileName = path.basename(currentFilePath);
    const currentFileNameWithoutExt = path.parse(currentFileName).name;
    const currentDir = path.dirname(currentFilePath);
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);

    if (!workspaceFolder) {
        vscode.window.showErrorMessage('File is not part of a workspace');
        return;
    }

    const workspacePath = workspaceFolder.uri.fsPath;

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

    let newFileName: string | undefined;
    let targetDir: string | undefined;

    if (action === 'rename' || action === 'copy' || action === 'move') {
        const prompt = `Enter new file name ${action === 'move' ? 'for' : 'to'} ${action} ${currentFileName}`;
        newFileName = await vscode.window.showInputBox({
            prompt,
            value: currentFileNameWithoutExt,
            validateInput: (value) => {
                if (!value) return `Please enter a new file name for ${action}`;
                if (action !== 'move' && value === currentFileNameWithoutExt) {
                    return `Please enter a new file name for ${action}`;
                }
                return null;
            }
        });
        if (!newFileName) return;
    }



    if (action === 'move') {
        const relativeCurrentDir = path.relative(workspacePath, currentDir);
        targetDir = await vscode.window.showInputBox({
            prompt: 'Enter target directory (relative to workspace root)',
            value: relativeCurrentDir,
            validateInput: (value) => {
                const absolutePath = path.join(workspacePath, value);
                return fs.existsSync(absolutePath) ? null : 'Directory does not exist';
            }
        });
        if (!targetDir) return;
        targetDir = path.join(workspacePath, targetDir);
    }

    const filesToProcess = getRelatedFiles(currentDir, currentFileNameWithoutExt, selectedExtensions);

    for (const file of filesToProcess) {
        const oldPath = path.join(currentDir, file);
        let newPath: string | undefined;

        if (newFileName) {
            newPath = path.join(action === 'move' ? targetDir! : currentDir, `${newFileName}${path.extname(file)}`);
        }

        try {
            switch (action) {
                case 'rename':
                    await vscode.workspace.fs.rename(vscode.Uri.file(oldPath), vscode.Uri.file(newPath!));
                    break;
                case 'copy':
                    await vscode.workspace.fs.copy(vscode.Uri.file(oldPath), vscode.Uri.file(newPath!), { overwrite: false });
                    break;
                case 'delete':
                    await vscode.workspace.fs.delete(vscode.Uri.file(oldPath));
                    break;
                case 'move':
                    await vscode.workspace.fs.rename(vscode.Uri.file(oldPath), vscode.Uri.file(newPath!));
                    break;
            }
            const actionPastTense = action === 'copy' ? 'copied' : `${action}d`;
            vscode.window.showInformationMessage(`File ${actionPastTense}: ${file}${newPath ? ` -> ${path.relative(workspacePath, newPath)}` : ''}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to ${action} file ${file}: ${error}`);
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