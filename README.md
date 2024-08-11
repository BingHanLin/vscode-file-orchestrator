# File Orchestrator

File Orchestrator is a powerful VS Code extension that simplifies file management operations for related files in your projects. It allows you to rename, copy, move, and delete files while automatically handling associated files with different extensions.

## Features

-   **Rename Files**: Rename a file and all its related files with different extensions.
-   **Copy Files**: Create copies of a file and its related files.
-   **Move Files**: Move a file and its related files to a different directory, with an option to rename.
-   **Delete Files**: Remove a file and all its related files.
-   **Customizable Extension Lists**: Define and use custom lists of related file extensions.

## Installation

1. Open VS Code
2. Go to the Extensions view (Ctrl+Shift+X or Cmd+Shift+X)
3. Search for "File Orchestrator"
4. Click Install

## Usage

### Commands

File Orchestrator adds the following commands to the Command Palette (Ctrl+Shift+P or Cmd+Shift+P):

-   `File Orchestrator: Rename File`
-   `File Orchestrator: Copy File`
-   `File Orchestrator: Move File`
-   `File Orchestrator: Delete File`

### Workflow

1. Open a file in the editor.
2. Run one of the File Orchestrator commands.
3. Select the extension list to apply (Default or custom lists).
4. Follow the prompts to complete the operation.

### Extension Lists

File Orchestrator uses extension lists to determine which related files to include in operations. You can configure these lists in your VS Code settings.

#### Default Extensions

Set the default extensions in your `settings.json`:

```json
{
    "fileOrchestrator.defaultExtensions": [".js", ".ts", ".css", ".html"]
}
```

#### Custom Extension Lists

Define custom extension lists for different project types:

```json
{
    "fileOrchestrator.customExtensionLists": {
        "React": [".js", ".jsx", ".ts", ".tsx", ".css"],
        "Vue": [".vue", ".js", ".ts", ".css"]
    }
}
```

## Examples

### Renaming a React Component

1. Open `MyComponent.tsx`
2. Run `File Orchestrator: Rename File`
3. Select the "React" extension list
4. Enter the new name, e.g., "NewComponent"
5. The extension will rename:
    - `MyComponent.tsx` to `NewComponent.tsx`
    - `MyComponent.css` to `NewComponent.css`
    - `MyComponent.test.js` to `NewComponent.test.js`

### Moving a Vue Component

1. Open `OldComponent.vue`
2. Run `File Orchestrator: Move File`
3. Select the "Vue" extension list
4. Enter the target directory (relative to workspace root)
5. Choose whether to rename the file
6. The extension will move:
    - `OldComponent.vue`
    - `OldComponent.js`
    - `OldComponent.css`

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This extension is licensed under the [MIT License](LICENSE).
