# File Orchestrator

File Orchestrator is a powerful VS Code extension that simplifies file management operations for related files in your projects. It allows you to rename, copy, move, delete, and create files while automatically handling associated files with different extensions.

## Features

-   **Rename Files**: Rename a file and all its related files with different extensions.
-   **Copy Files**: Create copies of a file and its related files.
-   **Move Files**: Move a file and its related files to a different directory, with an option to rename.
-   **Delete Files**: Remove a file and all its related files.
-   **Create Files**: Create new files with specified extensions in a chosen directory.
-   **Jump to Related Files**: Quickly navigate between related files.
-   **Bulk Replace**: Perform string replacements across related files.
-   **Open All Related Files in New Group**: Open all related files as tabs in a new editor group (horizontal split).
-   **Customizable Extension Groups**: Define and use custom groups of related file extensions for different project types.
-   **Related Files Sidebar**: View and open all related files for the current file in a dedicated sidebar panel.
-   **Commands Sidebar**: Trigger all File Orchestrator commands directly from a sidebar panel.

## Installation

1. Open VS Code
2. Go to the Extensions view
3. Search for "File Orchestrator"
4. Click Install

## Usage

### Side Bar Panels

File Orchestrator adds a dedicated sidebar (activity bar) with two panels:

-   **Related Files**: Shows all files related to the currently focused file. Click to open any related file.
-   **Commands**: Lists all File Orchestrator commands. Click to trigger any command directly.

### Commands

File Orchestrator adds the following commands to the Command Palette (Ctrl+Shift+P or Cmd+Shift+P):

-   `File Orchestrator: Rename File`
-   `File Orchestrator: Copy File`
-   `File Orchestrator: Move File`
-   `File Orchestrator: Delete File`
-   `File Orchestrator: Create File`
-   `File Orchestrator: Jump To Related File`
-   `File Orchestrator: String Replace In Related Files`
-   `File Orchestrator: Open All Related Files`

### Workflow

1. Open a file in the editor.
2. Run one of the File Orchestrator commands, or trigger a command directly from the Commands sidebar panel.
3. The extension group (default or custom) will be applied automatically. You can switch the active group via the sidebar or command palette.
4. Follow the prompts to complete the operation.

### Extension Lists

File Orchestrator uses extension groups to determine which related files to include in operations. You can configure these groups in your VS Code settings.

#### Default Extensions

Set the default extensions in your `settings.json`:

```json
{
    "fileOrchestrator.defaultExtensions": [
        ".cpp",
        ".hpp",
        ".cxx",
        ".hxx",
        ".c",
        ".h"
    ]
}
```

#### Custom Extension Lists

Define custom extension groups for different project types:

```json
{
    "fileOrchestrator.customExtensionGroups": {
        "Qt-Cpp": [".cpp", ".hpp", ".cxx", ".hxx", ".c", ".h", ".ui"]
    }
}
```

### Keyboard Shortcuts

You can configure a custom keyboard shortcut for the "Jump To Related File" command:

```json
{
    "fileOrchestrator.jumpToRelatedFileShortcut": "alt+p"
}
```

## Examples

### Renaming Related Files

1. Open `MyComponent.cpp`
2. Run `File Orchestrator: Rename File`
3. Enter the new name, e.g., "NewComponent"
4. The extension will rename:
    - `MyComponent.cpp` to `NewComponent.cpp`
    - `MyComponent.hpp` to `NewComponent.hpp`
    - `MyComponent.ui` to `NewComponent.ui`

### Moving Related Files

1. Open `OldComponent.vue`
2. Run `File Orchestrator: Move File`
3. Enter the target directory (relative to workspace root)
4. Choose whether to rename the file

### Jumping to Related Files

1. Open a file, e.g., `Component.cpp`
2. Press `Alt+P` (or your configured shortcut)
3. Select the related file from the quick pick menu

### Bulk Replace in Related Files

1. Select the text you want to replace in the active file
2. Run `File Orchestrator: String Replace In Related Files`
3. Enter the replacement text
4. The extension will perform the replacement in all related files

### Open All Related Files in a New Group

1. Open any file you want to use as the base.
2. Run `File Orchestrator: Open All Related Files`.
3. All related files will be opened as tabs in a new horizontal editor group, making it easy to compare and edit them side by side.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This extension is licensed under the MIT License.
