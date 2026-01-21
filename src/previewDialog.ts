import * as vscode from "vscode";
import * as path from "path";

export interface PreviewItem {
    oldPath: string;
    newPath?: string;
    action: "rename" | "move" | "copy" | "delete";
}

/**
 * Show a preview dialog for file operations
 * @param items List of items to preview
 * @param operation Name of the operation (e.g., "Rename", "Delete")
 * @returns true if user confirmed, false if canceled
 */
export async function showPreview(
    items: PreviewItem[],
    operation: string
): Promise<boolean> {
    if (items.length === 0) {
        return false;
    }

    // Create quick pick items
    const quickPickItems = items.map((item) => {
        let label: string;
        let description: string;
        let detail: string;

        const oldFileName = path.basename(item.oldPath);

        switch (item.action) {
            case "rename":
            case "move":
                const newFileName = item.newPath
                    ? path.basename(item.newPath)
                    : "";
                label = `$(file) ${oldFileName}`;
                description = `→ ${newFileName}`;
                detail = item.newPath ? path.dirname(item.newPath) : "";
                break;
            case "copy":
                const copyFileName = item.newPath
                    ? path.basename(item.newPath)
                    : "";
                label = `$(copy) ${oldFileName}`;
                description = `→ ${copyFileName}`;
                detail = item.newPath ? path.dirname(item.newPath) : "";
                break;
            case "delete":
                label = `$(trash) ${oldFileName}`;
                description = "";
                detail = path.dirname(item.oldPath);
                break;
        }

        return {
            label,
            description,
            detail,
            picked: true,
        };
    });

    // Show quick pick
    const result = await vscode.window.showQuickPick(quickPickItems, {
        canPickMany: true,
        placeHolder: `Preview: ${operation} ${items.length} file(s)`,
        title: `${operation} Files - Preview`,
        ignoreFocusOut: true,
    });

    // If user canceled or didn't select any items
    if (!result || result.length === 0) {
        vscode.window.showInformationMessage(
            `${operation} operation canceled.`
        );
        return false;
    }

    // If user deselected some items, show warning
    if (result.length < items.length) {
        const proceed = await vscode.window.showWarningMessage(
            `You selected ${result.length} of ${items.length} files. Proceed with partial ${operation.toLowerCase()}?`,
            "Yes",
            "No"
        );
        if (proceed !== "Yes") {
            return false;
        }
    }

    // Confirm the operation
    const actionWord =
        operation === "Delete"
            ? "delete"
            : operation.toLowerCase();
    const confirmation = await vscode.window.showWarningMessage(
        `Are you sure you want to ${actionWord} ${result.length} file(s)?`,
        { modal: true },
        "Confirm",
        "Cancel"
    );

    return confirmation === "Confirm";
}

/**
 * Show a simple confirmation dialog
 */
export async function showConfirmation(
    message: string,
    detail?: string
): Promise<boolean> {
    const result = await vscode.window.showWarningMessage(
        message,
        { modal: true, detail },
        "Confirm",
        "Cancel"
    );
    return result === "Confirm";
}
