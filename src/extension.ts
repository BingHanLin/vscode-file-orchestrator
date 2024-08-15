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
    ];

    commands.forEach(({ name, action }) => {
        const command = vscode.commands.registerCommand(
            `file-orchestrator.${name}`,
            action
        );
        context.subscriptions.push(command);
    });
}

async function renameFiles() {
    const {
        currentDir,
        currentFileNameWithoutExt,
        selectedExtensions,
        workspacePath,
    } = await getCommonInfo();
    if (!currentDir) return;

    const newFileName = await promptForNewFileName(
        "rename",
        currentFileNameWithoutExt
    );
    if (!newFileName) return;

    const filesToProcess = getRelatedFiles(
        currentDir,
        currentFileNameWithoutExt,
        selectedExtensions
    );

    for (const file of filesToProcess) {
        const oldPath = path.join(currentDir, file);
        const newPath = path.join(
            currentDir,
            `${newFileName}${path.extname(file)}`
        );
        await processFile("rename", oldPath, newPath, workspacePath);
    }
}

async function copyFiles() {
    const {
        currentDir,
        currentFileNameWithoutExt,
        selectedExtensions,
        workspacePath,
    } = await getCommonInfo();
    if (!currentDir) return;

    const newFileName = await promptForNewFileName(
        "copy",
        currentFileNameWithoutExt
    );
    if (!newFileName) return;

    const filesToProcess = getRelatedFiles(
        currentDir,
        currentFileNameWithoutExt,
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
    } = await getCommonInfo();
    if (!currentDir) return;

    const filesToProcess = getRelatedFiles(
        currentDir,
        currentFileNameWithoutExt,
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
    } = await getCommonInfo();
    if (!currentDir) return;

    const newFileName = await promptForNewFileName(
        "move",
        currentFileNameWithoutExt
    );
    if (!newFileName) return;

    const targetDir = await promptForTargetDirectory(
        workspacePath,
        path.relative(workspacePath, currentDir)
    );
    if (!targetDir) return;

    const filesToProcess = getRelatedFiles(
        currentDir,
        currentFileNameWithoutExt,
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
    const { selectedExtensions, workspacePath } = await getCommonInfo(true);

    const newFileName = await promptForNewFileName("create");
    if (!newFileName) return;

    const targetDir = await promptForTargetDirectory(workspacePath);
    if (!targetDir) return;

    for (const ext of selectedExtensions) {
        const newPath = path.join(targetDir, `${newFileName}${ext}`);
        await processFile("create", undefined, newPath, workspacePath);
    }
}

async function getCommonInfo(isCreate = false) {
    let currentDir: string | undefined;
    let currentFileNameWithoutExt: string | undefined;
    let workspaceFolder: vscode.WorkspaceFolder | undefined;

    if (!isCreate) {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage("No active file");
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
    const selectedExtensions = await promptForExtensions();
    if (!selectedExtensions) return {};

    return {
        currentDir,
        currentFileNameWithoutExt,
        selectedExtensions,
        workspacePath,
    };
}

async function promptForExtensions() {
    const config = vscode.workspace.getConfiguration("fileOrchestrator");
    const defaultExtensions = config.get<string[]>("defaultExtensions") || [];
    const customExtensionLists =
        config.get<{ [key: string]: string[] }>("customExtensionLists") || {};

    const extensionLists: { [key: string]: string[] } = {
        Default: defaultExtensions,
        ...customExtensionLists,
    };

    const quickPickItems = Object.entries(extensionLists).map(
        ([name, extensions]) => ({
            label: name,
            description: extensions.join(", "),
        })
    );

    const selectedItem = await vscode.window.showQuickPick(quickPickItems, {
        placeHolder: "Select extension list to apply",
        matchOnDescription: true,
    });

    return selectedItem ? extensionLists[selectedItem.label] : undefined;
}

async function promptForNewFileName(action: string, currentName = "") {
    return vscode.window.showInputBox({
        prompt: `Enter new file name to ${action}`,
        value: currentName,
        validateInput: (value) => {
            if (!value) return `Please enter a new file name to ${action}`;
            if (
                action !== "move" &&
                action !== "create" &&
                value === currentName
            ) {
                return `Please enter a new file name to ${action}`;
            }
            return null;
        },
    });
}

async function promptForTargetDirectory(
    workspacePath: string,
    defaultValue = ""
) {
    return vscode.window.showInputBox({
        prompt: "Enter target directory (relative to workspace root)",
        value: defaultValue,
        validateInput: (value) => {
            const absolutePath = path.join(workspacePath, value);
            return fs.existsSync(absolutePath)
                ? null
                : "Directory does not exist";
        },
    });
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

export function deactivate() {}
