import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

export function activate(context: vscode.ExtensionContext) {
    console.log(
        'Congratulations, your extension "file-orchestrator" is now active!'
    );

    const commands = [
        { name: "renameFile", action: renameFiles },
        { name: "copyFile", action: copyFiles },
        { name: "deleteFile", action: deleteFiles },
        { name: "moveFile", action: moveFiles },
        { name: "createFile", action: createFiles },
        { name: "jumpToRelatedFile", action: jumpToRelatedFile },
        { name: "bulkReplace", action: bulkReplace },
    ];

    commands.forEach(({ name, action }) => {
        const command = vscode.commands.registerCommand(
            `file-orchestrator.${name}`,
            action
        );
        context.subscriptions.push(command);
    });

    // Register the configurable keybinding
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "file-orchestrator.updateJumpToRelatedFileShortcut",
            updateJumpToRelatedFileShortcut
        )
    );

    // Initial setup of the keybinding
    updateJumpToRelatedFileShortcut();
}

async function updateJumpToRelatedFileShortcut() {
    const config = vscode.workspace.getConfiguration("fileOrchestrator");
    const shortcut = config.get<string>("jumpToRelatedFileShortcut") || "alt+p";

    await vscode.commands.executeCommand(
        "setContext",
        "fileOrchestrator.jumpToRelatedFileShortcut",
        shortcut
    );

    // Update keybindings.json
    const keybindings = (await vscode.commands.executeCommand(
        "getConfiguration",
        "keybindings"
    )) as any[];
    const existingBinding = keybindings.find(
        (kb: any) => kb.command === "file-orchestrator.jumpToRelatedFile"
    );

    if (existingBinding) {
        existingBinding.key = shortcut;
    } else {
        keybindings.push({
            key: shortcut,
            command: "file-orchestrator.jumpToRelatedFile",
            when: "editorTextFocus",
        });
    }

    await vscode.commands.executeCommand(
        "updateConfiguration",
        "keybindings",
        keybindings
    );
}

async function renameFiles() {
    const commonInfo = await getCommonInfo("rename");
    if (!commonInfo) return;

    const {
        currentDir,
        currentFileNameWithoutExt,
        selectedExtensions,
        workspacePath,
    } = commonInfo;

    const newFileName = await promptForNewFileName(
        "rename",
        currentFileNameWithoutExt
    );
    if (!newFileName) return;
    const filesToProcess = getRelatedFiles(
        currentDir!,
        currentFileNameWithoutExt!,
        selectedExtensions!
    );

    for (const file of filesToProcess) {
        const oldPath = path.join(currentDir!, file);
        const newPath = path.join(
            currentDir!,
            `${newFileName}${path.extname(file)}`
        );
        await processFile("rename", oldPath, newPath, workspacePath!);
    }
}

async function copyFiles() {
    const {
        currentDir,
        currentFileNameWithoutExt,
        selectedExtensions,
        workspacePath,
    } = await getCommonInfo("copy");
    if (!currentDir) return;

    const newFileName = await promptForNewFileName(
        "copy",
        currentFileNameWithoutExt
    );
    if (!newFileName) return;

    const filesToProcess = getRelatedFiles(
        currentDir,
        currentFileNameWithoutExt!,
        selectedExtensions
    );

    for (const file of filesToProcess) {
        const oldPath = path.join(currentDir, file);
        const newPath = path.join(
            currentDir,
            `${newFileName}${path.extname(file)}`
        );
        await processFile("copy", oldPath, newPath, workspacePath);
    }
}

async function deleteFiles() {
    const {
        currentDir,
        currentFileNameWithoutExt,
        selectedExtensions,
        workspacePath,
    } = await getCommonInfo("delete");
    if (!currentDir) return;

    const filesToProcess = getRelatedFiles(
        currentDir,
        currentFileNameWithoutExt!,
        selectedExtensions
    );

    for (const file of filesToProcess) {
        const oldPath = path.join(currentDir, file);
        await processFile("delete", oldPath, undefined, workspacePath);
    }
}

async function moveFiles() {
    const {
        currentDir,
        currentFileNameWithoutExt,
        selectedExtensions,
        workspacePath,
    } = await getCommonInfo("move");
    if (!currentDir) return;

    const newFileName = await promptForNewFileName(
        "move",
        currentFileNameWithoutExt
    );
    if (!newFileName) return;

    const targetDir = await promptForTargetDirectory(currentDir);

    if (!targetDir) return;

    // Check if targetDir exists, if not, create it
    if (!fs.existsSync(targetDir)) {
        await fs.promises.mkdir(targetDir, { recursive: true });
    }

    const filesToProcess = getRelatedFiles(
        currentDir,
        currentFileNameWithoutExt!,
        selectedExtensions
    );

    for (const file of filesToProcess) {
        const oldPath = path.join(currentDir, file);
        const newPath = path.join(
            targetDir,
            `${newFileName}${path.extname(file)}`
        );
        await processFile("move", oldPath, newPath, workspacePath);
    }
}

async function createFiles() {
    const {
        currentDir,
        currentFileNameWithoutExt,
        selectedExtensions,
        workspacePath,
    } = await getCommonInfo("create");
    if (!workspacePath) return;

    const newFileName = await promptForNewFileName("create", "NewFile");
    if (!newFileName) return;

    const targetDir = await promptForTargetDirectory(workspacePath);
    if (!targetDir) return;

    // Check if targetDir exists, if not, create it
    if (!fs.existsSync(targetDir)) {
        await fs.promises.mkdir(targetDir, { recursive: true });
    }

    for (const ext of selectedExtensions!) {
        const newPath = path.join(targetDir, `${newFileName}${ext}`);
        await processFile("create", undefined, newPath, workspacePath!);
    }
}

async function jumpToRelatedFile() {
    const {
        currentDir,
        currentFileNameWithoutExt,
        selectedExtensions,
        workspacePath,
    } = await getCommonInfo("jump to");
    if (!currentDir) return;

    const relatedFiles = getRelatedFiles(
        currentDir,
        currentFileNameWithoutExt!,
        selectedExtensions
    );

    if (relatedFiles.length === 0) {
        vscode.window.showInformationMessage("No related files found.");
        return;
    }

    // Get the current file's relative path
    const currentFile = vscode.window.activeTextEditor?.document.uri.fsPath;
    const currentRelativePath = currentFile
        ? path.relative(workspacePath, currentFile)
        : "Unknown";

    const items = relatedFiles.map((file) => {
        const fullPath = path.join(currentDir, file);
        const relativePath = path.relative(workspacePath, fullPath);
        return {
            label: file,
            description: path.extname(file),
            detail: relativePath, // This will show the full path relative to the workspace root
        };
    });

    const selectedFile = await vscode.window.showQuickPick(items, {
        placeHolder: `Select a file to jump to (from ${currentRelativePath})`,
        matchOnDescription: true,
        matchOnDetail: true,
    });

    if (selectedFile) {
        const filePath = path.join(currentDir, selectedFile.label);
        const document = await vscode.workspace.openTextDocument(filePath);
        await vscode.window.showTextDocument(document);
    }
}

async function getCommonInfo(action: string) {
    let currentDir: string | undefined;
    let currentFileNameWithoutExt: string | undefined;
    let workspaceFolder: vscode.WorkspaceFolder | undefined;

    if (action !== "create") {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage(`No active file to ${action}`);
            return {};
        }

        const currentFilePath = editor.document.uri.fsPath;
        currentDir = path.dirname(currentFilePath);
        currentFileNameWithoutExt = path.parse(
            path.basename(currentFilePath)
        ).name;
        workspaceFolder = vscode.workspace.getWorkspaceFolder(
            editor.document.uri
        );
    } else {
        workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    }

    if (!workspaceFolder) {
        vscode.window.showErrorMessage("No workspace folder found");
        return {};
    }

    const workspacePath = workspaceFolder.uri.fsPath;
    const selectedExtensions = await promptForExtensions(action);
    if (!selectedExtensions) return {};

    return {
        currentDir,
        currentFileNameWithoutExt,
        selectedExtensions,
        workspacePath,
    };
}

async function promptForExtensions(action: string) {
    const config = vscode.workspace.getConfiguration("fileOrchestrator");
    const defaultExtensions = config.get<string[]>("defaultExtensions") || [];
    const customExtensionLists =
        config.get<{ [key: string]: string[] }>("customExtensionLists") || {};

    const extensionLists: { [key: string]: string[] } = {
        Default: defaultExtensions,
        ...customExtensionLists,
    };

    let quickPickItems: { label: string; description: string }[];

    if (action === "create") {
        // For create action, show all extension lists
        quickPickItems = Object.entries(extensionLists).map(
            ([name, extensions]) => ({
                label: name,
                description: extensions.join(", "),
            })
        );
    } else {
        // For other actions, filter based on active file's extension
        const activeEditor = vscode.window.activeTextEditor;
        const activeFileExtension = activeEditor
            ? path.extname(activeEditor.document.fileName)
            : "";

        const filteredExtensionLists = Object.entries(extensionLists).filter(
            ([_, extensions]) => extensions.includes(activeFileExtension)
        );

        if (filteredExtensionLists.length === 0) {
            vscode.window.showWarningMessage(
                `No extension lists found containing ${activeFileExtension}. Command aborted.`
            );
            return undefined;
        }

        quickPickItems = filteredExtensionLists.map(([name, extensions]) => ({
            label: name,
            description: extensions.join(", "),
        }));
    }

    const selectedItem = await vscode.window.showQuickPick(quickPickItems, {
        placeHolder: `Select extension list to ${action}`,
        matchOnDescription: true,
    });

    return selectedItem ? extensionLists[selectedItem.label] : undefined;
}

async function promptForNewFileName(action: string, currentName = "") {
    return vscode.window.showInputBox({
        prompt: `Enter new file name to ${action}`,
        value: currentName,
        validateInput: (value) => {
            if (
                !value ||
                (action !== "move" &&
                    action !== "create" &&
                    value === currentName)
            ) {
                return `Please enter a new file name to ${action}`;
            }
            return null;
        },
    });
}

async function promptForTargetDirectory(basePath: string, defaultValue = "") {
    const userInput = await vscode.window.showInputBox({
        prompt: "Enter target directory",
        value: `${basePath}`,
    });

    if (userInput === undefined) {
        return undefined;
    }

    return userInput;
}

async function processFile(
    action: string,
    oldPath: string | undefined,
    newPath: string | undefined,
    workspacePath: string
) {
    try {
        switch (action) {
            case "rename":
            case "move":
                await vscode.workspace.fs.rename(
                    vscode.Uri.file(oldPath!),
                    vscode.Uri.file(newPath!)
                );
                break;
            case "copy":
                await vscode.workspace.fs.copy(
                    vscode.Uri.file(oldPath!),
                    vscode.Uri.file(newPath!),
                    { overwrite: false }
                );
                break;
            case "delete":
                await vscode.workspace.fs.delete(vscode.Uri.file(oldPath!));
                break;
            case "create":
                await vscode.workspace.fs.writeFile(
                    vscode.Uri.file(newPath!),
                    new Uint8Array()
                );
                break;
        }
        const actionPastTense = action === "copy" ? "copied" : `${action}d`;
        vscode.window.showInformationMessage(
            `File ${actionPastTense}: ${oldPath ? path.basename(oldPath) : ""}${
                newPath ? ` -> ${path.relative(workspacePath, newPath)}` : ""
            }`
        );
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to ${action} file: ${error}`);
    }
}

function getRelatedFiles(
    dir: string,
    baseName: string,
    extensions: string[]
): string[] {
    return fs.readdirSync(dir).filter((file) => {
        const { name, ext } = path.parse(file);
        return name === baseName && extensions.includes(ext);
    });
}

async function bulkReplace() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage("No active editor found");
        return;
    }

    const selection = editor.selection;
    const searchPattern = editor.document.getText(selection);
    if (!searchPattern) {
        vscode.window.showErrorMessage("Please select text to replace");
        return;
    }

    const {
        currentDir,
        currentFileNameWithoutExt,
        selectedExtensions,
        workspacePath,
    } = await getCommonInfo("bulk replace");
    if (!currentDir) return;

    const replacePattern = await vscode.window.showInputBox({
        prompt: `Enter replace pattern for "${searchPattern}"`,
        placeHolder: searchPattern,
        value: searchPattern,
    });
    if (replacePattern === undefined) return;

    const filesToProcess = getRelatedFiles(
        currentDir,
        currentFileNameWithoutExt!,
        selectedExtensions
    );

    let replacedCount = 0;
    for (const file of filesToProcess) {
        const filePath = path.join(currentDir, file);
        replacedCount += await replaceInFile(
            filePath,
            searchPattern,
            replacePattern
        );
    }

    vscode.window.showInformationMessage(
        `Bulk replace completed. ${replacedCount} occurrences replaced.`
    );
}

async function replaceInFile(
    filePath: string,
    search: string,
    replace: string
): Promise<number> {
    const document = await vscode.workspace.openTextDocument(filePath);
    const text = document.getText();
    const regex = new RegExp(search, "g");
    const newText = text.replace(regex, replace);
    const replacedCount = (text.match(regex) || []).length;

    if (replacedCount > 0) {
        const edit = new vscode.WorkspaceEdit();
        edit.replace(
            document.uri,
            new vscode.Range(0, 0, document.lineCount, 0),
            newText
        );
        await vscode.workspace.applyEdit(edit);
        await document.save();
    }

    return replacedCount;
}

export function deactivate() {}
