import { CommandsProvider } from './commandsView';
import { RelatedFilesProvider } from './relatedFilesView';
import { showPreview, PreviewItem } from './previewDialog';
import { SearchCacheManager } from './searchCache';
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

// Global search cache manager
let searchCacheManager: SearchCacheManager;

export function activate(context: vscode.ExtensionContext) {
    // Initialize search cache manager
    searchCacheManager = new SearchCacheManager();
    context.subscriptions.push(searchCacheManager);

    // Listen for configuration changes to update cache settings
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('fileOrchestrator.enableCache')) {
                searchCacheManager.updateConfiguration();
            }
        })
    );

    // Register Commands view
    const commandsProvider = new CommandsProvider();
    vscode.window.registerTreeDataProvider('fileOrchestrator.commandsView', commandsProvider);

    const relatedFilesProvider = new RelatedFilesProvider();
    vscode.window.registerTreeDataProvider('fileOrchestrator.relatedFilesView', relatedFilesProvider);
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
        { name: "openAllRelatedFiles", action: openAllRelatedFiles },
        { name: "setActiveExtensionGroup", action: setActiveExtensionGroup },
    ];

    commands.forEach(({ name, action }) => {
        const command = vscode.commands.registerCommand(
            `file-orchestrator.${name}`,
            action
        );
        context.subscriptions.push(command);
    });

    async function openAllRelatedFiles(uri?: vscode.Uri) {
        const {
            currentDir,
            currentFileNameWithoutExt,
            selectedExtensions,
            workspacePath,
        } = await getCommonInfo("open all", uri);
        if (!currentDir) return;

        const relatedFileUris = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Searching for related files...",
            cancellable: false
        }, async () => {
            return await getRelatedFilesAdvanced(
                currentFileNameWithoutExt!,
                selectedExtensions,
                currentDir,
                workspacePath!
            );
        });

        if (relatedFileUris.length === 0) {
            vscode.window.showInformationMessage("No related files found.");
            return;
        }

        let targetColumn = vscode.ViewColumn.Beside;
        let firstEditor: vscode.TextEditor | undefined;
        for (let i = 0; i < relatedFileUris.length; i++) {
            const fileUri = relatedFileUris[i];
            try {
                const document = await vscode.workspace.openTextDocument(fileUri);
                if (i === 0) {
                    const editor: vscode.TextEditor = await vscode.window.showTextDocument(document, { preview: false, preserveFocus: true, viewColumn: targetColumn });
                    firstEditor = editor;
                    targetColumn = editor.viewColumn ?? vscode.ViewColumn.Three;
                } else {
                    await vscode.window.showTextDocument(document, { preview: false, preserveFocus: true, viewColumn: targetColumn });
                }
            } catch (err) {
                vscode.window.showWarningMessage(`Failed to open ${path.basename(fileUri.fsPath)}: ${err}`);
            }
        }
    }

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

async function setActiveExtensionGroup() {
    const config = vscode.workspace.getConfiguration("fileOrchestrator");
    const customExtensionGroups = config.get<{ [key: string]: string[] }>("customExtensionGroups") || {};
    const defaultExtensions = config.get<string[]>("defaultExtensions") || [];
    const options = [
        { label: "Default", description: defaultExtensions.join(", ") },
        ...Object.keys(customExtensionGroups).map(key => ({ label: key, description: customExtensionGroups[key].join(", ") }))
    ];
    const selected = await vscode.window.showQuickPick(options, {
        placeHolder: "Select the active extension group for file operations"
    });
    if (selected) {
        await config.update("activeExtensionGroup", selected.label, vscode.ConfigurationTarget.Workspace);
        vscode.window.showInformationMessage(`Active extension group set to: ${selected.label}`);
    }
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

async function renameFiles(uri?: vscode.Uri) {
    const commonInfo = await getCommonInfo("rename", uri);
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

    const relatedFileUris = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Searching for related files...",
        cancellable: false
    }, async () => {
        return await getRelatedFilesAdvanced(
            currentFileNameWithoutExt!,
            selectedExtensions!,
            currentDir!,
            workspacePath!
        );
    });

    // Create preview items
    const previewItems: PreviewItem[] = relatedFileUris.map((fileUri) => ({
        oldPath: fileUri.fsPath,
        newPath: path.join(path.dirname(fileUri.fsPath), `${newFileName}${path.extname(fileUri.fsPath)}`),
        action: "rename",
    }));

    // Show preview and get confirmation
    const confirmed = await showPreview(previewItems, "Rename");
    if (!confirmed) return;

    // Execute the rename operation
    for (const fileUri of relatedFileUris) {
        const oldPath = fileUri.fsPath;
        const newPath = path.join(
            path.dirname(fileUri.fsPath),
            `${newFileName}${path.extname(fileUri.fsPath)}`
        );
        await processFile("rename", oldPath, newPath, workspacePath!);
    }
}

async function copyFiles(uri?: vscode.Uri) {
    const {
        currentDir,
        currentFileNameWithoutExt,
        selectedExtensions,
        workspacePath,
    } = await getCommonInfo("copy", uri);
    if (!currentDir) return;

    const newFileName = await promptForNewFileName(
        "copy",
        currentFileNameWithoutExt
    );
    if (!newFileName) return;

    const relatedFileUris = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Searching for related files...",
        cancellable: false
    }, async () => {
        return await getRelatedFilesAdvanced(
            currentFileNameWithoutExt!,
            selectedExtensions,
            currentDir,
            workspacePath
        );
    });

    for (const fileUri of relatedFileUris) {
        const oldPath = fileUri.fsPath;
        const newPath = path.join(
            path.dirname(fileUri.fsPath),
            `${newFileName}${path.extname(fileUri.fsPath)}`
        );
        await processFile("copy", oldPath, newPath, workspacePath);
    }
}

async function deleteFiles(uri?: vscode.Uri) {
    const {
        currentDir,
        currentFileNameWithoutExt,
        selectedExtensions,
        workspacePath,
    } = await getCommonInfo("delete", uri);
    if (!currentDir) return;

    const relatedFileUris = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Searching for related files...",
        cancellable: false
    }, async () => {
        return await getRelatedFilesAdvanced(
            currentFileNameWithoutExt!,
            selectedExtensions,
            currentDir,
            workspacePath
        );
    });

    // Create preview items
    const previewItems: PreviewItem[] = relatedFileUris.map((fileUri) => ({
        oldPath: fileUri.fsPath,
        action: "delete",
    }));

    // Show preview and get confirmation
    const confirmed = await showPreview(previewItems, "Delete");
    if (!confirmed) return;

    // Execute the delete operation
    for (const fileUri of relatedFileUris) {
        await processFile("delete", fileUri.fsPath, undefined, workspacePath);
    }
}

async function moveFiles(uri?: vscode.Uri) {
    const {
        currentDir,
        currentFileNameWithoutExt,
        selectedExtensions,
        workspacePath,
    } = await getCommonInfo("move", uri);
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

    const relatedFileUris = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Searching for related files...",
        cancellable: false
    }, async () => {
        return await getRelatedFilesAdvanced(
            currentFileNameWithoutExt!,
            selectedExtensions,
            currentDir,
            workspacePath
        );
    });

    // Create preview items
    const previewItems: PreviewItem[] = relatedFileUris.map((fileUri) => ({
        oldPath: fileUri.fsPath,
        newPath: path.join(targetDir, `${newFileName}${path.extname(fileUri.fsPath)}`),
        action: "move",
    }));

    // Show preview and get confirmation
    const confirmed = await showPreview(previewItems, "Move");
    if (!confirmed) return;

    // Execute the move operation
    for (const fileUri of relatedFileUris) {
        const oldPath = fileUri.fsPath;
        const newPath = path.join(
            targetDir,
            `${newFileName}${path.extname(fileUri.fsPath)}`
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

async function jumpToRelatedFile(uri?: vscode.Uri) {
    const {
        currentDir,
        currentFileNameWithoutExt,
        selectedExtensions,
        workspacePath,
    } = await getCommonInfo("jump to", uri);
    if (!currentDir) return;

    const relatedFileUris = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Searching for related files...",
        cancellable: false
    }, async () => {
        return await getRelatedFilesAdvanced(
            currentFileNameWithoutExt!,
            selectedExtensions,
            currentDir,
            workspacePath
        );
    });

    if (relatedFileUris.length === 0) {
        vscode.window.showInformationMessage("No related files found.");
        return;
    }

    // Get the current file's relative path
    const currentFile = uri?.fsPath ?? vscode.window.activeTextEditor?.document.uri.fsPath;
    const currentRelativePath = currentFile
        ? path.relative(workspacePath, currentFile)
        : "Unknown";

    // Get search scope for display
    const config = vscode.workspace.getConfiguration('fileOrchestrator');
    const searchScope = config.get<string>('searchScope', 'workspace');
    const scopeLabel = searchScope === 'sameDirectory' ? 'same directory' : searchScope === 'workspace' ? 'workspace' : 'custom paths';

    const items = relatedFileUris.map((fileUri) => {
        const relativePath = path.relative(workspacePath, fileUri.fsPath);
        const relativeDir = path.dirname(relativePath);
        const isSameDir = path.dirname(fileUri.fsPath) === currentDir;

        return {
            label: path.basename(fileUri.fsPath),
            description: isSameDir ? path.extname(fileUri.fsPath) : `$(folder) ${relativeDir}`,
            detail: relativePath,
            uri: fileUri
        };
    });

    const selectedFile = await vscode.window.showQuickPick(items, {
        placeHolder: `Select a file to jump to (from ${currentRelativePath}) - Searching in: ${scopeLabel}`,
        matchOnDescription: true,
        matchOnDetail: true,
    });

    if (selectedFile) {
        const document = await vscode.workspace.openTextDocument(selectedFile.uri);
        await vscode.window.showTextDocument(document);
    }
}

async function getCommonInfo(action: string, uri?: vscode.Uri) {
    let currentDir: string | undefined;
    let currentFileNameWithoutExt: string | undefined;
    let workspaceFolder: vscode.WorkspaceFolder | undefined;

    if (action !== "create") {
        // If URI is provided (from context menu), use that; otherwise use active editor
        let currentFilePath: string;
        if (uri) {
            currentFilePath = uri.fsPath;
            workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        } else {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage(`No active file to ${action}`);
                return {};
            }
            currentFilePath = editor.document.uri.fsPath;
            workspaceFolder = vscode.workspace.getWorkspaceFolder(
                editor.document.uri
            );
        }

        currentDir = path.dirname(currentFilePath);
        currentFileNameWithoutExt = path.parse(
            path.basename(currentFilePath)
        ).name;
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
    const customExtensionGroups = config.get<{ [key: string]: string[] }>("customExtensionGroups") || {};
    const activeGroup = config.get<string>("activeExtensionGroup") || "default";

    if (activeGroup === "default") {
        return defaultExtensions;
    }
    if (customExtensionGroups[activeGroup]) {
        return customExtensionGroups[activeGroup];
    }
    vscode.window.showWarningMessage(`Extension group '${activeGroup}' not found. Using default extensions.`);
    return defaultExtensions;
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
            `File ${actionPastTense}: ${oldPath ? path.basename(oldPath) : ""}${newPath ? ` -> ${path.relative(workspacePath, newPath)}` : ""
            }`
        );
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to ${action} file: ${error}`);
    }
}

/**
 * Legacy synchronous function for same-directory search
 * Used as fallback for 'sameDirectory' search scope
 */
function getRelatedFilesSync(
    dir: string,
    baseName: string,
    extensions: string[]
): string[] {
    return fs.readdirSync(dir).filter((file) => {
        const { name, ext } = path.parse(file);
        return name === baseName && extensions.includes(ext);
    });
}

/**
 * Advanced cross-directory search for related files
 * Supports workspace-wide search with caching and performance optimizations
 */
async function getRelatedFilesAdvanced(
    baseName: string,
    extensions: string[],
    currentDir: string,
    workspacePath: string
): Promise<vscode.Uri[]> {
    const config = vscode.workspace.getConfiguration('fileOrchestrator');
    const searchScope = config.get<string>('searchScope', 'workspace');
    const enableCache = config.get<boolean>('enableCache', true);
    const searchTimeout = config.get<number>('searchTimeout', 5000);
    const excludePatterns = config.get<string[]>('searchExclude', []);
    const customSearchPaths = config.get<string[]>('customSearchPaths', []);

    // Check cache first
    if (enableCache) {
        const cached = searchCacheManager.get(baseName, extensions, searchScope);
        if (cached) {
            return cached;
        }
    }

    // For same directory scope, use legacy sync function
    if (searchScope === 'sameDirectory') {
        const files = getRelatedFilesSync(currentDir, baseName, extensions);
        const uris = files.map(file => vscode.Uri.file(path.join(currentDir, file)));
        if (enableCache) {
            searchCacheManager.set(baseName, extensions, searchScope, uris);
        }
        return uris;
    }

    // Build search patterns for workspace or custom paths
    const patterns = extensions.map(ext => `**/${baseName}${ext}`);
    const includePattern = patterns.length === 1 ? patterns[0] : `{${patterns.join(',')}}`;
    const excludePattern = excludePatterns.length > 0 ? `{${excludePatterns.join(',')}}` : undefined;

    // Create a promise that will timeout
    const timeoutPromise = new Promise<vscode.Uri[]>((_, reject) => {
        setTimeout(() => reject(new Error('Search timeout')), searchTimeout);
    });

    try {
        let searchPromise: Promise<vscode.Uri[]>;

        if (searchScope === 'customPaths' && customSearchPaths.length > 0) {
            // Search in custom paths
            const customPatterns = customSearchPaths.flatMap(customPath =>
                extensions.map(ext => `${customPath}/${baseName}${ext}`)
            );
            const customIncludePattern = customPatterns.length === 1 ? customPatterns[0] : `{${customPatterns.join(',')}}`;
            searchPromise = Promise.resolve(vscode.workspace.findFiles(customIncludePattern, excludePattern));
        } else {
            // Workspace-wide search
            searchPromise = Promise.resolve(vscode.workspace.findFiles(includePattern, excludePattern));
        }

        // Race between search and timeout
        const files = await Promise.race([searchPromise, timeoutPromise]);

        // Cache the results
        if (enableCache) {
            searchCacheManager.set(baseName, extensions, searchScope, files);
        }

        return files;
    } catch (error) {
        if (error instanceof Error && error.message === 'Search timeout') {
            vscode.window.showWarningMessage(
                `File search timed out after ${searchTimeout}ms. Try reducing search scope or increasing timeout in settings.`
            );
        }
        // Fallback to same directory search
        const files = getRelatedFilesSync(currentDir, baseName, extensions);
        return files.map(file => vscode.Uri.file(path.join(currentDir, file)));
    }
}

/**
 * Unified wrapper for getting related files
 * Automatically chooses between sync and async search based on configuration
 */
function getRelatedFiles(
    dir: string,
    baseName: string,
    extensions: string[]
): string[] {
    // For backward compatibility, this function remains synchronous
    // and only works for same-directory search
    return getRelatedFilesSync(dir, baseName, extensions);
}

async function bulkReplace(uri?: vscode.Uri) {
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
    } = await getCommonInfo("bulk replace", uri);
    if (!currentDir) return;

    const replacePattern = await vscode.window.showInputBox({
        prompt: `Enter replace pattern for "${searchPattern}"`,
        placeHolder: searchPattern,
        value: searchPattern,
    });
    if (replacePattern === undefined) return;

    const relatedFileUris = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Searching for related files...",
        cancellable: false
    }, async () => {
        return await getRelatedFilesAdvanced(
            currentFileNameWithoutExt!,
            selectedExtensions,
            currentDir,
            workspacePath
        );
    });

    let replacedCount = 0;
    for (const fileUri of relatedFileUris) {
        replacedCount += await replaceInFile(
            fileUri.fsPath,
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

export function deactivate() { }
